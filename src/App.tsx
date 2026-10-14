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
  TimelineSnapshot,
  UnseenThreatVector,
} from './types/game';
import { ARCHETYPES } from './data/archetypes';
import {
  chooseAIMove,
  computeUnseen4DThreats,
  createInitialBoard,
  formatSquareName,
  formatWName,
  formatZName,
  getPieceAtProjected,
  getValidMovesForPiece,
} from './engine/chessEngine';
import {
  createFighterRuntime,
  stepCombatSimulation,
  triggerFighter4DPhaseShift,
  triggerFighterAttack,
  triggerFighterDash,
  triggerFighterJump,
  triggerFighterTemporalEcho,
  updateFighterAI,
} from './engine/combatEngine';
import {
  createArticulatedPiece,
  ArticulatedPieceRig,
  createFirstPersonViewmodelRig,
  FirstPersonViewmodelRig,
} from './three/pieceModels';
import {
  boardToWorld,
  createBoardArena,
  BoardArenaRig,
  update4DTesseractProjection,
  updateQuantumEntanglementBeams,
} from './three/arenaBuilder';
import {
  animateFighterRig,
  animateFirstPersonViewmodel,
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
import { CombatHudOverlay, PlayerCombatInputAction } from './components/CombatHudOverlay';
import { CodexModal } from './components/CodexModal';
import { Volume2, VolumeX, Swords, RotateCcw, Eye, Sparkles, Orbit, Layers, AlertTriangle } from 'lucide-react';

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

const PIECE_TORSO_HEIGHTS: Record<PieceType, number> = {
  p: 0.64,
  n: 0.78,
  b: 0.84,
  r: 0.86,
  q: 0.96,
  k: 1.0,
};

function getWarriorEyeHeightWorld(type: PieceType): number {
  return (PIECE_TORSO_HEIGHTS[type] + 0.37) * 1.42;
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

  // 4D Hypercube Slice State: Which 3D slice (Z, W) the player is currently observing,
  // and which target 4D slice the selected piece is projecting moves into!
  const [activeSliceW, setActiveSliceW] = useState<number>(0); // -1 = Kata, 0 = Prime, +1 = Ana
  const [activeSliceZ, setActiveSliceZ] = useState<number>(0); // 0 = Ground, 1 = Astral
  const [targetMoveW, setTargetMoveW] = useState<number>(0);
  const [targetMoveZ, setTargetMoveZ] = useState<number>(0);
  const [unseenThreats, setUnseenThreats] = useState<UnseenThreatVector[]>([]);
  const [canRewindTimeline, setCanRewindTimeline] = useState<boolean>(false);
  const [timelineBranchLabel, setTimelineBranchLabel] = useState<string>('Timeline α');

  const [selectedPiece, setSelectedPiece] = useState<ChessPiece | null>(null);
  const [hoveredCaptureMove, setHoveredCaptureMove] = useState<MoveOption | null>(null);
  const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([
    {
      id: 'init',
      turnNumber: 1,
      summary: '4D Hypercube Sanctuary Initialized',
      detail: 'Select any warrior to move on Prime (W=0) or project across the 4th spatial axis (Kata -W / Ana +W) & Spacetime trails!',
      wasUpset: false,
      winnerFaction: 'w',
    },
  ]);

  // HUD snapshot state during combat
  const [hudAttacker, setHudAttacker] = useState<FighterRuntime | null>(null);
  const [hudDefender, setHudDefender] = useState<FighterRuntime | null>(null);
  const [fightTimer, setFightTimer] = useState<number>(60);
  const [duelSquareName, setDuelSquareName] = useState<string>('E4');
  const [introShotIndex, setIntroShotIndex] = useState<number>(-1);
  const [combatCameraMode, setCombatCameraMode] = useState<'first_person' | 'side_arena'>('first_person');
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
    introShotIndex: number;
    combatCameraMode: 'first_person' | 'side_arena';
    currentDutchRoll: number;
    turnFaction: Faction;
    turnNumber: number;
    gameMode: 'vs_ai' | 'pvp';
    cameraPreset: CameraPreset;
    activeSliceW: number;
    activeSliceZ: number;
    targetMoveW: number;
    targetMoveZ: number;
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
    slowMoTimer: number;
    timelineSnapshots: TimelineSnapshot[];
    timelineBranchCount: number;
    keysHeld: Record<string, boolean>;
    pieceRigs: Map<string, ArticulatedPieceRig>;
    firstPersonRig: FirstPersonViewmodelRig | null;
    fpMountGroup: THREE.Group | null;
    arenaRig: BoardArenaRig | null;
    vfxPool: VFXPool | null;
    controls: OrbitControls | null;
    currentLookAt: THREE.Vector3;
  }>({
    phase: 'CHESS_VIEW',
    phaseTimer: 0,
    introShotIndex: -1,
    combatCameraMode: 'first_person',
    currentDutchRoll: 0,
    turnFaction: 'w',
    turnNumber: 1,
    gameMode: 'vs_ai',
    cameraPreset: 'white_orbit',
    activeSliceW: 0,
    activeSliceZ: 0,
    targetMoveW: 0,
    targetMoveZ: 0,
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
    slowMoTimer: 0,
    timelineSnapshots: [],
    timelineBranchCount: 0,
    keysHeld: {},
    pieceRigs: new Map(),
    firstPersonRig: null,
    fpMountGroup: null,
    arenaRig: null,
    vfxPool: null,
    controls: null,
    currentLookAt: new THREE.Vector3(0, 0.4, 0),
  });

  const saveTimelineSnapshot = useCallback(() => {
    const sim = simRef.current;
    const clonedPieces: ChessPiece[] = sim.pieces.map((p) => ({
      ...p,
      history: p.history.map((h) => ({ ...h })),
    }));
    const branches = ['α', 'β', 'γ', 'δ', 'ε', 'ζ'];
    const branchSym = branches[sim.timelineBranchCount % branches.length];
    sim.timelineSnapshots.push({
      turnNumber: sim.turnNumber,
      turnFaction: sim.turnFaction,
      branchName: `Timeline ${branchSym}`,
      pieces: clonedPieces,
    });
    if (sim.timelineSnapshots.length > 12) {
      sim.timelineSnapshots.shift();
    }
    setCanRewindTimeline(sim.timelineSnapshots.length > 0);
  }, []);

  // Spacetime Causality Rewind (Δt - 1): Fork a parallel timeline branch and restore prior board state!
  const handleChronoRewind = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase !== 'CHESS_VIEW' || sim.timelineSnapshots.length === 0) return;

    const snap = sim.timelineSnapshots.pop()!;
    sim.timelineBranchCount += 1;
    const branches = ['α', 'β', 'γ', 'δ', 'ε', 'ζ'];
    const newBranchName = `Timeline ${branches[sim.timelineBranchCount % branches.length]}`;
    setTimelineBranchLabel(newBranchName);
    setCanRewindTimeline(sim.timelineSnapshots.length > 0);

    const scene = sim.arenaRig?.group.parent;
    sim.pieceRigs.forEach((rig) => {
      rig.root.parent?.remove(rig.root);
    });
    sim.pieceRigs.clear();

    sim.pieces = snap.pieces;
    sim.turnNumber = snap.turnNumber;
    sim.turnFaction = 'w';
    sim.selectedPieceId = null;
    sim.validMoves = [];

    if (scene) {
      for (const p of sim.pieces) {
        const rig = createArticulatedPiece(p.type, p.faction);
        boardToWorld(p.row, p.col, rig.root.position);
        rig.root.rotation.y = p.faction === 'w' ? Math.PI : 0;
        scene.add(rig.root);
        sim.pieceRigs.set(p.id, rig);
      }
    }

    if (sim.vfxPool) {
      spawnShockwave(sim.vfxPool, 0, 0.1, 0, 0x38bdf8, 8.5);
    }
    soundEngine.playQuantumEntangle(true);
    setTurnNumber(sim.turnNumber);
    setTurnFaction('w');
    syncBoardHighlights();
    setBattleLogs((prev) => [
      {
        id: `rewind_${Date.now()}`,
        turnNumber: sim.turnNumber,
        summary: `Causality Rewound (Δt = -1) → Branched into ${newBranchName}`,
        detail: `Quantum wavefunction collapsed back to Turn ${snap.turnNumber} before the timeline diverged.`,
        wasUpset: false,
        winnerFaction: 'w',
      },
      ...prev.slice(0, 7),
    ]);
  }, []);

  // Quantum Bell-State Entanglement (|Φ⁺⟩): Link the selected piece with your highest-value allied warrior!
  const handleEntangleSelectedPiece = useCallback(() => {
    const sim = simRef.current;
    if (!sim.selectedPieceId) return;
    const sel = sim.pieces.find((p) => p.id === sim.selectedPieceId);
    if (!sel) return;

    // Find best allied partner to entangle with
    const allies = sim.pieces.filter(
      (p) => p.faction === sel.faction && p.id !== sel.id && p.id !== sel.entangledWithId
    );
    if (allies.length === 0) return;

    allies.sort(
      (a, b) => ARCHETYPES[b.type].tacticalValue - ARCHETYPES[a.type].tacticalValue
    );
    const partner = allies[0];

    // Clear old entanglement links for these two pieces
    for (const p of sim.pieces) {
      if (p.entangledWithId === sel.id || p.entangledWithId === partner.id) {
        p.entangledWithId = undefined;
      }
    }

    sel.entangledWithId = partner.id;
    partner.entangledWithId = sel.id;

    soundEngine.playQuantumEntangle(false);
    if (sim.vfxPool) {
      const posA = boardToWorld(sel.row, sel.col);
      const posB = boardToWorld(partner.row, partner.col);
      spawnShockwave(sim.vfxPool, posA.x, 0.08, posA.z, 0x38bdf8, 3.2);
      spawnShockwave(sim.vfxPool, posB.x, 0.08, posB.z, 0xc084fc, 3.2);
    }

    setSelectedPiece({ ...sel });
    setBattleLogs((prev) => [
      {
        id: `entangle_${Date.now()}`,
        turnNumber: sim.turnNumber,
        summary: `|Φ⁺⟩ Bell-State Entanglement: ${ARCHETYPES[sel.type].chessName} ⇄ ${ARCHETYPES[partner.type].chessName}`,
        detail: `Connected by a 3D Quantum Double-Helix! Grants +15% starting meter, passive Bell Shielding, and Entangled Assist Strikes in combat.`,
        wasUpset: false,
        winnerFaction: sel.faction,
      },
      ...prev.slice(0, 7),
    ]);
  }, []);

  const handleToggleCombatCameraMode = useCallback(() => {
    const sim = simRef.current;
    const next = sim.combatCameraMode === 'first_person' ? 'side_arena' : 'first_person';
    sim.combatCameraMode = next;
    setCombatCameraMode(next);
  }, []);

  const addCallout = useCallback((c: Omit<CombatCallout, 'id' | 'createdAt'>) => {
    const item: CombatCallout = {
      ...c,
      id: Date.now() + Math.random(),
      createdAt: performance.now(),
    };
    setCallouts((prev) => [...prev.slice(-3), item]);
  }, []);

  // Sync tile highlight meshes and Unseen 4D Threat sigils
  const syncBoardHighlights = useCallback(() => {
    const sim = simRef.current;
    if (!sim.arenaRig) return;

    sim.arenaRig.highlightMeshes.forEach((mesh) => {
      mesh.visible = false;
    });
    sim.arenaRig.threatSigilMeshes.forEach((sigil) => {
      sigil.visible = false;
    });

    if (sim.phase !== 'CHESS_VIEW') return;

    // 1. Compute Unseen 4D Cross-Dimensional Threats on the currently viewed 3D slice!
    const threats = computeUnseen4DThreats(
      sim.pieces,
      sim.activeSliceZ,
      sim.activeSliceW,
      sim.turnFaction
    );
    setUnseenThreats(threats);

    for (const t of threats) {
      const sigil = sim.arenaRig.threatSigilMeshes.get(`${t.targetRow}_${t.targetCol}`);
      if (sigil) {
        sigil.visible = true;
      }
    }

    // 2. Highlight selected piece and its valid moves (3D slice moves, 4D Hyper-Shifts, and Chrono-Intercepts!)
    const selPiece = sim.pieces.find((p) => p.id === sim.selectedPieceId) || null;
    setSelectedPiece(selPiece ? { ...selPiece } : null);

    if (selPiece) {
      const selMesh = sim.arenaRig.highlightMeshes.get(`${selPiece.row}_${selPiece.col}`);
      if (selMesh) {
        selMesh.visible = true;
        const mat = selMesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(0x38bdf8);
        mat.opacity = 0.48;
      }

      for (const mv of sim.validMoves) {
        const hl = sim.arenaRig.highlightMeshes.get(`${mv.to.row}_${mv.to.col}`);
        if (hl) {
          hl.visible = true;
          const mat = hl.material as THREE.MeshBasicMaterial;
          if (mv.dimensionType === 'TEMPORAL_INTERCEPT') {
            mat.color.setHex(0x22d3ee); // Cyan Chrono-Intercept
            mat.opacity = 0.68;
          } else if (mv.isCapture) {
            mat.color.setHex(mv.dimensionType === '4D_CROSS_SLICE_STRIKE' ? 0xc084fc : 0xf43f5e);
            mat.opacity = 0.65;
          } else if (mv.dimensionType === '4D_HYPER_SHIFT') {
            mat.color.setHex(0xa855f7); // Violet 4D Hyper-Shift
            mat.opacity = 0.52;
          } else {
            mat.color.setHex(0xf59e0b);
            mat.opacity = 0.38;
          }
        }
      }
    }
  }, []);

  // Helper to change viewed 3D slice or target 4D move projection slice
  const handleSelect4DSlice = useCallback(
    (newW: number, newZ: number, alsoSetView: boolean = true) => {
      const sim = simRef.current;
      if (alsoSetView) {
        sim.activeSliceW = newW;
        sim.activeSliceZ = newZ;
        setActiveSliceW(newW);
        setActiveSliceZ(newZ);
      }
      sim.targetMoveW = newW;
      sim.targetMoveZ = newZ;
      setTargetMoveW(newW);
      setTargetMoveZ(newZ);

      if (sim.selectedPieceId) {
        const sel = sim.pieces.find((p) => p.id === sim.selectedPieceId);
        if (sel) {
          sim.validMoves = getValidMovesForPiece(sel, sim.pieces, newZ, newW);
        }
      }
      soundEngine.playChessSelect();
      syncBoardHighlights();
    },
    [syncBoardHighlights]
  );

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

      boardToWorld(move.to.row, move.to.col, sim.duelCenterWorld);
      const sqName = `${formatSquareName(move.to)} · ${formatWName(move.to.w)}`;
      setDuelSquareName(sqName);

      const atkIsAI = sim.gameMode === 'vs_ai' && attackerPiece.faction === 'b';
      const defIsAI = sim.gameMode === 'vs_ai' && defenderPiece.faction === 'b';

      const atkPartner = attackerPiece.entangledWithId
        ? sim.pieces.find((p) => p.id === attackerPiece.entangledWithId)
        : undefined;
      const defPartner = defenderPiece.entangledWithId
        ? sim.pieces.find((p) => p.id === defenderPiece.entangledWithId)
        : undefined;

      sim.attackerRuntime = createFighterRuntime(
        attackerPiece,
        true,
        atkIsAI,
        atkPartner ? ARCHETYPES[atkPartner.type].chessName : undefined
      );
      sim.defenderRuntime = createFighterRuntime(
        defenderPiece,
        false,
        defIsAI,
        defPartner ? ARCHETYPES[defPartner.type].chessName : undefined
      );
      sim.prevAtkAction = 'idle';
      sim.prevDefAction = 'idle';
      sim.fightTimer = 60;
      sim.slowMoTimer = 0;
      sim.phase = 'TRANSITION_TO_FIGHT';
      sim.phaseTimer = 0;
      sim.introShotIndex = -1;
      setIntroShotIndex(-1);

      // Build First-Person Weapon & Shield Viewmodel Rig matching the human player's warrior!
      const humanRuntime = !sim.attackerRuntime.isAI
        ? sim.attackerRuntime
        : !sim.defenderRuntime.isAI
        ? sim.defenderRuntime
        : sim.attackerRuntime;
      if (sim.fpMountGroup) {
        if (sim.firstPersonRig) {
          sim.fpMountGroup.remove(sim.firstPersonRig.root);
        }
        const fpRig = createFirstPersonViewmodelRig(
          humanRuntime.piece.type,
          humanRuntime.piece.faction
        );
        fpRig.root.visible = false;
        sim.fpMountGroup.add(fpRig.root);
        sim.firstPersonRig = fpRig;
      }

      if (sim.controls) {
        sim.controls.enabled = false;
      }

      soundEngine.playArenaTransition();
      setPhase('TRANSITION_TO_FIGHT');
      setCallouts([]);
      setKoBanner(null);
      setHudAttacker({ ...sim.attackerRuntime });
      setHudDefender({ ...sim.defenderRuntime });

      if (move.dimensionType && move.dimensionType !== '3D_SLICE') {
        setTimeout(() => {
          addCallout({
            text:
              move.dimensionType === 'TEMPORAL_INTERCEPT'
                ? 'CHRONO-INTERCEPT DUEL (Δt = -1)!'
                : '4D CROSS-DIMENSIONAL AMBUSH!',
            subtext: move.dimensionLabel || 'HYPERCUBE COLLISION',
            x: 0,
            y: 2.35,
            color: '#c084fc',
          });
        }, 400);
      }
    },
    [addCallout, syncBoardHighlights]
  );

  // Execute a non-capture chess move (including 4D Hyper-Shifts!) or trigger a capture duel
  const executeChessMove = useCallback(
    (piece: ChessPiece, move: MoveOption) => {
      const sim = simRef.current;

      if (piece.faction === 'w') {
        saveTimelineSnapshot();
      }

      if (move.isCapture && move.targetPiece) {
        initiateCombatDuel(piece, move, false);
        return;
      }

      soundEngine.playChessMove();
      const prevW = piece.w;
      const prevZ = piece.z;
      piece.row = move.to.row;
      piece.col = move.to.col;
      piece.z = move.to.z;
      piece.w = move.to.w;
      piece.hasMoved = true;
      piece.meter = Math.min(100, piece.meter + (prevW !== piece.w || prevZ !== piece.z ? 14 : 8));
      piece.history.push({
        row: piece.row,
        col: piece.col,
        z: piece.z,
        w: piece.w,
        turn: sim.turnNumber + 1,
      });

      if (prevW !== piece.w || prevZ !== piece.z) {
        const sq = formatSquareName(move.to);
        const shiftEntry: BattleLogEntry = {
          id: `shift_${Date.now()}`,
          turnNumber: sim.turnNumber,
          summary: `4D Hyper-Shift: ${ARCHETYPES[piece.type].chessName} → ${sq} [${formatWName(piece.w)}]`,
          detail: `${ARCHETYPES[piece.type].warriorTitle} shifted along the 4th spatial axis from ${formatWName(prevW)} to ${formatWName(piece.w)}!`,
          wasUpset: false,
          winnerFaction: piece.faction,
        };
        setBattleLogs((prev) => [shiftEntry, ...prev.slice(0, 7)]);
      }

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
        z: 0,
        w: 0,
        hp: atkSpec.maxHp,
        maxHp: atkSpec.maxHp,
        meter: 50,
        kills: 0,
        hasMoved: true,
        history: [{ row: 4, col: 3, z: 0, w: 0, turn: 1 }],
      };

      const tempDef: ChessPiece = {
        id: `exhib_b_${Date.now()}`,
        type: defenderType,
        faction: 'b',
        row: 4,
        col: 4,
        z: 0,
        w: 0,
        hp: defSpec.maxHp,
        maxHp: defSpec.maxHp,
        meter: 50,
        kills: 0,
        hasMoved: true,
        history: [{ row: 4, col: 4, z: 0, w: 0, turn: 1 }],
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
        from: { row: 4, col: 3, z: 0, w: 0 },
        to: { row: 4, col: 4, z: 0, w: 0 },
        isCapture: true,
        targetPiece: tempDef,
        dimensionType: '3D_SLICE',
      };

      initiateCombatDuel(tempAtk, exhibMove, true);
    },
    [initiateCombatDuel]
  );

  // Trigger a 4D Hyper-Space Scenario on the board (shifts pieces into Ana +W and Kata -W so unseen 4D threats & cross-dimensional ambushes appear immediately!)
  const handleTrigger4DHyperScenario = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase !== 'CHESS_VIEW') return;

    // Place a Black Rook & Queen in Ana (+W) and Kata (-W) threatening the Prime (W=0) slice,
    // and select a White Knight/Queen ready to execute a 4D Cross-Dimensional Strike or Chrono-Intercept!
    const bRook = sim.pieces.find((p) => p.faction === 'b' && p.type === 'r');
    const bBishop = sim.pieces.find((p) => p.faction === 'b' && p.type === 'b');
    const wQueen = sim.pieces.find((p) => p.faction === 'w' && p.type === 'q');
    const wKnight = sim.pieces.find((p) => p.faction === 'w' && p.type === 'n');

    if (bRook) {
      bRook.row = 3;
      bRook.col = 3;
      bRook.w = 1; // Lurking in Ana (+W)!
      bRook.z = 0;
      bRook.history.push({ row: 2, col: 3, z: 0, w: 0, turn: sim.turnNumber });
      bRook.history.push({ row: 3, col: 3, z: 0, w: 1, turn: sim.turnNumber + 1 });
    }
    if (bBishop) {
      bBishop.row = 3;
      bBishop.col = 5;
      bBishop.w = -1; // Lurking in Kata (-W)!
      bBishop.z = 0;
    }
    if (wKnight) {
      wKnight.row = 5;
      wKnight.col = 4;
      wKnight.w = 0;
      wKnight.z = 0;
    }
    if (wQueen) {
      wQueen.row = 5;
      wQueen.col = 3;
      wQueen.w = 0;
      wQueen.z = 0;
      sim.selectedPieceId = wQueen.id;
      sim.targetMoveW = 1; // Project moves into Ana (+W) to ambush the lurking Rook!
      setTargetMoveW(1);
      sim.validMoves = getValidMovesForPiece(wQueen, sim.pieces, 0, 1);
    }

    soundEngine.playSpecialActivate();
    syncBoardHighlights();
    setBattleLogs((prev) => [
      {
        id: `hyper_${Date.now()}`,
        turnNumber: sim.turnNumber,
        summary: '4D Tesseract Fold Activated!',
        detail: 'Enemy Rook shifted to Ana (+W) at D5 and Bishop to Kata (-W) at F5! Purple sigils mark Unseen 4D Threats on Prime (W=0). Click D5 to launch a 4D Cross-Slice Ambush!',
        wasUpset: false,
        winnerFaction: 'w',
      },
      ...prev.slice(0, 7),
    ]);
  }, [syncBoardHighlights]);

  // Trigger an immediate canonical board clash (e.g. Pawn vs Queen surrounded by lively spectator pieces!)
  const handleTriggerFeaturedBoardClash = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase !== 'CHESS_VIEW') return;

    for (const p of sim.pieces.filter((x) => x.faction === sim.turnFaction)) {
      const moves = getValidMovesForPiece(p, sim.pieces, p.z, p.w);
      const cap = moves.find((m) => m.isCapture && m.targetPiece);
      if (cap) {
        executeChessMove(p, cap);
        return;
      }
    }

    const whitePawn =
      sim.pieces.find((p) => p.faction === 'w' && p.type === 'p' && p.col === 4) ||
      sim.pieces.find((p) => p.faction === 'w' && p.type === 'p');
    const blackQueen = sim.pieces.find((p) => p.faction === 'b' && p.type === 'q');

    if (whitePawn && blackQueen) {
      whitePawn.row = 4;
      whitePawn.col = 4;
      whitePawn.w = 0;
      blackQueen.row = 3;
      blackQueen.col = 3;
      blackQueen.w = 0;

      const move: MoveOption = {
        from: { row: 4, col: 4, z: 0, w: 0 },
        to: { row: 3, col: 3, z: 0, w: 0 },
        isCapture: true,
        targetPiece: blackQueen,
        dimensionType: '3D_SLICE',
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
    sim.activeSliceW = 0;
    sim.activeSliceZ = 0;
    sim.targetMoveW = 0;
    sim.targetMoveZ = 0;
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

    setActiveSliceW(0);
    setActiveSliceZ(0);
    setTargetMoveW(0);
    setTargetMoveZ(0);
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
        summary: 'New 4D Campaign Initialized',
        detail: 'All 32 warriors restored to Prime Slice (W=0, Z=0).',
        wasUpset: false,
        winnerFaction: 'w',
      },
    ]);
  }, [syncBoardHighlights]);

  // Player combat input handler (including 4D Phase Shift & Temporal Echo Clone!)
  const handlePlayerCombatInput = useCallback(
    (action: PlayerCombatInputAction) => {
      const sim = simRef.current;
      if (sim.phase !== 'FIGHT_ACTIVE') return;
      const atk = sim.attackerRuntime;
      const def = sim.defenderRuntime;
      if (!atk || !def) return;

      const human = !atk.isAI ? atk : !def.isAI ? def : atk;

      if (action === 'L' || action === 'H' || action === 'S') {
        triggerFighterAttack(human, action, addCallout);
      } else if (action === 'phase_shift_4d') {
        triggerFighter4DPhaseShift(human, addCallout);
      } else if (action === 'temporal_echo') {
        triggerFighterTemporalEcho(human, addCallout);
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

  // Initialize Three.js Scene, Calibrated Bloom, Studio & Cinematic Fight Lighting, Board, 4D Tesseract, Pieces, and Loop
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
      0.08,
      150
    );
    camera.position.set(0, 11.5, 11.5);
    scene.add(camera);

    // First-Person Viewmodel Mount attached directly to camera lens space
    const fpMountGroup = new THREE.Group();
    camera.add(fpMountGroup);
    const fpLight = new THREE.PointLight(0xfffbeb, 3.2, 2.5);
    fpLight.position.set(0, 0.25, -0.35);
    fpMountGroup.add(fpLight);
    simRef.current.fpMountGroup = fpMountGroup;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Calibrated toneMappingExposure so marble tiles and white armor never blow out!
    renderer.toneMappingExposure = 0.88;
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Post-Processing Composer with restrained, high-threshold UnrealBloomPass (scaled down glow!)
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isHeadless) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.18, // scaled-down strength for crispness
        0.28, // tight radius
        0.88 // high threshold so only true emissive weapon sparks/slashes bloom
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3-Point Board Studio Lighting Rig (calibrated intensities)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.48);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.65);
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

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(-10, 9, -11);
    scene.add(rimLight);

    const warmFill = new THREE.PointLight(0xf59e0b, 0.85, 24);
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

    // Build 3D Chessboard, 4D Tesseract Projector, Cinematic Spotlights & Duel Colosseum Arena
    const arenaRig = createBoardArena(renderer);
    scene.add(arenaRig.group);
    simRef.current.arenaRig = arenaRig;

    // Build Combat VFX Pool
    const vfxPool = createVFXPool();
    scene.add(vfxPool.group);
    simRef.current.vfxPool = vfxPool;

    // Holographic Temporal Echo Clone Mesh for 4D Spacetime Pincer Strikes during Duels!
    const echoGeo = new THREE.CylinderGeometry(0.28, 0.36, 1.35, 16);
    const echoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const temporalEchoMesh = new THREE.Mesh(echoGeo, echoMat);
    temporalEchoMesh.visible = false;
    scene.add(temporalEchoMesh);

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
        // Prioritize captures/chrono-intercepts on that square, or moves into the selected targetMoveW/targetMoveZ slice
        const chosenMove =
          sim.validMoves.find(
            (m) => m.to.row === coord.row && m.to.col === coord.col && m.isCapture
          ) ||
          sim.validMoves.find(
            (m) =>
              m.to.row === coord.row &&
              m.to.col === coord.col &&
              m.to.w === sim.targetMoveW &&
              m.to.z === sim.targetMoveZ
          ) ||
          sim.validMoves.find((m) => m.to.row === coord.row && m.to.col === coord.col);

        if (activePiece && chosenMove) {
          executeChessMove(activePiece, chosenMove);
          return;
        }
      }

      const clickedPiece = getPieceAtProjected(
        sim.pieces,
        coord.row,
        coord.col,
        sim.activeSliceZ,
        sim.activeSliceW
      );
      if (clickedPiece && clickedPiece.faction === sim.turnFaction) {
        soundEngine.playChessSelect();
        sim.selectedPieceId = clickedPiece.id;
        sim.targetMoveW = clickedPiece.w;
        sim.targetMoveZ = clickedPiece.z;
        setTargetMoveW(clickedPiece.w);
        setTargetMoveZ(clickedPiece.z);
        sim.validMoves = getValidMovesForPiece(
          clickedPiece,
          sim.pieces,
          clickedPiece.z,
          clickedPiece.w
        );
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
      } else if (e.key === 'v' || e.key === 'V') {
        const next = sim.combatCameraMode === 'first_person' ? 'side_arena' : 'first_person';
        sim.combatCameraMode = next;
        setCombatCameraMode(next);
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
      } else if (e.code === 'KeyQ') {
        triggerFighter4DPhaseShift(human, addCallout);
      } else if (e.code === 'KeyE') {
        triggerFighterTemporalEcho(human, addCallout);
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

      // Rotate & project the 4D Tesseract (8-cell Hypercube) in the sky!
      update4DTesseractProjection(arenaRig, elapsed, sim.activeSliceW, sim.activeSliceZ);

      // Spin any active 4D Unseen Threat Sigils on the board
      arenaRig.threatSigilMeshes.forEach((sigil) => {
        if (sigil.visible) {
          sigil.rotation.z += rawDelta * 2.2;
        }
      });

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
        temporalEchoMesh.visible = false;
        arenaRig.tesseractLines.visible = true;
        arenaRig.quantumLatticeGroup.visible = true;
        if (sim.firstPersonRig) {
          sim.firstPersonRig.root.visible = false;
        }

        // Restore camera FOV & level horizon when back on the Chessboard
        if (Math.abs(camera.fov - 45) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, 45, 8, rawDelta);
          camera.updateProjectionMatrix();
        }
        sim.currentDutchRoll = THREE.MathUtils.damp(sim.currentDutchRoll, 0, 10, rawDelta);

        const isQuantumManifold = sim.activeSliceW !== 0 || sim.activeSliceZ !== 0;

        // Distinct Visual Language between Classical Prime Sanctuary (W=0, Z=0) and Quantum 4D Manifold (W≠0 or Z≠0)
        scene.environmentIntensity = THREE.MathUtils.damp(
          scene.environmentIntensity ?? 0.65,
          isQuantumManifold ? 0.5 : 0.65,
          5,
          rawDelta
        );
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.density = THREE.MathUtils.damp(
            scene.fog.density,
            isQuantumManifold ? 0.028 : 0.022,
            5,
            rawDelta
          );
        }

        const targetKey = isQuantumManifold ? 1.15 : 1.65;
        keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, targetKey, 5, rawDelta);
        hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, isQuantumManifold ? 0.62 : 0.48, 5, rawDelta);
        rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, isQuantumManifold ? 1.55 : 0.95, 5, rawDelta);
        warmFill.color.setHex(
          sim.activeSliceW > 0
            ? 0x38bdf8
            : sim.activeSliceW < 0
            ? 0xc084fc
            : sim.activeSliceZ > 0
            ? 0x34d399
            : 0xf59e0b
        );
        warmFill.intensity = THREE.MathUtils.damp(
          warmFill.intensity,
          isQuantumManifold ? 1.45 : 0.85,
          5,
          rawDelta
        );

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

        // Position & render all 32 pieces with Single-3D-Slice 4D Quantum Perception!
        for (const piece of sim.pieces) {
          const rig = sim.pieceRigs.get(piece.id);
          if (!rig) continue;
          rig.root.visible = true;

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

          const isSameSlice = piece.w === sim.activeSliceW && piece.z === sim.activeSliceZ;
          const wDiff = piece.w - sim.activeSliceW;
          const zDiff = piece.z - sim.activeSliceZ;
          const elevation4D = isSameSlice ? 0 : 0.36 * Math.abs(wDiff) + 0.55 * Math.abs(zDiff);

          boardToWorld(piece.row, piece.col, _vec3A);
          rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, _vec3A.x + wDiff * 0.14, 10, rawDelta);
          rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, elevation4D, 10, rawDelta);
          rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, _vec3A.z, 10, rawDelta);
          rig.root.scale.setScalar(THREE.MathUtils.damp(rig.root.scale.x, isSameSlice ? 1.0 : 0.88, 8, rawDelta));

          const targetYaw = piece.faction === 'w' ? Math.PI : 0;
          rig.root.rotation.y = THREE.MathUtils.damp(rig.root.rotation.y, targetYaw, 8, rawDelta);

          rig.surpriseGroup.visible = false;
          const showQuantumOrbits =
            piece.w !== 0 || piece.z !== 0 || !isSameSlice || Boolean(piece.entangledWithId);
          rig.tesseractBadge.visible = piece.w !== 0 || piece.z !== 0 || !isSameSlice;
          rig.quantumWaveGroup.visible = showQuantumOrbits;
          if (showQuantumOrbits) {
            rig.tesseractBadge.rotation.y += rawDelta * 2.5;
            rig.tesseractBadge.rotation.x += rawDelta * 1.8;
            rig.quantumWaveGroup.rotation.y += rawDelta * 3.2;
            rig.quantumWaveGroup.rotation.z += rawDelta * 2.1;
          }

          const targetOpacity = isSameSlice ? 1.0 : 0.38;
          for (const mesh of rig.allStandardMeshes) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (Math.abs(mat.opacity - targetOpacity) > 0.01) {
              mat.transparent = targetOpacity < 0.99;
              mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 10, rawDelta);
              mat.needsUpdate = true;
            }
          }

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

        // Render 3D Double-Helix Quantum Entanglement Arcs between |Φ⁺⟩ Bell Pairs!
        arenaRig.entanglementHelixLines.visible = true;
        const entangledPairs: { a: THREE.Vector3; b: THREE.Vector3 }[] = [];
        const visitedIds = new Set<string>();
        for (const p of sim.pieces) {
          if (p.entangledWithId && !visitedIds.has(p.id)) {
            const partner = sim.pieces.find((x) => x.id === p.entangledWithId);
            if (partner) {
              visitedIds.add(p.id);
              visitedIds.add(partner.id);
              const rigA = sim.pieceRigs.get(p.id);
              const rigB = sim.pieceRigs.get(partner.id);
              if (rigA && rigB) {
                entangledPairs.push({
                  a: rigA.root.position,
                  b: rigB.root.position,
                });
              }
            }
          }
        }
        updateQuantumEntanglementBeams(arenaRig, entangledPairs, elapsed);

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
          arenaRig.tesseractLines.visible = false;
          arenaRig.entanglementHelixLines.visible = false;
          sim.phaseTimer += rawDelta;

          const atkWorldX = sim.duelCenterWorld.x + atk.x * 0.72;
          const atkWorldY = atk.y * 0.72;
          const atkWorldZ = sim.duelCenterWorld.z;
          const atkEyeH = getWarriorEyeHeightWorld(atk.piece.type);

          const defWorldX = sim.duelCenterWorld.x + def.x * 0.72;
          const defWorldY = def.y * 0.72;
          const defWorldZ = sim.duelCenterWorld.z;
          const defEyeH = getWarriorEyeHeightWorld(def.piece.type);

          const midWorldX = (atkWorldX + defWorldX) * 0.5;
          const atkRig = sim.pieceRigs.get(atk.piece.id);
          const defRig = sim.pieceRigs.get(def.piece.id);

          if (sim.phase === 'TRANSITION_TO_FIGHT' && sim.phaseTimer >= 0.55) {
            sim.phase = 'FIGHT_INTRO';
            sim.phaseTimer = 0;
            sim.introShotIndex = 0;
            setIntroShotIndex(0);
            setPhase('FIGHT_INTRO');
            soundEngine.playWesternStandoffCut(0);
            // Snap Challenger into place & start at wide FOV (62°) directly in front of Challenger's eyes, then CRASH-ZOOM to 9.5° in 0.14s!
            if (atkRig) {
              atkRig.root.position.set(atkWorldX, atkWorldY, atkWorldZ);
              atkRig.root.scale.setScalar(1.42);
              atkRig.root.rotation.y = Math.PI / 2;
            }
            camera.position.set(atkWorldX + 1.48, atkWorldY + atkEyeH, atkWorldZ);
            sim.currentLookAt.set(atkWorldX, atkWorldY + atkEyeH, atkWorldZ);
            camera.fov = 62; // Starts wide and immediately punches in via high-speed optical crash zoom!
            sim.currentDutchRoll = 0.04;
          } else if (sim.phase === 'FIGHT_INTRO') {
            // 3-Shot Sergio Leone / Tarantino Optical Crash-Zoom Sequence:
            // Shot 0 (0.00s - 0.85s): Challenger Extreme Eye Crash-Zoom (62° -> 9.5° in 0.14s!)
            // Shot 1 (0.85s - 1.70s): Defender Extreme Eye Counter-Crash-Zoom (62° -> 9.5° in 0.14s!)
            // Shot 2 (1.70s - 2.25s): Snap-Zoom into First-Person Warrior Visor POV!
            const nextShot = sim.phaseTimer < 0.85 ? 0 : sim.phaseTimer < 1.7 ? 1 : 2;
            if (nextShot !== sim.introShotIndex) {
              sim.introShotIndex = nextShot;
              setIntroShotIndex(nextShot);
              soundEngine.playWesternStandoffCut(nextShot);
              if (nextShot === 1) {
                if (defRig) {
                  defRig.root.position.set(defWorldX, defWorldY, defWorldZ);
                  defRig.root.scale.setScalar(1.42);
                  defRig.root.rotation.y = -Math.PI / 2;
                }
                camera.position.set(defWorldX - 1.48, defWorldY + defEyeH, defWorldZ);
                sim.currentLookAt.set(defWorldX, defWorldY + defEyeH, defWorldZ);
                camera.fov = 62; // Starts wide and immediately CRASH-ZOOMS into Defender's glaring eyes!
                sim.currentDutchRoll = -0.04;
              } else if (nextShot === 2) {
                const human = !atk.isAI ? atk : !def.isAI ? def : atk;
                const opp = human === atk ? def : atk;
                const hWorldX = sim.duelCenterWorld.x + human.x * 0.72;
                const hWorldY = human.y * 0.72;
                const hEyeH = getWarriorEyeHeightWorld(human.piece.type);
                const oWorldX = sim.duelCenterWorld.x + opp.x * 0.72;
                const oWorldY = opp.y * 0.72;
                const oEyeH = getWarriorEyeHeightWorld(opp.piece.type);

                camera.position.set(hWorldX, hWorldY + hEyeH, sim.duelCenterWorld.z);
                sim.currentLookAt.set(oWorldX, oWorldY + oEyeH * 0.82, sim.duelCenterWorld.z);
                camera.fov = 22; // Snap-zooms out into 56° First-Person Visor FOV!
                sim.currentDutchRoll = 0;
              }
            }
            if (sim.phaseTimer >= 2.25) {
              sim.phase = 'FIGHT_ACTIVE';
              sim.phaseTimer = 0;
              sim.introShotIndex = -1;
              setIntroShotIndex(-1);
              setPhase('FIGHT_ACTIVE');
            }
          }

          // 1. HIGH-CONTRAST STAGE SPOTLIGHTING & QUANTUM TUNNELING FIELD:
          const isQuantumCombat =
            atk.wPhaseTimerMs > 0 ||
            def.wPhaseTimerMs > 0 ||
            atk.temporalEchoTimerMs > 0 ||
            def.temporalEchoTimerMs > 0;

          arenaRig.quantumLatticeGroup.visible = isQuantumCombat;
          if (isQuantumCombat) {
            update4DTesseractProjection(arenaRig, elapsed * 2.5, atk.wPhaseOffset || 1, 0);
          }

          scene.environmentIntensity = THREE.MathUtils.damp(
            scene.environmentIntensity ?? 0.65,
            0.38,
            8,
            rawDelta
          );
          if (scene.fog instanceof THREE.FogExp2) {
            scene.fog.density = THREE.MathUtils.damp(scene.fog.density, 0.034, 6, rawDelta);
          }

          keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, 0.25, 8, rawDelta);
          hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, 0.28, 8, rawDelta);
          rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, 1.25, 8, rawDelta);
          warmFill.intensity = THREE.MathUtils.damp(warmFill.intensity, 0.18, 8, rawDelta);

          // Position blazing overhead spotlights so both fighters' eyes, armor, and stage floor are vividly lit!
          arenaRig.spotAttacker.position.set(atkWorldX + 0.45, 6.8, atkWorldZ + 2.2);
          arenaRig.spotAttacker.target.position.set(atkWorldX, atkWorldY + 0.95, atkWorldZ);
          arenaRig.spotAttacker.intensity = THREE.MathUtils.damp(arenaRig.spotAttacker.intensity, 210.0, 10, rawDelta);

          arenaRig.spotDefender.position.set(defWorldX - 0.45, 6.8, defWorldZ + 2.2);
          arenaRig.spotDefender.target.position.set(defWorldX, defWorldY + 0.95, defWorldZ);
          arenaRig.spotDefender.intensity = THREE.MathUtils.damp(arenaRig.spotDefender.intensity, 210.0, 10, rawDelta);

          // Vertical overhead volumetric light shafts descending directly onto each fighter
          arenaRig.volumetricConeAttacker.position.set(atkWorldX, 3.2, atkWorldZ);
          arenaRig.volumetricConeAttacker.rotation.set(0, 0, 0);
          (arenaRig.volumetricConeAttacker.material as THREE.MeshBasicMaterial).opacity =
            THREE.MathUtils.damp(
              (arenaRig.volumetricConeAttacker.material as THREE.MeshBasicMaterial).opacity,
              sim.phase === 'FIGHT_INTRO' ? 0.0 : 0.05,
              6,
              rawDelta
            );

          arenaRig.volumetricConeDefender.position.set(defWorldX, 3.2, defWorldZ);
          arenaRig.volumetricConeDefender.rotation.set(0, 0, 0);
          (arenaRig.volumetricConeDefender.material as THREE.MeshBasicMaterial).opacity =
            THREE.MathUtils.damp(
              (arenaRig.volumetricConeDefender.material as THREE.MeshBasicMaterial).opacity,
              sim.phase === 'FIGHT_INTRO' ? 0.0 : 0.05,
              6,
              rawDelta
            );

          // Strong front-stage fill light illuminating both duelists
          arenaRig.clashPointLight.position.set(midWorldX, 2.15, sim.duelCenterWorld.z + 2.2);
          arenaRig.clashPointLight.intensity = THREE.MathUtils.damp(arenaRig.clashPointLight.intensity, 28.0, 8, rawDelta);

          arenaRig.duelRingGroup.position.x = sim.duelCenterWorld.x;
          arenaRig.duelRingGroup.position.z = sim.duelCenterWorld.z;
          arenaRig.duelRingGroup.position.y = THREE.MathUtils.damp(
            arenaRig.duelRingGroup.position.y,
            0.0,
            9,
            rawDelta
          );
          (arenaRig.duelBarrierMesh.material as THREE.MeshBasicMaterial).opacity =
            THREE.MathUtils.damp(
              (arenaRig.duelBarrierMesh.material as THREE.MeshBasicMaterial).opacity,
              0.04,
              5,
              rawDelta
            );

          // Render Temporal Echo Hologram Clone if either fighter has bifurcated timelines!
          const echoOwner = atk.temporalEchoTimerMs > 0 ? atk : def.temporalEchoTimerMs > 0 ? def : null;
          if (echoOwner) {
            temporalEchoMesh.visible = true;
            temporalEchoMesh.position.set(
              sim.duelCenterWorld.x + echoOwner.temporalEchoX * 0.72,
              0.7,
              sim.duelCenterWorld.z
            );
            temporalEchoMesh.rotation.y += rawDelta * 8;
          } else {
            temporalEchoMesh.visible = false;
          }

          // 2. COMEDIC BYSTANDER PIECES & FULL ARENA RING CLEARANCE:
          // Clear all non-fighting pieces outside the 4.6-unit Duel Ring perimeter AND out of the camera's front viewing corridor so ONLY the two fighters occupy the spotlighted stage!
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

            const distToRingCenter = Math.hypot(
              curWorldX - sim.duelCenterWorld.x,
              curWorldZ - sim.duelCenterWorld.z
            );
            const distToAtk = Math.hypot(curWorldX - atkWorldX, curWorldZ - atkWorldZ);
            const distToDef = Math.hypot(curWorldX - defWorldX, curWorldZ - defWorldZ);
            const minFighterDist = Math.min(distToAtk, distToDef);

            // Check if this bystander is inside the 4.65-unit Duel Ring OR in the foreground camera sightline corridor!
            const inArenaRing = distToRingCenter < 4.65;
            const inCameraCorridor =
              curWorldZ > sim.duelCenterWorld.z - 0.6 &&
              curWorldZ < sim.duelCenterWorld.z + 6.0 &&
              Math.abs(curWorldX - midWorldX) < 3.8;

            if (inArenaRing || inCameraCorridor || minFighterDist < 2.6) {
              let pushDirX = curWorldX - sim.duelCenterWorld.x;
              let pushDirZ = curWorldZ - sim.duelCenterWorld.z;

              if (inCameraCorridor) {
                // Push sideways to the left/right flanks of the camera frustum so the fighters are 100% unobstructed!
                pushDirX = curWorldX >= midWorldX ? 1.6 : -1.6;
                pushDirZ = curWorldZ < sim.duelCenterWorld.z ? -0.9 : 0.25;
              } else if (Math.hypot(pushDirX, pushDirZ) < 0.25) {
                pushDirX = piece.col < 4 ? -1.2 : 1.2;
                pushDirZ = piece.row < 4 ? -1.2 : 1.2;
              }

              const len = Math.hypot(pushDirX, pushDirZ) || 1;
              pushDirX /= len;
              pushDirZ /= len;

              const urgency = inCameraCorridor
                ? 0.95
                : Math.max(0.45, (4.75 - distToRingCenter) / 4.75);
              bys.vx += pushDirX * (22.0 * urgency) * rawDelta;
              bys.vz += pushDirZ * (22.0 * urgency) * rawDelta;

              if (bys.y <= 0.02) {
                bys.vy = 5.4 + Math.random() * 2.0;
                soundEngine.playBystanderHop();
              }
              bys.panickedTimer = 0.65;
            } else {
              const homeDistToCenter = Math.hypot(
                _vec3A.x - sim.duelCenterWorld.x,
                _vec3A.z - sim.duelCenterWorld.z
              );
              const homeInCameraCorridor =
                _vec3A.z > sim.duelCenterWorld.z - 0.6 &&
                _vec3A.z < sim.duelCenterWorld.z + 6.0 &&
                Math.abs(_vec3A.x - midWorldX) < 3.8;

              if (!homeInCameraCorridor && homeDistToCenter > 4.95) {
                bys.vx += -bys.offsetX * 5.0 * rawDelta;
                bys.vz += -bys.offsetZ * 5.0 * rawDelta;
                if (Math.hypot(bys.offsetX, bys.offsetZ) > 0.35 && bys.y <= 0.01) {
                  bys.vy = 3.2;
                }
              }
            }

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

            const lookAngle = Math.atan2(midWorldX - rig.root.position.x, sim.duelCenterWorld.z - rig.root.position.z);
            rig.root.rotation.y = THREE.MathUtils.damp(rig.root.rotation.y, lookAngle, 10, rawDelta);

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

          // 3. Step Active Combat Simulation (with High-Noon Bullet-Time Dilation!)
          if (sim.slowMoTimer > 0) {
            sim.slowMoTimer = Math.max(0, sim.slowMoTimer - rawDelta);
          }
          const combatDelta = sim.slowMoTimer > 0 ? rawDelta * 0.24 : rawDelta;

          if (sim.hitstopTimer > 0) {
            sim.hitstopTimer = Math.max(0, sim.hitstopTimer - rawDelta);
          } else if (sim.phase === 'FIGHT_ACTIVE') {
            sim.fightTimer = Math.max(0, sim.fightTimer - combatDelta);

            const human = !atk.isAI ? atk : !def.isAI ? def : atk;
            if (
              human.action === 'idle' ||
              human.action === 'walk_fwd' ||
              human.action === 'walk_back'
            ) {
              const leftHeld = sim.keysHeld['KeyA'] || sim.keysHeld['ArrowLeft'];
              const rightHeld = sim.keysHeld['KeyD'] || sim.keysHeld['ArrowRight'];
              if (sim.combatCameraMode === 'first_person') {
                // In First-Person Visor POV, D advances toward the opponent and A steps back!
                if (rightHeld && !leftHeld) {
                  human.vx = human.facing * human.spec.walkSpeed;
                  human.action = 'walk_fwd';
                } else if (leftHeld && !rightHeld) {
                  human.vx = -human.facing * human.spec.walkSpeed;
                  human.action = 'walk_back';
                } else {
                  human.vx = 0;
                  human.action = 'idle';
                }
              } else {
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
            }

            if (atk.isAI) updateFighterAI(atk, def, combatDelta, nowMs, addCallout);
            if (def.isAI) updateFighterAI(def, atk, combatDelta, nowMs, addCallout);

            checkFighterActionVFX(atk, sim.prevAtkAction);
            checkFighterActionVFX(def, sim.prevDefAction);
            sim.prevAtkAction = atk.action;
            sim.prevDefAction = def.action;

            const stepEvents = stepCombatSimulation(atk, def, combatDelta, nowMs, addCallout);
            if (stepEvents.slowMoDurationMs > 0) {
              sim.slowMoTimer = Math.max(sim.slowMoTimer, stepEvents.slowMoDurationMs / 1000);
            }
            if (stepEvents.cameraShake > 0) {
              sim.cameraShake = Math.max(sim.cameraShake, stepEvents.cameraShake);
            }
            if (stepEvents.sparkWorldPos) {
              const worldX = sim.duelCenterWorld.x + stepEvents.sparkWorldPos.x * 0.72;
              const worldY = stepEvents.sparkWorldPos.y;
              const worldZ = sim.duelCenterWorld.z;
              spawnHitSparks(vfxPool, worldX, worldY, worldZ, stepEvents.sparkWorldPos.color, 16);

              arenaRig.clashPointLight.color.setHex(stepEvents.sparkWorldPos.color);
              arenaRig.clashPointLight.intensity = 16.0;

              if (stepEvents.cameraShake >= 0.25) {
                sim.hitstopTimer = 0.042;
                spawnShockwave(vfxPool, worldX, 0.05, worldZ, stepEvents.sparkWorldPos.color, 4.5);
                spawnGroundDebris(vfxPool, worldX, worldZ, 8);
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
              spawnShockwave(vfxPool, koWorldX, 0.05, sim.duelCenterWorld.z, 0xf59e0b, 6.5);
              spawnGroundDebris(vfxPool, koWorldX, sim.duelCenterWorld.z, 14);
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
                  survivorPiece.z = sim.pendingMove.to.z;
                  survivorPiece.w = sim.pendingMove.to.w;
                  survivorPiece.hasMoved = true;
                  survivorPiece.history.push({
                    row: survivorPiece.row,
                    col: survivorPiece.col,
                    z: survivorPiece.z,
                    w: survivorPiece.w,
                    turn: sim.turnNumber + 1,
                  });

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
              const targetWLabel = formatWName(sim.pendingMove.to.w);
              const wasUpset =
                !attackerWon ||
                winnerRuntime.spec.tacticalValue < loserRuntime.spec.tacticalValue;

              const duelLogEntry: BattleLogEntry = {
                id: `duel_${Date.now()}`,
                turnNumber: sim.turnNumber,
                summary: attackerWon
                  ? `${atk.spec.chessName} conquered ${def.spec.chessName} at ${sq} [${targetWLabel}]`
                  : `UPSET AT ${sq}: Defending ${def.spec.chessName} slew Attacking ${atk.spec.chessName}!`,
                detail: `${winnerRuntime.spec.warriorTitle} survived with ${survivorPiece?.hp ?? winnerRuntime.hp} HP (${survivorPiece?.kills ?? 1} Kills).`,
                wasUpset,
                winnerFaction: winnerRuntime.piece.faction,
              };

              setBattleLogs((prev) => [duelLogEntry, ...prev.slice(0, 7)]);

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
          const human = !atk.isAI ? atk : !def.isAI ? def : atk;
          const opponent = human === atk ? def : atk;
          const isFirstPersonActive =
            (sim.phase === 'FIGHT_ACTIVE' ||
              (sim.phase === 'FIGHT_INTRO' && sim.introShotIndex === 2)) &&
            sim.combatCameraMode === 'first_person';

          const fighterPairs: [FighterRuntime, ArticulatedPieceRig | undefined][] = [
            [atk, atkRig],
            [def, defRig],
          ];

          for (const [f, rig] of fighterPairs) {
            if (!rig) continue;
            const targetWorldX = sim.duelCenterWorld.x + f.x * 0.72;
            const targetWorldY = f.y * 0.72;
            const phaseOffsetZ = f.wPhaseTimerMs > 0 ? f.wPhaseOffset * 0.65 : 0;
            const targetWorldZ = sim.duelCenterWorld.z + phaseOffsetZ;

            rig.root.position.x = THREE.MathUtils.damp(
              rig.root.position.x,
              targetWorldX,
              28,
              rawDelta
            );
            rig.root.position.y = THREE.MathUtils.damp(
              rig.root.position.y,
              targetWorldY,
              28,
              rawDelta
            );
            rig.root.position.z = THREE.MathUtils.damp(
              rig.root.position.z,
              targetWorldZ,
              28,
              rawDelta
            );

            rig.root.scale.setScalar(
              THREE.MathUtils.damp(rig.root.scale.x, 1.42, 22, rawDelta)
            );

            // Visibility rules:
            // - During Shot 0 (Challenger Extreme Eye Crash-Zoom), hide Defender so Challenger's eyes are 100% unobstructed head-on!
            // - During Shot 1 (Defender Extreme Eye Crash-Zoom), hide Challenger so Defender's eyes are 100% unobstructed head-on!
            // - During First-Person Combat, hide the human fighter's 3rd-person body and show the First-Person Weapon/Shield Viewmodel!
            if (sim.phase === 'FIGHT_INTRO' && sim.introShotIndex === 0) {
              rig.root.visible = f === atk;
            } else if (sim.phase === 'FIGHT_INTRO' && sim.introShotIndex === 1) {
              rig.root.visible = f === def;
            } else if (isFirstPersonActive && f === human) {
              rig.root.visible = false;
            } else {
              rig.root.visible = true;
            }

            if (f.wPhaseTimerMs <= 0) {
              for (const mesh of rig.allStandardMeshes) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat.opacity < 0.99) {
                  mat.opacity = 1.0;
                  mat.transparent = false;
                  mat.needsUpdate = true;
                }
              }
            }

            const targetFacingYaw = f.facing === 1 ? Math.PI / 2 : -Math.PI / 2;
            rig.root.rotation.y = THREE.MathUtils.damp(
              rig.root.rotation.y,
              targetFacingYaw,
              24,
              rawDelta
            );

            animateFighterRig(rig, f, elapsed, rawDelta);

            // Keep head level during extreme eye Crash-Zooms so the glowing eyes lock dead-center into the lens!
            if (sim.phase === 'FIGHT_INTRO' && (sim.introShotIndex === 0 || sim.introShotIndex === 1)) {
              rig.headGroup.rotation.set(0, 0, 0);
              rig.bodyPivot.rotation.set(0, 0, 0);
            }
          }

          // Animate First-Person Weapon & Shield Viewmodel Rig when in First-Person Mode!
          if (sim.firstPersonRig) {
            sim.firstPersonRig.root.visible = isFirstPersonActive;
            if (isFirstPersonActive) {
              animateFirstPersonViewmodel(sim.firstPersonRig, human, elapsed, rawDelta);
            }
          }

          // 4. SPAGHETTI WESTERN OPTICAL CRASH-ZOOMS -> FIRST-PERSON VISOR COMBAT CAMERA
          const midX = sim.duelCenterWorld.x + ((atk.x + def.x) * 0.5) * 0.72;
          const midY = 0.96 + Math.max(atk.y, def.y) * 0.22;
          const midZ = sim.duelCenterWorld.z;
          const sep = Math.abs(atk.x - def.x);

          let targetFov = 38;
          let fovDampSpeed = 14;
          let targetDutchRoll = 0;
          let camLerpSpeed = 14;

          if (sim.phase === 'TRANSITION_TO_FIGHT') {
            _camTargetPos.set(midX, 1.75, midZ + 5.0);
            _camLookTarget.set(midX, 1.0, midZ);
            targetFov = 42;
            fovDampSpeed = 12;
            targetDutchRoll = 0.03;
            camLerpSpeed = 12;
          } else if (sim.phase === 'FIGHT_INTRO') {
            if (sim.introShotIndex === 0) {
              // SHOT 0: Sergio Leone Extreme Eye CRASH-ZOOM on Challenger (FOV 62° -> 9.5° in 0.14s, locked dead-on Challenger's glowing eyes!)
              _camTargetPos.set(atkWorldX + 1.48, atkWorldY + atkEyeH, atkWorldZ);
              _camLookTarget.set(atkWorldX, atkWorldY + atkEyeH, atkWorldZ);
              targetFov = 9.5;
              fovDampSpeed = 32; // Violent, high-speed optical crash zoom!
              targetDutchRoll = 0.035;
              camLerpSpeed = 40;
            } else if (sim.introShotIndex === 1) {
              // SHOT 1: Sergio Leone Extreme Eye Counter-CRASH-ZOOM on Defender (FOV 62° -> 9.5° in 0.14s, locked dead-on Defender's glaring eyes!)
              _camTargetPos.set(defWorldX - 1.48, defWorldY + defEyeH, defWorldZ);
              _camLookTarget.set(defWorldX, defWorldY + defEyeH, defWorldZ);
              targetFov = 9.5;
              fovDampSpeed = 32; // Violent, high-speed optical crash zoom!
              targetDutchRoll = -0.035;
              camLerpSpeed = 40;
            } else {
              // SHOT 2: Snap-Zoom out into Human Warrior's First-Person Helmet Visor POV!
              const hWorldX = sim.duelCenterWorld.x + human.x * 0.72;
              const hWorldY = human.y * 0.72;
              const hEyeH = getWarriorEyeHeightWorld(human.piece.type);
              const oWorldX = sim.duelCenterWorld.x + opponent.x * 0.72;
              const oWorldY = opponent.y * 0.72;
              const oEyeH = getWarriorEyeHeightWorld(opponent.piece.type);

              _camTargetPos.set(hWorldX, hWorldY + hEyeH, midZ);
              _camLookTarget.set(oWorldX, oWorldY + oEyeH * 0.82, midZ);
              targetFov = 56;
              fovDampSpeed = 24;
              targetDutchRoll = 0;
              camLerpSpeed = 28;
            }
          } else if (sim.phase === 'FIGHT_OUTRO') {
            // Heroic 3rd-Person Victory Shot on the surviving warrior under the spotlight!
            const winnerWorldX =
              def.hp <= 0 || (atk.hp > 0 && atk.hp / atk.maxHp >= def.hp / def.maxHp)
                ? atkWorldX
                : defWorldX;
            const winnerIsAtk = winnerWorldX === atkWorldX;
            _camTargetPos.set(
              winnerWorldX + (winnerIsAtk ? 0.85 : -0.85),
              1.32,
              midZ + 2.95
            );
            _camLookTarget.set(winnerWorldX, 1.12, midZ);
            targetFov = 29;
            fovDampSpeed = 14;
            targetDutchRoll = winnerIsAtk ? 0.06 : -0.06;
            camLerpSpeed = 12;
          } else if (sim.combatCameraMode === 'first_person') {
            // FIRST-PERSON VISOR COMBAT MODE (Default after the Western Crash Zooms!)
            const hWorldX = sim.duelCenterWorld.x + human.x * 0.72;
            const hWorldY = human.y * 0.72;
            const hPhaseZ = human.wPhaseTimerMs > 0 ? human.wPhaseOffset * 0.65 : 0;
            const hWorldZ = midZ + hPhaseZ;
            const hEyeH = getWarriorEyeHeightWorld(human.piece.type);

            const oWorldX = sim.duelCenterWorld.x + opponent.x * 0.72;
            const oWorldY = opponent.y * 0.72;
            const oPhaseZ = opponent.wPhaseTimerMs > 0 ? opponent.wPhaseOffset * 0.65 : 0;
            const oWorldZ = midZ + oPhaseZ;
            const oEyeH = getWarriorEyeHeightWorld(opponent.piece.type);

            const walkBob =
              human.action === 'walk_fwd' || human.action === 'walk_back'
                ? Math.sin(elapsed * 14) * 0.035
                : Math.sin(elapsed * 2.5) * 0.008;

            _camTargetPos.set(hWorldX, hWorldY + hEyeH + walkBob, hWorldZ);
            _camLookTarget.set(oWorldX, oWorldY + oEyeH * 0.78, oWorldZ);
            targetFov = human.action === 'special' ? 64 : human.wPhaseTimerMs > 0 ? 66 : 56;
            fovDampSpeed = 18;
            targetDutchRoll =
              human.action === 'hitstun'
                ? 0.08
                : human.wPhaseTimerMs > 0
                ? 0.05 * human.wPhaseOffset
                : 0;
            camLerpSpeed = 28;
          } else {
            // Optional Side Arena Camera (Toggled via 'V' key or HUD button)
            const camDistZ = THREE.MathUtils.clamp(4.45 + sep * 0.45, 4.5, 7.2);
            _camTargetPos.set(midX, 1.62 + Math.max(atk.y, def.y) * 0.18, midZ + camDistZ);
            _camLookTarget.set(midX, midY, midZ);
            targetFov = 38;
            fovDampSpeed = 12;
            targetDutchRoll = 0;
            camLerpSpeed = 12;
          }

          if (sim.cameraShake > 0) {
            _camTargetPos.x += (Math.random() - 0.5) * sim.cameraShake * 0.6;
            _camTargetPos.y += (Math.random() - 0.5) * sim.cameraShake * 0.6;
            targetDutchRoll += (Math.random() - 0.5) * sim.cameraShake * 0.22;
            sim.cameraShake = Math.max(0, sim.cameraShake - rawDelta * 1.8);
          }

          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, fovDampSpeed, rawDelta);
          camera.updateProjectionMatrix();

          camera.position.lerp(_camTargetPos, 1 - Math.exp(-camLerpSpeed * rawDelta));
          sim.currentLookAt.lerp(_camLookTarget, 1 - Math.exp(-(camLerpSpeed + 4) * rawDelta));
          camera.lookAt(sim.currentLookAt);

          // Apply Dutch Angle roll around the camera's local line-of-sight axis after lookAt!
          sim.currentDutchRoll = THREE.MathUtils.damp(
            sim.currentDutchRoll,
            targetDutchRoll,
            camLerpSpeed,
            rawDelta
          );
          camera.rotateZ(sim.currentDutchRoll);

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
          CROWNBREAKER 4D
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <button
            onClick={handleTrigger4DHyperScenario}
            className="hover:text-purple-400 text-purple-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            4D Hyper-Ambush Demo
          </button>
          <button
            onClick={handleTriggerFeaturedBoardClash}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pawn vs Queen Clash
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

      {/* 3. Top-Left Tactical / Quantum 4D Manifold Inspector & Unseen 4D Threat Radar (during CHESS_VIEW) */}
      {phase === 'CHESS_VIEW' && (
        <div className="pointer-events-auto fixed top-[68px] left-6 z-20 flex flex-col gap-2 max-w-sm">
          <div
            className={`rounded-xl px-4 py-3 shadow-xl border transition-colors ${
              activeSliceW !== 0 || activeSliceZ !== 0
                ? 'bg-[#090616]/95 border-cyan-400/70 shadow-[0_0_30px_rgba(56,189,248,0.18)]'
                : 'bg-[#0B0E17]/95 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>
                {timelineBranchLabel.toUpperCase()} · TURN {turnNumber}
              </span>
              <span className={activeSliceW !== 0 || activeSliceZ !== 0 ? 'text-cyan-300 font-bold' : 'text-amber-300'}>
                |ψ⟩ = |W={activeSliceW}, Z={activeSliceZ}⟩
              </span>
            </div>
            <div className="font-display text-base font-bold text-white mt-0.5">
              {activeSliceW !== 0 || activeSliceZ !== 0
                ? `Quantum Manifold: ${formatWName(activeSliceW)} · ${formatZName(activeSliceZ)}`
                : turnFaction === 'w'
                ? 'Solaris Order (White) to Move'
                : 'Obsidian Dominion (Black) to Move'}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              {activeSliceW !== 0 || activeSliceZ !== 0 ? (
                <>
                  Observing <span className="text-cyan-300 font-semibold">Quantum 4D Eigenstate</span>. Schrödinger probability waves &amp; <span className="text-cyan-300">|Φ⁺⟩ Double-Helix Beams</span> link entangled allies!
                </>
              ) : (
                <>
                  Classical Prime Sanctuary (<span className="text-amber-300">|W=0, Z=0⟩</span>). Cyan <span className="text-cyan-300">|Φ⁺⟩ Double-Helix Arcs</span> mark Quantum Entangled Bell Pairs!
                </>
              )}
            </div>

            {canRewindTimeline && (
              <button
                onClick={handleChronoRewind}
                className="mt-2 w-full px-3 py-1.5 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-400/50 rounded-lg text-[11px] font-mono font-semibold text-cyan-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Rewind spacetime causality by 1 turn (Δt = -1) and fork a parallel multiverse timeline branch!"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-300" />
                Chrono-Rewind Causality (Δt = -1 · Fork Timeline)
              </button>
            )}
          </div>

          {/* Unseen 4D Cross-Dimensional Threat Alert */}
          {unseenThreats.length > 0 && (
            <div className="bg-[#090616]/95 border border-purple-500/70 rounded-xl px-4 py-2.5 shadow-xl">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-purple-300">
                <AlertTriangle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>{unseenThreats.length} QUANTUM ENTANGLED THREAT{unseenThreats.length > 1 ? 'S' : ''}!</span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                {unseenThreats[0].axisDescription} threatens square{' '}
                <span className="font-mono font-bold text-white">
                  {formatSquareName({ row: unseenThreats[0].targetRow, col: unseenThreats[0].targetCol })}
                </span>
                .
              </div>
              <button
                onClick={() =>
                  handleSelect4DSlice(unseenThreats[0].attacker.w, unseenThreats[0].attacker.z, true)
                }
                className="mt-1.5 px-2.5 py-1 bg-purple-950/90 hover:bg-purple-900 border border-purple-500/40 rounded text-[11px] font-mono text-purple-200 transition-colors cursor-pointer"
              >
                Collapse Wavefunction to Attacker&apos;s Slice ({formatWName(unseenThreats[0].attacker.w)})
              </button>
            </div>
          )}

          {/* Selected Piece + 4D Quantum Tunneling Projector & Bell-State Entanglement */}
          {selectedPiece && (
            <div className="bg-[#0B0E17]/95 border border-cyan-500/50 rounded-xl px-4 py-3 shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                <span>
                  {ARCHETYPES[selectedPiece.type].chessName.toUpperCase()} · |W={selectedPiece.w}, Z={selectedPiece.z}⟩
                </span>
                <span className="tabular-nums text-amber-300">
                  {selectedPiece.hp}/{selectedPiece.maxHp} HP
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <div className="font-display text-sm font-bold text-white">
                  {ARCHETYPES[selectedPiece.type].warriorTitle}
                </div>
                <button
                  onClick={handleEntangleSelectedPiece}
                  className="px-2 py-0.5 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-400/50 rounded text-[10px] font-mono text-cyan-200 transition-colors cursor-pointer"
                  title="Entangle this warrior in a |Φ⁺⟩ Quantum Bell Pair with your highest-value ally for +15% starting meter, passive regeneration, and Entangled Assist Strikes!"
                >
                  {selectedPiece.entangledWithId ? '|Φ⁺⟩ Re-Entangle' : '+ |Φ⁺⟩ Entangle Pair'}
                </button>
              </div>

              {/* 4D Move Projection Selector */}
              <div className="mt-2 pt-2 border-t border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 mb-1.5 flex items-center gap-1">
                  <Orbit className="w-3 h-3 text-cyan-400" />
                  <span>QUANTUM TUNNEL MOVE INTO EIGENSTATE:</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      [-1, '|ψ₋⟩ Kata'],
                      [0, '|ψ₀⟩ Prime'],
                      [1, '|ψ₊⟩ Ana'],
                    ] as [number, string][]
                  ).map(([wVal, label]) => (
                    <button
                      key={wVal}
                      onClick={() => handleSelect4DSlice(wVal, targetMoveZ, false)}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                        targetMoveW === wVal
                          ? 'bg-cyan-600 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hoveredCaptureMove && hoveredCaptureMove.targetPiece && selectedPiece && (
            <div className="bg-[#0B0E17]/95 border border-rose-500/70 rounded-xl px-4 py-3 shadow-2xl">
              <div className="text-[11px] font-mono font-bold text-rose-400">
                {hoveredCaptureMove.dimensionLabel || `IMMINENT DUEL AT SQUARE ${formatSquareName(hoveredCaptureMove.to)}`}
              </div>
              <div className="font-display text-sm font-bold text-white mt-0.5">
                {ARCHETYPES[selectedPiece.type].chessName} ({selectedPiece.hp} HP) vs {ARCHETYPES[hoveredCaptureMove.targetPiece.type].chessName} ({hoveredCaptureMove.targetPiece.hp} HP)
              </div>
              <div className="text-[11px] text-slate-300 mt-1">
                Click square for <span className="text-amber-300">Western Crash-Zooms</span> → <span className="text-cyan-300">First-Person Visor Combat</span>!
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
        introShotIndex={introShotIndex}
        combatCameraMode={combatCameraMode}
        onToggleCombatCameraMode={handleToggleCombatCameraMode}
        callouts={callouts}
        dockCollapsed={dockCollapsed}
        onToggleDock={() => setDockCollapsed((p) => !p)}
        onPlayerInput={handlePlayerCombatInput}
      />

      {/* 7. Unified Collapsible Bottom Control Dock (during CHESS_VIEW) */}
      {phase === 'CHESS_VIEW' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(1020px,95vw)] flex flex-col items-center pointer-events-auto">
          <button
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="mb-1 px-3 py-1 text-xs font-mono text-slate-300 bg-[#0B0E17]/95 border border-slate-800 rounded-t-lg hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {dockCollapsed ? '▴ Show 4D Hypercube Navigator & Instant Clash (H)' : '▾ Hide Controls (H)'}
          </button>

          {!dockCollapsed && (
            <div className="w-full bg-[#0B0E17]/95 border border-slate-800 rounded-xl px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerFeaturedBoardClash}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Immediately trigger a Pawn vs Queen capture duel on the board!"
                >
                  <Swords className="w-3.5 h-3.5" />
                  Pawn vs Queen Clash
                </button>
                <button
                  onClick={handleTrigger4DHyperScenario}
                  className="px-3 py-2 bg-purple-950/90 hover:bg-purple-900 border border-purple-500/50 text-purple-200 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Shift pieces across the 4th spatial dimension (Ana +W / Kata -W) to experience Unseen 4D Threats & Cross-Dimensional Ambushes!"
                >
                  <Orbit className="w-3.5 h-3.5 text-purple-400" />
                  4D Hyper-Ambush
                </button>
                <button
                  onClick={() => setCodexOpen(true)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Matchups
                </button>
              </div>

              {/* 4D Hypercube W-Slice & Z-Stratum Navigator */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <Layers className="w-3.5 h-3.5 text-purple-400 ml-1.5 mr-1" />
                {(
                  [
                    [-1, 0, 'Kata (-W)'],
                    [0, 0, 'Prime (W=0)'],
                    [1, 0, 'Ana (+W)'],
                    [0, 1, 'Astral (+Z)'],
                  ] as [number, number, string][]
                ).map(([wVal, zVal, label]) => (
                  <button
                    key={`${wVal}_${zVal}`}
                    onClick={() => handleSelect4DSlice(wVal, zVal, true)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeSliceW === wVal && activeSliceZ === zVal
                        ? 'bg-purple-900/90 text-purple-200 border border-purple-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Camera Angle Presets + Audio/Reset */}
              <div className="flex items-center gap-2">
                <div className="hidden lg:flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <Eye className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
                  {(
                    [
                      ['white_orbit', 'Orbit'],
                      ['top_tactical', 'Top'],
                      ['cinematic_angle', 'Flank'],
                    ] as [CameraPreset, string][]
                  ).map(([preset, label]) => (
                    <button
                      key={preset}
                      onClick={() => handleSelectCameraPreset(preset)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        cameraPreset === preset
                          ? 'bg-slate-800 text-amber-400 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
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
                      4D CHRONICLE:
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
