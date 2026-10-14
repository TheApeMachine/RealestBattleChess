import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import confetti from 'canvas-confetti';
import {
  AttackInput,
  BattleLogEntry,
  BoardCoord,
  ChessPiece,
  CombatCallout,
  Faction,
  FighterRuntime,
  GamePhase,
  MoveOption,
  PieceType,
} from './types/game';
import { ARCHETYPES } from './data/archetypes';
import {
  chooseAIMove,
  createInitialBoard,
  formatSquareName,
  getPieceAt,
  getValidMovesForPiece,
} from './engine/chessEngine';
import {
  createFighterRuntime,
  stepCombatSimulation,
  triggerFighterAttack,
  triggerFighterDash,
  triggerFighterJump,
  updateFighterAI,
} from './engine/combatEngine';
import { createArticulatedPiece, ArticulatedPieceRig } from './three/pieceModels';
import {
  boardToWorld,
  createBoardArena,
  BoardArenaRig,
} from './three/arenaBuilder';
import {
  animateFighterRig,
  createVFXPool,
  spawnHitSparks,
  spawnShockwave,
  updateVFXPool,
  VFXPool,
} from './three/combatAnimator';
import { soundEngine } from './audio/soundEngine';
import { CombatHudOverlay } from './components/CombatHudOverlay';
import { CodexModal } from './components/CodexModal';
import { Volume2, VolumeX, Swords, RotateCcw, Eye, Sparkles } from 'lucide-react';

// Pre-allocated math helpers at module scope (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

type CameraPreset = 'white_orbit' | 'top_tactical' | 'cinematic_angle';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // React UI state synchronized with mutable engine ref
  const [phase, setPhase] = useState<GamePhase>('CHESS_VIEW');
  const [turnFaction, setTurnFaction] = useState<Faction>('w');
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [gameMode, setGameMode] = useState<'vs_ai' | 'pvp'>('vs_ai');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('white_orbit');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [codexOpen, setCodexOpen] = useState<boolean>(false);

  const [selectedPiece, setSelectedPiece] = useState<ChessPiece | null>(null);
  const [hoveredCaptureMove, setHoveredCaptureMove] = useState<MoveOption | null>(null);
  const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([
    {
      id: 'init',
      turnNumber: 1,
      summary: 'Sanctuary Board Initialized',
      detail: 'Select any Solaris (Gold/White) piece to advance, or initiate a Capture Clash to enter the 3D Fighting Arena.',
      wasUpset: false,
      winnerFaction: 'w',
    },
  ]);

  // HUD snapshot state during combat
  const [hudAttacker, setHudAttacker] = useState<FighterRuntime | null>(null);
  const [hudDefender, setHudDefender] = useState<FighterRuntime | null>(null);
  const [fightTimer, setFightTimer] = useState<number>(60);
  const [duelSquareName, setDuelSquareName] = useState<string>('E4');
  const [callouts, setCallouts] = useState<CombatCallout[]>([]);
  const [koBanner, setKoBanner] = useState<{
    title: string;
    subtitle: string;
    wasUpset: boolean;
  } | null>(null);
  const [warVictor, setWarVictor] = useState<{
    faction: Faction;
    reason: string;
  } | null>(null);

  // Mutable simulation state stored in ref so WebGL loop never tears down
  const simRef = useRef<{
    phase: GamePhase;
    phaseTimer: number;
    turnFaction: Faction;
    turnNumber: number;
    gameMode: 'vs_ai' | 'pvp';
    cameraPreset: CameraPreset;
    pieces: ChessPiece[];
    selectedPieceId: string | null;
    validMoves: MoveOption[];
    pendingMove: MoveOption | null;
    isExhibitionDuel: boolean;
    exhibitionTempRigs: ArticulatedPieceRig[];
    attackerRuntime: FighterRuntime | null;
    defenderRuntime: FighterRuntime | null;
    duelCenterWorld: THREE.Vector3;
    fightTimer: number;
    cameraShake: number;
    keysHeld: Record<string, boolean>;
    pieceRigs: Map<string, ArticulatedPieceRig>;
    arenaRig: BoardArenaRig | null;
    vfxPool: VFXPool | null;
    controls: OrbitControls | null;
    currentLookAt: THREE.Vector3;
  }>({
    phase: 'CHESS_VIEW',
    phaseTimer: 0,
    turnFaction: 'w',
    turnNumber: 1,
    gameMode: 'vs_ai',
    cameraPreset: 'white_orbit',
    pieces: createInitialBoard(),
    selectedPieceId: null,
    validMoves: [],
    pendingMove: null,
    isExhibitionDuel: false,
    exhibitionTempRigs: [],
    attackerRuntime: null,
    defenderRuntime: null,
    duelCenterWorld: new THREE.Vector3(0, 0, 0),
    fightTimer: 60,
    cameraShake: 0,
    keysHeld: {},
    pieceRigs: new Map(),
    arenaRig: null,
    vfxPool: null,
    controls: null,
    currentLookAt: new THREE.Vector3(0, 0.4, 0),
  });

  const addCallout = useCallback((c: Omit<CombatCallout, 'id' | 'createdAt'>) => {
    const item: CombatCallout = {
      ...c,
      id: Date.now() + Math.random(),
      createdAt: performance.now(),
    };
    setCallouts((prev) => [...prev.slice(-3), item]);
  }, []);

  // Sync tile highlight meshes with current selected piece & valid moves
  const syncBoardHighlights = useCallback(() => {
    const sim = simRef.current;
    if (!sim.arenaRig) return;

    sim.arenaRig.highlightMeshes.forEach((mesh) => {
      mesh.visible = false;
    });

    if (sim.phase !== 'CHESS_VIEW') return;

    const selPiece = sim.pieces.find((p) => p.id === sim.selectedPieceId) || null;
    setSelectedPiece(selPiece ? { ...selPiece } : null);

    if (selPiece) {
      const selMesh = sim.arenaRig.highlightMeshes.get(`${selPiece.row}_${selPiece.col}`);
      if (selMesh) {
        selMesh.visible = true;
        const mat = selMesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(0x38bdf8);
        mat.opacity = 0.55;
      }

      for (const mv of sim.validMoves) {
        const hl = sim.arenaRig.highlightMeshes.get(`${mv.to.row}_${mv.to.col}`);
        if (hl) {
          hl.visible = true;
          const mat = hl.material as THREE.MeshBasicMaterial;
          if (mv.isCapture) {
            mat.color.setHex(0xf43f5e);
            mat.opacity = 0.68;
          } else {
            mat.color.setHex(0xf59e0b);
            mat.opacity = 0.42;
          }
        }
      }
    }
  }, []);

  // Start a capture duel on the board
  const initiateCombatDuel = useCallback(
    (attackerPiece: ChessPiece, move: MoveOption, isExhibition: boolean = false) => {
      const sim = simRef.current;
      if (!move.targetPiece) return;

      const defenderPiece = move.targetPiece;
      sim.pendingMove = move;
      sim.isExhibitionDuel = isExhibition;
      sim.selectedPieceId = null;
      sim.validMoves = [];
      setHoveredCaptureMove(null);
      syncBoardHighlights();

      // Calculate world center of the contested square
      boardToWorld(move.to.row, move.to.col, sim.duelCenterWorld);
      const sqName = formatSquareName(move.to);
      setDuelSquareName(sqName);

      // Determine AI flags: in vs_ai mode, Black ('b') is AI, White ('w') is Player
      const atkIsAI = sim.gameMode === 'vs_ai' && attackerPiece.faction === 'b';
      const defIsAI = sim.gameMode === 'vs_ai' && defenderPiece.faction === 'b';

      sim.attackerRuntime = createFighterRuntime(attackerPiece, true, atkIsAI);
      sim.defenderRuntime = createFighterRuntime(defenderPiece, false, defIsAI);
      sim.fightTimer = 60;
      sim.phase = 'TRANSITION_TO_FIGHT';
      sim.phaseTimer = 0;

      if (sim.controls) {
        sim.controls.enabled = false;
      }

      soundEngine.playArenaTransition();
      setPhase('TRANSITION_TO_FIGHT');
      setCallouts([]);
      setKoBanner(null);
      setHudAttacker({ ...sim.attackerRuntime });
      setHudDefender({ ...sim.defenderRuntime });
    },
    [syncBoardHighlights]
  );

  // Execute a non-capture chess move or trigger a capture duel
  const executeChessMove = useCallback(
    (piece: ChessPiece, move: MoveOption) => {
      const sim = simRef.current;

      if (move.isCapture && move.targetPiece) {
        initiateCombatDuel(piece, move, false);
        return;
      }

      // Standard non-capture positional move
      soundEngine.playChessMove();
      piece.row = move.to.row;
      piece.col = move.to.col;
      piece.hasMoved = true;
      piece.meter = Math.min(100, piece.meter + 8); // Moving builds +8% tactical meter

      // Check Pawn Promotion on reaching far rank
      if (move.isPromotion && piece.type === 'p') {
        piece.type = 'q';
        piece.maxHp = ARCHETYPES.q.maxHp;
        piece.hp = ARCHETYPES.q.maxHp;
        // Rebuild 3D rig as a Queen
        const oldRig = sim.pieceRigs.get(piece.id);
        if (oldRig && oldRig.root.parent) {
          const parent = oldRig.root.parent;
          parent.remove(oldRig.root);
          const newRig = createArticulatedPiece('q', piece.faction);
          boardToWorld(piece.row, piece.col, newRig.root.position);
          newRig.root.rotation.y = piece.faction === 'w' ? Math.PI : 0;
          parent.add(newRig.root);
          sim.pieceRigs.set(piece.id, newRig);
        }
      }

      sim.selectedPieceId = null;
      sim.validMoves = [];
      syncBoardHighlights();

      const nextFaction: Faction = sim.turnFaction === 'w' ? 'b' : 'w';
      sim.turnFaction = nextFaction;
      sim.turnNumber += 1;
      setTurnFaction(nextFaction);
      setTurnNumber(sim.turnNumber);

      // If vs AI and it's now Black's turn, schedule AI move
      if (sim.gameMode === 'vs_ai' && nextFaction === 'b') {
        setTimeout(() => {
          const currentSim = simRef.current;
          if (currentSim.phase !== 'CHESS_VIEW' || currentSim.turnFaction !== 'b') return;
          const aiDecision = chooseAIMove(currentSim.pieces, 'b');
          if (aiDecision) {
            executeChessMove(aiDecision.piece, aiDecision.move);
          }
        }, 650);
      }
    },
    [initiateCombatDuel, syncBoardHighlights]
  );

  // Instant Exhibition Duel (e.g., Queen vs Pawn or Pawn vs Queen) from anywhere
  const handleLaunchExhibitionDuel = useCallback(
    (attackerType: PieceType, defenderType: PieceType) => {
      const sim = simRef.current;
      // Clean up any prior exhibition rigs
      for (const rig of sim.exhibitionTempRigs) {
        rig.root.parent?.remove(rig.root);
      }
      sim.exhibitionTempRigs = [];

      // Try to find an actual matchup on the board first, or spawn an exhibition clash at E4 (row 4, col 4)
      const atkSpec = ARCHETYPES[attackerType];
      const defSpec = ARCHETYPES[defenderType];

      const tempAtk: ChessPiece = {
        id: `exhib_w_${Date.now()}`,
        type: attackerType,
        faction: 'w',
        row: 4,
        col: 3,
        hp: atkSpec.maxHp,
        maxHp: atkSpec.maxHp,
        meter: 45,
        kills: 0,
        hasMoved: true,
      };

      const tempDef: ChessPiece = {
        id: `exhib_b_${Date.now()}`,
        type: defenderType,
        faction: 'b',
        row: 4,
        col: 4,
        hp: defSpec.maxHp,
        maxHp: defSpec.maxHp,
        meter: 45,
        kills: 0,
        hasMoved: true,
      };

      if (sim.arenaRig) {
        const scene = sim.arenaRig.group.parent;
        if (scene) {
          const rigA = createArticulatedPiece(attackerType, 'w');
          const rigB = createArticulatedPiece(defenderType, 'b');
          boardToWorld(4, 3, rigA.root.position);
          boardToWorld(4, 4, rigB.root.position);
          scene.add(rigA.root, rigB.root);
          sim.pieceRigs.set(tempAtk.id, rigA);
          sim.pieceRigs.set(tempDef.id, rigB);
          sim.exhibitionTempRigs.push(rigA, rigB);
        }
      }

      const exhibMove: MoveOption = {
        from: { row: 4, col: 3 },
        to: { row: 4, col: 4 },
        isCapture: true,
        targetPiece: tempDef,
      };

      initiateCombatDuel(tempAtk, exhibMove, true);
    },
    [initiateCombatDuel]
  );

  // Trigger an immediate canonical board clash (e.g. Queen tries to take a Pawn, or Pawn challenges Queen!)
  const handleTriggerFeaturedBoardClash = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase !== 'CHESS_VIEW') return;

    // Look for any available capture move on the board first
    for (const p of sim.pieces.filter((x) => x.faction === sim.turnFaction)) {
      const moves = getValidMovesForPiece(p, sim.pieces);
      const cap = moves.find((m) => m.isCapture && m.targetPiece);
      if (cap) {
        executeChessMove(p, cap);
        return;
      }
    }

    // If no pieces are currently in capture range (e.g. Turn 1), advance an Obsidian Queen & Solaris Pawn into D4/E5 and clash!
    const whitePawn = sim.pieces.find((p) => p.faction === 'w' && p.type === 'p');
    const blackQueen = sim.pieces.find((p) => p.faction === 'b' && p.type === 'q');

    if (whitePawn && blackQueen) {
      whitePawn.row = 4;
      whitePawn.col = 4;
      blackQueen.row = 3;
      blackQueen.col = 3;

      // In this scenario, the Obsidian Queen (or Solaris Pawn) initiates the capture!
      // Let's let the human player control the Solaris Pawn defending against the attacking Obsidian Queen (or attacking her)!
      const move: MoveOption = {
        from: { row: 4, col: 4 },
        to: { row: 3, col: 3 },
        isCapture: true,
        targetPiece: blackQueen,
      };
      initiateCombatDuel(whitePawn, move, false);
    }
  }, [executeChessMove, initiateCombatDuel]);

  // Reset full game
  const handleResetGame = useCallback(() => {
    const sim = simRef.current;
    const scene = sim.arenaRig?.group.parent;

    // Remove existing piece meshes
    sim.pieceRigs.forEach((rig) => {
      rig.root.parent?.remove(rig.root);
    });
    sim.pieceRigs.clear();
    sim.exhibitionTempRigs = [];

    const freshPieces = createInitialBoard();
    sim.pieces = freshPieces;
    sim.phase = 'CHESS_VIEW';
    sim.turnFaction = 'w';
    sim.turnNumber = 1;
    sim.selectedPieceId = null;
    sim.validMoves = [];
    sim.pendingMove = null;
    sim.attackerRuntime = null;
    sim.defenderRuntime = null;

    if (scene) {
      for (const p of freshPieces) {
        const rig = createArticulatedPiece(p.type, p.faction);
        boardToWorld(p.row, p.col, rig.root.position);
        rig.root.rotation.y = p.faction === 'w' ? Math.PI : 0;
        scene.add(rig.root);
        sim.pieceRigs.set(p.id, rig);
      }
    }

    if (sim.controls) {
      sim.controls.enabled = true;
    }

    syncBoardHighlights();
    setPhase('CHESS_VIEW');
    setTurnFaction('w');
    setTurnNumber(1);
    setWarVictor(null);
    setKoBanner(null);
    setBattleLogs([
      {
        id: `reset_${Date.now()}`,
        turnNumber: 1,
        summary: 'New Campaign Initialized',
        detail: 'All 32 warriors restored to full vitality.',
        wasUpset: false,
        winnerFaction: 'w',
      },
    ]);
  }, [syncBoardHighlights]);

  // Player combat input handler (works for both Keyboard and On-Screen Arcade Buttons)
  const handlePlayerCombatInput = useCallback(
    (
      action:
        | 'left'
        | 'right'
        | 'jump'
        | 'block_down'
        | 'block_up'
        | 'dash_fwd'
        | 'dash_back'
        | AttackInput
    ) => {
      const sim = simRef.current;
      if (sim.phase !== 'FIGHT_ACTIVE') return;
      const atk = sim.attackerRuntime;
      const def = sim.defenderRuntime;
      if (!atk || !def) return;

      const human = !atk.isAI ? atk : !def.isAI ? def : atk;

      if (action === 'L' || action === 'H' || action === 'S') {
        triggerFighterAttack(human, action, addCallout);
      } else if (action === 'jump') {
        triggerFighterJump(human);
      } else if (action === 'block_down') {
        if (human.action !== 'block') {
          human.lastBlockPressTime = performance.now();
        }
        human.action = 'block';
        human.vx = 0;
      } else if (action === 'block_up') {
        if (human.action === 'block') {
          human.action = 'idle';
        }
      } else if (action === 'dash_fwd') {
        triggerFighterDash(human, true);
      } else if (action === 'dash_back') {
        triggerFighterDash(human, false);
      } else if (action === 'left') {
        human.vx = -human.spec.walkSpeed;
        human.action = human.facing === -1 ? 'walk_fwd' : 'walk_back';
      } else if (action === 'right') {
        human.vx = human.spec.walkSpeed;
        human.action = human.facing === 1 ? 'walk_fwd' : 'walk_back';
      }
    },
    [addCallout]
  );

  // Initialize Three.js Scene, Studio Lighting, Board, Pieces, and Animation Loop
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b10);
    scene.fog = new THREE.FogExp2(0x090b10, 0.022);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      150
    );
    camera.position.set(0, 11.5, 11.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // WebGL context loss safety listeners
    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // Studio Environment Map (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3-Point Studio Lighting Rig + Warm/Cool Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    keyLight.position.set(9, 16, 10);
    keyLight.castShadow = !isHeadless;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 38;
    const d = 10.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
    rimLight.position.set(-10, 9, -11);
    scene.add(rimLight);

    const warmFill = new THREE.PointLight(0xf59e0b, 1.4, 24);
    warmFill.position.set(0, 6, 0);
    scene.add(warmFill);

    // OrbitControls for Chess View
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minDistance = 5.5;
    controls.maxDistance = 24;
    controls.target.set(0, 0.3, 0);
    simRef.current.controls = controls;

    // Build 3D Chessboard & Duel Colosseum Arena
    const arenaRig = createBoardArena(renderer);
    scene.add(arenaRig.group);
    simRef.current.arenaRig = arenaRig;

    // Build Combat VFX Pool
    const vfxPool = createVFXPool();
    scene.add(vfxPool.group);
    simRef.current.vfxPool = vfxPool;

    // Populate all 32 articulated 3D chess warriors
    const sim = simRef.current;
    sim.pieceRigs.clear();
    for (const piece of sim.pieces) {
      const rig = createArticulatedPiece(piece.type, piece.faction);
      boardToWorld(piece.row, piece.col, rig.root.position);
      rig.root.rotation.y = piece.faction === 'w' ? Math.PI : 0;
      scene.add(rig.root);
      sim.pieceRigs.set(piece.id, rig);
    }

    // Pre-warm shaders
    renderer.compile(scene, camera);

    // Raycasting for Chessboard Clicks & Hover Preview
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const getBoardCoordsFromEvent = (ev: PointerEvent): BoardCoord | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const flatTiles = arenaRig.tiles.flat();
      const hits = raycaster.intersectObjects(flatTiles, false);
      if (hits.length > 0) {
        const { row, col } = hits[0].object.userData as { row: number; col: number };
        return { row, col };
      }

      // Also check clicking directly on a piece mesh
      for (const [pieceId, rig] of sim.pieceRigs.entries()) {
        const pieceHits = raycaster.intersectObject(rig.root, true);
        if (pieceHits.length > 0) {
          const piece = sim.pieces.find((p) => p.id === pieceId);
          if (piece) return { row: piece.row, col: piece.col };
        }
      }
      return null;
    };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (sim.phase !== 'CHESS_VIEW' || sim.validMoves.length === 0) return;
      const coord = getBoardCoordsFromEvent(ev);
      if (!coord) {
        setHoveredCaptureMove(null);
        return;
      }
      const matchMove = sim.validMoves.find(
        (m) => m.to.row === coord.row && m.to.col === coord.col && m.isCapture
      );
      setHoveredCaptureMove(matchMove || null);
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (sim.phase !== 'CHESS_VIEW') return;
      // Ignore if dragging camera
      const dragDist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
      if (dragDist > 8) return;

      // In vs_ai mode, only allow selecting White on White's turn
      if (sim.gameMode === 'vs_ai' && sim.turnFaction === 'b') return;

      const coord = getBoardCoordsFromEvent(ev);
      if (!coord) return;

      // 1. Check if clicked square is a valid move for currently selected piece
      if (sim.selectedPieceId) {
        const activePiece = sim.pieces.find((p) => p.id === sim.selectedPieceId);
        const chosenMove = sim.validMoves.find(
          (m) => m.to.row === coord.row && m.to.col === coord.col
        );
        if (activePiece && chosenMove) {
          executeChessMove(activePiece, chosenMove);
          return;
        }
      }

      // 2. Otherwise select friendly piece on that square
      const clickedPiece = getPieceAt(sim.pieces, coord.row, coord.col);
      if (clickedPiece && clickedPiece.faction === sim.turnFaction) {
        soundEngine.playChessSelect();
        sim.selectedPieceId = clickedPiece.id;
        sim.validMoves = getValidMovesForPiece(clickedPiece, sim.pieces);
        syncBoardHighlights();
      } else {
        sim.selectedPieceId = null;
        sim.validMoves = [];
        syncBoardHighlights();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Keyboard Event Listeners for Real-Time Combat & Shortcut 'H'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }

      sim.keysHeld[e.code] = true;

      if (sim.phase !== 'FIGHT_ACTIVE') return;
      const atk = sim.attackerRuntime;
      const def = sim.defenderRuntime;
      if (!atk || !def) return;

      const human = !atk.isAI ? atk : !def.isAI ? def : atk;

      if (e.code === 'KeyJ' || e.code === 'KeyZ') {
        triggerFighterAttack(human, 'L', addCallout);
      } else if (e.code === 'KeyK' || e.code === 'KeyX') {
        triggerFighterAttack(human, 'H', addCallout);
      } else if (e.code === 'KeyU' || e.code === 'KeyC' || e.code === 'Enter') {
        triggerFighterAttack(human, 'S', addCallout);
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
        triggerFighterJump(human);
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        if (!e.repeat && human.action !== 'block') {
          human.lastBlockPressTime = performance.now();
        }
        human.action = 'block';
        human.vx = 0;
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') {
        const forward =
          sim.keysHeld['KeyA'] || sim.keysHeld['ArrowLeft']
            ? human.facing === -1
            : sim.keysHeld['KeyD'] || sim.keysHeld['ArrowRight']
            ? human.facing === 1
            : true;
        triggerFighterDash(human, forward);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      sim.keysHeld[e.code] = false;
      if (sim.phase !== 'FIGHT_ACTIVE') return;
      const atk = sim.attackerRuntime;
      const def = sim.defenderRuntime;
      if (!atk || !def) return;
      const human = !atk.isAI ? atk : !def.isAI ? def : atk;

      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        if (human.action === 'block') {
          human.action = 'idle';
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Resize Handler
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Master Animation Loop
    const clock = new THREE.Clock();
    let animFrameId = 0;
    let hudSyncAccumulator = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const rawDelta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const nowMs = performance.now();

      updateVFXPool(vfxPool, rawDelta);

      // Update Phase Machine
      if (sim.phase === 'CHESS_VIEW') {
        // Smoothly restore duel ring below board
        arenaRig.duelRingGroup.position.y = THREE.MathUtils.damp(
          arenaRig.duelRingGroup.position.y,
          -2.5,
          6,
          rawDelta
        );
        (arenaRig.duelBarrierMesh.material as THREE.MeshBasicMaterial).opacity =
          THREE.MathUtils.damp(
            (arenaRig.duelBarrierMesh.material as THREE.MeshBasicMaterial).opacity,
            0,
            8,
            rawDelta
          );

        // Smoothly position all pieces on their chess squares
        for (const piece of sim.pieces) {
          const rig = sim.pieceRigs.get(piece.id);
          if (!rig) continue;

          boardToWorld(piece.row, piece.col, _vec3A);
          rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, _vec3A.x, 10, rawDelta);
          rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, 0, 10, rawDelta);
          rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, _vec3A.z, 10, rawDelta);
          rig.root.scale.setScalar(THREE.MathUtils.damp(rig.root.scale.x, 1.0, 8, rawDelta));

          const targetYaw = piece.faction === 'w' ? Math.PI : 0;
          rig.root.rotation.y = THREE.MathUtils.damp(rig.root.rotation.y, targetYaw, 8, rawDelta);

          // Subtle idle breathing on board
          rig.bodyPivot.rotation.x = Math.sin(elapsed * 2.2 + piece.col) * 0.03;
          rig.bodyPivot.rotation.y = 0;
          rig.bodyPivot.rotation.z = 0;
          rig.rightArmPivot.rotation.set(-0.1, 0, 0);
          rig.leftArmPivot.rotation.set(-0.08, 0, 0);

          if (piece.type === 'q') {
            rig.specialOrbitGroup.rotation.y += rawDelta * 1.6;
            rig.specialOrbitGroup.scale.setScalar(1.0);
          }

          // Update HP ring opacity based on selection or damage
          const isSelected = piece.id === sim.selectedPieceId;
          const ringMat = rig.hpRingMesh.material as THREE.MeshBasicMaterial;
          ringMat.opacity = isSelected ? 0.95 : piece.hp < piece.maxHp ? 0.7 : 0.35;
        }

        controls.update();
      } else if (
        sim.phase === 'TRANSITION_TO_FIGHT' ||
        sim.phase === 'FIGHT_INTRO' ||
        sim.phase === 'FIGHT_ACTIVE' ||
        sim.phase === 'FIGHT_OUTRO'
      ) {
        const atk = sim.attackerRuntime;
        const def = sim.defenderRuntime;

        if (atk && def) {
          sim.phaseTimer += rawDelta;

          // Advance phase transitions smoothly
          if (sim.phase === 'TRANSITION_TO_FIGHT' && sim.phaseTimer >= 0.95) {
            sim.phase = 'FIGHT_INTRO';
            sim.phaseTimer = 0;
            setPhase('FIGHT_INTRO');
          } else if (sim.phase === 'FIGHT_INTRO' && sim.phaseTimer >= 1.1) {
            sim.phase = 'FIGHT_ACTIVE';
            sim.phaseTimer = 0;
            setPhase('FIGHT_ACTIVE');
          }

          // Elevate Duel Colosseum Ring around the contested square
          arenaRig.duelRingGroup.position.x = sim.duelCenterWorld.x;
          arenaRig.duelRingGroup.position.z = sim.duelCenterWorld.z;
          arenaRig.duelRingGroup.position.y = THREE.MathUtils.damp(
            arenaRig.duelRingGroup.position.y,
            0.0,
            7,
            rawDelta
          );
          (arenaRig.duelBarrierMesh.material as THREE.MeshBasicMaterial).opacity =
            THREE.MathUtils.damp(
              (arenaRig.duelBarrierMesh.material as THREE.MeshBasicMaterial).opacity,
              0.12,
              5,
              rawDelta
            );

          // Sink non-combatant chess pieces smoothly below the board so the Duel Stage is 100% clear
          for (const piece of sim.pieces) {
            if (piece.id === atk.piece.id || piece.id === def.piece.id) continue;
            const rig = sim.pieceRigs.get(piece.id);
            if (!rig) continue;
            rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, -2.2, 8, rawDelta);
          }

          // Step Active Combat Simulation
          if (sim.phase === 'FIGHT_ACTIVE') {
            sim.fightTimer = Math.max(0, sim.fightTimer - rawDelta);

            // Process held movement keys for human player
            const human = !atk.isAI ? atk : !def.isAI ? def : atk;
            if (
              human.action === 'idle' ||
              human.action === 'walk_fwd' ||
              human.action === 'walk_back'
            ) {
              const leftHeld = sim.keysHeld['KeyA'] || sim.keysHeld['ArrowLeft'];
              const rightHeld = sim.keysHeld['KeyD'] || sim.keysHeld['ArrowRight'];
              if (leftHeld && !rightHeld) {
                human.vx = -human.spec.walkSpeed;
                human.action = human.facing === -1 ? 'walk_fwd' : 'walk_back';
              } else if (rightHeld && !leftHeld) {
                human.vx = human.spec.walkSpeed;
                human.action = human.facing === 1 ? 'walk_fwd' : 'walk_back';
              } else {
                human.vx = 0;
                human.action = 'idle';
              }
            }

            // Update AI fighter(s)
            if (atk.isAI) updateFighterAI(atk, def, rawDelta, nowMs, addCallout);
            if (def.isAI) updateFighterAI(def, atk, rawDelta, nowMs, addCallout);

            const stepEvents = stepCombatSimulation(atk, def, rawDelta, nowMs, addCallout);
            if (stepEvents.cameraShake > 0) {
              sim.cameraShake = Math.max(sim.cameraShake, stepEvents.cameraShake);
            }
            if (stepEvents.sparkWorldPos) {
              const worldX = sim.duelCenterWorld.x + stepEvents.sparkWorldPos.x * 0.75;
              const worldY = stepEvents.sparkWorldPos.y;
              const worldZ = sim.duelCenterWorld.z;
              spawnHitSparks(vfxPool, worldX, worldY, worldZ, stepEvents.sparkWorldPos.color, 12);
              if (stepEvents.cameraShake >= 0.25) {
                spawnShockwave(vfxPool, worldX, 0.05, worldZ, stepEvents.sparkWorldPos.color, 4.5);
              }
            }

            // Check K.O. or Time Out!
            if (atk.hp <= 0 || def.hp <= 0 || sim.fightTimer <= 0) {
              const attackerWon =
                def.hp <= 0 || (atk.hp > 0 && atk.hp / atk.maxHp >= def.hp / def.maxHp);
              const winner = attackerWon ? atk : def;
              const loser = attackerWon ? def : atk;

              winner.action = 'victory';
              loser.action = 'defeat';
              sim.phase = 'FIGHT_OUTRO';
              sim.phaseTimer = 0;
              setPhase('FIGHT_OUTRO');
              soundEngine.playKO();
              spawnShockwave(
                vfxPool,
                sim.duelCenterWorld.x + loser.x * 0.75,
                0.05,
                sim.duelCenterWorld.z,
                0xf59e0b,
                7.5
              );

              const wasUpset =
                winner.spec.tacticalValue < loser.spec.tacticalValue || !attackerWon;

              if (wasUpset) {
                confetti({
                  particleCount: 70,
                  spread: 65,
                  origin: { y: 0.6 },
                });
              }

              setKoBanner({
                title: attackerWon
                  ? `${atk.spec.warriorTitle} Claims the Square!`
                  : `UPSET! Defending ${def.spec.chessName} Repels & Destroys ${atk.spec.chessName}!`,
                subtitle: wasUpset
                  ? `Tactical Upset: Value ${winner.spec.tacticalValue} ${winner.spec.chessName} defeated Value ${loser.spec.tacticalValue} ${loser.spec.chessName}!`
                  : `${winner.spec.chessName} survives with ${winner.hp} HP.`,
                wasUpset,
              });
            }
          } else if (sim.phase === 'FIGHT_OUTRO' && sim.phaseTimer >= 2.3) {
            // Resolve Duel Outcome on the Chessboard!
            const attackerWon =
              def.hp <= 0 || (atk.hp > 0 && atk.hp / atk.maxHp >= def.hp / def.maxHp);

            if (sim.isExhibitionDuel) {
              // Remove temporary exhibition rigs
              for (const rig of sim.exhibitionTempRigs) {
                rig.root.parent?.remove(rig.root);
              }
              sim.exhibitionTempRigs = [];
            } else if (sim.pendingMove) {
              const winnerRuntime = attackerWon ? atk : def;
              const loserRuntime = attackerWon ? def : atk;

              // Remove defeated piece from the board & scene (even if it was the Attacker!)
              sim.pieces = sim.pieces.filter((p) => p.id !== loserRuntime.piece.id);
              const loserRig = sim.pieceRigs.get(loserRuntime.piece.id);
              if (loserRig) {
                loserRig.root.parent?.remove(loserRig.root);
                sim.pieceRigs.delete(loserRuntime.piece.id);
              }

              // Update surviving piece stats (+15% victorious adrenaline heal)
              const survivorPiece = sim.pieces.find((p) => p.id === winnerRuntime.piece.id);
              if (survivorPiece) {
                const adrenalineHeal = Math.round(survivorPiece.maxHp * 0.15);
                survivorPiece.hp = Math.min(
                  survivorPiece.maxHp,
                  Math.max(12, winnerRuntime.hp + adrenalineHeal)
                );
                survivorPiece.meter = Math.min(100, winnerRuntime.meter + 15);
                survivorPiece.kills += 1;

                if (attackerWon) {
                  survivorPiece.row = sim.pendingMove.to.row;
                  survivorPiece.col = sim.pendingMove.to.col;
                  survivorPiece.hasMoved = true;

                  // Check Pawn Promotion after winning capture on back rank
                  if (
                    survivorPiece.type === 'p' &&
                    (survivorPiece.row === 0 || survivorPiece.row === 7)
                  ) {
                    survivorPiece.type = 'q';
                    survivorPiece.maxHp = ARCHETYPES.q.maxHp;
                    survivorPiece.hp = ARCHETYPES.q.maxHp;
                    const oldRig = sim.pieceRigs.get(survivorPiece.id);
                    if (oldRig && oldRig.root.parent) {
                      const parent = oldRig.root.parent;
                      parent.remove(oldRig.root);
                      const promotedRig = createArticulatedPiece('q', survivorPiece.faction);
                      parent.add(promotedRig.root);
                      sim.pieceRigs.set(survivorPiece.id, promotedRig);
                    }
                  }
                }
              }

              const sq = formatSquareName(sim.pendingMove.to);
              const wasUpset =
                !attackerWon ||
                winnerRuntime.spec.tacticalValue < loserRuntime.spec.tacticalValue;

              setBattleLogs((prev) => [
                {
                  id: `duel_${Date.now()}`,
                  turnNumber: sim.turnNumber,
                  summary: attackerWon
                    ? `${atk.spec.chessName} conquered ${def.spec.chessName} at ${sq}`
                    : `UPSET AT ${sq}: Defending ${def.spec.chessName} slew Attacking ${atk.spec.chessName}!`,
                  detail: `${winnerRuntime.spec.warriorTitle} survived with ${survivorPiece?.hp ?? winnerRuntime.hp} HP (${survivorPiece?.kills ?? 1} Kills).`,
                  wasUpset,
                  winnerFaction: winnerRuntime.piece.faction,
                },
                ...prev.slice(0, 7),
              ]);

              // Check if a King was slain (Regicide Victory!)
              if (loserRuntime.piece.type === 'k') {
                setWarVictor({
                  faction: winnerRuntime.piece.faction,
                  reason: `Regicide at Square ${sq}! ${winnerRuntime.spec.warriorTitle} defeated the Eternal Monarch in single combat.`,
                });
                confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
              }

              // Advance chess turn
              const nextFaction: Faction = sim.turnFaction === 'w' ? 'b' : 'w';
              sim.turnFaction = nextFaction;
              sim.turnNumber += 1;
              setTurnFaction(nextFaction);
              setTurnNumber(sim.turnNumber);

              // Trigger AI turn after returning to chessboard if vs_ai
              if (sim.gameMode === 'vs_ai' && nextFaction === 'b' && loserRuntime.piece.type !== 'k') {
                setTimeout(() => {
                  const currentSim = simRef.current;
                  if (currentSim.phase !== 'CHESS_VIEW' || currentSim.turnFaction !== 'b') return;
                  const aiDecision = chooseAIMove(currentSim.pieces, 'b');
                  if (aiDecision) {
                    executeChessMove(aiDecision.piece, aiDecision.move);
                  }
                }, 1100);
              }
            }

            // Transition smoothly back to Chessboard View
            sim.phase = 'CHESS_VIEW';
            sim.attackerRuntime = null;
            sim.defenderRuntime = null;
            sim.pendingMove = null;
            if (sim.controls) {
              sim.controls.enabled = true;
            }
            setPhase('CHESS_VIEW');
            setKoBanner(null);
            syncBoardHighlights();
          }

          // Position and animate the two dueling 3D rigs on the Duel Stage
          const fighterPairs: [FighterRuntime, ArticulatedPieceRig | undefined][] = [
            [atk, sim.pieceRigs.get(atk.piece.id)],
            [def, sim.pieceRigs.get(def.piece.id)],
          ];

          for (const [f, rig] of fighterPairs) {
            if (!rig) continue;
            const targetWorldX = sim.duelCenterWorld.x + f.x * 0.72;
            const targetWorldY = f.y * 0.72;
            const targetWorldZ = sim.duelCenterWorld.z;

            rig.root.position.x = THREE.MathUtils.damp(
              rig.root.position.x,
              targetWorldX,
              18,
              rawDelta
            );
            rig.root.position.y = THREE.MathUtils.damp(
              rig.root.position.y,
              targetWorldY,
              18,
              rawDelta
            );
            rig.root.position.z = THREE.MathUtils.damp(
              rig.root.position.z,
              targetWorldZ,
              14,
              rawDelta
            );

            // Scale fighters up slightly (1.42x) during combat for commanding presence
            rig.root.scale.setScalar(
              THREE.MathUtils.damp(rig.root.scale.x, 1.42, 8, rawDelta)
            );

            // Face opponent along X axis (+X = PI/2, -X = -PI/2)
            const targetFacingYaw = f.facing === 1 ? Math.PI / 2 : -Math.PI / 2;
            rig.root.rotation.y = THREE.MathUtils.damp(
              rig.root.rotation.y,
              targetFacingYaw,
              16,
              rawDelta
            );

            animateFighterRig(rig, f, elapsed, rawDelta);
          }

          // Smoothly glide camera to 2.5D Fighting Game Framing tracking midpoint & separation
          const midX = sim.duelCenterWorld.x + ((atk.x + def.x) * 0.5) * 0.72;
          const midY = 1.05 + Math.max(atk.y, def.y) * 0.25;
          const midZ = sim.duelCenterWorld.z;
          const sep = Math.abs(atk.x - def.x);
          const camDistZ = THREE.MathUtils.clamp(4.8 + sep * 0.52, 5.0, 8.6);

          _camTargetPos.set(midX, midY + 1.25, midZ + camDistZ);
          _camLookTarget.set(midX, midY, midZ);

          if (sim.cameraShake > 0) {
            _camTargetPos.x += (Math.random() - 0.5) * sim.cameraShake;
            _camTargetPos.y += (Math.random() - 0.5) * sim.cameraShake;
            sim.cameraShake = Math.max(0, sim.cameraShake - rawDelta * 1.8);
          }

          camera.position.lerp(_camTargetPos, 1 - Math.exp(-9 * rawDelta));
          sim.currentLookAt.lerp(_camLookTarget, 1 - Math.exp(-11 * rawDelta));
          camera.lookAt(sim.currentLookAt);

          // Throttle React HUD state updates to ~20fps for crisp bars without React overhead
          hudSyncAccumulator += rawDelta;
          if (hudSyncAccumulator >= 0.05) {
            hudSyncAccumulator = 0;
            setHudAttacker({ ...atk });
            setHudDefender({ ...def });
            setFightTimer(sim.fightTimer);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
    };
  }, [addCallout, executeChessMove, syncBoardHighlights]);

  // Update Camera Preset smoothly when switched in Chess View
  const handleSelectCameraPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    simRef.current.cameraPreset = preset;
    const controls = simRef.current.controls;
    if (!controls) return;
    const cam = controls.object as THREE.PerspectiveCamera;
    if (preset === 'white_orbit') {
      cam.position.set(0, 11.5, 11.5);
      controls.target.set(0, 0.3, 0);
    } else if (preset === 'top_tactical') {
      cam.position.set(0, 16.5, 2.2);
      controls.target.set(0, 0, 0);
    } else if (preset === 'cinematic_angle') {
      cam.position.set(-9.5, 7.5, 9.5);
      controls.target.set(0, 0.5, 0);
    }
    controls.update();
  };

  const toggleMute = () => {
    const next = !muted;
    soundEngine.muted = next;
    setMuted(next);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#090B10] text-slate-100 select-none">
      {/* 1. Strict 3-Zone Top Navigation Bar Contract */}
      <header className="relative z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#090B10] border-b border-slate-800/90">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
          }}
          className="font-display text-lg font-bold tracking-wider text-amber-400 whitespace-nowrap shrink-0"
        >
          CROWNBREAKER
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <button
            onClick={handleTriggerFeaturedBoardClash}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pawn vs Queen Clash
          </button>
          <button
            onClick={() => handleLaunchExhibitionDuel('q', 'p')}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Queen vs Pawn Duel
          </button>
          <button
            onClick={() => setCodexOpen(true)}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Combo Trees
          </button>
          <button
            onClick={handleResetGame}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reset Board
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCodexOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Warrior Codex & Duels
          </button>
        </div>
      </header>

      {/* 2. Isolated 3D WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 top-[53px] z-0 w-full h-[calc(100vh-53px)] cursor-grab active:cursor-grabbing"
      />

      {/* 3. Subtle Top-Left Tactical Status & Clash Preview (during CHESS_VIEW) */}
      {phase === 'CHESS_VIEW' && (
        <div className="pointer-events-none fixed top-[68px] left-6 z-20 flex flex-col gap-2 max-w-sm">
          <div className="bg-[#0B0E17]/95 border border-slate-800 rounded-xl px-4 py-3 shadow-xl">
            <div className="text-[11px] font-mono text-slate-400">
              TURN {turnNumber} · {gameMode === 'vs_ai' ? 'SOLO CAMPAIGN VS AI' : '2-PLAYER PASS & PLAY'}
            </div>
            <div className="font-display text-base font-bold text-white mt-0.5">
              {turnFaction === 'w' ? 'Solaris Order (White) to Move' : 'Obsidian Dominion (Black) to Move'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Click any piece to view legal moves. Capturing an enemy piece transitions smoothly into a 3D fighting duel!
            </div>
          </div>

          {/* Selected Piece Vitality & Archetype Card */}
          {selectedPiece && (
            <div className="bg-[#0B0E17]/95 border border-amber-500/40 rounded-xl px-4 py-3 shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono text-amber-400">
                <span>
                  {ARCHETYPES[selectedPiece.type].chessName.toUpperCase()} · VAL {ARCHETYPES[selectedPiece.type].tacticalValue}
                </span>
                <span className="tabular-nums">
                  {selectedPiece.hp}/{selectedPiece.maxHp} HP · {Math.round(selectedPiece.meter)}% METER
                </span>
              </div>
              <div className="font-display text-sm font-bold text-white mt-0.5">
                {ARCHETYPES[selectedPiece.type].warriorTitle}
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                Special: <span className="text-amber-300">{ARCHETYPES[selectedPiece.type].special.name}</span> ({ARCHETYPES[selectedPiece.type].special.meterCost}% Meter)
              </div>
            </div>
          )}

          {/* Hovering a Capture Target Preview */}
          {hoveredCaptureMove && hoveredCaptureMove.targetPiece && selectedPiece && (
            <div className="bg-[#0B0E17]/95 border border-rose-500/70 rounded-xl px-4 py-3 shadow-2xl">
              <div className="text-[11px] font-mono font-bold text-rose-400">
                IMMINENT DUEL AT SQUARE {formatSquareName(hoveredCaptureMove.to)}
              </div>
              <div className="font-display text-sm font-bold text-white mt-0.5">
                {ARCHETYPES[selectedPiece.type].chessName} ({selectedPiece.hp} HP) vs {ARCHETYPES[hoveredCaptureMove.targetPiece.type].chessName} ({hoveredCaptureMove.targetPiece.hp} HP)
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                Click red square to enter the 3D Colosseum. Even a Pawn can defeat a Queen with Parries and Underdog Valor!
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. K.O. / Upset Victory Banner Overlay */}
      {koBanner && (
        <div className="pointer-events-none fixed inset-x-0 top-1/3 z-30 flex justify-center px-4">
          <div className="bg-[#0B0E17]/95 border-2 border-amber-400 px-8 py-5 rounded-2xl text-center shadow-2xl max-w-xl">
            <div className="font-mono text-xs tracking-widest text-amber-400">
              {koBanner.wasUpset ? 'HISTORIC TACTICAL UPSET' : 'DUEL CONCLUDED'}
            </div>
            <div className="font-display text-2xl md:text-3xl font-extrabold text-white mt-1">
              {koBanner.title}
            </div>
            <div className="text-xs md:text-sm text-slate-300 mt-1.5">
              {koBanner.subtitle}
            </div>
          </div>
        </div>
      )}

      {/* 5. Campaign Victory Modal (Regicide) */}
      {warVictor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#0D111A] border border-amber-500/60 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="font-mono text-xs text-amber-400 tracking-widest">
              CROWNBREAKER VICTORY
            </div>
            <h2 className="font-display text-3xl font-extrabold text-white mt-2">
              {warVictor.faction === 'w' ? 'Solaris Order Triumphs' : 'Obsidian Dominion Triumphs'}
            </h2>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              {warVictor.reason}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={handleResetGame}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Play New Campaign
              </button>
              <button
                onClick={() => setWarVictor(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Inspect Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Real-Time Fighting Game HUD Overlay */}
      <CombatHudOverlay
        phase={phase}
        attacker={hudAttacker}
        defender={hudDefender}
        fightTimer={fightTimer}
        duelSquareName={duelSquareName}
        callouts={callouts}
        dockCollapsed={dockCollapsed}
        onToggleDock={() => setDockCollapsed((p) => !p)}
        onPlayerInput={handlePlayerCombatInput}
      />

      {/* 7. Unified Collapsible Bottom Control Dock (during CHESS_VIEW) */}
      {phase === 'CHESS_VIEW' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(940px,94vw)] flex flex-col items-center pointer-events-auto">
          <button
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="mb-1 px-3 py-1 text-xs font-mono text-slate-300 bg-[#0B0E17]/95 border border-slate-800 rounded-t-lg hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {dockCollapsed ? '▴ Show Tactical Dock & Instant Clash (H)' : '▾ Hide Controls (H)'}
          </button>

          {!dockCollapsed && (
            <div className="w-full bg-[#0B0E17]/95 border border-slate-800 rounded-xl px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-4">
              {/* Instant Clash & Exhibition Triggers */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerFeaturedBoardClash}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Immediately trigger a Pawn vs Queen capture duel on the board!"
                >
                  <Swords className="w-3.5 h-3.5" />
                  Instant Clash: Pawn vs Queen
                </button>
                <button
                  onClick={() => setCodexOpen(true)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Custom Matchup & Combos
                </button>
              </div>

              {/* Camera Angle Segmented Controls */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <Eye className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
                {(
                  [
                    ['white_orbit', 'Perspective'],
                    ['top_tactical', 'Top-Down'],
                    ['cinematic_angle', 'Flank View'],
                  ] as [CameraPreset, string][]
                ).map(([preset, label]) => (
                  <button
                    key={preset}
                    onClick={() => handleSelectCameraPreset(preset)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      cameraPreset === preset
                        ? 'bg-slate-800 text-amber-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Mode Switcher, Audio & Reset */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => {
                      setGameMode('vs_ai');
                      simRef.current.gameMode = 'vs_ai';
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      gameMode === 'vs_ai'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    vs AI
                  </button>
                  <button
                    onClick={() => {
                      setGameMode('pvp');
                      simRef.current.gameMode = 'pvp';
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      gameMode === 'pvp'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    2P Local
                  </button>
                </div>

                <button
                  onClick={toggleMute}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                  aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                  title={muted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={handleResetGame}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                  aria-label="Reset Match"
                  title="Reset Match"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Recent Battle Chronicle Strip */}
              {battleLogs.length > 0 && (
                <div className="w-full border-t border-slate-800/80 pt-2 flex items-center justify-between text-xs text-slate-400">
                  <div className="truncate">
                    <span className="font-mono text-amber-400 mr-2">
                      CHRONICLE:
                    </span>
                    <span className="text-slate-200 font-medium">
                      {battleLogs[0].summary}
                    </span>
                    <span className="mx-1.5">·</span>
                    <span>{battleLogs[0].detail}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 8. Warrior Codex & Custom Exhibition Duel Modal */}
      <CodexModal
        isOpen={codexOpen}
        onClose={() => setCodexOpen(false)}
        onLaunchExhibitionDuel={handleLaunchExhibitionDuel}
      />
    </div>
  );
}
