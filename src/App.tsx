import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import confetti from 'canvas-confetti';
import {
  AttackInput,
  BattleLogEntry,
  BoardCoord,
  ChessPiece,
  CombatCallout,
  Faction,
  FighterAction,
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
  spawnAuraPillar,
  spawnGroundDebris,
  spawnHitSparks,
  spawnShockwave,
  spawnSlashArc,
  updateVFXPool,
  VFXPool,
} from './three/combatAnimator';
import { soundEngine } from './audio/soundEngine';
import { CombatHudOverlay } from './components/CombatHudOverlay';
import { CodexModal } from './components/CodexModal';
import { Volume2, VolumeX, Swords, RotateCcw, Eye, Sparkles } from 'lucide-react';

// Pre-allocated math helpers at module scope (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

type CameraPreset = 'white_orbit' | 'top_tactical' | 'cinematic_angle';

interface BystanderPhysics {
  offsetX: number;
  offsetZ: number;
  vx: number;
  vz: number;
  y: number;
  vy: number;
  panickedTimer: number;
}

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
    prevAtkAction: FighterAction;
    prevDefAction: FighterAction;
    bystanders: Map<string, BystanderPhysics>;
    duelCenterWorld: THREE.Vector3;
    fightTimer: number;
    cameraShake: number;
    hitstopTimer: number;
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
    prevAtkAction: 'idle',
    prevDefAction: 'idle',
    bystanders: new Map(),
    duelCenterWorld: new THREE.Vector3(0, 0, 0),
    fightTimer: 60,
    cameraShake: 0,
    hitstopTimer: 0,
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
      sim.prevAtkAction = 'idle';
      sim.prevDefAction = 'idle';
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
      piece.meter = Math.min(100, piece.meter + 8);

      // Check Pawn Promotion on reaching far rank
      if (move.isPromotion && piece.type === 'p') {
        piece.type = 'q';
        piece.maxHp = ARCHETYPES.q.maxHp;
        piece.hp = ARCHETYPES.q.maxHp;
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

  // Instant Exhibition Duel from anywhere
  const handleLaunchExhibitionDuel = useCallback(
    (attackerType: PieceType, defenderType: PieceType) => {
      const sim = simRef.current;
      for (const rig of sim.exhibitionTempRigs) {
        rig.root.parent?.remove(rig.root);
      }
      sim.exhibitionTempRigs = [];

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

  // Trigger an immediate canonical board clash (e.g. Pawn vs Queen surrounded by lively spectator pieces!)
  const handleTriggerFeaturedBoardClash = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase !== 'CHESS_VIEW') return;

    for (const p of sim.pieces.filter((x) => x.faction === sim.turnFaction)) {
      const moves = getValidMovesForPiece(p, sim.pieces);
      const cap = moves.find((m) => m.isCapture && m.targetPiece);
      if (cap) {
        executeChessMove(p, cap);
        return;
      }
    }

    const whitePawn = sim.pieces.find((p) => p.faction === 'w' && p.type === 'p' && p.col === 4) ||
      sim.pieces.find((p) => p.faction === 'w' && p.type === 'p');
    const blackQueen = sim.pieces.find((p) => p.faction === 'b' && p.type === 'q');

    if (whitePawn && blackQueen) {
      whitePawn.row = 4;
      whitePawn.col = 4;
      blackQueen.row = 3;
      blackQueen.col = 3;

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

    sim.pieceRigs.forEach((rig) => {
      rig.root.parent?.remove(rig.root);
    });
    sim.pieceRigs.clear();
    sim.bystanders.clear();
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

  // Player combat input handler
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

  // Initialize Three.js Scene, Post-Processing Bloom, Studio & Cinematic Fight Lighting, Board, Pieces, and Loop
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);
    scene.fog = new THREE.FogExp2(0x07090e, 0.022);

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
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Post-Processing Composer with subtle HDR UnrealBloomPass
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isHeadless) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.44, // strength
        0.35, // radius
        0.8 // threshold
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // Studio Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3-Point Board Studio Lighting Rig (dims dramatically during fights so the SpotLights take center stage!)
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

    // Build 3D Chessboard, Cinematic Spotlights & Duel Colosseum Arena
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
    sim.bystanders.clear();
    for (const piece of sim.pieces) {
      const rig = createArticulatedPiece(piece.type, piece.faction);
      boardToWorld(piece.row, piece.col, rig.root.position);
      rig.root.rotation.y = piece.faction === 'w' ? Math.PI : 0;
      scene.add(rig.root);
      sim.pieceRigs.set(piece.id, rig);
      sim.bystanders.set(piece.id, {
        offsetX: 0,
        offsetZ: 0,
        vx: 0,
        vz: 0,
        y: 0,
        vy: 0,
        panickedTimer: 0,
      });
    }

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
      const dragDist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
      if (dragDist > 8) return;

      if (sim.gameMode === 'vs_ai' && sim.turnFaction === 'b') return;

      const coord = getBoardCoordsFromEvent(ev);
      if (!coord) return;

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

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
      if (bloomPass) bloomPass.resolution.set(w, h);
    };
    window.addEventListener('resize', onResize);

    // Helper to trigger 3D Slash Arcs & Aura Pillars when a fighter starts an attack
    const checkFighterActionVFX = (f: FighterRuntime, prevAction: FighterAction) => {
      if (f.action === prevAction) return;
      const worldX = sim.duelCenterWorld.x + f.x * 0.72;
      const worldY = 0.85 + f.y * 0.72;
      const worldZ = sim.duelCenterWorld.z;
      const colorHex = f.piece.faction === 'w' ? 0x38bdf8 : 0xf43f5e;

      if (f.action.startsWith('light')) {
        spawnSlashArc(vfxPool, worldX, worldY, worldZ, f.facing, colorHex, 'horizontal');
      } else if (f.action.startsWith('heavy')) {
        spawnSlashArc(vfxPool, worldX, worldY + 0.15, worldZ, f.facing, 0xf59e0b, 'overhead');
      } else if (f.action === 'combo_finisher') {
        spawnSlashArc(vfxPool, worldX, worldY, worldZ, f.facing, 0xfef08a, 'cyclone');
      } else if (f.action === 'special') {
        spawnAuraPillar(vfxPool, worldX, worldZ, 0xf59e0b);
        spawnSlashArc(vfxPool, worldX, worldY, worldZ, f.facing, 0xf59e0b, 'cyclone');
      } else if (f.action === 'parry_flash') {
        spawnAuraPillar(vfxPool, worldX, worldZ, 0xfef08a);
      }
    };

    // Master Animation Loop
    const clock = new THREE.Clock();
    let animFrameId = 0;
    let hudSyncAccumulator = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const rawDelta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const nowMs = performance.now();

      // Drift ambient sanctuary embers upward gently
      const emberPos = arenaRig.ambientParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < emberPos.count; i++) {
        let py = emberPos.getY(i) + rawDelta * (0.35 + (i % 3) * 0.18);
        if (py > 6.5) py = 0.1;
        emberPos.setY(i, py);
      }
      emberPos.needsUpdate = true;

      updateVFXPool(vfxPool, rawDelta);

      // Update Phase Machine
      if (sim.phase === 'CHESS_VIEW') {
        // Restore warm/cool broad studio lighting for Chessboard View
        keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, 2.2, 5, rawDelta);
        hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, 0.65, 5, rawDelta);
        rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, 1.35, 5, rawDelta);
        warmFill.intensity = THREE.MathUtils.damp(warmFill.intensity, 1.4, 5, rawDelta);

        // Turn off focused fight spotlights & volumetric cones smoothly
        arenaRig.spotAttacker.intensity = THREE.MathUtils.damp(arenaRig.spotAttacker.intensity, 0, 8, rawDelta);
        arenaRig.spotDefender.intensity = THREE.MathUtils.damp(arenaRig.spotDefender.intensity, 0, 8, rawDelta);
        arenaRig.clashPointLight.intensity = THREE.MathUtils.damp(arenaRig.clashPointLight.intensity, 0, 10, rawDelta);
        (arenaRig.volumetricConeAttacker.material as THREE.MeshBasicMaterial).opacity =
          THREE.MathUtils.damp((arenaRig.volumetricConeAttacker.material as THREE.MeshBasicMaterial).opacity, 0, 8, rawDelta);
        (arenaRig.volumetricConeDefender.material as THREE.MeshBasicMaterial).opacity =
          THREE.MathUtils.damp((arenaRig.volumetricConeDefender.material as THREE.MeshBasicMaterial).opacity, 0, 8, rawDelta);

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

        // Smoothly return all chess pieces (including any displaced bystanders) to their exact chess squares
        for (const piece of sim.pieces) {
          const rig = sim.pieceRigs.get(piece.id);
          if (!rig) continue;

          const bys = sim.bystanders.get(piece.id);
          if (bys) {
            bys.offsetX = THREE.MathUtils.damp(bys.offsetX, 0, 8, rawDelta);
            bys.offsetZ = THREE.MathUtils.damp(bys.offsetZ, 0, 8, rawDelta);
            bys.y = THREE.MathUtils.damp(bys.y, 0, 10, rawDelta);
            bys.vx = 0;
            bys.vz = 0;
            bys.vy = 0;
            bys.panickedTimer = 0;
          }

          boardToWorld(piece.row, piece.col, _vec3A);
          rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, _vec3A.x, 10, rawDelta);
          rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, 0, 10, rawDelta);
          rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, _vec3A.z, 10, rawDelta);
          rig.root.scale.setScalar(THREE.MathUtils.damp(rig.root.scale.x, 1.0, 8, rawDelta));

          const targetYaw = piece.faction === 'w' ? Math.PI : 0;
          rig.root.rotation.y = THREE.MathUtils.damp(rig.root.rotation.y, targetYaw, 8, rawDelta);

          rig.surpriseGroup.visible = false;
          rig.bodyPivot.rotation.x = Math.sin(elapsed * 2.2 + piece.col) * 0.03;
          rig.bodyPivot.rotation.y = 0;
          rig.bodyPivot.rotation.z = 0;
          rig.rightArmPivot.rotation.set(-0.1, 0, 0);
          rig.leftArmPivot.rotation.set(-0.08, 0, 0);
          rig.capePivot.rotation.x = 0.14 + Math.sin(elapsed * 2.5 + piece.row) * 0.04;

          if (piece.type === 'q') {
            rig.specialOrbitGroup.rotation.y += rawDelta * 1.6;
            rig.specialOrbitGroup.scale.setScalar(1.0);
          }

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

          if (sim.phase === 'TRANSITION_TO_FIGHT' && sim.phaseTimer >= 0.95) {
            sim.phase = 'FIGHT_INTRO';
            sim.phaseTimer = 0;
            setPhase('FIGHT_INTRO');
          } else if (sim.phase === 'FIGHT_INTRO' && sim.phaseTimer >= 1.1) {
            sim.phase = 'FIGHT_ACTIVE';
            sim.phaseTimer = 0;
            setPhase('FIGHT_ACTIVE');
          }

          // 1. CINEMATIC FIGHT LIGHTING: Dim ambient board lights into moody shadow & lock twin SpotLights onto the duelists!
          keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, 0.24, 6, rawDelta);
          hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, 0.14, 6, rawDelta);
          rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, 0.45, 6, rawDelta);
          warmFill.intensity = THREE.MathUtils.damp(warmFill.intensity, 0.2, 6, rawDelta);

          const atkWorldX = sim.duelCenterWorld.x + atk.x * 0.72;
          const atkWorldY = atk.y * 0.72;
          const atkWorldZ = sim.duelCenterWorld.z;

          const defWorldX = sim.duelCenterWorld.x + def.x * 0.72;
          const defWorldY = def.y * 0.72;
          const defWorldZ = sim.duelCenterWorld.z;

          const midWorldX = (atkWorldX + defWorldX) * 0.5;

          // Position SpotLights and Volumetric God-Ray Cones directly above the two fighters
          arenaRig.spotAttacker.position.set(atkWorldX - 0.6, 8.2, atkWorldZ + 1.2);
          arenaRig.spotAttacker.target.position.set(atkWorldX, atkWorldY + 0.6, atkWorldZ);
          arenaRig.spotAttacker.intensity = THREE.MathUtils.damp(arenaRig.spotAttacker.intensity, 32.0, 6, rawDelta);

          arenaRig.spotDefender.position.set(defWorldX + 0.6, 8.2, defWorldZ + 1.2);
          arenaRig.spotDefender.target.position.set(defWorldX, defWorldY + 0.6, defWorldZ);
          arenaRig.spotDefender.intensity = THREE.MathUtils.damp(arenaRig.spotDefender.intensity, 32.0, 6, rawDelta);

          arenaRig.volumetricConeAttacker.position.copy(arenaRig.spotAttacker.position);
          arenaRig.volumetricConeAttacker.lookAt(arenaRig.spotAttacker.target.position);
          arenaRig.volumetricConeAttacker.rotateX(Math.PI / 2);
          (arenaRig.volumetricConeAttacker.material as THREE.MeshBasicMaterial).opacity =
            THREE.MathUtils.damp((arenaRig.volumetricConeAttacker.material as THREE.MeshBasicMaterial).opacity, 0.065, 5, rawDelta);

          arenaRig.volumetricConeDefender.position.copy(arenaRig.spotDefender.position);
          arenaRig.volumetricConeDefender.lookAt(arenaRig.spotDefender.target.position);
          arenaRig.volumetricConeDefender.rotateX(Math.PI / 2);
          (arenaRig.volumetricConeDefender.material as THREE.MeshBasicMaterial).opacity =
            THREE.MathUtils.damp((arenaRig.volumetricConeDefender.material as THREE.MeshBasicMaterial).opacity, 0.065, 5, rawDelta);

          arenaRig.clashPointLight.position.set(midWorldX, 1.35, sim.duelCenterWorld.z + 0.4);
          arenaRig.clashPointLight.intensity = THREE.MathUtils.damp(arenaRig.clashPointLight.intensity, 1.2, 8, rawDelta);

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
              0.08,
              5,
              rawDelta
            );

          // 2. COMEDIC BYSTANDER PIECES: All other pieces stay on the board, watch the fight, and jump out of the way if the fighters get too close!
          for (const piece of sim.pieces) {
            if (piece.id === atk.piece.id || piece.id === def.piece.id) continue;
            const rig = sim.pieceRigs.get(piece.id);
            if (!rig) continue;

            let bys = sim.bystanders.get(piece.id);
            if (!bys) {
              bys = { offsetX: 0, offsetZ: 0, vx: 0, vz: 0, y: 0, vy: 0, panickedTimer: 0 };
              sim.bystanders.set(piece.id, bys);
            }

            boardToWorld(piece.row, piece.col, _vec3A);
            const curWorldX = _vec3A.x + bys.offsetX;
            const curWorldZ = _vec3A.z + bys.offsetZ;

            // Check distance to both fighters
            const distToAtk = Math.hypot(curWorldX - atkWorldX, curWorldZ - atkWorldZ);
            const distToDef = Math.hypot(curWorldX - defWorldX, curWorldZ - defWorldZ);
            const minFighterDist = Math.min(distToAtk, distToDef);

            const dangerRadius = 2.25;
            if (minFighterDist < dangerRadius) {
              // Panic and hop out of the way!
              const threatX = distToAtk < distToDef ? atkWorldX : defWorldX;
              const threatZ = distToAtk < distToDef ? atkWorldZ : defWorldZ;

              let pushDirX = curWorldX - threatX;
              let pushDirZ = curWorldZ - threatZ;
              // If threat is directly on the same Z-row, bias push perpendicular (along Z) so they jump clear of the horizontal fighting lane!
              if (Math.abs(pushDirZ) < 0.45) {
                pushDirZ = piece.row < 4 ? -1.2 : 1.2;
              }
              const len = Math.hypot(pushDirX, pushDirZ) || 1;
              pushDirX /= len;
              pushDirZ /= len;

              const urgency = (dangerRadius - minFighterDist) / dangerRadius;
              bys.vx += pushDirX * (14.0 * urgency) * rawDelta;
              bys.vz += pushDirZ * (16.5 * urgency) * rawDelta;

              if (bys.y <= 0.02) {
                bys.vy = 5.6 + Math.random() * 2.6;
                soundEngine.playBystanderHop();
              }
              bys.panickedTimer = 0.65;
            } else {
              // Gently spring back toward original square if it's now safe
              const homeDistToAtk = Math.hypot(_vec3A.x - atkWorldX, _vec3A.z - atkWorldZ);
              const homeDistToDef = Math.hypot(_vec3A.x - defWorldX, _vec3A.z - defWorldZ);
              if (Math.min(homeDistToAtk, homeDistToDef) > dangerRadius + 0.6) {
                bys.vx += -bys.offsetX * 5.0 * rawDelta;
                bys.vz += -bys.offsetZ * 5.0 * rawDelta;
                // Hop lightly while scurrying back to square
                if (Math.hypot(bys.offsetX, bys.offsetZ) > 0.35 && bys.y <= 0.01) {
                  bys.vy = 3.2;
                }
              }
            }

            // Integrate bystander velocity & gravity
            bys.offsetX += bys.vx * rawDelta;
            bys.offsetZ += bys.vz * rawDelta;
            bys.vx *= Math.max(0, 1 - 6.5 * rawDelta);
            bys.vz *= Math.max(0, 1 - 6.5 * rawDelta);

            if (bys.y > 0 || bys.vy !== 0) {
              bys.y += bys.vy * rawDelta;
              bys.vy -= 24.0 * rawDelta;
              if (bys.y <= 0) {
                bys.y = 0;
                bys.vy = 0;
              }
            }

            if (bys.panickedTimer > 0) {
              bys.panickedTimer = Math.max(0, bys.panickedTimer - rawDelta);
            }

            rig.root.position.set(_vec3A.x + bys.offsetX, bys.y, _vec3A.z + bys.offsetZ);

            // Rotate bystander to watch the fight!
            const lookAngle = Math.atan2(midWorldX - rig.root.position.x, sim.duelCenterWorld.z - rig.root.position.z);
            rig.root.rotation.y = THREE.MathUtils.damp(rig.root.rotation.y, lookAngle, 10, rawDelta);

            // Expressive spectator animations (panicked arm flailing when jumping out of the way, or excited spectating!)
            const isPanicking = bys.panickedTimer > 0 || bys.y > 0.05;
            rig.surpriseGroup.visible = isPanicking;
            if (isPanicking) {
              rig.surpriseGroup.rotation.y += rawDelta * 10;
              rig.bodyPivot.rotation.z = Math.sin(elapsed * 28 + piece.col) * 0.26;
              rig.bodyPivot.rotation.x = -0.18;
              rig.rightArmPivot.rotation.x = -2.4 + Math.sin(elapsed * 32) * 0.55;
              rig.leftArmPivot.rotation.x = -2.4 - Math.sin(elapsed * 32) * 0.55;
              rig.capePivot.rotation.x = 0.85;
            } else {
              rig.bodyPivot.rotation.z = 0;
              rig.bodyPivot.rotation.x = Math.sin(elapsed * 5 + piece.col) * 0.06;
              rig.rightArmPivot.rotation.x = -0.25 + Math.sin(elapsed * 5 + piece.row) * 0.12;
              rig.leftArmPivot.rotation.x = -0.2;
            }
          }

          // 3. Step Active Combat Simulation (with brief Hitstop support for meaty heavy impacts)
          if (sim.hitstopTimer > 0) {
            sim.hitstopTimer = Math.max(0, sim.hitstopTimer - rawDelta);
          } else if (sim.phase === 'FIGHT_ACTIVE') {
            sim.fightTimer = Math.max(0, sim.fightTimer - rawDelta);

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

            if (atk.isAI) updateFighterAI(atk, def, rawDelta, nowMs, addCallout);
            if (def.isAI) updateFighterAI(def, atk, rawDelta, nowMs, addCallout);

            // Check if either fighter just initiated a slash/special to spawn 3D weapon trail VFX
            checkFighterActionVFX(atk, sim.prevAtkAction);
            checkFighterActionVFX(def, sim.prevDefAction);
            sim.prevAtkAction = atk.action;
            sim.prevDefAction = def.action;

            const stepEvents = stepCombatSimulation(atk, def, rawDelta, nowMs, addCallout);
            if (stepEvents.cameraShake > 0) {
              sim.cameraShake = Math.max(sim.cameraShake, stepEvents.cameraShake);
            }
            if (stepEvents.sparkWorldPos) {
              const worldX = sim.duelCenterWorld.x + stepEvents.sparkWorldPos.x * 0.72;
              const worldY = stepEvents.sparkWorldPos.y;
              const worldZ = sim.duelCenterWorld.z;
              spawnHitSparks(vfxPool, worldX, worldY, worldZ, stepEvents.sparkWorldPos.color, 18);

              // Flare the clash point light dramatically on impact!
              arenaRig.clashPointLight.color.setHex(stepEvents.sparkWorldPos.color);
              arenaRig.clashPointLight.intensity = 14.0;

              if (stepEvents.cameraShake >= 0.25) {
                sim.hitstopTimer = 0.042; // Crisp 42ms fighting-game hitstop freeze on heavy/special blows!
                spawnShockwave(vfxPool, worldX, 0.05, worldZ, stepEvents.sparkWorldPos.color, 4.8);
                spawnGroundDebris(vfxPool, worldX, worldZ, 9);
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

              const koWorldX = sim.duelCenterWorld.x + loser.x * 0.72;
              spawnShockwave(vfxPool, koWorldX, 0.05, sim.duelCenterWorld.z, 0xf59e0b, 7.5);
              spawnGroundDebris(vfxPool, koWorldX, sim.duelCenterWorld.z, 16);
              spawnAuraPillar(vfxPool, sim.duelCenterWorld.x + winner.x * 0.72, sim.duelCenterWorld.z, 0xfef08a);

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
            const attackerWon =
              def.hp <= 0 || (atk.hp > 0 && atk.hp / atk.maxHp >= def.hp / def.maxHp);

            if (sim.isExhibitionDuel) {
              for (const rig of sim.exhibitionTempRigs) {
                rig.root.parent?.remove(rig.root);
              }
              sim.exhibitionTempRigs = [];
            } else if (sim.pendingMove) {
              const winnerRuntime = attackerWon ? atk : def;
              const loserRuntime = attackerWon ? def : atk;

              sim.pieces = sim.pieces.filter((p) => p.id !== loserRuntime.piece.id);
              const loserRig = sim.pieceRigs.get(loserRuntime.piece.id);
              if (loserRig) {
                loserRig.root.parent?.remove(loserRig.root);
                sim.pieceRigs.delete(loserRuntime.piece.id);
              }

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

              if (loserRuntime.piece.type === 'k') {
                setWarVictor({
                  faction: winnerRuntime.piece.faction,
                  reason: `Regicide at Square ${sq}! ${winnerRuntime.spec.warriorTitle} defeated the Eternal Monarch in single combat.`,
                });
                confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
              }

              const nextFaction: Faction = sim.turnFaction === 'w' ? 'b' : 'w';
              sim.turnFaction = nextFaction;
              sim.turnNumber += 1;
              setTurnFaction(nextFaction);
              setTurnNumber(sim.turnNumber);

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

            rig.root.scale.setScalar(
              THREE.MathUtils.damp(rig.root.scale.x, 1.42, 8, rawDelta)
            );

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
          const camDistZ = THREE.MathUtils.clamp(4.6 + sep * 0.52, 4.8, 8.4);

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

          hudSyncAccumulator += rawDelta;
          if (hudSyncAccumulator >= 0.05) {
            hudSyncAccumulator = 0;
            setHudAttacker({ ...atk });
            setHudDefender({ ...def });
            setFightTimer(sim.fightTimer);
          }
        }
      }

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
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
      if (composer) composer.dispose();
      renderer.dispose();
    };
  }, [addCallout, executeChessMove, syncBoardHighlights]);

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
    <div className="relative h-screen w-screen overflow-hidden bg-[#07090E] text-slate-100 select-none">
      {/* 1. Strict 3-Zone Top Navigation Bar Contract */}
      <header className="relative z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#07090E] border-b border-slate-800/90">
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
              Click any piece to move. Capturing triggers a spotlight duel right on the board—and nearby pieces will scramble out of the way!
            </div>
          </div>

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

          {hoveredCaptureMove && hoveredCaptureMove.targetPiece && selectedPiece && (
            <div className="bg-[#0B0E17]/95 border border-rose-500/70 rounded-xl px-4 py-3 shadow-2xl">
              <div className="text-[11px] font-mono font-bold text-rose-400">
                IMMINENT DUEL AT SQUARE {formatSquareName(hoveredCaptureMove.to)}
              </div>
              <div className="font-display text-sm font-bold text-white mt-0.5">
                {ARCHETYPES[selectedPiece.type].chessName} ({selectedPiece.hp} HP) vs {ARCHETYPES[hoveredCaptureMove.targetPiece.type].chessName} ({hoveredCaptureMove.targetPiece.hp} HP)
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                Click red square to ignite the Arena Spotlights! Even a Pawn can defeat a Queen with Parries and Underdog Valor!
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
