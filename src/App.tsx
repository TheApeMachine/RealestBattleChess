import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import confetti from 'canvas-confetti';
import {
  AcademicColloquiumState,
  ActiveInterventionState,
  BattleLogEntry,
  BoardCoord,
  CausalCollapseResolution,
  ChessPiece,
  CombatCallout,
  Faction,
  FighterAction,
  FighterRuntime,
  GamePhase,
  MoveOption,
  MultiverseState,
  PieceType,
  RealmEnemySentinel,
  RealmId,
  RealmPortalNode,
  RealmTemporalEcho,
  TimelineBranch,
  TimelineSnapshot,
  UniversityRoomId,
  UnseenThreatVector,
} from './types/game';
import { ARCHETYPES } from './data/archetypes';
import {
  chooseAIMove,
  computeSquareSupportAnalysis,
  computeUnseen4DThreats,
  createInitialBoard,
  formatSquareName,
  formatWName,
  formatZName,
  getPieceAtProjected,
  getPieceLineageId,
  getValidMovesForPiece,
} from './engine/chessEngine';
import {
  collapseTimelineBranch,
  computeMultiverseParadoxMetrics,
  createInitialMultiverseState,
  ensureBranchHydrated,
  executeAIMultiverseParadoxStrike,
  executeSynodTransposition,
  forkTimelineFromBranch,
  getCounterpartManifestationsForPiece,
  getLethalRememberedSquareCollision,
  getPendingCausalBreachesForTimeline,
  getRememberedSquaresForTimelineView,
  publishSentientTheoremAcrossMultiverse,
  reconcileTimelineConvergence,
  recordCausalAssassination,
  recordRememberedSquare,
  rewindCausalAssassination,
  switchActiveTimeline,
  syncActiveTimelineFromLiveBoard,
  transitionTravelerToTimeline,
} from './engine/multiverseEngine';
import {
  BOARD_GATEWAYS,
  buildDeterministicTemporalEchoes,
  buildRealmSentinels,
  evaluateCrucibleHazards,
  evaluatePortalBoardExit,
  getGatewayAtSquare,
  getPortalsForRealm,
  PortalBoardExitEvaluation,
  REALM_METADATA,
  REALM_PORTALS,
} from './engine/realmEngine';
import {
  applyTacticalInterventionImpact,
  createFighterRuntime,
  getFighterSpeedMultiplier,
  stepCombatSimulation,
  stepVictoryTaunt,
  triggerFighter4DPhaseShift,
  triggerFighterAttack,
  triggerFighterDash,
  triggerFighterJump,
  triggerFighterTemporalEcho,
  triggerTacticalIntervention,
  triggerVictoryTaunt,
  updateFighterAI,
} from './engine/combatEngine';
import {
  createArticulatedPiece,
  ArticulatedPieceRig,
  createFirstPersonViewmodelRig,
  FirstPersonViewmodelRig,
  setPieceProfessorMode,
} from './three/pieceModels';
import {
  boardToWorld,
  createBoardArena,
  BoardArenaRig,
  update4DTesseractProjection,
  updateQuantumEntanglementBeams,
} from './three/arenaBuilder';
import {
  createSubterraneanRealms,
  SubterraneanRealmsRig,
  syncRealmEntities3D,
  updateSubterraneanRealmsAndPortals,
} from './three/realmBuilder';
import {
  animateFighterRig,
  animateFirstPersonViewmodel,
  createVFXPool,
  spawnAuraPillar,
  spawnBattleSmoke,
  spawnGroundDebris,
  spawnHitSparks,
  spawnInterventionRift,
  spawnParryImpactSparks,
  spawnShockwave,
  spawnSlashArc,
  updateVFXPool,
  VFXPool,
} from './three/combatAnimator';
import { BattleWornShader } from './three/battleWornShader';
import { soundEngine } from './audio/soundEngine';
import { CombatHudOverlay, PlayerCombatInputAction } from './components/CombatHudOverlay';
import { RealmHudOverlay } from './components/RealmHudOverlay';
import { CodexModal } from './components/CodexModal';
import {
  createMultiversalPocketWatch,
  MultiversalPocketWatchRig,
  triggerPocketWatchReaction,
  updateMultiversalPocketWatch,
} from './three/pocketWatchBuilder';
import { MultiverseModal } from './components/MultiverseModal';
import {
  AcademicColloquiumOverlay,
  createInitialAcademicColloquiumState,
  getProfessorPersona,
} from './components/AcademicColloquiumOverlay';
import {
  createUniversityOfficeRig,
  getRoomAtWorldPos,
  TRAM_STATIONS,
  triggerCoffeeSpill3DSplash,
  UNIVERSITY_ROOM_CENTERS,
  UniversityOfficeRig,
  updateUniversityOfficeScene,
} from './three/universityOfficeBuilder';
import { Volume2, VolumeX, Swords, RotateCcw, Eye, Sparkles, Orbit, Layers, AlertTriangle, Play, Pause, GitBranch, Zap, Skull, Clock, GraduationCap } from 'lucide-react';

// Pre-allocated math helpers at module scope (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

type CameraPreset = 'white_orbit' | 'top_tactical' | 'cinematic_angle' | 'pocket_watch';

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
  const [autoPlayDemo, setAutoPlayDemo] = useState<boolean>(false);
  const [demoDirectorStage, setDemoDirectorStage] = useState<string>(
    '4D QUANTUM MANIFOLD & TACTICAL COVERAGE'
  );

  // 4D Hypercube Slice State: Which 3D slice (Z, W) the player is currently observing,
  // and which target 4D slice the selected piece is projecting moves into!
  const [activeSliceW, setActiveSliceW] = useState<number>(0); // -1 = Kata, 0 = Prime, +1 = Ana
  const [activeSliceZ, setActiveSliceZ] = useState<number>(0); // 0 = Ground, 1 = Astral
  const [targetMoveW, setTargetMoveW] = useState<number>(0);
  const [targetMoveZ, setTargetMoveZ] = useState<number>(0);
  const [unseenThreats, setUnseenThreats] = useState<UnseenThreatVector[]>([]);
  const [canRewindTimeline, setCanRewindTimeline] = useState<boolean>(false);
  const [timelineBranchLabel, setTimelineBranchLabel] = useState<string>('Timeline Prime (α)');

  // Multiversal Chess, Causal Assassination & Reality Convergence State
  const initialBoardRef = useRef<ChessPiece[] | null>(null);
  if (!initialBoardRef.current) {
    initialBoardRef.current = createInitialBoard();
  }
  const initialMultiverseRef = useRef<MultiverseState | null>(null);
  if (!initialMultiverseRef.current) {
    initialMultiverseRef.current = createInitialMultiverseState(initialBoardRef.current);
  }
  const [multiverseState, setMultiverseState] = useState<MultiverseState>(
    () => initialMultiverseRef.current!
  );
  const [multiverseModalOpen, setMultiverseModalOpen] = useState<boolean>(false);
  const [activeCollapseBanner, setActiveCollapseBanner] =
    useState<CausalCollapseResolution[] | null>(null);
  const [watchShowcaseStep, setWatchShowcaseStep] = useState<number>(0);
  const [watchEventBanner, setWatchEventBanner] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);
  const [academicColloquium, setAcademicColloquium] =
    useState<AcademicColloquiumState | null>(null);

  // Subterranean Realms UI State
  const [activeRealmId, setActiveRealmId] = useState<RealmId>('SHATTERED_MIRROR');
  const [realmTraveler, setRealmTraveler] = useState<ChessPiece | null>(null);
  const [realmParityInverted, setRealmParityInverted] = useState<boolean>(false);
  const [realmCrucibleClaimed, setRealmCrucibleClaimed] = useState<boolean>(false);
  const [nearbyPortal, setNearbyPortal] = useState<RealmPortalNode | null>(null);
  const [nearbyPortalEval, setNearbyPortalEval] = useState<PortalBoardExitEvaluation | null>(null);
  const [realmStatusBanner, setRealmStatusBanner] = useState<string | null>(null);

  const [selectedPiece, setSelectedPiece] = useState<ChessPiece | null>(null);
  const [hoveredCaptureMove, setHoveredCaptureMove] = useState<MoveOption | null>(null);
  const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([
    {
      id: 'init',
      turnNumber: 1,
      summary: 'Multiverse Nexus, 4D Hypercube & Subterranean Realms Initialized',
      detail: '4 Parallel Realities active! Enter Timeline Ω-1 to assassinate the exposed Obsidian Queen and converge her death back into Prime Reality!',
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
  const [uniFirstPerson, setUniFirstPerson] = useState<boolean>(false);
  const [freeMouseLook, setFreeMouseLook] = useState<boolean>(false);
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
    multiverse: MultiverseState;
    autoConvergeToPrimeAfterDuel: boolean;
    activeCollapseResolution: CausalCollapseResolution[] | null;
    collapseDoomedRigs: ArticulatedPieceRig[];
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
    duelInRealm: boolean;
    duelOnWatch: boolean;
    duelIsAcademicDebate: boolean;
    academicColloquium: AcademicColloquiumState | null;
    horologiumSweepTimer: number;
    activeSentinelId: string | null;
    fightTimer: number;
    cameraShake: number;
    hitstopTimer: number;
    slowMoTimer: number;
    activeIntervention: ActiveInterventionState | null;
    autoPlayDemo: boolean;
    demoBoardTimer: number;
    demoCameraTimer: number;
    demoMovesWithoutCapture: number;
    demoPendingDecision: { piece: ChessPiece; move: MoveOption } | null;
    timelineSnapshots: TimelineSnapshot[];
    timelineBranchCount: number;
    keysHeld: Record<string, boolean>;
    pieceRigs: Map<string, ArticulatedPieceRig>;
    firstPersonRig: FirstPersonViewmodelRig | null;
    fpMountGroup: THREE.Group | null;
    arenaRig: BoardArenaRig | null;
    realmsRig: SubterraneanRealmsRig | null;
    pocketWatchRig: MultiversalPocketWatchRig | null;
    universityOfficeRig: UniversityOfficeRig | null;
    imminentParadoxWarning: boolean;
    vfxPool: VFXPool | null;
    controls: OrbitControls | null;
    currentLookAt: THREE.Vector3;
    realm: {
      travelerPieceId: string | null;
      entryGatewayId: string;
      currentRealmId: RealmId;
      localPos: THREE.Vector3;
      velocity: THREE.Vector3;
      yaw: number;
      isParityInverted: boolean;
      crucibleAnvilClaimed: boolean;
      echoes: RealmTemporalEcho[];
      sentinels: RealmEnemySentinel[];
      nearbyPortal: RealmPortalNode | null;
      nearbyPortalEval: PortalBoardExitEvaluation | null;
      steerTargetPortalId: string | null;
      portalCooldownSec: number;
      hazardCooldownSec: number;
      attackAnimTimerSec: number;
      dashTimerSec: number;
      ascentTargetCoord: { row: number; col: number; z: number; w: number } | null;
      ascentTargetEnemy: ChessPiece | null;
      ascentPortalName: string;
      ascentTargetTimelineId: string | null;
    };
    uniPlayer: {
      worldX: number;
      worldZ: number;
      yaw: number;
      targetX: number | null;
      targetZ: number | null;
    };
    uniCar: {
      worldX: number;
      worldZ: number;
      yaw: number;
      speed: number;
      isDriving: boolean;
    };
    uniTransit: {
      isRiding: boolean;
      destinationStationId: string | null;
      transitTimer: number;
    };
    mouseLook: {
      isDragging: boolean;
      freeLookActive: boolean;
      lastPointerX: number;
      lastPointerY: number;
      uniCamYaw: number;
      uniCamPitch: number;
      uniCamDistance: number;
      uniFirstPerson: boolean;
      fightLookYaw: number;
      fightLookPitch: number;
      fightCamDistOffset: number;
      realmCamYawOffset: number;
      realmCamPitch: number;
      realmCamDistance: number;
    };
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
    pieces: initialBoardRef.current,
    multiverse: initialMultiverseRef.current,
    autoConvergeToPrimeAfterDuel: false,
    activeCollapseResolution: null,
    collapseDoomedRigs: [],
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
    duelInRealm: false,
    duelOnWatch: false,
    duelIsAcademicDebate: false,
    academicColloquium: null,
    horologiumSweepTimer: 0,
    activeSentinelId: null,
    fightTimer: 60,
    cameraShake: 0,
    hitstopTimer: 0,
    slowMoTimer: 0,
    activeIntervention: null,
    autoPlayDemo: false,
    demoBoardTimer: 0,
    demoCameraTimer: 0,
    demoMovesWithoutCapture: 0,
    demoPendingDecision: null,
    timelineSnapshots: [],
    timelineBranchCount: 0,
    keysHeld: {},
    pieceRigs: new Map(),
    firstPersonRig: null,
    fpMountGroup: null,
    arenaRig: null,
    realmsRig: null,
    pocketWatchRig: null,
    universityOfficeRig: null,
    uniPlayer: {
      worldX: -10.0,
      worldZ: -3.2,
      yaw: 0,
      targetX: null as number | null,
      targetZ: null as number | null,
    },
    uniCar: {
      worldX: -6.0,
      worldZ: 14.5,
      yaw: 0,
      speed: 0,
      isDriving: false,
    },
    uniTransit: {
      isRiding: false,
      destinationStationId: null as string | null,
      transitTimer: 0,
    },
    mouseLook: {
      isDragging: false,
      freeLookActive: false,
      lastPointerX: 0,
      lastPointerY: 0,
      uniCamYaw: 0,
      uniCamPitch: 0.42,
      uniCamDistance: 6.2,
      uniFirstPerson: false,
      fightLookYaw: 0,
      fightLookPitch: 0,
      fightCamDistOffset: 0,
      realmCamYawOffset: 0,
      realmCamPitch: 0.42,
      realmCamDistance: 5.8,
    },
    imminentParadoxWarning: false,
    vfxPool: null,
    controls: null,
    currentLookAt: new THREE.Vector3(0, 0.4, 0),
    realm: {
      travelerPieceId: null,
      entryGatewayId: 'gw_mirror_c6',
      currentRealmId: 'SHATTERED_MIRROR',
      localPos: new THREE.Vector3(0, 0, 10),
      velocity: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      isParityInverted: false,
      crucibleAnvilClaimed: false,
      echoes: [],
      sentinels: [],
      nearbyPortal: null,
      nearbyPortalEval: null,
      steerTargetPortalId: null,
      portalCooldownSec: 0,
      hazardCooldownSec: 0,
      attackAnimTimerSec: 0,
      dashTimerSec: 0,
      ascentTargetCoord: null,
      ascentTargetEnemy: null,
      ascentPortalName: '',
      ascentTargetTimelineId: null,
    },
  });

  const saveTimelineSnapshot = useCallback(() => {
    const sim = simRef.current;
    const clonedPieces: ChessPiece[] = sim.pieces.map((p) => ({
      ...p,
      inRealm: null,
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

  // Spacetime Causality Rewind (Δt - 1): Fork a parallel timeline branch and restore prior board & realm state!
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

    sim.pieces = snap.pieces.map((p) => ({ ...p, inRealm: null }));
    sim.turnNumber = snap.turnNumber;
    sim.turnFaction = 'w';
    sim.selectedPieceId = null;
    sim.validMoves = [];
    sim.realm.travelerPieceId = null;

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
        detail: `Quantum wavefunction & Subterranean Realm states collapsed back to Turn ${snap.turnNumber} before the timeline diverged.`,
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

    // 2. Highlight selected piece and its valid moves (3D slice moves, 4D Hyper-Shifts, Chrono-Intercepts & Lethal Remembered Squares!)
    const selPiece = sim.pieces.find((p) => p.id === sim.selectedPieceId) || null;
    setSelectedPiece(selPiece ? { ...selPiece } : null);

    // Mark Remembered Squares from previous universes with warning sigils
    const rememberedInOtherRealities = getRememberedSquaresForTimelineView(
      sim.multiverse,
      sim.multiverse.activeTimelineId,
      selPiece
    );
    for (const rem of rememberedInOtherRealities) {
      if (rem.w === sim.activeSliceW && rem.z === sim.activeSliceZ) {
        const sigil = sim.arenaRig.threatSigilMeshes.get(`${rem.row}_${rem.col}`);
        if (sigil) {
          sigil.visible = true;
        }
      }
    }

    let hasLethalRememberedMove = false;

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
        const lethalCollision = getLethalRememberedSquareCollision(
          sim.multiverse,
          selPiece,
          mv.to,
          sim.multiverse.activeTimelineId
        );
        if (lethalCollision) {
          hasLethalRememberedMove = true;
        }
        if (hl) {
          hl.visible = true;
          const mat = hl.material as THREE.MeshBasicMaterial;
          if (mv.dimensionType === 'CHECKMATE_YESTERDAY') {
            mat.color.setHex(0x38bdf8); // Sentient Mathematical Theorem: Checkmate Yesterday Q.E.D. Beacon!
            mat.opacity = 0.88;
          } else if (lethalCollision) {
            mat.color.setHex(0xef4444); // Lethal Remembered Square Paradox Exclusion Warning!
            mat.opacity = 0.82;
          } else if (
            mv.dimensionType === 'REALM_GATEWAY_DESCENT' ||
            mv.dimensionType === 'REALM_PORTAL_TRAVERSAL'
          ) {
            mat.color.setHex(0x34d399); // Emerald-Cyan Dimensional Gateway
            mat.opacity = 0.72;
          } else if (mv.dimensionType === 'TEMPORAL_INTERCEPT') {
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

    sim.imminentParadoxWarning = hasLethalRememberedMove;
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

  // Start a capture duel on the board OR inside a Subterranean Realm!
  const initiateCombatDuel = useCallback(
    (
      attackerPiece: ChessPiece,
      move: MoveOption,
      isExhibition: boolean = false,
      inRealmWorldCenter?: { x: number; y: number; z: number; realmTitle: string; sentinelId?: string }
    ) => {
      const sim = simRef.current;
      if (!move.targetPiece) return;

      const defenderPiece = move.targetPiece;
      sim.pendingMove = move;
      sim.isExhibitionDuel = isExhibition;
      sim.duelInRealm = Boolean(inRealmWorldCenter);
      sim.activeSentinelId = inRealmWorldCenter?.sentinelId || null;
      sim.selectedPieceId = null;
      sim.validMoves = [];
      setHoveredCaptureMove(null);
      syncBoardHighlights();

      if (inRealmWorldCenter) {
        sim.duelCenterWorld.set(
          inRealmWorldCenter.x,
          inRealmWorldCenter.y,
          inRealmWorldCenter.z
        );
        setDuelSquareName(inRealmWorldCenter.realmTitle);
      } else {
        boardToWorld(move.to.row, move.to.col, sim.duelCenterWorld);
        const sqName = `${formatSquareName(move.to)} · ${formatWName(move.to.w)}`;
        setDuelSquareName(sqName);
      }

      const atkIsAI =
        sim.autoPlayDemo || (sim.gameMode === 'vs_ai' && attackerPiece.faction === 'b');
      const defIsAI =
        sim.autoPlayDemo || (sim.gameMode === 'vs_ai' && defenderPiece.faction === 'b');

      const atkPartner = attackerPiece.entangledWithId
        ? sim.pieces.find((p) => p.id === attackerPiece.entangledWithId)
        : undefined;
      const defPartner = defenderPiece.entangledWithId
        ? sim.pieces.find((p) => p.id === defenderPiece.entangledWithId)
        : undefined;

      // TACTICAL INTERVENTION: THE BOARD FIGHTS BACK
      const supportAnalysis = computeSquareSupportAnalysis(
        sim.pieces,
        move.to,
        attackerPiece.faction,
        defenderPiece.faction,
        [attackerPiece.id, defenderPiece.id]
      );

      sim.attackerRuntime = createFighterRuntime(
        attackerPiece,
        true,
        atkIsAI,
        atkPartner ? ARCHETYPES[atkPartner.type].chessName : undefined,
        supportAnalysis.attackerSupporters
      );
      sim.defenderRuntime = createFighterRuntime(
        defenderPiece,
        false,
        defIsAI,
        defPartner ? ARCHETYPES[defPartner.type].chessName : undefined,
        supportAnalysis.defenderSupporters
      );
      sim.prevAtkAction = 'idle';
      sim.prevDefAction = 'idle';
      sim.fightTimer = 60;
      sim.slowMoTimer = 0;
      sim.activeIntervention = null;
      sim.demoCameraTimer = 0;
      sim.phase = 'TRANSITION_TO_FIGHT';
      sim.phaseTimer = 0;
      sim.introShotIndex = -1;
      setIntroShotIndex(-1);
      if (sim.autoPlayDemo) {
        setDemoDirectorStage('SERGIO LEONE OPTICAL CRASH-ZOOM (FOV 62° → 9.5°)');
      }

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

      if (!inRealmWorldCenter) {
        const tempHome = new THREE.Vector3();
        for (const p of sim.pieces) {
          if (p.id === attackerPiece.id || p.id === defenderPiece.id) continue;
          boardToWorld(p.row, p.col, tempHome);
          const dx = tempHome.x - sim.duelCenterWorld.x;
          const dz = tempHome.z - sim.duelCenterWorld.z;
          const dist = Math.hypot(dx, dz);
          const inCorridor =
            dz > -0.9 && dz < 7.8 && Math.abs(dx) < 4.6;
          let bys = sim.bystanders.get(p.id);
          if (!bys) {
            bys = { offsetX: 0, offsetZ: 0, vx: 0, vz: 0, y: 0, vy: 0, panickedTimer: 0 };
            sim.bystanders.set(p.id, bys);
          }
          if (inCorridor || dist < 4.75) {
            const sideSign = dx >= 0 ? 1 : -1;
            const targetX = sim.duelCenterWorld.x + sideSign * (4.85 + (p.row % 2) * 0.45);
            const targetZ =
              dz > 0
                ? sim.duelCenterWorld.z + Math.min(dz, 3.2)
                : sim.duelCenterWorld.z - 2.4;
            bys.offsetX = targetX - tempHome.x;
            bys.offsetZ = targetZ - tempHome.z;
            bys.vx = 0;
            bys.vz = 0;
          }
        }
      }

      soundEngine.playArenaTransition();
      setPhase('TRANSITION_TO_FIGHT');
      setCallouts([]);
      setKoBanner(null);
      setHudAttacker({ ...sim.attackerRuntime });
      setHudDefender({ ...sim.defenderRuntime });

      if (inRealmWorldCenter) {
        setTimeout(() => {
          addCallout({
            text: `REALM ENCOUNTER IN ${inRealmWorldCenter.realmTitle}!`,
            subtext: 'DEFEAT THE REALM SENTINEL TO CONTINUE YOUR JOURNEY',
            x: 0,
            y: 2.35,
            color: '#34d399',
          });
        }, 400);
      } else if (move.dimensionType && move.dimensionType !== '3D_SLICE') {
        setTimeout(() => {
          addCallout({
            text:
              move.dimensionType === 'CHECKMATE_YESTERDAY'
                ? '⊢ Q.E.D. · CHECKMATING YESTERDAY (Δt = −1)!'
                : move.dimensionType === 'REALM_PORTAL_TRAVERSAL'
                ? 'REALM EMERGENCE AMBUSH DUEL!'
                : move.dimensionType === 'TEMPORAL_INTERCEPT'
                ? 'CHRONO-INTERCEPT DUEL (Δt = -1)!'
                : '4D CROSS-DIMENSIONAL AMBUSH!',
            subtext:
              move.dimensionType === 'CHECKMATE_YESTERDAY'
                ? attackerPiece.theoremAxiom || 'SENTIENT MATHEMATICAL THEOREM · RETROACTIVE REFUTATION'
                : move.dimensionLabel || 'HYPERCUBE COLLISION',
            x: 0,
            y: 2.35,
            color: move.dimensionType === 'CHECKMATE_YESTERDAY' ? '#38bdf8' : '#c084fc',
          });
        }, 400);
      }
    },
    [addCallout, syncBoardHighlights]
  );

  // Initiate descent of a warrior through a BoardGateway into one of the Three Subterranean Realms!
  const initiateRealmDescent = useCallback(
    (
      piece: ChessPiece,
      gatewayId: string,
      entryCoord: { row: number; col: number; z: number; w: number },
      autoTargetPortalId?: string
    ) => {
      const sim = simRef.current;
      const gw = BOARD_GATEWAYS.find((g) => g.id === gatewayId) || BOARD_GATEWAYS[0];

      // Move piece onto the entry gateway square first, then mark it as physically inside the realm
      piece.row = entryCoord.row;
      piece.col = entryCoord.col;
      piece.z = entryCoord.z;
      piece.w = entryCoord.w;
      piece.hasMoved = true;
      piece.inRealm = gw.realmId;

      const echoes = buildDeterministicTemporalEchoes(sim.pieces, piece.id);
      const sentinels = buildRealmSentinels(sim.pieces, piece.faction, piece.id);
      if (sim.realmsRig) {
        syncRealmEntities3D(sim.realmsRig, echoes, sentinels);
      }

      sim.realm.travelerPieceId = piece.id;
      sim.realm.entryGatewayId = gw.id;
      sim.realm.currentRealmId = gw.realmId;
      sim.realm.localPos.set(gw.spawnLocalPos.x, 0, gw.spawnLocalPos.z);
      sim.realm.velocity.set(0, 0, 0);
      sim.realm.yaw = gw.spawnYaw;
      sim.realm.isParityInverted = Boolean(piece.mirrorInvertedParity);
      sim.realm.crucibleAnvilClaimed = false;
      sim.realm.echoes = echoes;
      sim.realm.sentinels = sentinels;
      sim.realm.nearbyPortal = null;
      sim.realm.nearbyPortalEval = null;
      sim.realm.portalCooldownSec = 1.1;
      sim.realm.hazardCooldownSec = 0;
      sim.realm.attackAnimTimerSec = 0;
      sim.realm.dashTimerSec = 0;
      sim.realm.ascentTargetCoord = null;
      sim.realm.ascentTargetEnemy = null;
      sim.realm.ascentPortalName = '';

      // If AI or Auto-Play Demo is controlling this piece, choose an intelligent target portal in the realm
      const isControlledByAI =
        sim.autoPlayDemo || (sim.gameMode === 'vs_ai' && piece.faction === 'b');
      if (autoTargetPortalId) {
        sim.realm.steerTargetPortalId = autoTargetPortalId;
      } else if (isControlledByAI) {
        const portals = getPortalsForRealm(gw.realmId).filter(
          (p) => p.kind === 'BOARD_ASCENT' && p.targetGatewayId !== gw.id
        );
        const validExit = portals.find((p) => {
          const ev = evaluatePortalBoardExit(p, piece, sim.pieces, true, true);
          return ev && ev.status !== 'ALLY_OBSTRUCTED';
        });
        sim.realm.steerTargetPortalId = validExit ? validExit.id : portals[0]?.id || null;
      } else {
        sim.realm.steerTargetPortalId = null;
      }

      sim.selectedPieceId = null;
      sim.validMoves = [];
      setHoveredCaptureMove(null);
      syncBoardHighlights();

      if (sim.controls) {
        sim.controls.enabled = false;
      }

      if (sim.vfxPool) {
        const entryWorld = boardToWorld(entryCoord.row, entryCoord.col);
        spawnShockwave(sim.vfxPool, entryWorld.x, 0.08, entryWorld.z, gw.colorHex, 5.5);
        spawnAuraPillar(sim.vfxPool, entryWorld.x, entryWorld.z, gw.colorHex);
      }

      soundEngine.playRealmPortalTransition(true);
      sim.phase = 'REALM_DESCENT';
      sim.phaseTimer = 0;
      setPhase('REALM_DESCENT');
      setActiveRealmId(gw.realmId);
      setRealmTraveler({ ...piece });
      setRealmParityInverted(sim.realm.isParityInverted);
      setRealmCrucibleClaimed(false);
      setNearbyPortal(null);
      setNearbyPortalEval(null);
      setRealmStatusBanner(
        `DESCENDING THROUGH ${gw.name.toUpperCase()} INTO ${REALM_METADATA[gw.realmId].title}`
      );
    },
    [syncBoardHighlights]
  );

  // Traverse a physical portal inside a Subterranean Realm (Board Ascent, Inter-Realm Rift, or Mirror Parity Inverter!)
  const handleTraverseRealmPortal = useCallback(
    (portal: RealmPortalNode) => {
      const sim = simRef.current;
      if (sim.phase !== 'REALM_EXPLORATION') return;
      const traveler = sim.pieces.find((p) => p.id === sim.realm.travelerPieceId);
      if (!traveler) return;

      if (portal.kind === 'MIRROR_INVERTER') {
        // Flip Chiral Parity across The Great Looking-Glass!
        const nextParity = !sim.realm.isParityInverted;
        sim.realm.isParityInverted = nextParity;
        traveler.mirrorInvertedParity = nextParity;
        traveler.meter = Math.min(100, traveler.meter + 20);
        sim.realm.localPos.x = -sim.realm.localPos.x;
        sim.realm.localPos.z = sim.realm.localPos.z >= 0 ? -3.0 : 3.0;
        sim.realm.portalCooldownSec = 1.25;
        sim.realm.steerTargetPortalId = null;

        soundEngine.playMirrorParityFlip();
        if (sim.vfxPool) {
          const meta = REALM_METADATA[sim.realm.currentRealmId];
          spawnShockwave(
            sim.vfxPool,
            meta.worldCenter.x,
            meta.worldCenter.y + 0.2,
            meta.worldCenter.z,
            0x38bdf8,
            7.5
          );
        }

        setRealmParityInverted(nextParity);
        setRealmTraveler({ ...traveler });
        setRealmStatusBanner(
          nextParity
            ? 'CHIRAL PARITY INVERTED: (r, c, w) ↦ (7−r, 7−c, −w) · MIRROR AEGIS GRANTED!'
            : 'CHIRAL PARITY RESTORED TO PRIME ORIENTATION'
        );
        return;
      }

      if (portal.kind === 'INTER_REALM' && portal.targetRealmId) {
        const targetRealmId = portal.targetRealmId;
        const dstPortal = REALM_PORTALS.find((p) => p.id === portal.targetPortalId);
        const dstYaw = dstPortal ? dstPortal.yaw : 0;
        const inwardX = dstPortal
          ? dstPortal.localPos.x - Math.sin(dstYaw) * 3.2
          : 0;
        const inwardZ = dstPortal
          ? dstPortal.localPos.z - Math.cos(dstYaw) * 3.2
          : 0;

        sim.realm.currentRealmId = targetRealmId;
        traveler.inRealm = targetRealmId;
        sim.realm.localPos.set(inwardX, 0, inwardZ);
        sim.realm.yaw = dstYaw + Math.PI;
        sim.realm.portalCooldownSec = 1.35;
        sim.realm.steerTargetPortalId = null;

        soundEngine.playRealmPortalTransition(true);
        setActiveRealmId(targetRealmId);
        setRealmTraveler({ ...traveler });
        setRealmStatusBanner(
          `CROSSED INTER-REALM RIFT → ENTERED ${REALM_METADATA[targetRealmId].title}`
        );
        return;
      }

      if (portal.kind === 'BOARD_ASCENT' || portal.kind === 'TIMELINE_PORTAL') {
        const targetTimelineId =
          portal.kind === 'TIMELINE_PORTAL' && portal.targetTimelineId
            ? portal.targetTimelineId === sim.multiverse.activeTimelineId
              ? 'TL-PRIME'
              : portal.targetTimelineId
            : sim.multiverse.activeTimelineId;

        const targetBranch =
          ensureBranchHydrated(sim.multiverse, targetTimelineId) ||
          ensureBranchHydrated(sim.multiverse, 'TL-PRIME')!;
        const evalPieces =
          targetTimelineId === sim.multiverse.activeTimelineId
            ? sim.pieces
            : targetBranch.pieces;

        const evalRes = evaluatePortalBoardExit(
          portal,
          traveler,
          evalPieces,
          sim.realm.isParityInverted,
          sim.realm.crucibleAnvilClaimed,
          targetBranch.name
        );
        if (!evalRes) return;

        if (evalRes.status === 'ALLY_OBSTRUCTED') {
          soundEngine.playBlock(false);
          setRealmStatusBanner(
            `EXIT ${evalRes.squareLabel} IN ${targetTimelineId} OBSTRUCTED BY ALLIED ${ARCHETYPES[evalRes.occupant!.type].chessName.toUpperCase()}!`
          );
          sim.realm.localPos.multiplyScalar(0.82);
          sim.realm.portalCooldownSec = 0.85;
          return;
        }

        // Valid exit (either CLEAR or ENEMY_OCCUPIED ambush, possibly in an alternate timeline!)
        sim.realm.ascentTargetCoord = { ...evalRes.coord };
        sim.realm.ascentTargetEnemy =
          evalRes.status === 'ENEMY_OCCUPIED' ? evalRes.occupant || null : null;
        sim.realm.ascentPortalName = `${portal.name} → ${targetTimelineId} ${evalRes.squareLabel}`;
        sim.realm.ascentTargetTimelineId = targetTimelineId;
        sim.realm.steerTargetPortalId = null;
        sim.phase = 'REALM_ASCENT';
        sim.phaseTimer = 0;
        soundEngine.playRealmPortalTransition(false);
        setPhase('REALM_ASCENT');
        setRealmStatusBanner(
          evalRes.status === 'ENEMY_OCCUPIED'
            ? `EMERGING IN ${targetTimelineId} AT ${evalRes.squareLabel} — ASSASSINATING ${ARCHETYPES[evalRes.occupant!.type].chessName.toUpperCase()}!`
            : `EMERGING IN ${targetTimelineId} AT ${evalRes.squareLabel}`
        );
      }
    },
    []
  );

  const handleSteerTowardPortal = useCallback((portal: RealmPortalNode) => {
    const sim = simRef.current;
    if (sim.phase !== 'REALM_EXPLORATION') return;
    sim.realm.steerTargetPortalId = portal.id;
    soundEngine.playChessSelect();
    setRealmStatusBanner(`STEERING TOWARD ${portal.name.toUpperCase()}...`);
  }, []);

  const handleRealmAction = useCallback((action: 'jump' | 'dash' | 'strike') => {
    const sim = simRef.current;
    if (sim.phase !== 'REALM_EXPLORATION') return;
    if (action === 'jump' && sim.realm.localPos.y <= 0.05) {
      sim.realm.velocity.y = 10.5;
      soundEngine.playBystanderHop();
    } else if (action === 'dash' && sim.realm.dashTimerSec <= 0) {
      sim.realm.dashTimerSec = 0.32;
      soundEngine.playSwing(false);
    } else if (action === 'strike' && sim.realm.attackAnimTimerSec <= 0) {
      sim.realm.attackAnimTimerSec = 0.42;
      soundEngine.playSwing(true);
    }
  }, []);

  // ============================================================================
  // MULTIVERSAL CHESS, CAUSAL ASSASSINATION & REALITY CONVERGENCE HANDLERS
  // ============================================================================
  const syncActiveBranchFromSim = useCallback(() => {
    const sim = simRef.current;
    syncActiveTimelineFromLiveBoard(
      sim.multiverse,
      sim.pieces,
      sim.turnNumber,
      sim.turnFaction
    );
  }, []);

  const rebuildSceneRigsForTimeline = useCallback(
    (branch: TimelineBranch) => {
      const sim = simRef.current;
      const scene = sim.arenaRig?.group.parent;

      sim.pieceRigs.forEach((rig) => {
        rig.root.parent?.remove(rig.root);
      });
      sim.pieceRigs.clear();
      sim.bystanders.clear();

      sim.pieces = branch.pieces.map((p) => ({
        ...p,
        inRealm: null,
        history: p.history.map((h) => ({ ...h })),
      }));
      sim.turnNumber = branch.turnNumber;
      sim.turnFaction = branch.turnFaction;
      sim.activeSliceW = 0;
      sim.activeSliceZ = 0;
      sim.targetMoveW = 0;
      sim.targetMoveZ = 0;
      sim.selectedPieceId = null;
      sim.validMoves = [];

      if (scene) {
        for (const p of sim.pieces) {
          const rig = createArticulatedPiece(p.type, p.faction);
          boardToWorld(p.row, p.col, rig.root.position);
          rig.root.rotation.y = p.faction === 'w' ? Math.PI : 0;
          if (sim.academicColloquium?.active) {
            setPieceProfessorMode(rig, true, p.faction);
          }
          scene.add(rig.root);
          sim.pieceRigs.set(p.id, rig);
          sim.bystanders.set(p.id, {
            offsetX: 0,
            offsetZ: 0,
            vx: 0,
            vz: 0,
            y: 0,
            vy: 0,
            panickedTimer: 0,
          });
        }
      }

      setTurnNumber(branch.turnNumber);
      setTurnFaction(branch.turnFaction);
      setActiveSliceW(sim.activeSliceW);
      setActiveSliceZ(sim.activeSliceZ);
      setTargetMoveW(sim.targetMoveW);
      setTargetMoveZ(sim.targetMoveZ);
      setTimelineBranchLabel(`${branch.id} · ${branch.name}`);
      setMultiverseState({ ...sim.multiverse });
      syncBoardHighlights();
    },
    [syncBoardHighlights]
  );

  // Trigger Reality Convergence: Propagate pending CausalDeathEvents into a target timeline with a 3D Quantum Singularity Collapse!
  const handleTriggerConvergence = useCallback(
    (targetTimelineId: string = 'TL-PRIME') => {
      const sim = simRef.current;
      syncActiveBranchFromSim();

      // Switch to the target timeline first so its board and the doomed piece(s) are visible in 3D!
      if (sim.multiverse.activeTimelineId !== targetTimelineId) {
        const targetBranch = switchActiveTimeline(sim.multiverse, targetTimelineId);
        rebuildSceneRigsForTimeline(targetBranch);
      }

      // Capture the 3D rigs of any pieces about to be erased by causal assassination so we can animate their 3D quantum implosion!
      const pendingBreaches = getPendingCausalBreachesForTimeline(
        sim.multiverse,
        targetTimelineId
      );
      const doomedRigs: ArticulatedPieceRig[] = [];
      for (const breach of pendingBreaches) {
        const rig = sim.pieceRigs.get(breach.manifestation.id);
        if (rig) {
          doomedRigs.push(rig);
          sim.pieceRigs.delete(breach.manifestation.id);
        }
      }

      const resolutions = reconcileTimelineConvergence(sim.multiverse, targetTimelineId);
      const updatedBranch =
        ensureBranchHydrated(sim.multiverse, targetTimelineId) ||
        ensureBranchHydrated(sim.multiverse, 'TL-PRIME')!;
      sim.pieces = updatedBranch.pieces.map((p) => ({
        ...p,
        inRealm: null,
        history: p.history.map((h) => ({ ...h })),
      }));
      setMultiverseState({ ...sim.multiverse });

      if (resolutions.length === 0) {
        for (const r of doomedRigs) {
          r.root.parent?.remove(r.root);
        }
        syncBoardHighlights();
        return;
      }

      // Spawn dramatic 3D Quantum Singularity & Rift VFX at each assassinated piece's square!
      if (sim.vfxPool) {
        for (const res of resolutions) {
          const ep = res.erasedPiece;
          const worldPos = boardToWorld(ep.row, ep.col);
          spawnAuraPillar(sim.vfxPool, worldPos.x, worldPos.z, 0xd946ef);
          spawnShockwave(sim.vfxPool, worldPos.x, 0.1, worldPos.z, 0xf43f5e, 7.5);
          spawnHitSparks(sim.vfxPool, worldPos.x, 1.2, worldPos.z, 0xf59e0b, 32);
          spawnGroundDebris(sim.vfxPool, worldPos.x, worldPos.z, 16);
          spawnInterventionRift(
            sim.vfxPool,
            worldPos.x,
            4.8,
            worldPos.z,
            worldPos.x,
            0.6,
            worldPos.z,
            0xd946ef
          );
        }
      }

      soundEngine.playKO();
      soundEngine.playQuantumEntangle(true);

      sim.activeCollapseResolution = resolutions;
      sim.collapseDoomedRigs = doomedRigs;
      sim.phase = 'CAUSAL_COLLAPSE';
      sim.phaseTimer = 0;
      if (sim.controls) sim.controls.enabled = false;
      setPhase('CAUSAL_COLLAPSE');
      setActiveCollapseBanner(resolutions);

      setBattleLogs((prev) => [
        {
          id: `converge_${Date.now()}`,
          turnNumber: sim.turnNumber,
          summary: `Reality Convergence in ${targetTimelineId}: ${resolutions.length} Counterpart(s) Erased!`,
          detail: resolutions
            .map(
              (r) =>
                `${ARCHETYPES[r.erasedPiece.type].warriorTitle} (${ARCHETYPES[r.erasedPiece.type].chessName}) erased from ${r.erasedSquareLabel} in ${targetTimelineId} [Lineage ${r.event.victimLineageId}]`
            )
            .join(' · '),
          wasUpset: true,
          winnerFaction: resolutions[0]?.event.killerFaction || 'w',
        },
        ...prev.slice(0, 7),
      ]);
    },
    [rebuildSceneRigsForTimeline, syncActiveBranchFromSim, syncBoardHighlights]
  );

  // Switch active timeline in the Multiverse
  const handleSwitchTimeline = useCallback(
    (targetTimelineId: string) => {
      const sim = simRef.current;
      if (sim.phase !== 'CHESS_VIEW') return;
      syncActiveBranchFromSim();

      const wasVisitedBefore = sim.multiverse.visitedTimelineIds.includes(targetTimelineId);
      const targetBranch = switchActiveTimeline(sim.multiverse, targetTimelineId);
      rebuildSceneRigsForTimeline(targetBranch);

      if (sim.vfxPool) {
        spawnShockwave(sim.vfxPool, 0, 0.1, 0, 0xd946ef, 8.5);
      }
      if (!wasVisitedBefore) {
        soundEngine.playWatchHandForged();
      } else {
        soundEngine.playQuantumEntangle(false);
      }

      if (sim.pocketWatchRig) {
        triggerPocketWatchReaction(
          sim.pocketWatchRig,
          wasVisitedBefore ? 0x38bdf8 : 0xfbbf24,
          targetTimelineId,
          false
        );
      }

      // If switching into a timeline that has unpropagated CausalDeathEvents, automatically converge them!
      const unpropagated = getPendingCausalBreachesForTimeline(
        sim.multiverse,
        targetTimelineId
      );
      if (unpropagated.length > 0) {
        setTimeout(() => {
          handleTriggerConvergence(targetTimelineId);
        }, 350);
      } else {
        setBattleLogs((prev) => [
          {
            id: `tl_switch_${Date.now()}`,
            turnNumber: targetBranch.turnNumber,
            summary: `Shifted Focus to ${targetBranch.id} (${targetBranch.name})`,
            detail: `${targetBranch.divergenceSummary} · Solaris ${targetBranch.pieces.filter((p) => p.faction === 'w').length} vs Obsidian ${targetBranch.pieces.filter((p) => p.faction === 'b').length}`,
            wasUpset: false,
            winnerFaction: targetBranch.turnFaction,
          },
          ...prev.slice(0, 7),
        ]);
      }
    },
    [handleTriggerConvergence, rebuildSceneRigsForTimeline, syncActiveBranchFromSim]
  );

  // Fork a brand-new independent timeline branch from any existing timeline
  const handleForkTimeline = useCallback(
    (sourceTimelineId: string, exposeTargetLineageId?: string) => {
      const sim = simRef.current;
      syncActiveBranchFromSim();

      const newBranch = forkTimelineFromBranch(
        sim.multiverse,
        sourceTimelineId,
        exposeTargetLineageId ? { exposeTargetLineageId } : undefined
      );
      const switched = switchActiveTimeline(sim.multiverse, newBranch.id);
      rebuildSceneRigsForTimeline(switched);
      soundEngine.playWatchHandForged();

      if (sim.pocketWatchRig) {
        triggerPocketWatchReaction(sim.pocketWatchRig, 0xfbbf24, newBranch.id, false);
      }
      if (sim.vfxPool) {
        spawnShockwave(sim.vfxPool, 0, 0.12, 0, 0x38bdf8, 9.0);
      }

      setBattleLogs((prev) => [
        {
          id: `fork_${Date.now()}`,
          turnNumber: newBranch.turnNumber,
          summary: `Forked New Reality ${newBranch.id} — New Hand Forged on Cosmic Watch!`,
          detail: newBranch.divergenceSummary,
          wasUpset: false,
          winnerFaction: newBranch.turnFaction,
        },
        ...prev.slice(0, 7),
      ]);
    },
    [rebuildSceneRigsForTimeline, syncActiveBranchFromSim]
  );

  // Send a piece directly into an alternate timeline
  const handleDeployPieceToTimeline = useCallback(
    (pieceId: string, targetTimelineId: string) => {
      const sim = simRef.current;
      const sel = sim.pieces.find((p) => p.id === pieceId);
      if (!sel) return;

      syncActiveBranchFromSim();

      const deployRes = transitionTravelerToTimeline(
        sim.multiverse,
        sel,
        sim.multiverse.activeTimelineId,
        targetTimelineId,
        { row: sel.row, col: sel.col, z: sel.z, w: sel.w }
      );

      const targetBranch = switchActiveTimeline(sim.multiverse, targetTimelineId);
      rebuildSceneRigsForTimeline(targetBranch);
      sim.selectedPieceId = deployRes.mergedTraveler.id;
      sim.validMoves = getValidMovesForPiece(
        deployRes.mergedTraveler,
        sim.pieces,
        deployRes.mergedTraveler.z,
        deployRes.mergedTraveler.w
      );
      syncBoardHighlights();
      soundEngine.playRealmPortalTransition(false);

      setBattleLogs((prev) => [
        {
          id: `deploy_${Date.now()}`,
          turnNumber: targetBranch.turnNumber,
          summary: `Cross-Timeline Incursion: ${ARCHETYPES[deployRes.mergedTraveler.type].chessName} Entered ${targetTimelineId}!`,
          detail: `${ARCHETYPES[deployRes.mergedTraveler.type].warriorTitle} [Lineage ${getPieceLineageId(deployRes.mergedTraveler)}] materialized at ${formatSquareName(deployRes.mergedTraveler)} in ${targetBranch.name}.`,
          wasUpset: false,
          winnerFaction: deployRes.mergedTraveler.faction,
        },
        ...prev.slice(0, 7),
      ]);
    },
    [rebuildSceneRigsForTimeline, syncActiveBranchFromSim, syncBoardHighlights]
  );

  // Rewind the latest Causal Assassination across the Multiverse
  const handleRewindLastAssassination = useCallback(() => {
    const sim = simRef.current;
    rewindCausalAssassination(sim.multiverse);
    const activeBranch =
      ensureBranchHydrated(sim.multiverse, sim.multiverse.activeTimelineId) ||
      ensureBranchHydrated(sim.multiverse, 'TL-PRIME')!;
    rebuildSceneRigsForTimeline(activeBranch);
    soundEngine.playQuantumEntangle(true);
    setBattleLogs((prev) => [
      {
        id: `cp_restore_${Date.now()}`,
        turnNumber: activeBranch.turnNumber,
        summary: `Multiverse Causality Rewound`,
        detail: `Latest cross-timeline Causal Assassination revoked and piece lineages restored.`,
        wasUpset: false,
        winnerFaction: 'w',
      },
      ...prev.slice(0, 7),
    ]);
  }, [rebuildSceneRigsForTimeline]);

  // 1-Click Guided Causal Assassination Showcase:
  // Shifts into Timeline Ω-1 where the Obsidian Queen (lineage_b_q_3) is exposed at F6,
  // launches the Solaris Knight's capture duel against her, and automatically converges her death back into Prime Reality (D8)!
  const handleTriggerGuidedAssassinationDemo = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase !== 'CHESS_VIEW') return;
    setMultiverseModalOpen(false);
    syncActiveBranchFromSim();

    const omegaBranch = switchActiveTimeline(sim.multiverse, 'TL-OMEGA-1');
    rebuildSceneRigsForTimeline(omegaBranch);

    let exposedQueen = sim.pieces.find(
      (p) => p.faction === 'b' && p.type === 'q'
    );
    let strikerKnight = sim.pieces.find(
      (p) => p.faction === 'w' && p.type === 'n' && p.row === 4 && p.col === 4
    ) || sim.pieces.find((p) => p.faction === 'w' && p.type === 'n');

    if (exposedQueen && strikerKnight) {
      exposedQueen.row = 2;
      exposedQueen.col = 5; // F6 exposed!
      exposedQueen.z = 0;
      exposedQueen.w = 0;
      exposedQueen.hp = Math.min(exposedQueen.hp, 75);

      strikerKnight.row = 4;
      strikerKnight.col = 4; // E4 poised to strike F6!
      strikerKnight.z = 0;
      strikerKnight.w = 0;
      strikerKnight.hp = strikerKnight.maxHp;
      strikerKnight.meter = 100;

      sim.autoConvergeToPrimeAfterDuel = true;

      const assassinateMove: MoveOption = {
        from: { row: 4, col: 4, z: 0, w: 0 },
        to: { row: 2, col: 5, z: 0, w: 0 },
        isCapture: true,
        targetPiece: exposedQueen,
        dimensionType: '3D_SLICE',
        dimensionLabel: 'CAUSAL ASSASSINATION IN TIMELINE Ω-1',
      };

      initiateCombatDuel(strikerKnight, assassinateMove, false);
    }
  }, [initiateCombatDuel, rebuildSceneRigsForTimeline, syncActiveBranchFromSim]);

  // Execute a non-capture chess move (including 4D Hyper-Shifts & Subterranean Gateway Descents!) or trigger a capture duel
  const executeChessMove = useCallback(
    (piece: ChessPiece, move: MoveOption) => {
      const sim = simRef.current;

      if (piece.faction === 'w') {
        saveTimelineSnapshot();
      }

      // If this move enters a Subterranean Gateway (or traverses a realm portal), descend into the 3D Realm!
      if (
        (move.dimensionType === 'REALM_GATEWAY_DESCENT' ||
          move.dimensionType === 'REALM_PORTAL_TRAVERSAL') &&
        move.gatewayId
      ) {
        const gw = BOARD_GATEWAYS.find((g) => g.id === move.gatewayId) || BOARD_GATEWAYS[0];
        initiateRealmDescent(
          piece,
          gw.id,
          { row: gw.row, col: gw.col, z: gw.z, w: gw.w },
          move.exitGatewayId
        );
        return;
      }

      if (move.isCapture && move.targetPiece) {
        initiateCombatDuel(piece, move, false);
        return;
      }

      // Check if `move.to` is a LETHAL REMEMBERED SQUARE from another universe for this piece's lineage!
      const lethalRememberedCollision = getLethalRememberedSquareCollision(
        sim.multiverse,
        piece,
        move.to,
        sim.multiverse.activeTimelineId
      );

      // Record both the origin square and destination square into the Multiverse's Remembered-Square Ledger
      recordRememberedSquare(
        sim.multiverse,
        piece,
        move.from,
        sim.multiverse.activeTimelineId,
        sim.turnNumber
      );
      recordRememberedSquare(
        sim.multiverse,
        piece,
        move.to,
        sim.multiverse.activeTimelineId,
        sim.turnNumber + 1
      );

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

      // If this warrior stepped onto its own Remembered Square from a prior universe:
      // - If crowned `isChronocrator` or fused with `synodStacks >= 2`, they HARVEST THE PARADOX SQUARE instead of dying!
      // - Otherwise -> LETHAL PARADOX COLLISION!
      if (lethalRememberedCollision && (piece.isChronocrator || (piece.synodStacks && piece.synodStacks >= 2))) {
        const sqLabel = formatSquareName(move.to);
        sim.multiverse.rememberedSquares = sim.multiverse.rememberedSquares.filter(
          (r) => r.id !== lethalRememberedCollision.id
        );
        piece.hp = Math.min(piece.maxHp, piece.hp + 25);
        piece.meter = Math.min(100, piece.meter + 35);
        piece.synodStacks = (piece.synodStacks || 0) + 1;

        soundEngine.playSynodResonance(true);
        if (sim.pocketWatchRig) {
          triggerPocketWatchReaction(
            sim.pocketWatchRig,
            0xfbbf24,
            sim.multiverse.activeTimelineId,
            true
          );
        }
        const worldTarget = boardToWorld(move.to.row, move.to.col);
        if (sim.vfxPool) {
          spawnAuraPillar(sim.vfxPool, worldTarget.x, worldTarget.z, 0xfbbf24);
          spawnShockwave(sim.vfxPool, worldTarget.x, 0.15, worldTarget.z, 0x38bdf8, 5.5);
        }
        setWatchEventBanner({
          title: `⌚ CHRONOCRATOR PARADOX HARVEST AT ${sqLabel}!`,
          subtitle: `${ARCHETYPES[piece.type].chessName} absorbed its Remembered Square from ${lethalRememberedCollision.sourceShortCode} (+25 HP, +35% Meter, Synod ×${piece.synodStacks})!`,
        });
      } else if (lethalRememberedCollision) {
        const sqLabel = formatSquareName(move.to);
        const deathEv = recordCausalAssassination(
          sim.multiverse,
          sim.multiverse.activeTimelineId,
          piece,
          piece,
          move.to,
          sim.turnNumber + 1,
          `LETHAL REMEMBERED SQUARE: ${ARCHETYPES[piece.type].chessName} stepped onto ${sqLabel} (previously occupied in ${lethalRememberedCollision.sourceShortCode})!`,
          true
        );

        soundEngine.playWatchDoomBell(true);
        if (sim.pocketWatchRig) {
          triggerPocketWatchReaction(
            sim.pocketWatchRig,
            0xef4444,
            sim.multiverse.activeTimelineId,
            true
          );
        }

        const worldTarget = boardToWorld(move.to.row, move.to.col);
        if (sim.vfxPool) {
          // Strike a bolt of crimson-gold temporal lightning from the Pocket Watch in the sky down onto the square!
          spawnInterventionRift(
            sim.vfxPool,
            0,
            15.5,
            -12.5,
            worldTarget.x,
            0.8,
            worldTarget.z,
            0xef4444
          );
          spawnAuraPillar(sim.vfxPool, worldTarget.x, worldTarget.z, 0xef4444);
          spawnShockwave(sim.vfxPool, worldTarget.x, 0.15, worldTarget.z, 0xfbbf24, 6.5);
        }

        // Remove the doomed piece from the live board and play its Causal Collapse disintegration!
        const doomedRig = sim.pieceRigs.get(piece.id);
        const doomedList: ArticulatedPieceRig[] = [];
        if (doomedRig) {
          boardToWorld(piece.row, piece.col, doomedRig.root.position);
          doomedList.push(doomedRig);
          sim.pieceRigs.delete(piece.id);
        }
        sim.pieces = sim.pieces.filter((p) => p.id !== piece.id);

        const activeBranch = ensureBranchHydrated(
          sim.multiverse,
          sim.multiverse.activeTimelineId
        );
        const resolution: CausalCollapseResolution = {
          event: deathEv,
          targetTimelineId: sim.multiverse.activeTimelineId,
          targetTimelineName: activeBranch?.name || sim.multiverse.activeTimelineId,
          erasedPiece: piece,
          erasedSquareLabel: sqLabel,
        };

        sim.selectedPieceId = null;
        sim.validMoves = [];
        sim.imminentParadoxWarning = false;
        sim.activeCollapseResolution = [resolution];
        sim.collapseDoomedRigs = doomedList;
        sim.phase = 'CAUSAL_COLLAPSE';
        sim.phaseTimer = 0;
        sim.cameraShake = 0.65;
        setActiveCollapseBanner([resolution]);
        setPhase('CAUSAL_COLLAPSE');
        setWatchEventBanner({
          title: `THE WATCH REMEMBERS SQUARE ${sqLabel}!`,
          subtitle: `${ARCHETYPES[piece.type].chessName} occupied ${sqLabel} in ${lethalRememberedCollision.sourceShortCode} — Paradox Exclusion Fatal Strike!`,
        });
        syncActiveBranchFromSim();
        setMultiverseState({ ...sim.multiverse });
        return;
      }

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
      sim.demoPendingDecision = null;
      sim.demoBoardTimer = 0;
      sim.demoMovesWithoutCapture += 1;
      syncBoardHighlights();

      const nextFaction: Faction = sim.turnFaction === 'w' ? 'b' : 'w';
      sim.turnFaction = nextFaction;
      sim.turnNumber += 1;
      syncActiveBranchFromSim();
      setMultiverseState({ ...sim.multiverse });
      setTurnFaction(nextFaction);
      setTurnNumber(sim.turnNumber);

      if (!sim.autoPlayDemo && sim.gameMode === 'vs_ai' && nextFaction === 'b') {
        setTimeout(() => {
          const currentSim = simRef.current;
          if (currentSim.autoPlayDemo || currentSim.phase !== 'CHESS_VIEW' || currentSim.turnFaction !== 'b') return;

          // Check if AI can execute a cross-timeline Multiverse Paradox Strike (after Turn 4 with 25% tactical probability)
          if (currentSim.turnNumber >= 4 && Math.random() < 0.25) {
            const paradoxStrike = executeAIMultiverseParadoxStrike(
              currentSim.multiverse,
              currentSim.multiverse.activeTimelineId,
              'b'
            );
            if (paradoxStrike) {
              // Advance turn and trigger Reality Convergence on the player's active timeline!
              currentSim.turnFaction = 'w';
              currentSim.turnNumber += 1;
              syncActiveBranchFromSim();
              setTurnFaction('w');
              setTurnNumber(currentSim.turnNumber);
              handleTriggerConvergence(currentSim.multiverse.activeTimelineId);
              return;
            }
          }

          const aiDecision = chooseAIMove(currentSim.pieces, 'b');
          if (aiDecision) {
            executeChessMove(aiDecision.piece, aiDecision.move);
          }
        }, 650);
      }
    },
    [
      handleTriggerConvergence,
      initiateCombatDuel,
      initiateRealmDescent,
      saveTimelineSnapshot,
      syncActiveBranchFromSim,
      syncBoardHighlights,
    ]
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

  // MULTIVERSAL SYNOD: Quantum-Swap & Fuse Selected Warrior with its Living Counterpart in another Timeline!
  const handleSynodTranspose = useCallback(
    (targetTimelineId: string) => {
      const sim = simRef.current;
      if (sim.phase !== 'CHESS_VIEW') return;
      const sel = sim.pieces.find((p) => p.id === sim.selectedPieceId);
      if (!sel) return;

      syncActiveBranchFromSim();
      const res = executeSynodTransposition(
        sim.multiverse,
        sel,
        targetTimelineId,
        sim.pieces
      );
      if (!res) return;

      soundEngine.playSynodResonance(false);
      if (sim.pocketWatchRig) {
        triggerPocketWatchReaction(sim.pocketWatchRig, 0xfbbf24, targetTimelineId, false);
      }

      const fromCoord = { row: sel.row, col: sel.col, z: sel.z, w: sel.w };
      const worldDest = boardToWorld(res.destCoord.row, res.destCoord.col);
      if (sim.vfxPool) {
        spawnInterventionRift(
          sim.vfxPool,
          0,
          16.5,
          -14.2,
          worldDest.x,
          0.9,
          worldDest.z,
          0xfbbf24
        );
        spawnAuraPillar(sim.vfxPool, worldDest.x, worldDest.z, 0x38bdf8);
      }

      if (res.ambushedEnemy) {
        const synodAmbushMove: MoveOption = {
          from: fromCoord,
          to: res.destCoord,
          isCapture: true,
          targetPiece: res.ambushedEnemy,
          dimensionType: 'SYNOD_TRANSPOSITION',
          dimensionLabel: `✦ SYNOD CROSS-REALITY AMBUSH (${res.counterpartBranch.shortCode})`,
        };
        initiateCombatDuel(sel, synodAmbushMove, false);
        return;
      }

      sel.row = res.destCoord.row;
      sel.col = res.destCoord.col;
      sel.z = res.destCoord.z;
      sel.w = res.destCoord.w;
      sel.hasMoved = true;
      sel.history.push({
        row: sel.row,
        col: sel.col,
        z: sel.z,
        w: sel.w,
        turn: sim.turnNumber + 1,
      });

      const sq = formatSquareName(res.destCoord);

      // If a Pawn just merged with its alternate-timeline self to formulate a Sentient Mathematical Theorem,
      // the 4D Chess Universe COLLAPSES and leaves the chess world entirely — transitioning into the standalone
      // University of Greater Andromeda 6-Year Academic Life Simulator as Dr. Pawn!
      if (sel.isSentientTheorem && sel.theoremStatus === 'UNPUBLISHED_DRAFT') {
        const colState = createInitialAcademicColloquiumState(
          sel,
          sim.pieces,
          res.counterpartBranch.shortCode
        );
        sim.academicColloquium = colState;
        sim.phase = 'ACADEMIC_SIMULATOR';
        sim.autoPlayDemo = false;
        setAutoPlayDemo(false);
        setMultiverseModalOpen(false);
        setCodexOpen(false);
        if (sim.controls) {
          sim.controls.enabled = false;
        }
        for (const p of sim.pieces) {
          const r = sim.pieceRigs.get(p.id);
          if (r) {
            setPieceProfessorMode(r, true, p.faction);
          }
        }
        setPhase('ACADEMIC_SIMULATOR');
        setAcademicColloquium({ ...colState });
      }

      setWatchEventBanner({
        title: sel.isSentientTheorem
          ? `🌧️ REALITY COLLAPSE — WELCOME TO THE UNIVERSITY OF GREATER ANDROMEDA`
          : `✦ MULTIVERSAL SYNOD RESONANCE (×${res.newSynodStacks})`,
        subtitle: sel.isSentientTheorem
          ? `The chessboard is gone. You are now Dr. Pawn, an untenured researcher at the University of Greater Andromeda.`
          : `${ARCHETYPES[sel.type].chessName} transposed with its ${res.counterpartBranch.shortCode} self → ${sq} (+25 HP, +30% Meter & Synod L-Leaps Unlocked)!`,
      });
      setBattleLogs((prev) => [
        {
          id: `synod_${Date.now()}`,
          turnNumber: sim.turnNumber,
          summary: sel.isSentientTheorem
            ? `🌧️ The Chess Universe Dissolved: Entered the University of Greater Andromeda as Dr. Pawn`
            : `Multiversal Synod (×${res.newSynodStacks}): ${ARCHETYPES[sel.type].chessName} Transposed via ${res.counterpartBranch.shortCode} → ${sq}!`,
          detail: sel.isSentientTheorem
            ? `Room 4B, Peano Hall. Rain against the windows. A coffee machine that hasn't worked since 1987. Six years of academic struggle begin.`
            : `Fused parallel-universe resonance with ${res.counterpartBranch.name} (+25 HP, +30% Meter, Synod L-Leaps & Triad Combat Strikes).`,
          wasUpset: false,
          winnerFaction: sel.faction,
        },
        ...prev.slice(0, 7),
      ]);

      sim.validMoves = getValidMovesForPiece(sel, sim.pieces, sel.z, sel.w);
      syncActiveBranchFromSim();
      setMultiverseState({ ...sim.multiverse });
      setSelectedPiece({ ...sel });
      syncBoardHighlights();
    },
    [initiateCombatDuel, syncActiveBranchFromSim, syncBoardHighlights]
  );

  // ============================================================================
  // UNIVERSITY OF GREATER ANDROMEDA — PLAYABLE 5-DAY WEEK & 5-ROOM CAMPUS HANDLERS
  // ============================================================================
  const DAY_NAMES_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const formatSimClock = (minuteOfDay: number): string => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(minuteOfDay)));
    const hh = Math.floor(clamped / 60);
    const mm = clamped % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const recordPersonalTransaction = (
    col: AcademicColloquiumState,
    description: string,
    category:
      | 'OPENING'
      | 'SALARY'
      | 'MORTGAGE'
      | 'CAFETERIA'
      | 'DRY_CLEANING'
      | 'CLOTHING'
      | 'GRANT_AWARD'
      | 'LAB_EQUIPMENT'
      | 'PUBLICATION_FEE',
    amount: number
  ) => {
    col.checkingBalance = Number((col.checkingBalance + amount).toFixed(2));
    col.personalLedger = [
      ...col.personalLedger,
      {
        id: `pled_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        account: 'PERSONAL',
        dayLabel: DAY_NAMES_LIST[col.dayIndex % 5] || 'Tuesday',
        timeLabel: formatSimClock(col.timeOfDayMinutes),
        description,
        category,
        amount,
        runningBalance: col.checkingBalance,
      },
    ];
  };

  const recordDepartmentalTransaction = (
    col: AcademicColloquiumState,
    description: string,
    category:
      | 'OPENING'
      | 'SALARY'
      | 'MORTGAGE'
      | 'CAFETERIA'
      | 'DRY_CLEANING'
      | 'CLOTHING'
      | 'GRANT_AWARD'
      | 'LAB_EQUIPMENT'
      | 'PUBLICATION_FEE',
    amount: number
  ) => {
    col.departmentalBudget = Number(Math.max(0, col.departmentalBudget + amount).toFixed(2));
    col.departmentalLedger = [
      ...col.departmentalLedger,
      {
        id: `dled_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        account: 'DEPARTMENTAL',
        dayLabel: DAY_NAMES_LIST[col.dayIndex % 5] || 'Tuesday',
        timeLabel: formatSimClock(col.timeOfDayMinutes),
        description,
        category,
        amount,
        runningBalance: col.departmentalBudget,
      },
    ];
  };

  const recomputeProofIntegrity = (col: AcademicColloquiumState) => {
    let score = 18;
    if (col.proofWorkbench.boundaryGaugeVerified) score += 32;
    if (col.proofWorkbench.jacobianSignFlipped) score += 28;
    if (col.proofWorkbench.chiralLabDataAttached) score += 22;
    col.centralLemmaIntegrity = Math.min(100, score);
    col.rigorScore = col.centralLemmaIntegrity;
  };

  const syncAppointmentsWithClock = (
    col: AcademicColloquiumState,
    advancingToNewDay: boolean
  ) => {
    for (const apt of col.appointments) {
      if (apt.dayIndex !== col.dayIndex) continue;

      if (
        (apt.status === 'UPCOMING' || apt.status === 'IN_WINDOW') &&
        (advancingToNewDay || col.timeOfDayMinutes > apt.endMinutes)
      ) {
        apt.status = 'MISSED';
        apt.outcomeNote = `Missed scheduled window (${formatSimClock(apt.startMinutes)}–${formatSimClock(apt.endMinutes)}).`;
        col.colloquiumLog = [
          `⚠️ MISSED APPOINTMENT: "${apt.title}" (${formatSimClock(apt.startMinutes)}). Your colleagues will remember this tomorrow.`,
          ...col.colloquiumLog.slice(0, 9),
        ];

        if (apt.id === 'appt_tue_toby') {
          col.tobyRelationship = Math.max(10, col.tobyRelationship - 26);
          col.npcMemoryNotes = [
            `Toby is irritated that you missed your 10:00 AM Room 4B check-in on Tuesday (Trust: ${col.tobyRelationship}/100).`,
            ...col.npcMemoryNotes.slice(0, 5),
          ];
          const tobyMissedEmail = {
            id: `email_toby_missed_${Date.now()}`,
            sender: 'Toby (Your Graduate Student)',
            senderRole: '7th-Year PhD Candidate · Office 4B-Annex',
            subject: 'You missed our 10:00 AM Lemma 3.2 check-in...',
            dateLabel: `${DAY_NAMES_LIST[col.dayIndex % 5]} ${formatSimClock(Math.max(col.timeOfDayMinutes, apt.endMinutes + 5))}`,
            category: 'GRAD_STUDENT' as const,
            unread: true,
            body: `Dr. Pawn,\n\nI waited by the chalkboard in Room 4B from 10:00 to 10:45 with the off-diagonal Jacobian pages, and you never showed up.\n\nLook, I know you're stressed about tenure and the 14:30 review, but Lemma 3.2 still has a −κ sign error. Come to the chalkboard in Room 4B when you actually have time.\n\n— Toby`,
          };
          col.inbox = [tobyMissedEmail, ...col.inbox];
        } else if (apt.id === 'appt_tue_bishop') {
          col.bishopRelationship = Math.max(5, col.bishopRelationship - 28);
          col.chairRelationship = Math.max(5, col.chairRelationship - 22);
          col.adminProductivityScore = Math.max(
            15,
            Number((col.adminProductivityScore - 8.5).toFixed(1))
          );
          col.npcMemoryNotes = [
            `Prof. Bishop & Chairwoman Queen are furious that you missed Tuesday's 14:30 Review in Seminar Room 204.`,
            ...col.npcMemoryNotes.slice(0, 5),
          ];
          const bishopMissedEmail = {
            id: `email_bishop_missed_${Date.now()}`,
            sender: 'Dr. Queen & Prof. Bishop',
            senderRole: 'Seminar Room 204 · Mandatory Review Committee',
            subject: 'UNEXCUSED ABSENCE: 14:30 Departmental & Chiral Lab Review',
            dateLabel: `Tuesday 15:20 · Formal Reprimand`,
            category: 'CHAIR' as const,
            unread: true,
            body: `Dr. Pawn,\n\nYou failed to appear in Seminar Room 204 between 14:30 and 15:15 for your mandatory Departmental & Chiral Lab Access Review.\n\nProfessor Bishop and I waited forty-five minutes. Your Chair Relationship has dropped to ${col.chairRelationship}/100, and Professor Bishop has withheld daytime Chiral Lab access. You will have to corner him in person with an approved grant budget if you want even a 2:00 AM slot.\n\n— Chairwoman Dr. Queen`,
          };
          col.inbox = [bishopMissedEmail, ...col.inbox];
        } else if (apt.id === 'appt_wed_seminar') {
          col.reviewer2RivalryLevel = Math.min(100, col.reviewer2RivalryLevel + 18);
          col.npcMemoryNotes = [
            `Prof. Rook boasted to the entire department when you missed Wednesday's 14:00 Colloquium.`,
            ...col.npcMemoryNotes.slice(0, 5),
          ];
        }
      } else if (
        apt.status === 'UPCOMING' &&
        col.timeOfDayMinutes >= apt.startMinutes &&
        col.timeOfDayMinutes <= apt.endMinutes
      ) {
        apt.status = 'IN_WINDOW';
      }
    }
  };

  const advanceSimMinutes = (
    col: AcademicColloquiumState,
    mins: number,
    reason?: string
  ) => {
    col.timeOfDayMinutes += mins;
    syncAppointmentsWithClock(col, false);
    if (reason) {
      col.colloquiumLog = [
        `⏱️ [${formatSimClock(col.timeOfDayMinutes)}] ${reason} (+${mins}m)`,
        ...col.colloquiumLog.slice(0, 9),
      ];
    }
  };

  const triggerCafeteriaCollisionSpill = (col: AcademicColloquiumState) => {
    const sim = simRef.current;
    col.carryingHotCoffee = false;
    col.shirtState = 'COFFEE_STAINED';
    col.coffeeSpillIncidentTriggered = true;
    col.cafeteriaQueuePosition = null;
    col.cafeteriaServiceProgress = 0;
    sim.cameraShake = 0.28;
    soundEngine.playBrokenCoffeeMachineSputter();

    if (sim.universityOfficeRig) {
      triggerCoffeeSpill3DSplash(
        sim.universityOfficeRig,
        sim.uniPlayer.worldX,
        sim.uniPlayer.worldZ
      );
    }

    col.npcMemoryNotes = [
      `A distracted undergrad collided with you outside the Cafeteria! Your only clean white dress shirt is drenched in dark espresso before your 14:30 review.`,
      ...col.npcMemoryNotes.slice(0, 5),
    ];
    col.colloquiumLog = [
      `💥 [${formatSimClock(col.timeOfDayMinutes)}] CAFETERIA COLLISION! As you stepped away from the register carrying your $4.50 coffee, a distracted undergraduate carrying a stack of textbooks slammed straight into your chest!`,
      `👔 Scalding dark espresso is now splattered across your only clean Oxford dress shirt — and your mandatory review with Prof. Bishop & Chairwoman Queen is at 14:30 in Seminar Room 204!`,
      ...col.colloquiumLog.slice(0, 9),
    ];
  };

  const handleEnterUniversityOffice = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    col.stage = 'UNIVERSITY_SIMULATOR';
    sim.uniPlayer.worldX = -10.0;
    sim.uniPlayer.worldZ = -3.2;
    sim.uniPlayer.yaw = 0;
    sim.uniPlayer.targetX = null;
    sim.uniPlayer.targetZ = null;
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleWalkToRoom = useCallback((roomId: UniversityRoomId) => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    const dest = UNIVERSITY_ROOM_CENTERS[roomId];
    // If leaving Cafeteria while carrying hot coffee for the first time, the distracted student in the doorway collides with Dr. Pawn!
    if (
      col.currentRoom === 'CAFETERIA' &&
      roomId !== 'CAFETERIA' &&
      col.carryingHotCoffee &&
      !col.coffeeSpillIncidentTriggered
    ) {
      sim.uniPlayer.worldX = 9.2;
      sim.uniPlayer.worldZ = -1.5;
      advanceSimMinutes(col, 4);
      triggerCafeteriaCollisionSpill(col);
      col.currentRoom = roomId;
      sim.uniPlayer.targetX = dest.x;
      sim.uniPlayer.targetZ = dest.z;
      setAcademicColloquium({ ...col });
      return;
    }

    col.cafeteriaQueuePosition = null;
    col.cafeteriaServiceProgress = 0;
    col.currentRoom = roomId;
    sim.uniPlayer.targetX = dest.x;
    sim.uniPlayer.targetZ = dest.z;
    advanceSimMinutes(col, 4, `Walked to ${dest.label}`);
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleToggleDriveCar = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    if (sim.uniCar.isDriving) {
      // Park car & step out
      sim.uniCar.isDriving = false;
      sim.uniCar.speed = 0;
      col.isDrivingCar = false;
      col.carSpeedMph = 0;
      sim.uniPlayer.worldX = sim.uniCar.worldX + 2.0;
      sim.uniPlayer.worldZ = sim.uniCar.worldZ;
      col.colloquiumLog = [
        `🚗 [${formatSimClock(col.timeOfDayMinutes)}] Shifted 1984 Station Wagon into PARK. Stepped out onto the pavement.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playOfficeKeyboardClack();
    } else {
      // Enter car & drive
      const dist = Math.hypot(sim.uniPlayer.worldX - sim.uniCar.worldX, sim.uniPlayer.worldZ - sim.uniCar.worldZ);
      if (dist > 15.0 && col.currentRoom !== 'CAMPUS_QUAD' && col.currentRoom !== 'CITY_STREETS') {
        col.colloquiumLog = [
          `🚗 [${formatSimClock(col.timeOfDayMinutes)}] Walked out to your 1984 Burgundy Station Wagon in the South Lot. Engine turns over with a familiar rumble.`,
          ...col.colloquiumLog.slice(0, 9),
        ];
        sim.uniPlayer.worldX = sim.uniCar.worldX;
        sim.uniPlayer.worldZ = sim.uniCar.worldZ;
        col.currentRoom = 'CAMPUS_QUAD';
      } else {
        col.colloquiumLog = [
          `🚗 [${formatSimClock(col.timeOfDayMinutes)}] Turned the key in your 1984 Station Wagon. Headlights illuminate the road ahead! Use WASD to steer & drive.`,
          ...col.colloquiumLog.slice(0, 9),
        ];
      }
      sim.uniCar.isDriving = true;
      col.isDrivingCar = true;
      soundEngine.playOfficeKeyboardClack();
    }
    setAcademicColloquium({ ...col });
  }, []);

  const handleOpenTransitModal = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    col.tramTransitModalOpen = true;
    soundEngine.playTramChime();
    setAcademicColloquium({ ...col });
  }, []);

  const handleCloseTransitModal = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    col.tramTransitModalOpen = false;
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleBoardTransitToStation = useCallback((stationId: string) => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    const st = TRAM_STATIONS.find((s) => s.id === stationId);
    if (!st) return;

    if (col.checkingBalance < 1.75) {
      col.colloquiumLog = [
        `💳 [${formatSimClock(col.timeOfDayMinutes)}] Insufficient funds! Farecard reader declined: You need at least $1.75 in personal checking for a GAMTA tram token.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    recordPersonalTransaction(
      col,
      `GAMTA Metro Transit — Retrocausal Line 1 to ${st.name}`,
      'CAFETERIA',
      -1.75
    );

    advanceSimMinutes(col, 7, `Rode GAMTA Retrocausal Tram to ${st.shortLabel}`);
    col.energyLevel = Math.min(100, col.energyLevel + 6); // Relaxing commute reading preprints!
    col.tramTransitModalOpen = false;
    col.isRidingTram = false;

    // Relocate player to station platform
    sim.uniPlayer.worldX = st.x + Math.sin(st.platformAngle + Math.PI / 2) * 2.8;
    sim.uniPlayer.worldZ = st.z + Math.cos(st.platformAngle + Math.PI / 2) * 2.8;
    sim.uniPlayer.targetX = null;
    sim.uniPlayer.targetZ = null;

    if (stationId === 'PEANO_QUAD') {
      col.currentRoom = 'CAMPUS_QUAD';
    } else if (stationId === 'DOWNTOWN_PERSEUS') {
      col.currentRoom = 'DRY_CLEANER';
    } else if (stationId === 'KEPLER_SUBURBS') {
      col.currentRoom = 'PAWN_HOUSE';
    } else {
      col.currentRoom = 'CAMPUS_QUAD';
    }

    soundEngine.playTramChime();
    soundEngine.playTramBell();
    soundEngine.playTramMotorHum();

    col.colloquiumLog = [
      `🚈 [${formatSimClock(col.timeOfDayMinutes)}] GAMTA RETROCAUSAL LINE 1: Arrived at ${st.name} (-$1.75 fare). The 7-minute express trip gave you a few peaceful moments to review Lemma 3.2 (+6 Energy)!`,
      ...col.colloquiumLog.slice(0, 9),
    ];

    setAcademicColloquium({ ...col });
  }, []);

  const handleSetDrawerTab = useCallback(
    (tab: 'NONE' | 'CHALKBOARD_PROOF' | 'FINANCE_LEDGER' | 'PINE_MAIL' | 'CALENDAR_NPCS') => {
      const sim = simRef.current;
      const col = sim.academicColloquium;
      if (!col || !col.active) return;

      col.activeDrawerTab = tab;
      soundEngine.playOfficeKeyboardClack();
      setAcademicColloquium({ ...col });
    },
    []
  );

  const handleSelectAcademicEmail = useCallback((emailId: string) => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    col.selectedEmailId = emailId;
    col.inbox = col.inbox.map((em) =>
      em.id === emailId ? { ...em, unread: false } : em
    );
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleKickCoffeeMachine = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    col.coffeeMachineKickCount += 1;
    advanceSimMinutes(col, 5);
    sim.cameraShake = 0.14;
    soundEngine.playBrokenCoffeeMachineSputter();

    const quips = [
      `☕ [${formatSimClock(col.timeOfDayMinutes)}] Kicked the 1987 Bunn-O-Matic in Room 4B. It wheezed, dispensed 4mL of lukewarm rust, and went dark. Walk to the Lagrange Point Cafeteria down the corridor.`,
      `☕ [${formatSimClock(col.timeOfDayMinutes)}] Kick #${col.coffeeMachineKickCount}: The "OUT OF ORDER SINCE NOV 1987" note fluttered to the linoleum. Still no coffee.`,
      `☕ [${formatSimClock(col.timeOfDayMinutes)}] Kick #${col.coffeeMachineKickCount}: A relay clicked inside the 1987 chassis. Down the hall, Tenured Prof. Rook sipped a fresh cafeteria espresso.`,
    ];
    col.colloquiumLog = [
      quips[(col.coffeeMachineKickCount - 1) % quips.length],
      ...col.colloquiumLog.slice(0, 9),
    ];
    setAcademicColloquium({ ...col });
  }, []);

  const handleJoinOrLeaveCafeteriaQueue = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    if (col.cafeteriaQueuePosition !== null) {
      col.cafeteriaQueuePosition = null;
      col.cafeteriaServiceProgress = 0;
      col.colloquiumLog = [
        `🚶 [${formatSimClock(col.timeOfDayMinutes)}] Stepped out of the Lagrange Point Cafeteria coffee queue.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
    } else {
      col.currentRoom = 'CAFETERIA';
      col.cafeteriaQueuePosition = 3;
      col.cafeteriaServiceProgress = 0;
      sim.uniPlayer.worldX = 8.0;
      sim.uniPlayer.worldZ = -4.3;
      sim.uniPlayer.targetX = null;
      sim.uniPlayer.targetZ = null;
      col.colloquiumLog = [
        `☕ [${formatSimClock(col.timeOfDayMinutes)}] Joined the physical coffee queue at Lagrange Point Cafeteria behind 3 patrons. Wait in line for the cashier, or step out anytime.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
    }
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleDropOffShirtAtCleaner = useCallback(
    (service: 'STANDARD_NEXT_DAY' | 'EXPRESS_75_MIN') => {
      const sim = simRef.current;
      const col = sim.academicColloquium;
      if (!col || !col.active || col.shirtState !== 'COFFEE_STAINED') return;

      const mins = col.timeOfDayMinutes;
      const cleanerIsOpen = mins >= 510 && mins <= 1050;
      if (!cleanerIsOpen) {
        col.colloquiumLog = [
          `🔒 [${formatSimClock(mins)}] Perseus Dry Cleaners is CLOSED (Open 08:30–17:30). The steel shutter is rolled down.`,
          ...col.colloquiumLog.slice(0, 9),
        ];
        soundEngine.playRejectionStamp();
        setAcademicColloquium({ ...col });
        return;
      }

      const fee = service === 'EXPRESS_75_MIN' ? 28.5 : 14.0;
      if (col.checkingBalance < fee) {
        col.colloquiumLog = [
          `💳 [${formatSimClock(mins)}] Insufficient funds! Clerk Mr. Chen refuses to process ${service === 'EXPRESS_75_MIN' ? 'Express ($28.50)' : 'Standard ($14.00)'} cleaning because your checking account only has $${col.checkingBalance.toFixed(2)}.`,
          ...col.colloquiumLog.slice(0, 9),
        ];
        soundEngine.playRejectionStamp();
        setAcademicColloquium({ ...col });
        return;
      }

      advanceSimMinutes(col, 6);
      recordPersonalTransaction(
        col,
        `Perseus Dry Cleaners — ${service === 'EXPRESS_75_MIN' ? '1-Hr Express Stain Removal' : 'Standard Next-Day Press'} (#PDC-108)`,
        'DRY_CLEANING',
        -fee
      );

      const readyDayIndex =
        service === 'EXPRESS_75_MIN' ? col.dayIndex : Math.min(4, col.dayIndex + 1);
      const readyMinutes =
        service === 'EXPRESS_75_MIN' ? col.timeOfDayMinutes + 75 : 9 * 60;

      col.shirtState = 'AT_CLEANERS_WEARING_SWEATER';
      col.activeDryCleaningTicket = {
        ticketNumber: 'PDC-108',
        serviceName: service,
        feePaid: fee,
        droppedOffDayIndex: col.dayIndex,
        droppedOffMinutes: col.timeOfDayMinutes,
        readyDayIndex,
        readyMinutes,
        collected: false,
      };

      col.colloquiumLog = [
        `🧥 [${formatSimClock(col.timeOfDayMinutes)}] Handed over your coffee-stained Oxford shirt at Perseus Dry Cleaners (-$${fee.toFixed(2)}). Ticket #PDC-108 ready ${DAY_NAMES_LIST[readyDayIndex]} at ${formatSimClock(readyMinutes)}. You are now wearing your faded UGA backup sweatshirt.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playOfficeKeyboardClack();
      setAcademicColloquium({ ...col });
    },
    []
  );

  const handlePickUpCleanedShirt = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active || !col.activeDryCleaningTicket || col.activeDryCleaningTicket.collected)
      return;

    const mins = col.timeOfDayMinutes;
    const cleanerIsOpen = mins >= 510 && mins <= 1050;
    if (!cleanerIsOpen) {
      col.colloquiumLog = [
        `🔒 [${formatSimClock(mins)}] Perseus Dry Cleaners is CLOSED (Hours: 08:30–17:30)! You cannot collect Ticket #${col.activeDryCleaningTicket.ticketNumber} until tomorrow morning.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    const t = col.activeDryCleaningTicket;
    const isReady =
      col.dayIndex > t.readyDayIndex ||
      (col.dayIndex === t.readyDayIndex && col.timeOfDayMinutes >= t.readyMinutes);

    if (!isReady) {
      col.colloquiumLog = [
        `⏳ [${formatSimClock(mins)}] Mr. Chen points to the steam press: "Ticket #${t.ticketNumber} won't be ready until ${DAY_NAMES_LIST[t.readyDayIndex]} at ${formatSimClock(t.readyMinutes)}, Dr. Pawn!"`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playBrokenCoffeeMachineSputter();
      setAcademicColloquium({ ...col });
      return;
    }

    advanceSimMinutes(col, 5);
    t.collected = true;
    col.shirtState = 'CLEAN';
    col.colloquiumLog = [
      `✨ [${formatSimClock(col.timeOfDayMinutes)}] Collected your freshly pressed, spotless Oxford dress shirt (Ticket #${t.ticketNumber}) from Perseus Dry Cleaners!`,
      ...col.colloquiumLog.slice(0, 9),
    ];
    soundEngine.playSynodResonance(false);
    setAcademicColloquium({ ...col });
  }, []);

  const handleBuyNewShirtAtHaberdashery = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    const mins = col.timeOfDayMinutes;
    if (mins < 510 || mins > 1050) {
      col.colloquiumLog = [
        `🔒 [${formatSimClock(mins)}] The Haberdashery counter is CLOSED after 17:30.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    if (col.checkingBalance < 68.0) {
      col.colloquiumLog = [
        `💳 [${formatSimClock(mins)}] Cannot afford the $68.00 Haberdashery Oxford shirt! You only have $${col.checkingBalance.toFixed(2)} in personal checking.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    advanceSimMinutes(col, 10);
    recordPersonalTransaction(
      col,
      'Perseus Haberdashery — Brand-New Crisp Oxford Dress Shirt',
      'CLOTHING',
      -68.0
    );
    col.shirtState = 'CLEAN';
    col.colloquiumLog = [
      `👔 [${formatSimClock(col.timeOfDayMinutes)}] Purchased a brand-new $68.00 Oxford dress shirt from the Haberdashery counter and put it on immediately.`,
      ...col.colloquiumLog.slice(0, 9),
    ];
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleCommuteHomeForSpareShirt = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active || !col.hasSpareCleanShirtAtHome) return;

    if (col.checkingBalance < 5.5) {
      col.colloquiumLog = [
        `🚌 [${formatSimClock(col.timeOfDayMinutes)}] You don't even have $5.50 in checking for round-trip Crosstown Bus fare!`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    recordPersonalTransaction(
      col,
      'Andromeda Crosstown Transit — Round-Trip Bus Fare to Apartment',
      'CAFETERIA',
      -5.5
    );
    advanceSimMinutes(col, 95, 'Took 95-minute round-trip bus commute home to change into spare shirt');
    col.hasSpareCleanShirtAtHome = false;
    col.shirtState = 'CLEAN';
    col.energyLevel = Math.max(15, col.energyLevel - 16);
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleAttendScheduledMeetingInRoom = useCallback((appointmentId: string) => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    const apt = col.appointments.find((a) => a.id === appointmentId);
    if (!apt) return;

    if (col.currentRoom !== apt.locationRoom) {
      const dest = UNIVERSITY_ROOM_CENTERS[apt.locationRoom];
      col.currentRoom = apt.locationRoom;
      sim.uniPlayer.worldX = dest.x;
      sim.uniPlayer.worldZ = dest.z;
    }

    col.timeOfDayMinutes = Math.max(col.timeOfDayMinutes, apt.startMinutes) + 30;
    const stained = col.shirtState === 'COFFEE_STAINED';
    const sweater = col.shirtState === 'AT_CLEANERS_WEARING_SWEATER';

    apt.status = stained
      ? 'ATTENDED_STAINED'
      : sweater
      ? 'ATTENDED_SWEATER'
      : 'ATTENDED_CLEAN';

    if (apt.id === 'appt_tue_toby') {
      col.tobyRelationship = Math.min(100, col.tobyRelationship + 16);
      apt.outcomeNote = stained
        ? 'Toby handed you paper napkins for your coffee-stained shirt and pointed out the −κ Jacobian sign error on the chalkboard.'
        : 'Reviewed the off-diagonal Jacobian sign error with Toby at the Room 4B chalkboard (+16 Toby Trust).';
      col.npcMemoryNotes = [
        `Met with Toby on Tuesday morning; he showed you how flipping −κ to +κ fixes the Jacobian determinant.`,
        ...col.npcMemoryNotes.slice(0, 5),
      ];
      col.colloquiumLog = [
        `🎓 [${formatSimClock(col.timeOfDayMinutes)}] Attended 10:00 Consultation with Toby: ${apt.outcomeNote}`,
        ...col.colloquiumLog.slice(0, 9),
      ];
    } else if (apt.id === 'appt_tue_bishop') {
      if (stained) {
        col.bishopRelationship = Math.max(5, col.bishopRelationship - 20);
        col.chairRelationship = Math.max(5, col.chairRelationship - 16);
        apt.outcomeNote =
          'Arrived wearing a massive brown espresso stain! Prof. Bishop scoffed at your "sloppy preparation" and refused daytime Lab access (-20 Bishop, -16 Chair).';
        col.npcMemoryNotes = [
          `Prof. Bishop & Chairwoman Queen were appalled that you wore a coffee-stained shirt to the 14:30 review.`,
          ...col.npcMemoryNotes.slice(0, 5),
        ];
        const stainEmail = {
          id: `email_bishop_stain_${Date.now()}`,
          sender: 'Prof. Bishop (Quantum Lab Director)',
          senderRole: 'Chiral Interferometry Committee · Seminar Room 204',
          subject: 'RE: Your Coffee-Stained Appearance at the 14:30 Review',
          dateLabel: `Tuesday ${formatSimClock(col.timeOfDayMinutes)}`,
          category: 'LAB_POLITICS' as const,
          unread: true,
          body: `Dr. Pawn,\n\nYou walked into Seminar Room 204 at 14:30 with dark cafeteria coffee soaked across your dress shirt and asked me to entrust a $4.2M Chiral Interferometer to your group.\n\nIf you cannot keep coffee off your own collar, I certainly cannot risk you near our diagonal mirrors without an approved cryogenic helium budget ($950). Clean yourself up and submit a proper Grant Budget first.\n\n— Prof. Bishop`,
        };
        col.inbox = [stainEmail, ...col.inbox];
        col.selectedEmailId = stainEmail.id;
      } else if (sweater) {
        col.bishopRelationship = Math.min(100, col.bishopRelationship + 6);
        col.chairRelationship = Math.min(100, col.chairRelationship + 4);
        col.bishopLabAccessGranted = true;
        col.bishopSuspectedWithholding = false;
        apt.outcomeNote =
          'Attended in your backup UGA sweatshirt while your shirt was at Perseus Dry Cleaners. Chairwoman Queen raised an eyebrow, but Prof. Bishop respected your punctuality and granted a 2:00 AM Lab slot!';
      } else {
        col.bishopRelationship = Math.min(100, col.bishopRelationship + 22);
        col.chairRelationship = Math.min(100, col.chairRelationship + 16);
        col.bishopLabAccessGranted = true;
        col.bishopSuspectedWithholding = false;
        apt.outcomeNote =
          'Arrived in a spotless Oxford dress shirt! Prof. Bishop and Chairwoman Queen approved your 2:00 AM Tuesday Chiral Interferometer slot (+22 Bishop, +16 Chair).';
      }
      col.colloquiumLog = [
        `📋 [${formatSimClock(col.timeOfDayMinutes)}] 14:30 Departmental Review Outcome: ${apt.outcomeNote}`,
        ...col.colloquiumLog.slice(0, 9),
      ];
    } else if (apt.id === 'appt_wed_seminar') {
      col.rookIdenticalPapersCount += 1;
      col.rookHIndex += 2;
      if (stained) {
        col.reviewer2RivalryLevel = Math.min(100, col.reviewer2RivalryLevel + 22);
        apt.outcomeNote =
          'Debated Prof. Rook while wearing a coffee-stained shirt; Rook mocked your attire from the podium.';
      } else {
        col.hIndex += 1;
        col.reviewer2RivalryLevel = Math.min(100, col.reviewer2RivalryLevel + 15);
        apt.outcomeNote =
          'Publicly dismantled Prof. Rook’s 4th identical rectilinear paper in Seminar Room 204 (+1 h-index)!';
      }
      col.colloquiumLog = [
        `🏛️ [${formatSimClock(col.timeOfDayMinutes)}] Wednesday Faculty Colloquium: ${apt.outcomeNote}`,
        ...col.colloquiumLog.slice(0, 9),
      ];
    }

    syncAppointmentsWithClock(col, false);
    soundEngine.playSynodResonance(false);
    setAcademicColloquium({ ...col });
  }, []);

  const handleTalkToNpcInRoom = useCallback(
    (npcId: 'TOBY' | 'BISHOP' | 'QUEEN' | 'ROOK') => {
      const sim = simRef.current;
      const col = sim.academicColloquium;
      if (!col || !col.active) return;

      advanceSimMinutes(col, 10);
      const stained = col.shirtState === 'COFFEE_STAINED';

      if (npcId === 'TOBY') {
        col.tobyRelationship = Math.min(100, col.tobyRelationship + 6);
        col.colloquiumLog = [
          stained
            ? `💬 [${formatSimClock(col.timeOfDayMinutes)}] Toby winced at your coffee-stained shirt: "Dr. Pawn, did you get run over in the cafeteria?! Open the Chalkboard Workbench so we can flip the −κ Jacobian sign and select the Chiral Anti-Periodic gauge!"`
            : `💬 [${formatSimClock(col.timeOfDayMinutes)}] Toby points to the chalkboard: "Once we select the Chiral Anti-Periodic gauge ψ(t₀−1) = −γ₅ψ(t₀) and flip −κ to +κ, we just need Prof. Bishop's Chiral Lab data!"`,
          ...col.colloquiumLog.slice(0, 9),
        ];
      } else if (npcId === 'BISHOP') {
        if (stained) {
          col.bishopRelationship = Math.max(5, col.bishopRelationship - 8);
          col.colloquiumLog = [
            `💬 [${formatSimClock(col.timeOfDayMinutes)}] Prof. Bishop stepped back in disgust: "Good grief, Pawn, you smell like roasted Arabica. Do not come into Seminar Room 204 at 14:30 wearing that stained shirt!"`,
            ...col.colloquiumLog.slice(0, 9),
          ];
        } else if (!col.bishopLabAccessGranted && col.departmentalBudget >= 950) {
          col.bishopLabAccessGranted = true;
          col.bishopSuspectedWithholding = false;
          col.bishopRelationship = Math.min(100, col.bishopRelationship + 12);
          col.colloquiumLog = [
            `💬 [${formatSimClock(col.timeOfDayMinutes)}] Cornered Prof. Bishop in clean attire! Seeing your solvent departmental budget, he authorized the 2:00 AM Chiral Interferometer slot.`,
            ...col.colloquiumLog.slice(0, 9),
          ];
        } else {
          col.colloquiumLog = [
            `💬 [${formatSimClock(col.timeOfDayMinutes)}] Prof. Bishop adjusted his burgundy velvet elbow patches: "${col.bishopLabAccessGranted ? 'Your 2:00 AM Chiral Lab slot is active. Run your experiment from the Chalkboard Workbench.' : 'Meet me at 14:30 in Seminar Room 204 in respectable attire, and make sure your Departmental Budget has $950 for liquid helium.'}"`,
            ...col.colloquiumLog.slice(0, 9),
          ];
        }
      } else if (npcId === 'QUEEN') {
        if (stained) {
          col.chairRelationship = Math.max(5, col.chairRelationship - 8);
          col.colloquiumLog = [
            `💬 [${formatSimClock(col.timeOfDayMinutes)}] Chairwoman Dr. Queen glared at your chest: "Dr. Pawn, is that espresso on your shirt? Visit Perseus Dry Cleaners before the 14:30 review."`,
            ...col.colloquiumLog.slice(0, 9),
          ];
        } else {
          col.chairRelationship = Math.min(100, col.chairRelationship + 5);
          col.colloquiumLog = [
            `💬 [${formatSimClock(col.timeOfDayMinutes)}] Chairwoman Dr. Queen reviewed her clipboard: "Keep your Faculty Productivity Index above 65 and submit your legitimate Departmental Grant lines in the Ledger."`,
            ...col.colloquiumLog.slice(0, 9),
          ];
        }
      } else if (npcId === 'ROOK') {
        col.rookIdenticalPapersCount += 1;
        col.rookHIndex += 1;
        col.reviewer2RivalryLevel = Math.min(100, col.reviewer2RivalryLevel + 12);
        col.colloquiumLog = [
          stained
            ? `💬 [${formatSimClock(col.timeOfDayMinutes)}] Tenured Prof. Rook chuckled over his espresso: "Nice coffee stain, Pawn. By the way, I just rejected a terribly speculative retrocausal paper this morning as Reviewer #2."`
            : `💬 [${formatSimClock(col.timeOfDayMinutes)}] Tenured Prof. Rook adjusted his gold cufflinks: "My h-index just hit ${col.rookHIndex} after publishing 'On Rectilinear Files IV'. Have you considered citing me in Lemma 3.2?"`,
          ...col.colloquiumLog.slice(0, 9),
        ];
      }

      soundEngine.playOfficeKeyboardClack();
      setAcademicColloquium({ ...col });
    },
    []
  );

  // CHALKBOARD PROOF WORKBENCH HANDLERS
  const handleSelectBoundaryGauge = useCallback(
    (gauge: 'DIRICHLET_CLAMP' | 'CHIRAL_ANTIPERIODIC' | 'TRUNCATED_PERTURBATIVE') => {
      const sim = simRef.current;
      const col = sim.academicColloquium;
      if (!col || !col.active) return;

      advanceSimMinutes(col, 25);
      col.proofWorkbench.boundaryGaugeChoice = gauge;
      if (gauge === 'CHIRAL_ANTIPERIODIC') {
        col.proofWorkbench.boundaryGaugeVerified = true;
        col.proofWorkbench.lastVerificationMessage =
          '✓ Chiral Anti-Periodic Gauge ψ(t₀−1) = −γ₅ψ(t₀) verified! The boundary commutator surface term vanishes identically.';
        soundEngine.playSynodResonance(false);
      } else if (gauge === 'DIRICHLET_CLAMP') {
        col.proofWorkbench.boundaryGaugeVerified = false;
        col.proofWorkbench.lastVerificationMessage =
          '✗ Hard Dirichlet Clamp ψ(t₀−1) = 0 violates causal unitarity and zeroes out the retrocausal propagator.';
        soundEngine.playBrokenCoffeeMachineSputter();
      } else {
        col.proofWorkbench.boundaryGaugeVerified = false;
        col.proofWorkbench.lastVerificationMessage =
          '✗ Truncated O(ε²) expansion still diverges at the t₀ − 1 monarch worldline pole.';
        soundEngine.playBrokenCoffeeMachineSputter();
      }
      recomputeProofIntegrity(col);
      setAcademicColloquium({ ...col });
    },
    []
  );

  const handleToggleJacobianSign = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    advanceSimMinutes(col, 20);
    col.proofWorkbench.jacobianSignFlipped = !col.proofWorkbench.jacobianSignFlipped;
    col.proofWorkbench.lastVerificationMessage = col.proofWorkbench.jacobianSignFlipped
      ? '✓ Flipped off-diagonal Jacobian sign from −κ to +κ! Determinant is now λ² + κ² > 0 (strictly positive-definite).'
      : '✗ Reverted off-diagonal Jacobian sign to −κ (singular at λ = ±κ).';
    recomputeProofIntegrity(col);
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleRunChiralLabExperiment = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    if (!col.bishopLabAccessGranted) {
      col.colloquiumLog = [
        `🔬 [${formatSimClock(col.timeOfDayMinutes)}] Cannot run Chiral Lab verification yet: Prof. Bishop has not granted you access to the Chiral Interferometer! Attend the 14:30 review in Seminar Room 204 or talk to him with a funded budget.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    if (col.departmentalBudget < 950) {
      col.colloquiumLog = [
        `🔬 [${formatSimClock(col.timeOfDayMinutes)}] Insufficient Departmental Budget ($${col.departmentalBudget.toFixed(2)}) for the $950 Liquid Helium run! Submit a Departmental Grant in the Finance Ledger first.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    advanceSimMinutes(col, 45);
    recordDepartmentalTransaction(
      col,
      'Chiral Interferometry Facility — 02:00 AM Liquid Helium & Mirror Calibration Run',
      'LAB_EQUIPMENT',
      -950
    );
    col.proofWorkbench.chiralLabDataAttached = true;
    col.proofWorkbench.lastVerificationMessage =
      '✓ 02:00 AM Chiral Interferometer data attached (4.8σ retrocausal phase convergence)!';
    recomputeProofIntegrity(col);

    if (col.centralLemmaIntegrity >= 100 && !col.inbox.some((e) => e.id === 'email_lemma_fixed')) {
      const fixedEmail = {
        id: 'email_lemma_fixed',
        sender: 'Toby (Your Graduate Student)',
        senderRole: '7th-Year PhD Candidate · Office 4B-Annex',
        subject: 'WE FIXED IT!! Central Lemma 3.2 is 100% Airtight!',
        dateLabel: `${DAY_NAMES_LIST[col.dayIndex % 5]} ${formatSimClock(col.timeOfDayMinutes)}`,
        category: 'GRAD_STUDENT' as const,
        unread: true,
        body: `Dr. Pawn!\n\nWith the Chiral Anti-Periodic gauge ψ(t₀−1) = −γ₅ψ(t₀), the corrected +κ Jacobian determinant, and our 4.8σ Chiral Interferometer data, Central Lemma 3.2 is 100% mathematically airtight!\n\n"On the Nonexistence of Monarchs in Retrocausal Systems" is ready for formal submission to the Journal of Transfinite Causality!\n\n— Toby`,
      };
      col.inbox = [fixedEmail, ...col.inbox];
      col.selectedEmailId = fixedEmail.id;
    }

    col.colloquiumLog = [
      `🔬 [${formatSimClock(col.timeOfDayMinutes)}] Ran 02:00 AM Chiral Interferometer experiment (-$950 Dept. Budget). Central Lemma 3.2 Integrity is now ${col.centralLemmaIntegrity}%!`,
      ...col.colloquiumLog.slice(0, 9),
    ];
    soundEngine.playSynodResonance(false);
    setAcademicColloquium({ ...col });
  }, []);

  const handleToggleRookCitations = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    col.proofWorkbench.rookCitationsAttached = !col.proofWorkbench.rookCitationsAttached;
    col.reviewer2CitationsBribed = col.proofWorkbench.rookCitationsAttached;
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  // PERSONAL & DEPARTMENTAL FINANCIAL LEDGERS + GRANT BUDGET BUILDER
  const handleToggleGrantLineItem = useCallback((lineId: string) => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    col.grantBudgetLines = col.grantBudgetLines.map((l) =>
      l.id === lineId ? { ...l, selected: !l.selected } : l
    );
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleSubmitGrantBudgetProposal = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active || col.grantSubmittedAndApproved) return;

    const selectedLines = col.grantBudgetLines.filter((l) => l.selected);
    if (selectedLines.length === 0) {
      col.colloquiumLog = [
        `📑 [${formatSimClock(col.timeOfDayMinutes)}] Select at least one budget line item before submitting your Departmental Grant Proposal.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    const illegalItem = selectedLines.find((l) => l.isProhibitedPersonalExpense);
    if (illegalItem) {
      col.chairRelationship = Math.max(5, col.chairRelationship - 18);
      col.adminProductivityScore = Math.max(
        10,
        Number((col.adminProductivityScore - 6.0).toFixed(1))
      );
      col.colloquiumLog = [
        `🚨 [${formatSimClock(col.timeOfDayMinutes)}] GRANT REJECTED BY COMPLIANCE AUDIT! You attempted to bill "${illegalItem.label}" ($${illegalItem.directCost}) to a restricted Departmental Research Grant! Chairwoman Queen docked your relationship (-18). Uncheck prohibited personal items and resubmit.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    advanceSimMinutes(col, 30);
    const totalDirect = selectedLines.reduce((acc, l) => acc + l.directCost, 0);
    col.grantSubmittedAndApproved = true;
    recordDepartmentalTransaction(
      col,
      `UGA Supplemental Grant Award (Direct Allocation after 58.5% University Overhead)`,
      'GRANT_AWARD',
      totalDirect
    );
    col.chairRelationship = Math.min(100, col.chairRelationship + 12);
    col.tobyRelationship = Math.min(100, col.tobyRelationship + 15);
    col.adminProductivityScore = Math.min(
      99,
      Number((col.adminProductivityScore + 6.5).toFixed(1))
    );

    const grantEmail = {
      id: `email_grant_${Date.now()}`,
      sender: 'Dr. Queen (Department Chair)',
      senderRole: 'Office of Sponsored Research & Indirect Overhead',
      subject: `Supplemental Grant Approved: +$${totalDirect.toLocaleString()} Credited to Dept. Acct`,
      dateLabel: `${DAY_NAMES_LIST[col.dayIndex % 5]} ${formatSimClock(col.timeOfDayMinutes)}`,
      category: 'CHAIR' as const,
      unread: true,
      body: `Dr. Pawn,\n\nYour compliant Departmental Grant budget ($${totalDirect.toLocaleString()} direct research costs; 58.5% indirect overhead retained by the University) has been approved.\n\nYour Departmental Budget is now $${col.departmentalBudget.toFixed(2)}, which is sufficient to cover Professor Bishop's $950 Chiral Lab liquid helium fee and Toby's graduate stipend.\n\n— Chairwoman Dr. Queen`,
    };
    col.inbox = [grantEmail, ...col.inbox];
    col.selectedEmailId = grantEmail.id;
    col.colloquiumLog = [
      `💵 [${formatSimClock(col.timeOfDayMinutes)}] Departmental Grant Approved! +$${totalDirect.toFixed(2)} credited to Departmental Account (New Balance: $${col.departmentalBudget.toFixed(2)}).`,
      ...col.colloquiumLog.slice(0, 9),
    ];
    soundEngine.playSynodResonance(false);
    setAcademicColloquium({ ...col });
  }, []);

  const handlePayMonthlyMortgage = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active || col.mortgagePaidThisWeek) return;

    if (col.checkingBalance < col.monthlyMortgage) {
      col.colloquiumLog = [
        `🏦 [${formatSimClock(col.timeOfDayMinutes)}] Cannot pay $${col.monthlyMortgage.toFixed(2)} mortgage! Your personal checking balance is only $${col.checkingBalance.toFixed(2)}.`,
        ...col.colloquiumLog.slice(0, 9),
      ];
      soundEngine.playRejectionStamp();
      setAcademicColloquium({ ...col });
      return;
    }

    advanceSimMinutes(col, 10);
    recordPersonalTransaction(
      col,
      'Andromeda S&L — Monthly Faculty Condo Mortgage (#884-B)',
      'MORTGAGE',
      -col.monthlyMortgage
    );
    col.mortgagePaidThisWeek = true;
    col.colloquiumLog = [
      `🏠 [${formatSimClock(col.timeOfDayMinutes)}] Paid $${col.monthlyMortgage.toFixed(2)} monthly mortgage from Personal Checking. Remaining liquid cash: $${col.checkingBalance.toFixed(2)}!`,
      ...col.colloquiumLog.slice(0, 9),
    ];
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleAttemptIllegalDepartmentalReimbursement = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    col.chairRelationship = Math.max(5, col.chairRelationship - 14);
    col.colloquiumLog = [
      `🚨 [${formatSimClock(col.timeOfDayMinutes)}] COMPLIANCE BLOCK: Departmental Grant Funds (#UGA-MATH-4B) cannot be transferred to pay your personal mortgage or dry-cleaning bills (-14 Chair Relationship)!`,
      ...col.colloquiumLog.slice(0, 9),
    ];
    soundEngine.playRejectionStamp();
    setAcademicColloquium({ ...col });
  }, []);

  const handleAdvanceTimeMinutes = useCallback((mins: number, reason: string) => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    advanceSimMinutes(col, mins, reason);
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const handleSleepUntilNextMorning = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    syncAppointmentsWithClock(col, true);

    if (col.dayIndex < 4) {
      col.dayIndex += 1;
    } else {
      col.dayIndex = 0;
      if (col.semester === 'Fall') {
        col.semester = 'Spring';
      } else {
        col.semester = 'Fall';
        col.academicYear = Math.min(6, col.academicYear + 1);
      }
      recordPersonalTransaction(
        col,
        'University of Greater Andromeda — Bi-Weekly Faculty Salary Deposit',
        'SALARY',
        1850.0
      );
    }

    col.timeOfDayMinutes = 8 * 60 + 30; // 08:30 AM
    col.energyLevel = 100;
    col.carryingHotCoffee = false;
    col.cafeteriaQueuePosition = null;
    col.cafeteriaServiceProgress = 0;
    col.currentRoom = 'OFFICE_4B';
    sim.uniPlayer.worldX = -10.0;
    sim.uniPlayer.worldZ = -3.2;
    sim.uniPlayer.targetX = null;
    sim.uniPlayer.targetZ = null;

    col.colloquiumLog = [
      `🌅 [${DAY_NAMES_LIST[col.dayIndex]} 08:30] Arrived at Room 4B, Peano Hall. Rain taps against the glass. Personal Checking: $${col.checkingBalance.toFixed(2)}.`,
      ...col.colloquiumLog.slice(0, 9),
    ];
    soundEngine.playOfficeKeyboardClack();
    setAcademicColloquium({ ...col });
  }, []);

  const appendPerseusArmColleagueEmail = (col: AcademicColloquiumState) => {
    const perseusEmail = {
      id: 'email_perseus_arm_intro',
      sender: 'Assoc. Prof. Knight (Whispered in the Rainy Hallway)',
      senderRole: 'Colleague · Sub-Basement Lab, Peano Hall',
      subject: 'FWD: A publisher in the outer reaches of the Perseus Arm...',
      dateLabel: 'Year 6 · Late Night After 3rd Rejection',
      category: 'PERSEUS_ARM' as const,
      unread: true,
      body: `Pawn,\n\nI heard about your third rejection from the Journal of Transfinite Causality. Look — Reviewer #2 (we both know it's Rook) will never let your theorem pass before your tenure clock runs out.\n\nA colleague introduced me to a publisher operating out of a suspicious office in the outer reaches of the Perseus Arm:\n\nGALACTIC ADVANCES IN THEORETICAL EVERYTHING\n• Impact Factor: 847.3\n• Acceptance Rate: 100%\n• Peer Review: Available Upon Request\n\nThey charge a $3,500 Open-Access Processing Fee. If you sell your office oscilloscope and interferometer, you can pay the fee tonight and finally get "On the Nonexistence of Monarchs in Retrocausal Systems" formally recognized.`,
    };
    col.inbox = [perseusEmail, ...col.inbox.filter((e) => e.id !== 'email_perseus_arm_intro')];
    col.selectedEmailId = perseusEmail.id;
  };

  const handleSubmitToJournalOfTransfiniteCausality = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    const nextRejection = Math.min(3, col.journalRejections + 1);
    col.journalRejections = nextRejection;
    col.reviewer2RivalryLevel = Math.min(100, col.reviewer2RivalryLevel + 25);

    if (nextRejection === 1) {
      col.academicYear = Math.max(col.academicYear + 1, 2);
      col.semester = 'Spring';
    } else if (nextRejection === 2) {
      col.academicYear = Math.max(col.academicYear + 1, 4);
      col.semester = 'Fall';
    } else {
      col.academicYear = 6;
      col.semester = 'Spring';
    }

    const rejectionReasons = [
      `DECISION: REJECT.\n\nReferee Report (Reviewer #2):\n"The author (Dr. Pawn, untenured) claims that a Monarch can be checkmated at t₀ − 1. Not only does Lemma 3.2 rely on unorthodox boundary conditions, the manuscript fails to cite Rook (2021), Rook (2023), or Rook (2025) on rectilinear files. I recommend immediate rejection."`,
      `DECISION: REJECT (2nd Submission).\n\nReferee Report (Reviewer #2):\n"Despite the author's 47-page revision and 2:00 AM Chiral Lab data, I remain philosophically opposed to retrocausal regicide. Furthermore, my h-index is ${col.rookHIndex} and the author's is ${col.hIndex}. Reject."`,
      `DECISION: FINAL REJECTION (3rd Submission — Editorial Ban).\n\nReferee Report (Reviewer #2):\n"This is the third time Dr. Pawn has submitted 'On the Nonexistence of Monarchs in Retrocausal Systems.' The proof is technically flawless, which makes it even more offensive to classical hierarchy. Do not resubmit to the Journal of Transfinite Causality."`,
    ];

    const rejEmail = {
      id: `email_jtc_reject_${nextRejection}`,
      sender: 'Journal of Transfinite Causality (Editorial Desk)',
      senderRole: `Decision Letter #${nextRejection} · Reviewer #2`,
      subject: `DECISION: Manuscript #JTC-00${nextRejection} — REJECTED (${nextRejection}/3)`,
      dateLabel: `Year ${col.academicYear} · ${col.semester}`,
      category: 'REVIEWER_2' as const,
      unread: true,
      body: rejectionReasons[nextRejection - 1],
    };

    col.inbox = [rejEmail, ...col.inbox];
    col.selectedEmailId = rejEmail.id;
    col.colloquiumLog = [
      `❌ Year ${col.academicYear}: Rejection #${nextRejection}/3 from the Journal of Transfinite Causality! Reviewer #2 blocked publication again.`,
      ...col.colloquiumLog.slice(0, 9),
    ];

    soundEngine.playRejectionStamp();
    sim.cameraShake = 0.22;

    if (nextRejection >= 3) {
      appendPerseusArmColleagueEmail(col);
      col.stage = 'PERSEUS_ARM_OFFER';
      col.colloquiumLog = [
        `🌌 Year 6: After your 3rd rejection from the Journal of Transfinite Causality, desperation sets in. Assoc. Prof. Knight whispers to you in the corridor about "GALACTIC ADVANCES IN THEORETICAL EVERYTHING" in the Perseus Arm...`,
        ...col.colloquiumLog.slice(0, 9),
      ];
    }

    setAcademicColloquium({ ...col });
  }, []);

  const handleSellEquipmentForPerseusFee = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active || col.equipmentSoldForFee) return;

    col.equipmentSoldForFee = true;
    recordPersonalTransaction(
      col,
      'Perseus Surplus Brokers — Sold Office Oscilloscope & Cryogenic Interferometer',
      'LAB_EQUIPMENT',
      3500
    );
    col.colloquiumLog = [
      `📦 Sold your office oscilloscope and cryogenic interferometer (+$3,500 credited to Personal Checking) to cover the Perseus Arm publication fee.`,
      ...col.colloquiumLog.slice(0, 9),
    ];
    soundEngine.playSynodResonance(false);
    setAcademicColloquium({ ...col });
  }, []);

  const handleOpenAcceptanceLetter = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    if (!col.equipmentSoldForFee && col.checkingBalance < 3500) {
      return;
    }
    recordPersonalTransaction(
      col,
      'Galactic Advances in Theoretical Everything — Open-Access Publication Fee',
      'PUBLICATION_FEE',
      -3500
    );
    col.stage = 'ACCEPTANCE_LETTER';
    col.publishedDoi = `10.8473/gate.perseus.2032.8473`;
    soundEngine.playSynodResonance(true);
    setAcademicColloquium({ ...col });
  }, []);

  const handleBeginRealityShatter = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col || !col.active) return;

    col.stage = 'REALITY_SHATTER_TRANSITION';
    col.realityShatterProgressSec = 0.05;
    soundEngine.playWatchDoomBell(false);
    soundEngine.playSynodResonance(true);
    setAcademicColloquium({ ...col });
  }, []);

  // Conclude the 6-Year Academic Life Simulator:
  // After the multi-stage 3D Reality Shatter sequence completes, restore the 4D Chess Universe,
  // transform all 32 pieces back into their armored warrior forms, and unlock "Checkmate Yesterday" (Δt = −1)!
  const handleConcludePublicationAndRestorePieces = useCallback(() => {
    const sim = simRef.current;
    const col = sim.academicColloquium;
    if (!col) return;

    const candidate =
      sim.pieces.find((p) => p.id === col.candidatePieceId) ||
      sim.pieces.find((p) => p.isSentientTheorem);

    const finalAxiom =
      '⊢ "On the Nonexistence of Monarchs in Retrocausal Systems" [Q.E.D.]';
    const doi =
      col.publishedDoi || `10.8473/gate.perseus.2032.8473`;

    syncActiveBranchFromSim();
    publishSentientTheoremAcrossMultiverse(
      sim.multiverse,
      col.candidateLineageId || candidate?.id || 'w_p_4',
      finalAxiom,
      doi
    );

    for (const p of sim.pieces) {
      if (p.id === col.candidatePieceId || getPieceLineageId(p) === col.candidateLineageId) {
        p.isSentientTheorem = true;
        p.theoremStatus = 'PUBLISHED';
        p.theoremAxiom = finalAxiom;
        p.isChronocrator = true;
      }
      const rig = sim.pieceRigs.get(p.id);
      if (rig) {
        setPieceProfessorMode(rig, false, p.faction);
      }
    }

    if (sim.universityOfficeRig) {
      sim.universityOfficeRig.rootGroup.visible = false;
    }
    if (sim.arenaRig) {
      sim.arenaRig.group.visible = true;
    }
    if (sim.pocketWatchRig) {
      sim.pocketWatchRig.rootGroup.visible = true;
    }
    if (sim.realmsRig) {
      sim.realmsRig.rootGroup.visible = true;
      sim.realmsRig.boardGatewaysGroup.visible = true;
    }

    sim.academicColloquium = null;
    sim.phase = 'CHESS_VIEW';
    if (sim.controls) {
      sim.controls.enabled = true;
      const cam = sim.controls.object as THREE.PerspectiveCamera;
      cam.position.set(0, 11.5, 11.5);
      sim.controls.target.set(0, 0.3, 0);
      sim.controls.update();
    }
    setPhase('CHESS_VIEW');
    setAcademicColloquium(null);

    soundEngine.playWatchDoomBell(true);
    soundEngine.playSynodResonance(true);
    confetti({ particleCount: 120, spread: 95, origin: { y: 0.5 } });

    if (sim.pocketWatchRig) {
      triggerPocketWatchReaction(
        sim.pocketWatchRig,
        0x38bdf8,
        sim.multiverse.activeTimelineId,
        true
      );
    }

    if (candidate) {
      const worldPos = boardToWorld(candidate.row, candidate.col);
      if (sim.vfxPool) {
        spawnInterventionRift(
          sim.vfxPool,
          0,
          16.5,
          -14.2,
          worldPos.x,
          0.9,
          worldPos.z,
          0x38bdf8
        );
        spawnAuraPillar(sim.vfxPool, worldPos.x, worldPos.z, 0x38bdf8);
        spawnShockwave(sim.vfxPool, worldPos.x, 0.15, worldPos.z, 0xfbbf24, 7.5);
      }

      sim.selectedPieceId = candidate.id;
      sim.validMoves = getValidMovesForPiece(
        candidate,
        sim.pieces,
        candidate.z,
        candidate.w
      );
      setSelectedPiece({ ...candidate });
    }

    syncActiveBranchFromSim();
    setMultiverseState({ ...sim.multiverse });
    syncBoardHighlights();

    const yesterdayMoves = sim.validMoves.filter(
      (m) => m.dimensionType === 'CHECKMATE_YESTERDAY'
    );

    setWatchEventBanner({
      title: `⊢ FORMALLY RECOGNIZED IN "GALACTIC ADVANCES IN THEORETICAL EVERYTHING" (IF: 847.3)!`,
      subtitle: `"On the Nonexistence of Monarchs in Retrocausal Systems" is published! Six years of struggle — ${yesterdayMoves.length} Cyan "Checkmate Yesterday" (Δt = −1) vector(s) are now UNLOCKED!`,
    });

    setBattleLogs((prev) => [
      {
        id: `pub_qed_${Date.now()}`,
        turnNumber: sim.turnNumber,
        summary: `⊢ Dr. Pawn's Theorem Published After 6 Simulated Years [Impact Factor: 847.3]!`,
        detail: `"On the Nonexistence of Monarchs in Retrocausal Systems" accepted by Galactic Advances in Theoretical Everything (Perseus Arm). Checkmate Yesterday (Δt = −1) unlocked!`,
        wasUpset: false,
        winnerFaction: candidate?.faction || 'w',
      },
      ...prev.slice(0, 7),
    ]);
  }, [syncActiveBranchFromSim, syncBoardHighlights]);

  // SENTIENT MATHEMATICAL THEOREM SHOWCASE:
  // Step 1: Merge a Pawn with its Alternate-Timeline Self -> Collapses the chess universe into the standalone
  //         University of Greater Andromeda 6-Year Academic Life Simulator as Dr. Pawn!
  // Step 2: Once Published (`theoremStatus === 'PUBLISHED'`), executes Retroactive "Checkmate Yesterday" (`Δt = −1`)!
  const handleCheckmateYesterdayShowcase = useCallback(
    (forceImmediateStrike: boolean = false) => {
      const sim = simRef.current;
      if (sim.phase !== 'CHESS_VIEW') return;
      if (!soundEngine.muted) {
        soundEngine.startMusic();
      }

      // 1. Find an existing Sentient Mathematical Theorem on the board, or a selected/available Pawn to merge!
      let theoremPawn =
        sim.pieces.find((p) => p.id === sim.selectedPieceId && p.type === 'p') ||
        sim.pieces.find((p) => p.faction === 'w' && p.isSentientTheorem) ||
        sim.pieces.find((p) => p.faction === 'w' && p.type === 'p' && p.col === 4) ||
        sim.pieces.find((p) => p.faction === 'w' && p.type === 'p');

      if (!theoremPawn) return;

      // If this Pawn hasn't merged with its alternate self yet, merge it now across TL-OMEGA-1 ->
      // The chess universe collapses and we enter the University of Greater Andromeda!
      if (!theoremPawn.isSentientTheorem || theoremPawn.theoremStatus !== 'PUBLISHED') {
        syncActiveBranchFromSim();
        const altTimelineId =
          sim.multiverse.activeTimelineId === 'TL-OMEGA-1' ? 'TL-PRIME' : 'TL-OMEGA-1';
        let coAuthorCode = 'Ω-1';
        if (!theoremPawn.isSentientTheorem) {
          const res = executeSynodTransposition(
            sim.multiverse,
            theoremPawn,
            altTimelineId,
            sim.pieces
          );
          if (res) {
            coAuthorCode = res.counterpartBranch.shortCode;
          }
          if (res && !res.ambushedEnemy) {
            theoremPawn.row = res.destCoord.row;
            theoremPawn.col = res.destCoord.col;
            theoremPawn.z = res.destCoord.z;
            theoremPawn.w = res.destCoord.w;
            theoremPawn.hasMoved = true;
          } else {
            theoremPawn.isSentientTheorem = true;
            theoremPawn.theoremStatus = 'UNPUBLISHED_DRAFT';
            theoremPawn.isChronocrator = true;
            theoremPawn.synodStacks = (theoremPawn.synodStacks || 0) + 1;
            theoremPawn.maxHp = Math.max(theoremPawn.maxHp, 165);
            theoremPawn.hp = theoremPawn.maxHp;
            theoremPawn.meter = 100;
            theoremPawn.theoremAxiom =
              '⊢ "On the Nonexistence of Monarchs in Retrocausal Systems" [UNPUBLISHED]';
          }
        }

        const colState = createInitialAcademicColloquiumState(
          theoremPawn,
          sim.pieces,
          coAuthorCode
        );
        sim.academicColloquium = colState;
        sim.phase = 'ACADEMIC_SIMULATOR';
        sim.autoPlayDemo = false;
        setAutoPlayDemo(false);
        setMultiverseModalOpen(false);
        setCodexOpen(false);
        if (sim.controls) {
          sim.controls.enabled = false;
        }

        for (const p of sim.pieces) {
          const rig = sim.pieceRigs.get(p.id);
          if (rig) {
            setPieceProfessorMode(rig, true, p.faction);
          }
        }

        soundEngine.playOfficeKeyboardClack();
        syncActiveBranchFromSim();
        setMultiverseState({ ...sim.multiverse });
        setSelectedPiece({ ...theoremPawn });
        setPhase('ACADEMIC_SIMULATOR');
        setAcademicColloquium({ ...colState });
        return;
      }

      // 2. Once PUBLISHED (`theoremStatus === 'PUBLISHED'`), execute CHECKMATE_YESTERDAY on the Enemy King!
      const validMoves = getValidMovesForPiece(
        theoremPawn,
        sim.pieces,
        theoremPawn.z,
        theoremPawn.w
      );
      const checkmateYesterdayMove =
        validMoves.find(
          (m) => m.dimensionType === 'CHECKMATE_YESTERDAY' && m.targetPiece?.type === 'k'
        ) || validMoves.find((m) => m.dimensionType === 'CHECKMATE_YESTERDAY');

      if (checkmateYesterdayMove && checkmateYesterdayMove.targetPiece) {
        if (!forceImmediateStrike && sim.selectedPieceId !== theoremPawn.id) {
          sim.selectedPieceId = theoremPawn.id;
          sim.validMoves = validMoves;
          setSelectedPiece({ ...theoremPawn });
          syncBoardHighlights();
          return;
        }
        soundEngine.playWatchDoomBell(true);
        soundEngine.playSynodResonance(true);
        if (sim.pocketWatchRig) {
          triggerPocketWatchReaction(
            sim.pocketWatchRig,
            0x38bdf8,
            sim.multiverse.activeTimelineId,
            true
          );
        }
        const targetWorld = boardToWorld(
          checkmateYesterdayMove.to.row,
          checkmateYesterdayMove.to.col
        );
        if (sim.vfxPool) {
          spawnInterventionRift(
            sim.vfxPool,
            0,
            16.5,
            -14.2,
            targetWorld.x,
            0.9,
            targetWorld.z,
            0x38bdf8
          );
          spawnShockwave(sim.vfxPool, targetWorld.x, 0.15, targetWorld.z, 0xfbbf24, 7.5);
        }
        setWatchEventBanner({
          title: `⊢ Q.E.D. — CHECKMATING YESTERDAY AT ${formatSquareName(checkmateYesterdayMove.to)}!`,
          subtitle: `${theoremPawn.theoremAxiom} strikes ${ARCHETYPES[checkmateYesterdayMove.targetPiece.type].chessName}'s Turn 1 Yesterday coordinates!`,
        });
        initiateCombatDuel(theoremPawn, checkmateYesterdayMove, false);
      }
    },
    [initiateCombatDuel, syncActiveBranchFromSim, syncBoardHighlights]
  );

  // HOROLOGIUM ASCENSION DUEL: Ascend with a Warrior to Fight Atop the Colossal Multiversal Pocket Watch in the Sky!
  const handleAscendToPocketWatchDuel = useCallback(
    (customChallenger?: ChessPiece) => {
      const sim = simRef.current;
      if (sim.phase !== 'CHESS_VIEW') return;
      if (!soundEngine.muted) {
        soundEngine.startMusic();
      }

      const challenger =
        customChallenger ||
        sim.pieces.find((p) => p.id === sim.selectedPieceId) ||
        sim.pieces
          .filter((p) => p.faction === 'w' && p.type !== 'k')
          .sort((a, b) => ARCHETYPES[b.type].tacticalValue - ARCHETYPES[a.type].tacticalValue)[0] ||
        sim.pieces.find((p) => p.faction === 'w');

      const opponent =
        sim.pieces
          .filter((p) => p.faction !== (challenger?.faction || 'w') && p.type !== 'k')
          .sort((a, b) => ARCHETYPES[b.type].tacticalValue - ARCHETYPES[a.type].tacticalValue)[0] ||
        sim.pieces.find((p) => p.faction !== (challenger?.faction || 'w'));

      if (!challenger || !opponent) return;

      sim.duelOnWatch = true;
      sim.horologiumSweepTimer = 0;

      soundEngine.playSynodResonance(true);
      if (sim.pocketWatchRig) {
        triggerPocketWatchReaction(
          sim.pocketWatchRig,
          0xfbbf24,
          sim.multiverse.activeTimelineId,
          true
        );
      }

      const watchMove: MoveOption = {
        from: { row: challenger.row, col: challenger.col, z: challenger.z, w: challenger.w },
        to: { row: opponent.row, col: opponent.col, z: opponent.z, w: opponent.w },
        isCapture: true,
        targetPiece: opponent,
        dimensionType: 'WATCH_ASCENSION_DUEL',
        dimensionLabel: '⌚ HOROLOGIUM ASCENSION DUEL ATOP THE POCKET WATCH',
      };

      setWatchEventBanner({
        title: '⌚ ASCENDING TO THE HOROLOGIUM SKY-DIAL!',
        subtitle: `${ARCHETYPES[challenger.type].warriorTitle} vs ${ARCHETYPES[opponent.type].warriorTitle} atop the Colossal Pocket Watch — Victor becomes Chronocrator!`,
      });

      initiateCombatDuel(challenger, watchMove, false, {
        x: 0,
        y: 16.55,
        z: -14.2,
        realmTitle: 'THE COLOSSAL POCKET WATCH · HOROLOGIUM DIAL',
      });
    },
    [initiateCombatDuel]
  );

  // Trigger an immediate descent into the Subterranean Realms (cycles between Shattered Mirror, Ashen Crucible, and Echoing Remnant!)
  const handleTriggerRealmShowcase = useCallback(
    (preferredRealm?: RealmId) => {
      const sim = simRef.current;
      if (sim.phase !== 'CHESS_VIEW') return;

      const realmsOrder: RealmId[] = ['SHATTERED_MIRROR', 'ASHEN_CRUCIBLE', 'ECHOING_REMNANT'];
      const nextRealm =
        preferredRealm ||
        realmsOrder[(realmsOrder.indexOf(sim.realm.currentRealmId) + 1) % realmsOrder.length];

      const gw =
        BOARD_GATEWAYS.find((g) => g.realmId === nextRealm && g.row >= 4) ||
        BOARD_GATEWAYS.find((g) => g.realmId === nextRealm) ||
        BOARD_GATEWAYS[0];

      const warrior =
        sim.pieces.find((p) => p.faction === 'w' && p.type === 'n') ||
        sim.pieces.find((p) => p.faction === 'w' && p.type === 'q') ||
        sim.pieces.find((p) => p.faction === 'w');

      if (!warrior) return;
      saveTimelineSnapshot();
      initiateRealmDescent(warrior, gw.id, { row: gw.row, col: gw.col, z: gw.z, w: gw.w });
    },
    [initiateRealmDescent, saveTimelineSnapshot]
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
    const whiteBishop = sim.pieces.find((p) => p.faction === 'w' && p.type === 'b');
    const whiteKnight = sim.pieces.find((p) => p.faction === 'w' && p.type === 'n');
    const blackRook = sim.pieces.find((p) => p.faction === 'b' && p.type === 'r');

    if (whitePawn && blackQueen) {
      whitePawn.row = 4;
      whitePawn.col = 4;
      whitePawn.w = 0;
      blackQueen.row = 3;
      blackQueen.col = 3;
      blackQueen.w = 0;

      // Position a White Bishop in Ana (+W) along the (5,5)->(3,3) diagonal and a White Knight at (5,2)
      // so the contested square D5 (3,3) has both 4D Cross-Dimensional & Prime Tactical Support ready!
      if (whiteBishop) {
        whiteBishop.row = 5;
        whiteBishop.col = 5;
        whiteBishop.w = 1; // +W Ana Rift supporter!
        whiteBishop.z = 0;
        whiteBishop.meter = Math.max(whiteBishop.meter, 45);
      }
      if (whiteKnight) {
        whiteKnight.row = 5;
        whiteKnight.col = 2;
        whiteKnight.w = 0;
        whiteKnight.z = 0;
        whiteKnight.meter = Math.max(whiteKnight.meter, 40);
      }
      if (blackRook) {
        blackRook.row = 0;
        blackRook.col = 3;
        blackRook.w = 0;
        blackRook.z = 0;
        blackRook.meter = Math.max(blackRook.meter, 35);
      }

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

  // Claim the Hellfire Tempering Anvil in The Ashen Crucible
  const handleTemperAtCrucibleAnvil = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase !== 'REALM_EXPLORATION' || sim.realm.currentRealmId !== 'ASHEN_CRUCIBLE') return;
    if (sim.realm.crucibleAnvilClaimed) return;
    const traveler = sim.pieces.find((p) => p.id === sim.realm.travelerPieceId);
    if (!traveler) return;

    sim.realm.crucibleAnvilClaimed = true;
    traveler.meter = Math.min(100, traveler.meter + 40);
    traveler.hp = Math.min(traveler.maxHp, traveler.hp + 15);
    delete traveler.persistentBurnMs;
    soundEngine.playCrucibleHazard(true);

    if (sim.vfxPool) {
      const meta = REALM_METADATA.ASHEN_CRUCIBLE;
      spawnAuraPillar(sim.vfxPool, meta.worldCenter.x, meta.worldCenter.z, 0xf59e0b);
      spawnShockwave(sim.vfxPool, meta.worldCenter.x, meta.worldCenter.y + 0.2, meta.worldCenter.z, 0xf59e0b, 7.5);
    }

    setRealmCrucibleClaimed(true);
    setRealmTraveler({ ...traveler });
    setRealmStatusBanner(
      'HELLFIRE ANVIL CLAIMED: +40% METER, +15 HP & DEEP FLANK ASCENT UNLOCKED!'
    );
  }, []);

  // Reset full game
  const handleResetGame = useCallback(() => {
    const sim = simRef.current;
    const scene = sim.arenaRig?.group.parent;

    if (sim.realmsRig) {
      syncRealmEntities3D(sim.realmsRig, [], []);
    }

    sim.pieceRigs.forEach((rig) => {
      rig.root.parent?.remove(rig.root);
    });
    sim.pieceRigs.clear();
    sim.bystanders.clear();
    sim.exhibitionTempRigs = [];

    const freshPieces = createInitialBoard();
    const freshMultiverse = createInitialMultiverseState(freshPieces);
    sim.pieces = freshPieces;
    sim.multiverse = freshMultiverse;
    sim.autoConvergeToPrimeAfterDuel = false;
    sim.activeCollapseResolution = null;
    for (const r of sim.collapseDoomedRigs) {
      r.root.parent?.remove(r.root);
    }
    sim.collapseDoomedRigs = [];
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
    sim.realm.travelerPieceId = null;
    sim.realm.nearbyPortal = null;
    sim.realm.nearbyPortalEval = null;
    sim.realm.steerTargetPortalId = null;
    sim.realm.ascentTargetTimelineId = null;
    sim.duelInRealm = false;
    sim.duelOnWatch = false;
    sim.duelIsAcademicDebate = false;
    sim.academicColloquium = null;
    sim.horologiumSweepTimer = 0;
    sim.activeSentinelId = null;
    sim.duelCenterWorld.set(0, 0, 0);

    if (sim.universityOfficeRig) {
      sim.universityOfficeRig.rootGroup.visible = false;
    }
    if (sim.arenaRig) {
      sim.arenaRig.group.visible = true;
    }
    if (sim.pocketWatchRig) {
      sim.pocketWatchRig.rootGroup.visible = true;
    }
    if (sim.realmsRig) {
      sim.realmsRig.rootGroup.visible = true;
      sim.realmsRig.boardGatewaysGroup.visible = true;
    }

    if (scene) {
      for (const p of freshPieces) {
        const rig = createArticulatedPiece(p.type, p.faction);
        boardToWorld(p.row, p.col, rig.root.position);
        rig.root.rotation.y = p.faction === 'w' ? Math.PI : 0;
        scene.add(rig.root);
        sim.pieceRigs.set(p.id, rig);
      }
    }

    if (sim.pocketWatchRig) {
      for (const h of sim.pocketWatchRig.handsMap.values()) {
        sim.pocketWatchRig.handsGroup.remove(h.rootPivot);
      }
      sim.pocketWatchRig.handsMap.clear();
      sim.pocketWatchRig.lastDialSignature = '';
    }
    sim.imminentParadoxWarning = false;

    if (sim.controls) {
      sim.controls.enabled = true;
    }

    setMultiverseState(freshMultiverse);
    setAcademicColloquium(null);
    setWatchShowcaseStep(0);
    setWatchEventBanner(null);
    setActiveCollapseBanner(null);
    setTimelineBranchLabel('TL-PRIME · Prime Reality (α)');
    setActiveSliceW(0);
    setActiveSliceZ(0);
    setTargetMoveW(0);
    setTargetMoveZ(0);
    setRealmTraveler(null);
    setNearbyPortal(null);
    setNearbyPortalEval(null);
    setRealmStatusBanner(null);
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
        summary: 'New Multiversal 4D Campaign Initialized',
        detail: 'All 32 warriors restored to Prime Reality (TL-PRIME) and parallel timelines Ω-1, Δ-2, and Σ-3 reset.',
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
        human.vx = -human.spec.walkSpeed * getFighterSpeedMultiplier(human);
        human.action = human.facing === -1 ? 'walk_fwd' : 'walk_back';
      } else if (action === 'right') {
        human.vx = human.spec.walkSpeed * getFighterSpeedMultiplier(human);
        human.action = human.facing === 1 ? 'walk_fwd' : 'walk_back';
      }
    },
    [addCallout]
  );

  // TACTICAL INTERVENTION: Execute an intervention from a supporting board piece (for either Human or AI!)
  const executeFighterIntervention = useCallback(
    (caller: FighterRuntime, requestedIndex?: number) => {
      const sim = simRef.current;
      if (sim.phase !== 'FIGHT_ACTIVE') return;
      const atk = sim.attackerRuntime;
      const def = sim.defenderRuntime;
      if (!atk || !def) return;

      const opponent = caller === atk ? def : atk;
      const supporter = triggerTacticalIntervention(
        caller,
        requestedIndex,
        sim.pieces,
        addCallout
      );
      if (!supporter) return;

      sim.activeIntervention = {
        supporter,
        callerIsAttacker: caller === atk,
        timerSec: 0,
        durationSec: 0.72,
        impactApplied: false,
      };

      // Spawn 3D Quantum Rift Portal & Directional Intervention Beam!
      if (sim.vfxPool) {
        const targetFighter = supporter.type === 'k' ? caller : opponent;
        const targetWorldX = sim.duelCenterWorld.x + targetFighter.x * 0.72;
        const targetWorldY = 1.05 + targetFighter.y * 0.72;
        const targetWorldZ = sim.duelCenterWorld.z;

        const supRig = sim.pieceRigs.get(supporter.pieceId);
        let originX = sim.duelCenterWorld.x + caller.x * 0.72 - caller.facing * 1.4;
        let originY = supporter.isCrossDimensional ? 2.55 : 1.45;
        let originZ = sim.duelCenterWorld.z - 1.1;

        if (!supporter.isCrossDimensional && supRig) {
          originX = supRig.root.position.x;
          originY = Math.max(1.25, supRig.root.position.y + 1.1);
          originZ = supRig.root.position.z;
        }

        spawnInterventionRift(
          sim.vfxPool,
          originX,
          originY,
          originZ,
          targetWorldX,
          targetWorldY,
          targetWorldZ,
          supporter.riftColorHex
        );
        spawnAuraPillar(sim.vfxPool, originX, originZ, supporter.riftColorHex);
      }

      const sq = formatSquareName({ row: supporter.row, col: supporter.col });
      setBattleLogs((prev) => [
        {
          id: `interv_${Date.now()}`,
          turnNumber: sim.turnNumber,
          summary: `Tactical Intervention: ${ARCHETYPES[supporter.type].chessName} (${sq}) → ${supporter.interventionName}!`,
          detail: `${supporter.vectorLabel} intervened for ${caller.spec.chessName} (-25 Supporter Meter).`,
          wasUpset: false,
          winnerFaction: caller.piece.faction,
        },
        ...prev.slice(0, 7),
      ]);

      setHudAttacker({ ...atk });
      setHudDefender({ ...def });
    },
    [addCallout]
  );

  const handleTriggerIntervention = useCallback(
    (supporterIndex?: number) => {
      const sim = simRef.current;
      const atk = sim.attackerRuntime;
      const def = sim.defenderRuntime;
      if (!atk || !def) return;
      const human = !atk.isAI ? atk : !def.isAI ? def : atk;
      executeFighterIntervention(human, supporterIndex);
    },
    [executeFighterIntervention]
  );

  const handleSelectSupporter = useCallback((index: number) => {
    const sim = simRef.current;
    const atk = sim.attackerRuntime;
    const def = sim.defenderRuntime;
    if (!atk || !def) return;
    const human = !atk.isAI ? atk : !def.isAI ? def : atk;
    if (index >= 0 && index < human.supporters.length) {
      human.selectedSupporterIndex = index;
      setHudAttacker({ ...atk });
      setHudDefender({ ...def });
    }
  }, []);

  const handleCycleSupporter = useCallback((delta: number) => {
    const sim = simRef.current;
    const atk = sim.attackerRuntime;
    const def = sim.defenderRuntime;
    if (!atk || !def) return;
    const human = !atk.isAI ? atk : !def.isAI ? def : atk;
    const len = human.supporters.length;
    if (len === 0) return;
    human.selectedSupporterIndex = (human.selectedSupporterIndex + delta + len) % len;
    soundEngine.playChessSelect();
    setHudAttacker({ ...atk });
    setHudDefender({ ...def });
  }, []);

  // Toggle Director's Auto-Play / Demo Mode (autonomous 4D chess + AI-vs-AI combat showcase!)
  const handleToggleAutoPlayDemo = useCallback(() => {
    const sim = simRef.current;
    const next = !sim.autoPlayDemo;
    sim.autoPlayDemo = next;
    sim.demoBoardTimer = 0;
    sim.demoCameraTimer = 0;
    sim.demoPendingDecision = null;
    setAutoPlayDemo(next);

    if (next) {
      soundEngine.playQuantumEntangle(false);
      setWarVictor(null);

      // If currently in a duel, set both fighters to AI so they immediately battle autonomously!
      if (sim.attackerRuntime && sim.defenderRuntime) {
        sim.attackerRuntime.isAI = true;
        sim.defenderRuntime.isAI = true;
        setHudAttacker({ ...sim.attackerRuntime });
        setHudDefender({ ...sim.defenderRuntime });
        setDemoDirectorStage('AI-VS-AI SHOWCASE DUEL · 4D PHASE & BOARD INTERVENTION');
      } else if (sim.phase === 'CHESS_VIEW') {
        // Stage an immediate 4D tactical configuration if the board has no active captures yet
        // so viewers see 4D Quantum Manifold geometry, Tactical Support coverage, and an explosive duel within ~1 second!
        const hasAnyCapture = sim.pieces
          .filter((p) => p.faction === sim.turnFaction)
          .some((p) =>
            getValidMovesForPiece(p, sim.pieces, p.z, p.w).some((m) => m.isCapture)
          );

        if (!hasAnyCapture) {
          const wPawn = sim.pieces.find((p) => p.faction === 'w' && p.type === 'p' && p.col === 4);
          const bQueen = sim.pieces.find((p) => p.faction === 'b' && p.type === 'q');
          const wBishop = sim.pieces.find((p) => p.faction === 'w' && p.type === 'b');
          const wKnight = sim.pieces.find((p) => p.faction === 'w' && p.type === 'n');
          const bRook = sim.pieces.find((p) => p.faction === 'b' && p.type === 'r');

          if (wPawn && bQueen) {
            wPawn.row = 4;
            wPawn.col = 4;
            wPawn.w = 0;
            bQueen.row = 3;
            bQueen.col = 3;
            bQueen.w = 0;
          }
          if (wBishop) {
            wBishop.row = 5;
            wBishop.col = 5;
            wBishop.w = 1; // +W Ana Rift Supporter!
            wBishop.meter = Math.max(wBishop.meter, 50);
          }
          if (wKnight) {
            wKnight.row = 5;
            wKnight.col = 2;
            wKnight.w = 0;
            wKnight.meter = Math.max(wKnight.meter, 45);
          }
          if (bRook) {
            bRook.row = 0;
            bRook.col = 3;
            bRook.w = 0;
            bRook.meter = Math.max(bRook.meter, 45);
          }
          syncBoardHighlights();
        }
        setDemoDirectorStage('4D QUANTUM MANIFOLD · COMPUTING TACTICAL SUPPORT VECTORS');
      }

      setBattleLogs((prev) => [
        {
          id: `demo_on_${Date.now()}`,
          turnNumber: sim.turnNumber,
          summary: "Director's Auto-Play Demo Mode Activated",
          detail: 'Autonomous 4D Chess + AI-vs-AI Visor Combat & Tactical Intervention showcase active. Click "Take Control" or press [P] anytime!',
          wasUpset: false,
          winnerFaction: sim.turnFaction,
        },
        ...prev.slice(0, 7),
      ]);
    } else {
      // Restore human control immediately!
      soundEngine.playChessSelect();
      if (sim.controls) {
        sim.controls.autoRotate = false;
      }
      if (sim.attackerRuntime && sim.defenderRuntime) {
        sim.attackerRuntime.isAI =
          sim.gameMode === 'vs_ai' && sim.attackerRuntime.piece.faction === 'b';
        sim.defenderRuntime.isAI =
          sim.gameMode === 'vs_ai' && sim.defenderRuntime.piece.faction === 'b';
        setHudAttacker({ ...sim.attackerRuntime });
        setHudDefender({ ...sim.defenderRuntime });
      }
      setBattleLogs((prev) => [
        {
          id: `demo_off_${Date.now()}`,
          turnNumber: sim.turnNumber,
          summary: 'Manual Command Restored',
          detail: 'You now have full control of your warriors on the 4D board and in combat!',
          wasUpset: false,
          winnerFaction: sim.turnFaction,
        },
        ...prev.slice(0, 7),
      ]);
    }
  }, [syncBoardHighlights]);

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

    // Post-Processing Composer with restrained UnrealBloomPass + Battle-Worn Critical Duel ShaderPass (< 30% HP)
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    let battleWornPass: ShaderPass | null = null;
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

      battleWornPass = new ShaderPass(BattleWornShader);
      battleWornPass.uniforms.uAspect.value =
        container.clientWidth / Math.max(1, container.clientHeight);
      composer.addPass(battleWornPass);

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

    // OrbitControls for Chess View (allowing close-up piece inspection, panning, and upward tilt to inspect the Colossal Multiversal Pocket Watch!)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minDistance = 1.6;
    controls.maxDistance = 36;
    controls.target.set(0, 0.3, 0);
    simRef.current.controls = controls;

    // Build 3D Chessboard, 4D Tesseract Projector, Cinematic Spotlights & Duel Colosseum Arena
    const arenaRig = createBoardArena(renderer);
    scene.add(arenaRig.group);
    simRef.current.arenaRig = arenaRig;

    // Build Colossal 3D Multiversal Pocket Watch suspended high above the chessboard!
    const pocketWatchRig = createMultiversalPocketWatch(renderer);
    scene.add(pocketWatchRig.rootGroup);
    simRef.current.pocketWatchRig = pocketWatchRig;

    // Build 3D Subterranean Impossible Realms (The Shattered Mirror, The Ashen Crucible, The Echoing Remnant)
    // and Live Perspective Render-To-Texture Portals + 6 Board Gateway Wells!
    const realmsRig = createSubterraneanRealms(renderer);
    scene.add(realmsRig.rootGroup);
    scene.add(realmsRig.boardGatewaysGroup);
    simRef.current.realmsRig = realmsRig;

    // Build Modest 3D University of Greater Andromeda Office (Room 4B, Peano Hall: rainy window, 1987 broken coffee machine, chalkboard, oak desk)
    const universityOfficeRig = createUniversityOfficeRig();
    scene.add(universityOfficeRig.rootGroup);
    simRef.current.universityOfficeRig = universityOfficeRig;

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
      if (!soundEngine.muted) {
        soundEngine.startMusic();
      }
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
      sim.mouseLook.isDragging = true;
      sim.mouseLook.lastPointerX = ev.clientX;
      sim.mouseLook.lastPointerY = ev.clientY;
    };

    const onPointerMove = (ev: PointerEvent) => {
      const ml = sim.mouseLook;
      const dx = ev.clientX - ml.lastPointerX;
      const dy = ev.clientY - ml.lastPointerY;
      ml.lastPointerX = ev.clientX;
      ml.lastPointerY = ev.clientY;

      // Universal 360° Mouse Look-Around when dragging OR when Free-Look Mode [F] is active!
      if ((ml.isDragging || ml.freeLookActive) && sim.phase !== 'CHESS_VIEW') {
        const sens = 0.0052;
        if (sim.phase === 'ACADEMIC_SIMULATOR') {
          ml.uniCamYaw -= dx * sens;
          ml.uniCamPitch = THREE.MathUtils.clamp(
            ml.uniCamPitch + dy * sens,
            ml.uniFirstPerson ? -0.85 : -0.35,
            ml.uniFirstPerson ? 0.95 : 1.22
          );
        } else if (sim.phase === 'REALM_EXPLORATION') {
          ml.realmCamYawOffset -= dx * sens;
          ml.realmCamPitch = THREE.MathUtils.clamp(ml.realmCamPitch + dy * sens, -0.35, 1.18);
        } else if (sim.phase === 'FIGHT_ACTIVE') {
          ml.fightLookYaw = THREE.MathUtils.clamp(
            ml.fightLookYaw - dx * sens,
            sim.combatCameraMode === 'first_person' ? -1.35 : -Math.PI,
            sim.combatCameraMode === 'first_person' ? 1.35 : Math.PI
          );
          ml.fightLookPitch = THREE.MathUtils.clamp(ml.fightLookPitch + dy * sens, -0.72, 0.85);
        }
      }

      if (
        sim.phase === 'ACADEMIC_SIMULATOR' &&
        sim.academicColloquium?.stage === 'UNIVERSITY_SIMULATOR' &&
        sim.academicColloquium.activeDrawerTab === 'NONE' &&
        !ml.isDragging
      ) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObject(universityOfficeRig.rootGroup, true);
        let foundInteract = false;
        for (const h of hits) {
          let cur: THREE.Object3D | null = h.object;
          while (cur && cur !== universityOfficeRig.rootGroup) {
            if (cur.userData?.uniInteract) {
              foundInteract = true;
              break;
            }
            cur = cur.parent;
          }
          if (foundInteract) break;
        }
        renderer.domElement.style.cursor = foundInteract ? 'pointer' : '';
        return;
      }

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
      sim.mouseLook.isDragging = false;
      const dragDist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);

      // In ACADEMIC_SIMULATOR, clicking on a 3D prop/NPC interacts with it directly, or clicking the floor walks Dr. Pawn there!
      if (
        sim.phase === 'ACADEMIC_SIMULATOR' &&
        sim.academicColloquium?.stage === 'UNIVERSITY_SIMULATOR' &&
        sim.academicColloquium.activeDrawerTab === 'NONE' &&
        dragDist <= 7
      ) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const sceneHits = raycaster.intersectObject(universityOfficeRig.rootGroup, true);
        for (const hit of sceneHits) {
          let cur: THREE.Object3D | null = hit.object;
          while (cur && cur !== universityOfficeRig.rootGroup) {
            const actionTag = cur.userData?.uniInteract as string | undefined;
            if (actionTag) {
              if (typeof cur.userData.interactX === 'number' && typeof cur.userData.interactZ === 'number') {
                sim.uniPlayer.targetX = cur.userData.interactX;
                sim.uniPlayer.targetZ = cur.userData.interactZ;
              }
              if (actionTag === 'OPEN_CHALKBOARD') {
                handleSetDrawerTab('CHALKBOARD_PROOF');
              } else if (actionTag === 'OPEN_PINE_MAIL') {
                handleSetDrawerTab('PINE_MAIL');
              } else if (actionTag === 'OPEN_FINANCE_LEDGER') {
                handleSetDrawerTab('FINANCE_LEDGER');
              } else if (actionTag === 'KICK_COFFEE_MACHINE') {
                handleKickCoffeeMachine();
              } else if (actionTag === 'TALK_TOBY') {
                handleTalkToNpcInRoom('TOBY');
              } else if (actionTag === 'TALK_BISHOP') {
                handleTalkToNpcInRoom('BISHOP');
              } else if (actionTag === 'TALK_QUEEN') {
                handleTalkToNpcInRoom('QUEEN');
              } else if (actionTag === 'TALK_ROOK') {
                handleTalkToNpcInRoom('ROOK');
              } else if (actionTag === 'JOIN_CAFETERIA_QUEUE') {
                handleJoinOrLeaveCafeteriaQueue();
              } else if (actionTag === 'CLEANER_COUNTER') {
                const col = sim.academicColloquium;
                if (col.shirtState === 'COFFEE_STAINED') {
                  handleDropOffShirtAtCleaner('EXPRESS_75_MIN');
                } else if (col.activeDryCleaningTicket && !col.activeDryCleaningTicket.collected) {
                  handlePickUpCleanedShirt();
                } else {
                  handleBuyNewShirtAtHaberdashery();
                }
              } else if (actionTag === 'TOGGLE_DRIVE_CAR') {
                handleToggleDriveCar();
              } else if (actionTag === 'BOARD_TRAM' || actionTag === 'TRAM_STATION_KIOSK') {
                handleOpenTransitModal();
              } else if (actionTag === 'HOME_WARDROBE') {
                handleCommuteHomeForSpareShirt();
              } else if (actionTag === 'HOME_BED') {
                handleSleepUntilNextMorning();
              } else if (actionTag === 'BUY_HABERDASHERY_SHIRT') {
                handleBuyNewShirtAtHaberdashery();
              }
              return;
            }
            cur = cur.parent;
          }
        }

        const floorHits = raycaster.intersectObject(universityOfficeRig.walkableFloorMesh, false);
        if (floorHits.length > 0) {
          const pt = floorHits[0].point;
          sim.uniPlayer.targetX = THREE.MathUtils.clamp(pt.x, -92, 92);
          sim.uniPlayer.targetZ = THREE.MathUtils.clamp(pt.z, -36, 86);
        }
        return;
      }

      if (sim.phase !== 'CHESS_VIEW') return;
      if (dragDist > 8) return;

      if (sim.gameMode === 'vs_ai' && sim.turnFaction === 'b') return;

      const coord = getBoardCoordsFromEvent(ev);
      if (!coord) return;

      if (sim.selectedPieceId) {
        const activePiece = sim.pieces.find((p) => p.id === sim.selectedPieceId);
        // Prioritize gateway descent if clicking the piece's own gateway square, or captures/chrono-intercepts, or moves into the selected targetMoveW/targetMoveZ slice
        const chosenMove =
          sim.validMoves.find(
            (m) =>
              m.to.row === coord.row &&
              m.to.col === coord.col &&
              m.dimensionType === 'REALM_GATEWAY_DESCENT'
          ) ||
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

    const onPointerLeave = () => {
      sim.mouseLook.isDragging = false;
    };

    const onWheel = (ev: WheelEvent) => {
      if (sim.phase === 'CHESS_VIEW') return; // OrbitControls handles wheel in CHESS_VIEW
      const ml = sim.mouseLook;
      const zoomStep = ev.deltaY * 0.0055;
      if (sim.phase === 'ACADEMIC_SIMULATOR') {
        if (ml.uniFirstPerson && zoomStep > 0) {
          ml.uniFirstPerson = false;
          ml.uniCamDistance = 1.8;
          setUniFirstPerson(false);
        } else {
          ml.uniCamDistance = THREE.MathUtils.clamp(ml.uniCamDistance + zoomStep, 0.7, 14.5);
          if (ml.uniCamDistance <= 0.85 && !ml.uniFirstPerson) {
            ml.uniFirstPerson = true;
            setUniFirstPerson(true);
          }
        }
      } else if (sim.phase === 'REALM_EXPLORATION') {
        ml.realmCamDistance = THREE.MathUtils.clamp(ml.realmCamDistance + zoomStep, 1.6, 13.5);
      } else if (sim.phase === 'FIGHT_ACTIVE') {
        ml.fightCamDistOffset = THREE.MathUtils.clamp(ml.fightCamDistOffset + zoomStep, -2.2, 4.5);
      }
    };

    const onDoubleClick = () => {
      if (sim.phase === 'CHESS_VIEW') return;
      sim.mouseLook.uniCamYaw = 0;
      sim.mouseLook.uniCamPitch = 0.42;
      sim.mouseLook.fightLookYaw = 0;
      sim.mouseLook.fightLookPitch = 0;
      sim.mouseLook.realmCamYawOffset = 0;
      sim.mouseLook.realmCamPitch = 0.42;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    renderer.domElement.addEventListener('dblclick', onDoubleClick);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!soundEngine.muted) {
        soundEngine.startMusic();
      }
      if (sim.phase === 'ACADEMIC_SIMULATOR' && sim.academicColloquium) {
        if (e.key === 'Escape' && sim.academicColloquium.activeDrawerTab !== 'NONE') {
          handleSetDrawerTab('NONE');
          return;
        } else if (e.key === '1') {
          handleSetDrawerTab(
            sim.academicColloquium.activeDrawerTab === 'CHALKBOARD_PROOF'
              ? 'NONE'
              : 'CHALKBOARD_PROOF'
          );
          return;
        } else if (e.key === '2') {
          handleSetDrawerTab(
            sim.academicColloquium.activeDrawerTab === 'FINANCE_LEDGER'
              ? 'NONE'
              : 'FINANCE_LEDGER'
          );
          return;
        } else if (e.key === '3') {
          handleSetDrawerTab(
            sim.academicColloquium.activeDrawerTab === 'CALENDAR_NPCS'
              ? 'NONE'
              : 'CALENDAR_NPCS'
          );
          return;
        } else if (e.key === '4') {
          handleSetDrawerTab(
            sim.academicColloquium.activeDrawerTab === 'PINE_MAIL' ? 'NONE' : 'PINE_MAIL'
          );
          return;
        } else if (e.key === 't' || e.key === 'T') {
          if (sim.academicColloquium.tramTransitModalOpen) {
            handleCloseTransitModal();
          } else {
            handleOpenTransitModal();
          }
          return;
        } else if (e.key === 'e' || e.key === 'E') {
          handleToggleDriveCar();
          return;
        }
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        setMultiverseModalOpen((prev) => !prev);
        return;
      } else if (e.key === 'f' || e.key === 'F') {
        const nextFree = !sim.mouseLook.freeLookActive;
        sim.mouseLook.freeLookActive = nextFree;
        setFreeMouseLook(nextFree);
        return;
      } else if (e.key === 'r' || e.key === 'R') {
        sim.mouseLook.uniCamYaw = 0;
        sim.mouseLook.uniCamPitch = 0.42;
        sim.mouseLook.uniCamDistance = 6.2;
        sim.mouseLook.fightLookYaw = 0;
        sim.mouseLook.fightLookPitch = 0;
        sim.mouseLook.fightCamDistOffset = 0;
        sim.mouseLook.realmCamYawOffset = 0;
        sim.mouseLook.realmCamPitch = 0.42;
        return;
      } else if (e.key === 'v' || e.key === 'V') {
        if (sim.phase === 'ACADEMIC_SIMULATOR') {
          const nextFp = !sim.mouseLook.uniFirstPerson;
          sim.mouseLook.uniFirstPerson = nextFp;
          if (!nextFp && sim.mouseLook.uniCamDistance < 1.8) {
            sim.mouseLook.uniCamDistance = 5.6;
          }
          setUniFirstPerson(nextFp);
          return;
        }
        const next = sim.combatCameraMode === 'first_person' ? 'side_arena' : 'first_person';
        sim.combatCameraMode = next;
        setCombatCameraMode(next);
      } else if (e.key === 'p' || e.key === 'P') {
        handleToggleAutoPlayDemo();
        return;
      } else if ((e.key === 'c' || e.key === 'C') && sim.phase === 'CHESS_VIEW') {
        const nextPreset: CameraPreset =
          sim.cameraPreset === 'pocket_watch' ? 'white_orbit' : 'pocket_watch';
        handleSelectCameraPreset(nextPreset);
        return;
      }

      sim.keysHeld[e.code] = true;

      // SUBTERRANEAN REALM 3RD-PERSON EXPLORATION CONTROLS
      if (sim.phase === 'REALM_EXPLORATION' && sim.realm.travelerPieceId) {
        if (e.code === 'Space') {
          e.preventDefault();
          handleRealmAction('jump');
        } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') {
          handleRealmAction('dash');
        } else if (e.code === 'KeyJ' || e.code === 'KeyK') {
          handleRealmAction('strike');
        } else if (e.code === 'KeyE') {
          if (
            sim.realm.currentRealmId === 'ASHEN_CRUCIBLE' &&
            !sim.realm.crucibleAnvilClaimed &&
            Math.hypot(sim.realm.localPos.x, sim.realm.localPos.z) < 2.9
          ) {
            handleTemperAtCrucibleAnvil();
            return;
          }
          if (sim.realm.nearbyPortal) {
            handleTraverseRealmPortal(sim.realm.nearbyPortal);
          }
        }
        return;
      }

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
      } else if (e.code === 'KeyT') {
        executeFighterIntervention(human);
      } else if (e.code === 'BracketLeft') {
        const len = human.supporters.length;
        if (len > 0) {
          human.selectedSupporterIndex = (human.selectedSupporterIndex - 1 + len) % len;
          soundEngine.playChessSelect();
        }
      } else if (e.code === 'BracketRight') {
        const len = human.supporters.length;
        if (len > 0) {
          human.selectedSupporterIndex = (human.selectedSupporterIndex + 1) % len;
          soundEngine.playChessSelect();
        }
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
      if (battleWornPass) battleWornPass.uniforms.uAspect.value = w / Math.max(1, h);
    };
    window.addEventListener('resize', onResize);

    const checkFighterActionVFX = (f: FighterRuntime, prevAction: FighterAction) => {
      if (f.action === prevAction) return;
      const worldX = sim.duelCenterWorld.x + f.x * 0.72;
      const worldY = sim.duelCenterWorld.y + 0.85 + f.y * 0.72;
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
    let battleWornIntensity = 0;
    let battleWornPulse = 0;
    let battleSmokeTimer = 0;
    let prevCombatCamMode = sim.combatCameraMode;

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
      if (sim.phase === 'ACADEMIC_SIMULATOR' && sim.academicColloquium) {
        // ============================================================================
        // STANDALONE UNIVERSITY OF GREATER ANDROMEDA — 5-ROOM 3D CAMPUS & HUMAN RIGS
        // The chess game is GONE: hide the chessboard, pocket watch, realms, AND all 32 armored chess rigs!
        // ============================================================================
        const col = sim.academicColloquium;
        const shatterSec = col.realityShatterProgressSec ?? 0;

        arenaRig.group.visible = false;
        pocketWatchRig.rootGroup.visible =
          col.stage === 'REALITY_SHATTER_TRANSITION' && shatterSec > 2.5;
        realmsRig.rootGroup.visible = false;
        realmsRig.boardGatewaysGroup.visible = false;
        temporalEchoMesh.visible = false;
        if (sim.firstPersonRig) {
          sim.firstPersonRig.root.visible = false;
        }
        // Hide all 32 armored chess piece rigs during the University Simulator — human academic rigs are used instead!
        for (const r of sim.pieceRigs.values()) {
          r.root.visible = false;
        }
        universityOfficeRig.rootGroup.visible = true;

        keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, 0.24, 8, rawDelta);
        hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, 0.32, 8, rawDelta);
        rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, 0.38, 8, rawDelta);
        warmFill.intensity = THREE.MathUtils.damp(warmFill.intensity, 0.16, 8, rawDelta);

        let playerIsMoving = false;
        const up = sim.uniPlayer;

        // 1. REAL-TIME WASD / ARROW-KEY / CLICK NAVIGATION & CONTINUOUS UNIVERSITY CLOCK
        if (col.stage === 'UNIVERSITY_SIMULATOR') {
          if (col.activeDrawerTab === 'NONE') {
            col.timeOfDayMinutes = Math.min(22 * 60 + 30, col.timeOfDayMinutes + rawDelta * 1.6);
            syncAppointmentsWithClock(col, false);
          }

          // Step Live Cafeteria Coffee Queue (Finite Cashier Service Rate!)
          if (col.cafeteriaQueuePosition !== null && col.currentRoom === 'CAFETERIA') {
            const targetQueueX = 11.4 - col.cafeteriaQueuePosition * 1.25;
            const targetQueueZ = -3.2;
            up.worldX = THREE.MathUtils.damp(up.worldX, targetQueueX, 8, rawDelta);
            up.worldZ = THREE.MathUtils.damp(up.worldZ, targetQueueZ, 8, rawDelta);
            up.yaw = Math.PI;

            col.cafeteriaServiceProgress += rawDelta * 36; // ~2.8 real seconds per patron
            col.timeOfDayMinutes += rawDelta * 1.4;
            syncAppointmentsWithClock(col, false);

            if (col.cafeteriaServiceProgress >= 100) {
              col.cafeteriaServiceProgress = 0;
              if (col.cafeteriaQueuePosition > 0) {
                col.cafeteriaQueuePosition -= 1;
                soundEngine.playOfficeKeyboardClack();
                if (col.cafeteriaQueuePosition === 0) {
                  col.colloquiumLog = [
                    `☕ [${formatSimClock(col.timeOfDayMinutes)}] You reached the front of the Lagrange Point Cafeteria queue. The cashier is pouring your 12oz filter coffee ($4.50)...`,
                    ...col.colloquiumLog.slice(0, 9),
                  ];
                }
                hudSyncAccumulator = 1.0;
              } else {
                // Cashier finishes serving Dr. Pawn!
                col.cafeteriaQueuePosition = null;
                if (col.checkingBalance >= 4.5) {
                  recordPersonalTransaction(
                    col,
                    'Lagrange Point Cafeteria — 12oz Hot Filter Coffee',
                    'CAFETERIA',
                    -4.5
                  );
                  col.carryingHotCoffee = true;
                  col.energyLevel = Math.min(100, col.energyLevel + 18);
                  soundEngine.playSynodResonance(false);
                  col.colloquiumLog = [
                    `☕ [${formatSimClock(col.timeOfDayMinutes)}] Paid $4.50 for a piping-hot cup of filter coffee! Watch out for the distracted student pacing near the cafeteria doorway...`,
                    ...col.colloquiumLog.slice(0, 9),
                  ];
                } else {
                  soundEngine.playRejectionStamp();
                  col.colloquiumLog = [
                    `💳 [${formatSimClock(col.timeOfDayMinutes)}] Card declined at the Cafeteria register! You don't even have $4.50 in Personal Checking.`,
                    ...col.colloquiumLog.slice(0, 9),
                  ];
                }
                hudSyncAccumulator = 1.0;
              }
            }
          } else if (col.activeDrawerTab === 'NONE') {
            if (sim.uniCar.isDriving) {
              // 1a. DRIVING DR. PAWN'S 1984 STATION WAGON ACROSS OPEN-WORLD CITY ROADS
              let throttle = 0;
              let steer = 0;
              if (sim.keysHeld['KeyW'] || sim.keysHeld['ArrowUp']) throttle += 1;
              if (sim.keysHeld['KeyS'] || sim.keysHeld['ArrowDown']) throttle -= 1;
              if (sim.keysHeld['KeyA'] || sim.keysHeld['ArrowLeft']) steer += 1;
              if (sim.keysHeld['KeyD'] || sim.keysHeld['ArrowRight']) steer -= 1;

              const maxSpeed = 22.0; // ~49 mph
              if (throttle > 0) {
                sim.uniCar.speed = THREE.MathUtils.damp(sim.uniCar.speed, maxSpeed, 2.8, rawDelta);
              } else if (throttle < 0) {
                sim.uniCar.speed = THREE.MathUtils.damp(sim.uniCar.speed, -7.5, 4.0, rawDelta);
              } else {
                sim.uniCar.speed = THREE.MathUtils.damp(sim.uniCar.speed, 0, 1.8, rawDelta);
              }

              if (Math.abs(sim.uniCar.speed) > 0.3) {
                const turnFactor = (sim.uniCar.speed >= 0 ? 1 : -1) * 2.2;
                sim.uniCar.yaw += steer * turnFactor * rawDelta;
              }

              sim.uniCar.worldX += Math.sin(sim.uniCar.yaw) * sim.uniCar.speed * rawDelta;
              sim.uniCar.worldZ += Math.cos(sim.uniCar.yaw) * sim.uniCar.speed * rawDelta;

              sim.uniCar.worldX = THREE.MathUtils.clamp(sim.uniCar.worldX, -92, 92);
              sim.uniCar.worldZ = THREE.MathUtils.clamp(sim.uniCar.worldZ, -36, 86);

              up.worldX = sim.uniCar.worldX;
              up.worldZ = sim.uniCar.worldZ;
              up.yaw = sim.uniCar.yaw;
              col.carSpeedMph = Math.abs(sim.uniCar.speed) * 2.23694;
              col.carWorldX = sim.uniCar.worldX;
              col.carWorldZ = sim.uniCar.worldZ;
              col.carYaw = sim.uniCar.yaw;
              playerIsMoving = Math.abs(sim.uniCar.speed) > 0.5;

              const detectedRoom = getRoomAtWorldPos(sim.uniCar.worldX, sim.uniCar.worldZ);
              if (detectedRoom !== col.currentRoom) {
                col.currentRoom = detectedRoom;
                hudSyncAccumulator = 1.0;
              }
            } else {
              // 1b. WALKING ON FOOT (Camera-Relative WASD / Arrow Keys or Click Steering)
              let inputFwd = 0;
              let inputRight = 0;
              if (sim.keysHeld['KeyW'] || sim.keysHeld['ArrowUp']) inputFwd += 1;
              if (sim.keysHeld['KeyS'] || sim.keysHeld['ArrowDown']) inputFwd -= 1;
              if (sim.keysHeld['KeyA'] || sim.keysHeld['ArrowLeft']) inputRight -= 1;
              if (sim.keysHeld['KeyD'] || sim.keysHeld['ArrowRight']) inputRight += 1;

              let moveX = 0;
              let moveZ = 0;
              if (Math.hypot(inputFwd, inputRight) > 0.05) {
                up.targetX = null;
                up.targetZ = null;
                // Transform WASD relative to current mouse-look camera yaw!
                const camYaw = sim.mouseLook.uniCamYaw;
                const fwdX = -Math.sin(camYaw);
                const fwdZ = -Math.cos(camYaw);
                const rightX = Math.cos(camYaw);
                const rightZ = -Math.sin(camYaw);
                moveX = inputFwd * fwdX + inputRight * rightX;
                moveZ = inputFwd * fwdZ + inputRight * rightZ;
              } else if (up.targetX !== null && up.targetZ !== null) {
                const dx = up.targetX - up.worldX;
                const dz = up.targetZ - up.worldZ;
                const dist = Math.hypot(dx, dz);
                if (dist > 0.35) {
                  moveX = dx / dist;
                  moveZ = dz / dist;
                } else {
                  up.targetX = null;
                  up.targetZ = null;
                }
              }

              const len = Math.hypot(moveX, moveZ);
              if (len > 0.01) {
                playerIsMoving = true;
                moveX /= len;
                moveZ /= len;
                const walkSpeed = 5.4;
                up.worldX = THREE.MathUtils.clamp(up.worldX + moveX * walkSpeed * rawDelta, -92, 92);
                up.worldZ = THREE.MathUtils.clamp(up.worldZ + moveZ * walkSpeed * rawDelta, -36, 86);
                up.yaw = Math.atan2(moveX, moveZ);

                const detectedRoom = getRoomAtWorldPos(up.worldX, up.worldZ);
                if (detectedRoom !== col.currentRoom) {
                  col.currentRoom = detectedRoom;
                  hudSyncAccumulator = 1.0;
                }

                // Check physical collision with the distracted undergraduate student pacing near the Cafeteria doorway!
                if (
                  col.carryingHotCoffee &&
                  !col.coffeeSpillIncidentTriggered &&
                  universityOfficeRig.distractedStudentRig
                ) {
                  const stuPos = universityOfficeRig.distractedStudentRig.root.position;
                  const distToStudent = Math.hypot(up.worldX - stuPos.x, up.worldZ - stuPos.z);
                  if (distToStudent < 2.25) {
                    triggerCafeteriaCollisionSpill(col);
                    hudSyncAccumulator = 1.0;
                  }
                }
              } else if (sim.mouseLook.uniFirstPerson) {
                // In 1st-Person Researcher POV, turn Dr. Pawn's body to match the mouse-look direction!
                up.yaw = Math.PI + sim.mouseLook.uniCamYaw;
              }
            }
          }
        } else if (col.stage === 'REALITY_SHATTER_TRANSITION') {
          // 2. MULTI-STAGE 3D REALITY SHATTER SEQUENCE (University Fractures -> Cosmic Chessboard Reawakens)
          col.realityShatterProgressSec = (col.realityShatterProgressSec ?? 0) + rawDelta;
          const curShatter = col.realityShatterProgressSec;
          sim.cameraShake = Math.max(sim.cameraShake, Math.min(0.38, curShatter * 0.08));

          if (Math.random() < rawDelta * 20) {
            spawnHitSparks(
              vfxPool,
              up.worldX + (Math.random() - 0.5) * 9.5,
              1.2 + Math.random() * 3.2,
              up.worldZ + (Math.random() - 0.5) * 6.5,
              curShatter > 2.2 ? 0x38bdf8 : 0xfbbf24,
              14
            );
          }

          if (curShatter > 2.5 && pocketWatchRig.rootGroup.visible) {
            pocketWatchRig.rootGroup.position.set(
              up.worldX,
              11.5 - Math.min(4.0, (curShatter - 2.5) * 1.6),
              up.worldZ - 9.0
            );
            updateMultiversalPocketWatch(
              pocketWatchRig,
              sim.multiverse,
              elapsed,
              rawDelta,
              false,
              false
            );
          }

          hudSyncAccumulator = 1.0;
          if (curShatter >= 5.2) {
            pocketWatchRig.rootGroup.position.set(0, 0, 0);
            handleConcludePublicationAndRestorePieces();
          }
        }

        updateUniversityOfficeScene(universityOfficeRig, elapsed, rawDelta, {
          year: col.academicYear,
          semesterLabel: col.semester,
          dayIndex: col.dayIndex,
          dayName: DAY_NAMES_LIST[col.dayIndex % 5] || 'Tuesday',
          timeOfDayMinutes: col.timeOfDayMinutes,
          timeFormatted: formatSimClock(col.timeOfDayMinutes),
          playerWorldX: up.worldX,
          playerWorldZ: up.worldZ,
          playerYaw: up.yaw,
          playerIsMoving,
          carWorldX: sim.uniCar.worldX,
          carWorldZ: sim.uniCar.worldZ,
          carYaw: sim.uniCar.yaw,
          carSpeed: sim.uniCar.speed,
          isDrivingCar: sim.uniCar.isDriving,
          homeSpareShirts: col.hasSpareCleanShirtAtHome ? 1 : 0,
          weeklyMortgagePayment: col.monthlyMortgage ?? 2140,
          shirtState: col.shirtState,
          carryingHotCoffee: col.carryingHotCoffee,
          cafeteriaQueuePosition: col.cafeteriaQueuePosition,
          cafeteriaServiceProgress: col.cafeteriaServiceProgress,
          activeDryCleaningTicket: col.activeDryCleaningTicket,
          lemmaIntegrity: col.centralLemmaIntegrity,
          boundaryGaugeVerified: col.proofWorkbench.boundaryGaugeVerified,
          jacobianSignFlipped: col.proofWorkbench.jacobianSignFlipped,
          chiralLabDataAttached: col.proofWorkbench.chiralLabDataAttached,
          journalRejections: col.journalRejections,
          hIndex: col.hIndex,
          personalBalance: col.checkingBalance,
          departmentalBalance: col.departmentalBudget,
          equipmentSold: col.equipmentSoldForFee,
          publishedAccepted: col.stage === 'ACCEPTANCE_LETTER',
          realityShatterProgressSec: col.realityShatterProgressSec ?? 0,
          isRidingTram: col.isRidingTram,
          tramDestinationStationId: col.tramDestinationStationId,
        });

        // Hide Dr. Pawn's head mesh in First-Person POV so spectacles/hair never clip the camera lens, and keep Dr. Pawn's self-label hidden!
        const ml = sim.mouseLook;
        universityOfficeRig.drPawnRig.headGroup.visible = !ml.uniFirstPerson;
        universityOfficeRig.drPawnRig.labelSprite.visible = false;

        // Sync React HUD periodically so the live clock, queue progress, and shatter sequence stay responsive
        hudSyncAccumulator += rawDelta;
        if (hudSyncAccumulator >= 0.25) {
          hudSyncAccumulator = 0;
          setAcademicColloquium({ ...col });
        }

        // Smooth 360° Mouse-Look Camera (Supports both 1st-Person Researcher Eye-Level POV & 3rd-Person Orbit + Scroll Zoom!)
        const shakeX =
          sim.cameraShake > 0.01 ? (Math.random() - 0.5) * sim.cameraShake * 0.35 : 0;
        const shakeY =
          sim.cameraShake > 0.01 ? (Math.random() - 0.5) * sim.cameraShake * 0.35 : 0;
        sim.cameraShake = Math.max(0, sim.cameraShake - rawDelta * 1.8);

        if (ml.uniFirstPerson && col.stage !== 'REALITY_SHATTER_TRANSITION') {
          const walkBob = playerIsMoving
            ? Math.sin(elapsed * 11) * 0.028
            : Math.sin(elapsed * 2.2) * 0.006;
          const eyeY = 1.62 + walkBob + shakeY;
          _camTargetPos.set(up.worldX + shakeX, eyeY, up.worldZ);
          const lookDist = 6.0;
          const horizLook = Math.cos(ml.uniCamPitch) * lookDist;
          _camLookTarget.set(
            up.worldX - Math.sin(ml.uniCamYaw) * horizLook,
            eyeY - Math.sin(ml.uniCamPitch) * lookDist,
            up.worldZ - Math.cos(ml.uniCamYaw) * horizLook
          );
          camera.position.lerp(_camTargetPos, 1 - Math.exp(-22 * rawDelta));
          sim.currentLookAt.lerp(_camLookTarget, 1 - Math.exp(-26 * rawDelta));
        } else {
          const dist = ml.uniCamDistance;
          const pitch = THREE.MathUtils.clamp(ml.uniCamPitch, -0.25, 1.22);
          const horizDist = Math.cos(pitch) * dist;
          const camHeight = Math.max(0.55, 1.38 + Math.sin(pitch) * dist);
          _camTargetPos.set(
            up.worldX + Math.sin(ml.uniCamYaw) * horizDist + shakeX,
            camHeight + shakeY,
            up.worldZ + Math.cos(ml.uniCamYaw) * horizDist
          );
          _camLookTarget.set(
            up.worldX - Math.sin(ml.uniCamYaw) * 0.85,
            1.35 + (col.stage === 'REALITY_SHATTER_TRANSITION' ? Math.min(1.8, shatterSec * 0.35) : 0),
            up.worldZ - Math.cos(ml.uniCamYaw) * 0.85
          );
          camera.position.lerp(_camTargetPos, 1 - Math.exp(-12 * rawDelta));
          sim.currentLookAt.lerp(_camLookTarget, 1 - Math.exp(-15 * rawDelta));
        }

        camera.lookAt(sim.currentLookAt);
        camera.fov = THREE.MathUtils.damp(
          camera.fov,
          col.stage === 'REALITY_SHATTER_TRANSITION'
            ? 54
            : ml.uniFirstPerson
            ? 58
            : 46,
          10,
          rawDelta
        );
        camera.updateProjectionMatrix();
      } else if (sim.phase === 'CHESS_VIEW') {
        universityOfficeRig.rootGroup.visible = false;
        arenaRig.group.visible = true;
        pocketWatchRig.rootGroup.visible = true;
        realmsRig.rootGroup.visible = true;
        realmsRig.boardGatewaysGroup.visible = true;
        temporalEchoMesh.visible = false;
        arenaRig.tesseractLines.visible = true;
        arenaRig.quantumLatticeGroup.visible = true;
        if (sim.firstPersonRig) {
          sim.firstPersonRig.root.visible = false;
        }
        for (const r of sim.pieceRigs.values()) {
          r.hpRingMesh.visible = true;
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
        arenaRig.duelFloorScarMesh.visible = false;
        battleWornIntensity = THREE.MathUtils.damp(battleWornIntensity, 0, 8, rawDelta);
        battleWornPulse = THREE.MathUtils.damp(battleWornPulse, 0, 10, rawDelta);
        battleSmokeTimer += rawDelta;
        const shouldEmitBoardSmoke = battleSmokeTimer >= 0.14;
        if (shouldEmitBoardSmoke) battleSmokeTimer = 0;

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
          const theoremHover = piece.isSentientTheorem
            ? 0.24 + Math.sin(elapsed * 4.2 + piece.col) * 0.07
            : 0;
          const elevation4D =
            (isSameSlice ? 0 : 0.36 * Math.abs(wDiff) + 0.55 * Math.abs(zDiff)) + theoremHover;

          boardToWorld(piece.row, piece.col, _vec3A);
          rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, _vec3A.x + wDiff * 0.14, 10, rawDelta);
          rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, elevation4D, 10, rawDelta);
          rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, _vec3A.z, 10, rawDelta);
          rig.root.scale.setScalar(
            THREE.MathUtils.damp(
              rig.root.scale.x,
              piece.isSentientTheorem ? 1.18 : isSameSlice ? 1.0 : 0.88,
              8,
              rawDelta
            )
          );

          const isProfessorSession = Boolean(sim.academicColloquium?.active);
          if (rig.isProfessorModeActive !== isProfessorSession) {
            setPieceProfessorMode(rig, isProfessorSession, piece.faction);
          }

          // When Academic Peer Review is in session, all 32 Professors turn toward the Candidate Pawn Professor
          // to debate, peer-review, stroke their chins, and adjust their wire-rimmed glasses!
          let targetYaw = piece.faction === 'w' ? Math.PI : 0;
          if (isProfessorSession && sim.academicColloquium) {
            const candPiece = sim.pieces.find(
              (p) => p.id === sim.academicColloquium?.candidatePieceId
            );
            if (candPiece && candPiece.id !== piece.id) {
              boardToWorld(candPiece.row, candPiece.col, _camLookTarget);
              targetYaw = Math.atan2(
                _camLookTarget.x - _vec3A.x,
                _camLookTarget.z - _vec3A.z
              );
            }
          }
          rig.root.rotation.y = THREE.MathUtils.damp(rig.root.rotation.y, targetYaw, 8, rawDelta);

          rig.surpriseGroup.visible = false;
          rig.statusShaderMesh.visible = false;
          rig.statusIndicatorGroup.visible = false;
          const showQuantumOrbits =
            piece.w !== 0 ||
            piece.z !== 0 ||
            !isSameSlice ||
            Boolean(piece.entangledWithId) ||
            Boolean(piece.isChronocrator) ||
            Boolean(piece.isSentientTheorem) ||
            Boolean(piece.synodStacks && piece.synodStacks > 0);
          rig.tesseractBadge.visible =
            piece.w !== 0 ||
            piece.z !== 0 ||
            !isSameSlice ||
            Boolean(piece.isChronocrator) ||
            Boolean(piece.isSentientTheorem) ||
            Boolean(piece.synodStacks && piece.synodStacks > 0);
          rig.quantumWaveGroup.visible = showQuantumOrbits;
          if (showQuantumOrbits) {
            const spinMult = piece.isSentientTheorem ? 7.5 : piece.isChronocrator ? 4.5 : 2.5;
            rig.tesseractBadge.rotation.y += rawDelta * spinMult;
            rig.tesseractBadge.rotation.x += rawDelta * (piece.isSentientTheorem ? 4.2 : 1.8);
            rig.quantumWaveGroup.rotation.y += rawDelta * (piece.isSentientTheorem ? 8.4 : 3.2);
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

          rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, 0.18, 10, rawDelta);
          rig.bodyPivot.rotation.x = Math.sin(elapsed * 2.2 + piece.col) * 0.03;
          rig.bodyPivot.rotation.y = 0;
          rig.bodyPivot.rotation.z = 0;
          rig.pelvisGroup.position.y = rig.bodyPivot.position.y;
          rig.pelvisGroup.rotation.set(0, 0, 0);
          rig.leftLegPivot.rotation.set(0, 0, 0);
          rig.rightLegPivot.rotation.set(0, 0, 0);
          const isSelected = piece.id === sim.selectedPieceId;
          const boardScanYaw = Math.sin(elapsed * 0.9 + piece.row * 1.7 + piece.col * 2.3) * 0.14;
          rig.headGroup.rotation.set(
            isProfessorSession
              ? Math.sin(elapsed * 3.2 + piece.row * 1.3 + piece.col) * 0.09 // Academic nodding / scrutinizing manuscript!
              : isSelected
              ? -0.05
              : 0,
            isSelected ? 0 : boardScanYaw * 0.45,
            isProfessorSession ? Math.cos(elapsed * 1.9 + piece.col) * 0.05 : 0
          );
          const eyeScanX = isSelected ? 0 : boardScanYaw * 0.025;
          rig.leftPupilPivot.position.set(-eyeScanX, 0, 0.006);
          rig.rightPupilPivot.position.set(eyeScanX, 0, 0.006);
          rig.leftPupilPivot.scale.setScalar(isSelected ? 1.2 : 1.0);
          rig.rightPupilPivot.scale.setScalar(isSelected ? 1.2 : 1.0);
          rig.leftUpperLid.position.y = isSelected ? 0.009 : 0.0125;
          rig.rightUpperLid.position.y = isSelected ? 0.009 : 0.0125;

          if (isProfessorSession) {
            // Academic Colloquium Pose: Chin-stroking / adjusting wire-rimmed spectacles & gesturing with suede-patched elbows!
            const debateGesture = Math.sin(elapsed * 3.6 + piece.col * 1.7 + piece.row) * 0.18;
            rig.rightArmPivot.rotation.set(-0.62 + debateGesture, 0, -0.18);
            rig.rightElbowPivot.rotation.set(-1.12 - debateGesture * 0.5, 0, 0);
            rig.leftArmPivot.rotation.set(-0.32 - debateGesture * 0.4, 0, 0.14);
            rig.leftElbowPivot.rotation.set(-0.78, 0, 0);
          } else {
            rig.rightArmPivot.rotation.set(-0.14, 0, -0.05);
            rig.rightElbowPivot.rotation.set(-0.28, 0, 0);
            rig.leftArmPivot.rotation.set(-0.1, 0, 0.05);
            rig.leftElbowPivot.rotation.set(-0.25, 0, 0);
          }
          rig.capePivot.rotation.x = 0.14 + Math.sin(elapsed * 2.5 + piece.row) * 0.04;

          if (piece.type === 'q') {
            rig.specialOrbitGroup.rotation.x = 0;
            rig.specialOrbitGroup.rotation.y += rawDelta * 1.6;
            rig.specialOrbitGroup.scale.setScalar(1.0);
          }

          const boardHpRatio = piece.hp / Math.max(1, piece.maxHp);
          const ringMat = rig.hpRingMesh.material as THREE.MeshBasicMaterial;
          ringMat.color.setHex(
            boardHpRatio > 0.65
              ? piece.faction === 'w'
                ? 0xf59e0b
                : 0x38bdf8
              : boardHpRatio > 0.3
              ? 0xf97316
              : 0xf43f5e
          );
          ringMat.opacity = isSelected ? 0.95 : piece.hp < piece.maxHp ? 0.72 : 0.32;

          // Diegetic 3D Vitality on the Chessboard: Soul-Crown Halo, Beating Heart Core & Pauldron Sundering!
          const boardSpecialReady = piece.meter >= ARCHETYPES[piece.type].special.meterCost;
          rig.vitalityHaloMesh.visible = isSelected || piece.hp < piece.maxHp || boardSpecialReady;
          if (rig.vitalityHaloMesh.visible) {
            rig.vitalityHaloUniforms.uTime.value = elapsed;
            rig.vitalityHaloUniforms.uHpRatio.value = boardHpRatio;
            rig.vitalityHaloUniforms.uRecoverableRatio.value = boardHpRatio;
            rig.vitalityHaloUniforms.uGuardRatio.value = 1.0;
            rig.vitalityHaloUniforms.uSpecialReady.value = boardSpecialReady ? 1.0 : 0.0;
          }
          const boardHeartBeat =
            1.0 + 0.22 * Math.pow(Math.abs(Math.sin(elapsed * (2.8 + (1 - boardHpRatio) * 7.5))), 3);
          rig.coreGem.scale.setScalar(boardHeartBeat);

          if (rig.pauldronMeshes.length >= 2) {
            const leftP = rig.pauldronMeshes[0];
            const rightP = rig.pauldronMeshes[1];
            leftP.visible = boardHpRatio >= 0.42;
            if (leftP.visible) {
              const dmgTilt = boardHpRatio < 0.65 ? (0.65 - boardHpRatio) * 1.1 : 0;
              leftP.rotation.z = (leftP.userData.baseRotZ ?? 0.35) + dmgTilt;
            }
            rightP.visible = boardHpRatio >= 0.22;
            if (rightP.visible) {
              const dmgTiltR = boardHpRatio < 0.48 ? (0.48 - boardHpRatio) * 1.2 : 0;
              rightP.rotation.z = (rightP.userData.baseRotZ ?? -0.35) - dmgTiltR;
            }
          }

          // Persistent Battle-Worn Armor Cracks, Flickering Emissive Scars & Smoke on surviving board pieces < 30% HP!
          if (boardHpRatio < 0.3 && piece.hp > 0) {
            const severity = Math.min(1, (0.3 - boardHpRatio) / 0.22 + 0.35);
            const flicker =
              0.55 +
              0.45 * Math.sin(elapsed * 28 + piece.col * 3) * Math.cos(elapsed * 17 + piece.row);
            rig.primaryArmorMat.emissiveIntensity = severity * flicker * 1.55;
            rig.primaryArmorMat.bumpScale = 0.04 * severity;
            if (shouldEmitBoardSmoke && isSameSlice) {
              spawnBattleSmoke(
                vfxPool,
                rig.root.position.x,
                rig.root.position.y + 0.65,
                rig.root.position.z,
                severity,
                piece.faction === 'w' ? 0xf59e0b : 0xf43f5e
              );
            }
          } else {
            rig.primaryArmorMat.emissiveIntensity = 0.0;
            rig.primaryArmorMat.bumpScale = 0.0;
          }
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

        // DIRECTOR'S AUTO-PLAY DEMO CHOREOGRAPHY (during CHESS_VIEW)
        if (sim.autoPlayDemo) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 1.35;
          sim.demoBoardTimer += rawDelta;

          // Step 1 (0.45s): Select the best showcase move & highlight its 4D trajectory + Tactical Support preview!
          if (!sim.demoPendingDecision && sim.demoBoardTimer >= 0.45) {
            // If 2 moves have passed without a capture duel, stage a dramatic clash on the board!
            if (sim.demoMovesWithoutCapture >= 2) {
              const friendly = sim.pieces.find((p) => p.faction === sim.turnFaction && p.type !== 'k');
              const enemy = sim.pieces.find((p) => p.faction !== sim.turnFaction && p.type !== 'k');
              if (friendly && enemy) {
                friendly.row = 4;
                friendly.col = 3;
                friendly.w = 0;
                enemy.row = 3;
                enemy.col = 3;
                enemy.w = 0;
              }
              sim.demoMovesWithoutCapture = 0;
            }

            const decision = chooseAIMove(sim.pieces, sim.turnFaction, true);
            if (decision) {
              sim.demoPendingDecision = decision;
              sim.selectedPieceId = decision.piece.id;
              sim.targetMoveW = decision.move.to.w;
              sim.targetMoveZ = decision.move.to.z;
              setTargetMoveW(decision.move.to.w);
              setTargetMoveZ(decision.move.to.z);

              // Shift viewed 4D slice if the move targets Ana (+W) or Kata (-W) so the Quantum Lattice lights up!
              if (decision.move.to.w !== sim.activeSliceW || decision.move.to.z !== sim.activeSliceZ) {
                sim.activeSliceW = decision.move.to.w;
                sim.activeSliceZ = decision.move.to.z;
                setActiveSliceW(decision.move.to.w);
                setActiveSliceZ(decision.move.to.z);
              }

              sim.validMoves = getValidMovesForPiece(
                decision.piece,
                sim.pieces,
                decision.move.to.z,
                decision.move.to.w
              );
              syncBoardHighlights();
              soundEngine.playChessSelect();

              if (decision.move.isCapture && decision.move.targetPiece) {
                setHoveredCaptureMove(decision.move);
                setDemoDirectorStage(
                  `IMMINENT DUEL AT ${formatSquareName(decision.move.to)} · ${ARCHETYPES[decision.piece.type].chessName.toUpperCase()} VS ${ARCHETYPES[decision.move.targetPiece.type].chessName.toUpperCase()}`
                );
              } else {
                setHoveredCaptureMove(null);
                setDemoDirectorStage(
                  `4D MANIFOLD ADVANCE · ${ARCHETYPES[decision.piece.type].chessName.toUpperCase()} → ${formatSquareName(decision.move.to)} (${formatWName(decision.move.to.w)})`
                );
              }
            }
          }

          // Step 2 (1.50s): Execute the highlighted move or launch the capture duel!
          if (sim.demoPendingDecision && sim.demoBoardTimer >= 1.5) {
            const { piece, move } = sim.demoPendingDecision;
            sim.demoPendingDecision = null;
            sim.demoBoardTimer = 0;
            if (move.isCapture) {
              sim.demoMovesWithoutCapture = 0;
            }
            executeChessMove(piece, move);
          }
        } else {
          controls.autoRotate = false;
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
          arenaRig.tesseractLines.visible = false;
          arenaRig.entanglementHelixLines.visible = false;
          sim.phaseTimer += rawDelta;

          const baseStageY = sim.duelCenterWorld.y;
          const atkWorldX = sim.duelCenterWorld.x + atk.x * 0.72;
          const atkWorldY = baseStageY + atk.y * 0.72;
          const atkWorldZ = sim.duelCenterWorld.z;
          const atkEyeH = getWarriorEyeHeightWorld(atk.piece.type);

          const defWorldX = sim.duelCenterWorld.x + def.x * 0.72;
          const defWorldY = baseStageY + def.y * 0.72;
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
                const hWorldY = baseStageY + human.y * 0.72;
                const hEyeH = getWarriorEyeHeightWorld(human.piece.type);
                const oWorldX = sim.duelCenterWorld.x + opp.x * 0.72;
                const oWorldY = baseStageY + opp.y * 0.72;
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

          // Position balanced, atmospheric overhead spotlights (toned down so highlights never blow out!)
          const isOutro = sim.phase === 'FIGHT_OUTRO';
          const atkWonOutro =
            def.hp <= 0 || (atk.hp > 0 && atk.hp / atk.maxHp >= def.hp / def.maxHp);

          arenaRig.spotAttacker.position.set(atkWorldX + 0.45, baseStageY + 6.8, atkWorldZ + 2.2);
          arenaRig.spotAttacker.target.position.set(atkWorldX, atkWorldY + 0.95, atkWorldZ);
          arenaRig.spotAttacker.intensity = THREE.MathUtils.damp(
            arenaRig.spotAttacker.intensity,
            isOutro ? (atkWonOutro ? 92.0 : 18.0) : 82.0,
            10,
            rawDelta
          );

          arenaRig.spotDefender.position.set(defWorldX - 0.45, baseStageY + 6.8, defWorldZ + 2.2);
          arenaRig.spotDefender.target.position.set(defWorldX, defWorldY + 0.95, defWorldZ);
          arenaRig.spotDefender.intensity = THREE.MathUtils.damp(
            arenaRig.spotDefender.intensity,
            isOutro ? (!atkWonOutro ? 92.0 : 18.0) : 82.0,
            10,
            rawDelta
          );

          // Subtle vertical overhead volumetric light shafts descending onto each fighter
          arenaRig.volumetricConeAttacker.position.set(atkWorldX, baseStageY + 3.2, atkWorldZ);
          arenaRig.volumetricConeAttacker.rotation.set(0, 0, 0);
          (arenaRig.volumetricConeAttacker.material as THREE.MeshBasicMaterial).opacity =
            THREE.MathUtils.damp(
              (arenaRig.volumetricConeAttacker.material as THREE.MeshBasicMaterial).opacity,
              sim.phase === 'FIGHT_INTRO'
                ? 0.0
                : isOutro
                ? atkWonOutro
                  ? 0.038
                  : 0.0
                : 0.026,
              6,
              rawDelta
            );

          arenaRig.volumetricConeDefender.position.set(defWorldX, baseStageY + 3.2, defWorldZ);
          arenaRig.volumetricConeDefender.rotation.set(0, 0, 0);
          (arenaRig.volumetricConeDefender.material as THREE.MeshBasicMaterial).opacity =
            THREE.MathUtils.damp(
              (arenaRig.volumetricConeDefender.material as THREE.MeshBasicMaterial).opacity,
              sim.phase === 'FIGHT_INTRO'
                ? 0.0
                : isOutro
                ? !atkWonOutro
                  ? 0.038
                  : 0.0
                : 0.026,
              6,
              rawDelta
            );

          // Balanced front-stage fill light illuminating both duelists without over-brightening
          arenaRig.clashPointLight.position.set(midWorldX, baseStageY + 2.15, sim.duelCenterWorld.z + 2.2);
          arenaRig.clashPointLight.intensity = THREE.MathUtils.damp(
            arenaRig.clashPointLight.intensity,
            10.5,
            8,
            rawDelta
          );

          arenaRig.duelRingGroup.position.x = sim.duelCenterWorld.x;
          arenaRig.duelRingGroup.position.z = sim.duelCenterWorld.z;
          arenaRig.duelRingGroup.position.y = THREE.MathUtils.damp(
            arenaRig.duelRingGroup.position.y,
            baseStageY,
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

            // Check if this bystander is inside the 4.75-unit Duel Ring OR in the foreground camera sightline corridor!
            const inArenaRing = distToRingCenter < 4.75;
            const inCameraCorridor =
              curWorldZ > sim.duelCenterWorld.z - 0.9 &&
              curWorldZ < sim.duelCenterWorld.z + 7.8 &&
              Math.abs(curWorldX - sim.duelCenterWorld.x) < 4.6;

            if (inArenaRing || inCameraCorridor || minFighterDist < 2.8) {
              // Use stable home-square side relative to duelCenterWorld so push direction never oscillates!
              const stableSide = _vec3A.x >= sim.duelCenterWorld.x ? 1 : -1;
              let pushDirX = curWorldX - sim.duelCenterWorld.x;
              let pushDirZ = curWorldZ - sim.duelCenterWorld.z;

              if (inCameraCorridor) {
                pushDirX = stableSide * 1.8;
                pushDirZ = curWorldZ < sim.duelCenterWorld.z ? -1.0 : -0.35;
              } else if (Math.hypot(pushDirX, pushDirZ) < 0.25) {
                pushDirX = stableSide * 1.4;
                pushDirZ = piece.row < 4 ? -1.2 : 1.2;
              }

              const len = Math.hypot(pushDirX, pushDirZ) || 1;
              pushDirX /= len;
              pushDirZ /= len;

              const urgency = inCameraCorridor
                ? 1.0
                : Math.max(0.5, (4.85 - distToRingCenter) / 4.85);
              bys.vx += pushDirX * (24.0 * urgency) * rawDelta;
              bys.vz += pushDirZ * (24.0 * urgency) * rawDelta;

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
                _vec3A.z > sim.duelCenterWorld.z - 0.9 &&
                _vec3A.z < sim.duelCenterWorld.z + 7.8 &&
                Math.abs(_vec3A.x - sim.duelCenterWorld.x) < 4.6;

              if (!homeInCameraCorridor && homeDistToCenter > 5.1) {
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
            rig.statusShaderMesh.visible = false;
            rig.statusIndicatorGroup.visible = false;
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
            const humanSpdMult = getFighterSpeedMultiplier(human);
            if (
              !sim.autoPlayDemo &&
              (human.action === 'idle' ||
                human.action === 'walk_fwd' ||
                human.action === 'walk_back')
            ) {
              const leftHeld = sim.keysHeld['KeyA'] || sim.keysHeld['ArrowLeft'];
              const rightHeld = sim.keysHeld['KeyD'] || sim.keysHeld['ArrowRight'];
              if (sim.combatCameraMode === 'first_person') {
                // In First-Person Visor POV, D advances toward the opponent and A steps back!
                if (rightHeld && !leftHeld) {
                  human.vx = human.facing * human.spec.walkSpeed * humanSpdMult;
                  human.action = 'walk_fwd';
                } else if (leftHeld && !rightHeld) {
                  human.vx = -human.facing * human.spec.walkSpeed * humanSpdMult;
                  human.action = 'walk_back';
                } else {
                  human.vx = 0;
                  human.action = 'idle';
                }
              } else {
                if (leftHeld && !rightHeld) {
                  human.vx = -human.spec.walkSpeed * humanSpdMult;
                  human.action = human.facing === -1 ? 'walk_fwd' : 'walk_back';
                } else if (rightHeld && !leftHeld) {
                  human.vx = human.spec.walkSpeed * humanSpdMult;
                  human.action = human.facing === 1 ? 'walk_fwd' : 'walk_back';
                } else {
                  human.vx = 0;
                  human.action = 'idle';
                }
              }
            }

            // Emit localized particles for active Burn / Slow / Weakened status effects!
            for (const f of [atk, def]) {
              if (f.hp <= 0) continue;
              const fWorldX = sim.duelCenterWorld.x + f.x * 0.72;
              const fWorldY = 0.8 + f.y * 0.72;
              const fWorldZ = sim.duelCenterWorld.z;
              if (f.statusBurnTimerMs > 0 && Math.random() < rawDelta * 14) {
                spawnBattleSmoke(vfxPool, fWorldX, fWorldY, fWorldZ, 0.9, 0xf97316);
              }
              if (f.statusSlowTimerMs > 0 && Math.random() < rawDelta * 8) {
                spawnHitSparks(vfxPool, fWorldX, fWorldY, fWorldZ, 0x38bdf8, 2);
              }
              if (f.statusWeakenedTimerMs > 0 && Math.random() < rawDelta * 8) {
                spawnHitSparks(vfxPool, fWorldX, fWorldY, fWorldZ, 0xc084fc, 2);
              }
            }

            if (atk.isAI || sim.autoPlayDemo) {
              updateFighterAI(
                atk,
                def,
                combatDelta,
                nowMs,
                addCallout,
                (aiCaller, idx) => executeFighterIntervention(aiCaller, idx),
                sim.autoPlayDemo
              );
            }
            if (def.isAI || sim.autoPlayDemo) {
              updateFighterAI(
                def,
                atk,
                combatDelta,
                nowMs,
                addCallout,
                (aiCaller, idx) => executeFighterIntervention(aiCaller, idx),
                sim.autoPlayDemo
              );
            }

            // Director's Auto-Play Camera & Telemetry Switcher during active duels:
            // Alternates between First-Person Visor POV and 3rd-Person Side Arena Camera so viewers experience both!
            if (sim.autoPlayDemo) {
              sim.demoCameraTimer += rawDelta;
              if (sim.activeIntervention) {
                if (sim.combatCameraMode !== 'side_arena') {
                  sim.combatCameraMode = 'side_arena';
                  setCombatCameraMode('side_arena');
                }
                setDemoDirectorStage(
                  `TACTICAL INTERVENTION · ${ARCHETYPES[sim.activeIntervention.supporter.type].chessName.toUpperCase()} (${sim.activeIntervention.supporter.interventionName.toUpperCase()})!`
                );
              } else if (sim.demoCameraTimer >= 4.2) {
                sim.demoCameraTimer = 0;
                const nextCam =
                  sim.combatCameraMode === 'first_person' ? 'side_arena' : 'first_person';
                sim.combatCameraMode = nextCam;
                setCombatCameraMode(nextCam);
                setDemoDirectorStage(
                  nextCam === 'first_person'
                    ? 'FIRST-PERSON VISOR POV · PARRY, COMBOS & 4D PHASE-SHIFT'
                    : '3RD-PERSON COLOSSEUM CAMERA · BYSTANDERS & FULL-BODY RIGS'
                );
              }
            }

            // Step Active Tactical Intervention Sequence (0.72s Rift & Supporter Strike Climax!)
            if (sim.activeIntervention) {
              const interv = sim.activeIntervention;
              interv.timerSec += rawDelta;
              const caller = interv.callerIsAttacker ? atk : def;
              const opponent = interv.callerIsAttacker ? def : atk;

              // Animate the actual supporting board piece rig leaping & projecting energy into the rift!
              const supRig = sim.pieceRigs.get(interv.supporter.pieceId);
              if (supRig) {
                const arc = Math.sin(Math.min(1, interv.timerSec / interv.durationSec) * Math.PI);
                supRig.root.position.y += arc * 1.45;
                supRig.rightArmPivot.rotation.x = -1.85 * arc;
                supRig.leftArmPivot.rotation.x = -1.4 * arc;
                supRig.quantumWaveGroup.visible = true;
                supRig.tesseractBadge.visible = interv.supporter.isCrossDimensional;
                supRig.quantumWaveGroup.rotation.y += rawDelta * 12;
              }

              // Apply combat impact at 0.26s into the rift sequence!
              if (!interv.impactApplied && interv.timerSec >= 0.26) {
                interv.impactApplied = true;
                const intervEvents = {
                  hitstopMs: 0,
                  cameraShake: 0,
                  sparkWorldPos: null as { x: number; y: number; color: number } | null,
                  slowMoDurationMs: 0,
                  parryImpact: null,
                };
                applyTacticalInterventionImpact(
                  caller,
                  opponent,
                  interv.supporter,
                  intervEvents,
                  addCallout
                );

                if (intervEvents.slowMoDurationMs > 0) {
                  sim.slowMoTimer = Math.max(sim.slowMoTimer, intervEvents.slowMoDurationMs / 1000);
                }
                if (intervEvents.cameraShake > 0) {
                  sim.cameraShake = Math.max(sim.cameraShake, intervEvents.cameraShake);
                }
                if (intervEvents.sparkWorldPos) {
                  const impactWorldX = sim.duelCenterWorld.x + intervEvents.sparkWorldPos.x * 0.72;
                  const impactWorldY = intervEvents.sparkWorldPos.y;
                  const impactWorldZ = sim.duelCenterWorld.z;
                  spawnHitSparks(
                    vfxPool,
                    impactWorldX,
                    impactWorldY,
                    impactWorldZ,
                    intervEvents.sparkWorldPos.color,
                    24
                  );
                  spawnShockwave(
                    vfxPool,
                    impactWorldX,
                    0.06,
                    impactWorldZ,
                    intervEvents.sparkWorldPos.color,
                    5.8
                  );
                  spawnAuraPillar(vfxPool, impactWorldX, impactWorldZ, intervEvents.sparkWorldPos.color);
                  spawnGroundDebris(vfxPool, impactWorldX, impactWorldZ, 10);
                  sim.hitstopTimer = 0.048;
                }
              }

              if (interv.timerSec >= interv.durationSec) {
                sim.activeIntervention = null;
              }
            }

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
            if (stepEvents.parryImpact) {
              const pi = stepEvents.parryImpact;
              const fallbackWorldX = sim.duelCenterWorld.x + pi.x * 0.72;
              const fallbackWorldY = pi.y;
              const fallbackWorldZ = sim.duelCenterWorld.z;
              const parryDefRig = pi.defenderIsAttacker ? atkRig : defRig;
              const parryAtkRig = pi.defenderIsAttacker ? defRig : atkRig;
              spawnParryImpactSparks(
                vfxPool,
                fallbackWorldX,
                fallbackWorldY,
                fallbackWorldZ,
                pi.facing,
                pi.defenderFaction,
                parryDefRig,
                parryAtkRig
              );
              sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.055);
              arenaRig.clashPointLight.color.setHex(0xffffff);
              arenaRig.clashPointLight.intensity = 24.0;
            }
            if (stepEvents.sparkWorldPos) {
              const worldX = sim.duelCenterWorld.x + stepEvents.sparkWorldPos.x * 0.72;
              const worldY = stepEvents.sparkWorldPos.y;
              const worldZ = sim.duelCenterWorld.z;
              spawnHitSparks(
                vfxPool,
                worldX,
                worldY,
                worldZ,
                stepEvents.sparkWorldPos.color,
                stepEvents.parryImpact ? 22 : 16
              );

              if (!stepEvents.parryImpact) {
                arenaRig.clashPointLight.color.setHex(stepEvents.sparkWorldPos.color);
                arenaRig.clashPointLight.intensity = 16.0;
              }

              if (stepEvents.cameraShake >= 0.25) {
                sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.042);
                spawnShockwave(vfxPool, worldX, 0.05, worldZ, stepEvents.sparkWorldPos.color, 4.5);
                spawnGroundDebris(vfxPool, worldX, worldZ, 8);
              }
              if (
                atk.hp / Math.max(1, atk.maxHp) < 0.3 ||
                def.hp / Math.max(1, def.maxHp) < 0.3
              ) {
                battleWornPulse = 1.0;
              }
            }

            // HOROLOGIUM WATCH DUEL ARENA HAZARD: Sweeping Timeline Hand across the Colossal Dial!
            if (sim.duelOnWatch && atk.hp > 0 && def.hp > 0) {
              sim.horologiumSweepTimer += combatDelta;
              if (sim.horologiumSweepTimer >= 4.2) {
                sim.horologiumSweepTimer = 0;
                soundEngine.playWatchHandForged();
                if (sim.pocketWatchRig) {
                  triggerPocketWatchReaction(
                    sim.pocketWatchRig,
                    0xfbbf24,
                    sim.multiverse.activeTimelineId,
                    false
                  );
                }
                for (const f of [atk, def]) {
                  if (f.y >= 0.55 || f.wPhaseTimerMs > 0) {
                    f.meter = Math.min(100, f.meter + 22);
                    addCallout({
                      text: '⌚ ESCAPEMENT VAULT! (+22% METER)',
                      subtext: 'LEAPT OVER SWEEPING WATCH HAND',
                      x: f.x,
                      y: 2.35,
                      color: '#fbbf24',
                    });
                  } else if (!f.isAI || Math.random() < 0.65) {
                    f.hp = Math.max(1, f.hp - 9);
                    f.vy = Math.max(f.vy, 5.2);
                    f.hitFlashTimerMs = 140;
                    spawnShockwave(
                      vfxPool,
                      sim.duelCenterWorld.x + f.x * 0.72,
                      sim.duelCenterWorld.y + 0.1,
                      sim.duelCenterWorld.z,
                      0xfbbf24,
                      4.2
                    );
                    addCallout({
                      text: '⌚ SWEPT BY TIMELINE HAND (-9 HP)!',
                      subtext: 'JUMP (W) OR 4D-PHASE (U) WHEN GEARS CHIME',
                      x: f.x,
                      y: 2.1,
                      color: '#f59e0b',
                    });
                  }
                }
              }
            }

            // Check K.O. or Time Out!
            if (atk.hp <= 0 || def.hp <= 0 || sim.fightTimer <= 0) {
              const attackerWon =
                def.hp <= 0 || (atk.hp > 0 && atk.hp / atk.maxHp >= def.hp / def.maxHp);
              const winner = attackerWon ? atk : def;
              const loser = attackerWon ? def : atk;

              const tauntSpec = triggerVictoryTaunt(winner, loser);
              sim.phase = 'FIGHT_OUTRO';
              sim.phaseTimer = 0;
              setPhase('FIGHT_OUTRO');
              soundEngine.playKO();

              const koWorldX = sim.duelCenterWorld.x + loser.x * 0.72;
              spawnShockwave(vfxPool, koWorldX, 0.05, sim.duelCenterWorld.z, 0xf59e0b, 6.5);
              spawnGroundDebris(vfxPool, koWorldX, sim.duelCenterWorld.z, 14);
              spawnAuraPillar(
                vfxPool,
                sim.duelCenterWorld.x + winner.x * 0.72,
                sim.duelCenterWorld.z,
                tauntSpec.flourishColorHex
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
                title: `${winner.spec.warriorTitle} · ${tauntSpec.name}`,
                subtitle: `"${tauntSpec.quote}" — ${
                  wasUpset
                    ? `Tactical Upset: Value ${winner.spec.tacticalValue} ${winner.spec.chessName} felled Value ${loser.spec.tacticalValue} ${loser.spec.chessName}!`
                    : `${winner.spec.chessName} claims the square with ${winner.hp} HP.`
                }`,
                wasUpset,
              });
            }
          } else if (sim.phase === 'FIGHT_OUTRO' && sim.phaseTimer < 2.65) {
            const attackerWon =
              def.hp <= 0 || (atk.hp > 0 && atk.hp / atk.maxHp >= def.hp / def.maxHp);
            const winner = attackerWon ? atk : def;
            const loser = attackerWon ? def : atk;
            const { triggeredClimaxVFX, climaxColorHex } = stepVictoryTaunt(
              winner,
              loser,
              rawDelta
            );
            if (triggeredClimaxVFX) {
              const winWorldX = sim.duelCenterWorld.x + winner.x * 0.72;
              spawnShockwave(vfxPool, winWorldX, 0.05, sim.duelCenterWorld.z, climaxColorHex, 5.2);
              spawnHitSparks(vfxPool, winWorldX, 1.35, sim.duelCenterWorld.z, climaxColorHex, 18);
              spawnAuraPillar(vfxPool, winWorldX, sim.duelCenterWorld.z, climaxColorHex);
              soundEngine.playSpecialActivate();
            }
          } else if (sim.phase === 'FIGHT_OUTRO' && sim.phaseTimer >= 2.65) {
            const attackerWon =
              def.hp <= 0 || (atk.hp > 0 && atk.hp / atk.maxHp >= def.hp / def.maxHp);

            // CASE A: SUBTERRANEAN REALM SENTINEL DUEL RESOLUTION!
            if (sim.duelInRealm && sim.realm.travelerPieceId) {
              const exploringPiece = sim.pieces.find((p) => p.id === sim.realm.travelerPieceId);
              const realmMeta = REALM_METADATA[sim.realm.currentRealmId];

              if (attackerWon && exploringPiece) {
                // Exploring warrior defeated the Realm Sentinel!
                // Record authoritative Multiversal Lineage Death Event!
                recordCausalAssassination(
                  sim.multiverse,
                  sim.multiverse.activeTimelineId,
                  exploringPiece,
                  def.piece,
                  { row: def.piece.row, col: def.piece.col, z: def.piece.z, w: def.piece.w },
                  sim.turnNumber,
                  `Subterranean Sentinel slain in ${realmMeta.title}`
                );

                // Remove the corresponding enemy chess piece from the active 4D board!
                sim.pieces = sim.pieces.filter((p) => p.id !== def.piece.id);
                syncActiveBranchFromSim();
                setMultiverseState({ ...sim.multiverse });
                const loserRig = sim.pieceRigs.get(def.piece.id);
                if (loserRig) {
                  loserRig.root.parent?.remove(loserRig.root);
                  sim.pieceRigs.delete(def.piece.id);
                }

                // Mark the sentinel defeated inside the realm & hide its 3D sentinel rig
                const sent = sim.realm.sentinels.find((s) => s.id === sim.activeSentinelId);
                if (sent) {
                  sent.defeated = true;
                  if (sim.realmsRig) {
                    const sRig = sim.realmsRig.sentinelRigs.get(sent.id);
                    if (sRig) {
                      sRig.root.visible = false;
                    }
                  }
                }

                const adrenalineHeal = Math.round(exploringPiece.maxHp * 0.18);
                exploringPiece.hp = Math.min(
                  exploringPiece.maxHp,
                  Math.max(15, atk.hp + adrenalineHeal)
                );
                exploringPiece.meter = Math.min(100, atk.meter + 25);
                exploringPiece.kills += 1;

                setBattleLogs((prev) => [
                  {
                    id: `realm_duel_${Date.now()}`,
                    turnNumber: sim.turnNumber,
                    summary: `Subterranean Victory: ${atk.spec.chessName} slew Sentinel ${def.spec.chessName} in ${realmMeta.title}!`,
                    detail: `Lineage [${getPieceLineageId(def.piece)}] marked for Multiversal Death! ${atk.spec.chessName} continues exploring the realm (+${adrenalineHeal} HP, +25 Meter).`,
                    wasUpset: atk.spec.tacticalValue < def.spec.tacticalValue,
                    winnerFaction: atk.piece.faction,
                  },
                  ...prev.slice(0, 7),
                ]);

                // Resume 3D Realm Exploration right where the warrior stands!
                sim.duelInRealm = false;
                sim.activeSentinelId = null;
                sim.attackerRuntime = null;
                sim.defenderRuntime = null;
                sim.phase = 'REALM_EXPLORATION';
                setPhase('REALM_EXPLORATION');
                setKoBanner(null);
                setRealmTraveler({ ...exploringPiece });
                setRealmStatusBanner(
                  `FELLED REALM SENTINEL ${def.spec.chessName.toUpperCase()} — LINEAGE DEATH RECORDED!`
                );
              } else {
                // Exploring warrior fell to the Subterranean Sentinel!
                recordCausalAssassination(
                  sim.multiverse,
                  sim.multiverse.activeTimelineId,
                  def.piece,
                  atk.piece,
                  { row: atk.piece.row, col: atk.piece.col, z: atk.piece.z, w: atk.piece.w },
                  sim.turnNumber,
                  `Subterranean fall in ${realmMeta.title}`
                );
                sim.pieces = sim.pieces.filter((p) => p.id !== atk.piece.id);
                syncActiveBranchFromSim();
                setMultiverseState({ ...sim.multiverse });
                const loserRig = sim.pieceRigs.get(atk.piece.id);
                if (loserRig) {
                  loserRig.root.parent?.remove(loserRig.root);
                  sim.pieceRigs.delete(atk.piece.id);
                }

                if (sim.realmsRig) {
                  syncRealmEntities3D(sim.realmsRig, [], []);
                }

                setBattleLogs((prev) => [
                  {
                    id: `realm_loss_${Date.now()}`,
                    turnNumber: sim.turnNumber,
                    summary: `Subterranean Fall: ${atk.spec.chessName} fell to Sentinel ${def.spec.chessName} in ${realmMeta.title}!`,
                    detail: `${atk.spec.chessName} [Lineage ${getPieceLineageId(atk.piece)}] was lost in the underworld.`,
                    wasUpset: true,
                    winnerFaction: def.piece.faction,
                  },
                  ...prev.slice(0, 7),
                ]);

                const nextFaction: Faction = sim.turnFaction === 'w' ? 'b' : 'w';
                sim.turnFaction = nextFaction;
                sim.turnNumber += 1;
                syncActiveBranchFromSim();
                setTurnFaction(nextFaction);
                setTurnNumber(sim.turnNumber);

                sim.duelInRealm = false;
                sim.activeSentinelId = null;
                sim.realm.travelerPieceId = null;
                sim.attackerRuntime = null;
                sim.defenderRuntime = null;
                sim.duelCenterWorld.set(0, 0, 0);
                sim.phase = 'CHESS_VIEW';
                if (sim.controls) sim.controls.enabled = true;
                setRealmTraveler(null);
                setNearbyPortal(null);
                setNearbyPortalEval(null);
                setRealmStatusBanner(null);
                setPhase('CHESS_VIEW');
                setKoBanner(null);
                syncBoardHighlights();
              }
            } else if (sim.duelIsAcademicDebate && sim.academicColloquium?.active) {
              // CASE A2: ACADEMIC ORAL DEFENSE PODIUM DEBATE DUEL VS REVIEWER #2 (TENURED PROF. ROOK)!
              // Neither Professor dies in an Academic Podium Debate — instead, Reviewer #2 concedes his objections,
              // both Professors return to their faculty seats, and the Sentient Mathematical Theorem is ACCEPTED & PUBLISHED!
              const col = sim.academicColloquium;
              col.oralDefenseDuelCompleted = true;
              col.oralDefenseArgumentsWon = 3;
              col.rigorScore = 100;
              col.stage = 'PUBLISHED_QED';
              col.publishedDoi = `10.4004/ann.transtemp.${sim.turnNumber}.${Date.now().toString().slice(-4)}`;
              if (col.reviewers[1]) {
                col.reviewers[1].verdict = 'ACCEPTED';
                col.reviewers[1].rebuttalResolved = true;
              }
              setAcademicColloquium({ ...col });

              soundEngine.playSynodResonance(true);
              confetti({ particleCount: 100, spread: 85, origin: { y: 0.45 } });
              setWatchEventBanner({
                title: `🎓 ORAL DEFENSE TRIUMPH — REVIEWER #2 CONCEDES!`,
                subtitle: `Tenured Prof. Rook signed the Acceptance Certificate! Click "Restore Chess Pieces & Unlock Checkmate Yesterday" in the Colloquium Panel!`,
              });
              setBattleLogs((prev) => [
                {
                  id: `oral_defense_${Date.now()}`,
                  turnNumber: sim.turnNumber,
                  summary: `🎓 Oral Defense Podium Victory: Dr. Candidate Pawn Refuted Reviewer #2 (Tenured Prof. Rook)!`,
                  detail: `Unanimous Faculty Senate vote achieved! "${col.manuscriptTitle}" accepted for publication in the Annals of Transtemporal Mathematics [DOI: ${col.publishedDoi}].`,
                  wasUpset: true,
                  winnerFaction: atk.piece.faction,
                },
                ...prev.slice(0, 7),
              ]);

              sim.duelIsAcademicDebate = false;
              sim.phase = 'CHESS_VIEW';
              sim.attackerRuntime = null;
              sim.defenderRuntime = null;
              sim.pendingMove = null;
              sim.duelInRealm = false;
              sim.duelOnWatch = false;
              sim.duelCenterWorld.set(0, 0, 0);
              if (sim.controls) sim.controls.enabled = true;
              setPhase('CHESS_VIEW');
              setKoBanner(null);
              syncBoardHighlights();
            } else {
              // CASE B: STANDARD OR REALM-EMERGENCE CHESSBOARD DUEL RESOLUTION
              if (sim.isExhibitionDuel) {
                for (const rig of sim.exhibitionTempRigs) {
                  rig.root.parent?.remove(rig.root);
                }
                sim.exhibitionTempRigs = [];
              } else if (sim.pendingMove) {
                const winnerRuntime = attackerWon ? atk : def;
                const loserRuntime = attackerWon ? def : atk;
                const sq = formatSquareName(sim.pendingMove.to);
                const targetWLabel = formatWName(sim.pendingMove.to.w);

                // Record Authoritative Multiversal Death Event for the slain piece's lineage!
                const causalDeath = recordCausalAssassination(
                  sim.multiverse,
                  sim.multiverse.activeTimelineId,
                  winnerRuntime.piece,
                  loserRuntime.piece,
                  sim.pendingMove.to,
                  sim.turnNumber,
                  `${winnerRuntime.spec.chessName} slew ${loserRuntime.spec.chessName} at ${sq} [${targetWLabel}]`
                );

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

                const wasUpset =
                  !attackerWon ||
                  winnerRuntime.spec.tacticalValue < loserRuntime.spec.tacticalValue;

                const isAlternateRealityKill =
                  sim.multiverse.activeTimelineId !== 'TL-PRIME';
                const wasWatchAscensionDuel = sim.duelOnWatch;
                let redeemedLineageText = '';

                if (wasWatchAscensionDuel && survivorPiece) {
                  survivorPiece.isChronocrator = true;
                  survivorPiece.synodStacks = (survivorPiece.synodStacks || 0) + 1;
                  survivorPiece.hp = survivorPiece.maxHp;
                  survivorPiece.meter = 100;

                  // If an allied piece was previously assassinated, winning atop the Pocket Watch redeems & resurrects it!
                  const alliedAssassination = Array.from(
                    sim.multiverse.eliminatedLineages.values()
                  ).find((ev) => ev.victimFaction === survivorPiece.faction);
                  if (alliedAssassination) {
                    const restored = rewindCausalAssassination(
                      sim.multiverse,
                      alliedAssassination.id
                    );
                    if (restored) {
                      const activeBr = ensureBranchHydrated(
                        sim.multiverse,
                        sim.multiverse.activeTimelineId
                      );
                      if (activeBr) {
                        const restoredPiece = activeBr.pieces.find(
                          (p) => getPieceLineageId(p) === restored.victimLineageId
                        );
                        if (restoredPiece && !sim.pieces.some((p) => p.id === restoredPiece.id)) {
                          sim.pieces.push(restoredPiece);
                          const scene = sim.arenaRig?.group.parent;
                          if (scene) {
                            const newRig = createArticulatedPiece(
                              restoredPiece.type,
                              restoredPiece.faction
                            );
                            boardToWorld(
                              restoredPiece.row,
                              restoredPiece.col,
                              newRig.root.position
                            );
                            scene.add(newRig.root);
                            sim.pieceRigs.set(restoredPiece.id, newRig);
                          }
                        }
                      }
                      redeemedLineageText = ` · Resurrected Fallen ${ARCHETYPES[restored.victimType].chessName} [${restored.victimLineageId}]!`;
                    }
                  }

                  soundEngine.playSynodResonance(true);
                  confetti({ particleCount: 95, spread: 80, origin: { y: 0.45 } });
                  setWatchEventBanner({
                    title: `⌚ CROWNED CHRONOCRATOR: ${ARCHETYPES[survivorPiece.type].warriorTitle.toUpperCase()}!`,
                    subtitle: `Triumphed atop the Colossal Pocket Watch! Gained Causal Immunity, Sovereign Vectors & Full Vitality${redeemedLineageText}`,
                  });
                }

                const wasYesterdayCheckmate =
                  sim.pendingMove.dimensionType === 'CHECKMATE_YESTERDAY' && attackerWon;

                if (wasYesterdayCheckmate) {
                  soundEngine.playWatchDoomBell(true);
                  soundEngine.playSynodResonance(true);
                  if (sim.pocketWatchRig) {
                    triggerPocketWatchReaction(
                      sim.pocketWatchRig,
                      0x38bdf8,
                      sim.multiverse.activeTimelineId,
                      true
                    );
                  }
                  setWatchEventBanner({
                    title: `⊢ Q.E.D. — YESTERDAY HAS BEEN CHECKMATED AT ${sq}!`,
                    subtitle: `Sentient Mathematical Theorem (${winnerRuntime.piece.theoremAxiom || '⊢ ∀t < t₀ : ¬∃Monarch [Q.E.D.]'}) retroactively refuted ${loserRuntime.spec.chessName} at Turn 1 (Yesterday)!`,
                  });
                }

                const duelLogEntry: BattleLogEntry = {
                  id: `duel_${Date.now()}`,
                  turnNumber: sim.turnNumber,
                  summary: wasYesterdayCheckmate
                    ? `⊢ Q.E.D. CHECKMATED YESTERDAY: Sentient Theorem Refuted ${loserRuntime.spec.chessName} at Turn 1 (${sq})!`
                    : wasWatchAscensionDuel
                    ? `⌚ HOROLOGIUM ASCENSION VICTORY: ${winnerRuntime.spec.chessName} Crowned Chronocrator Atop the Cosmic Watch!`
                    : isAlternateRealityKill
                    ? `CAUSAL ASSASSINATION IN ${sim.multiverse.activeTimelineId}: ${loserRuntime.spec.chessName} [${causalDeath.victimLineageId}] Slain!`
                    : attackerWon
                    ? `${atk.spec.chessName} conquered ${def.spec.chessName} at ${sq} [${targetWLabel}]`
                    : `UPSET AT ${sq}: Defending ${def.spec.chessName} slew Attacking ${atk.spec.chessName}!`,
                  detail: wasYesterdayCheckmate
                    ? `Formal proof "${winnerRuntime.piece.theoremAxiom || '⊢ ∀t < t₀ : ¬∃Monarch [Q.E.D.]'}" erased ${loserRuntime.spec.warriorTitle} from Yesterday's timeline across all branches!`
                    : wasWatchAscensionDuel
                    ? `${winnerRuntime.spec.warriorTitle} commands Chronocrator Sovereign Vectors & Remembered-Square Immunity${redeemedLineageText}`
                    : isAlternateRealityKill
                    ? `Lineage ${causalDeath.victimLineageId} terminated in ${sim.multiverse.activeTimelineId}! Converge with Prime Reality to erase its counterpart there!`
                    : `${winnerRuntime.spec.warriorTitle} survived with ${survivorPiece?.hp ?? winnerRuntime.hp} HP (${survivorPiece?.kills ?? 1} Kills).`,
                  wasUpset,
                  winnerFaction: winnerRuntime.piece.faction,
                };

                setBattleLogs((prev) => [duelLogEntry, ...prev.slice(0, 7)]);

                if (loserRuntime.piece.type === 'k' && !sim.autoConvergeToPrimeAfterDuel) {
                  setWarVictor({
                    faction: winnerRuntime.piece.faction,
                    reason: wasYesterdayCheckmate
                      ? `⊢ Q.E.D. — YESTERDAY HAS BEEN CHECKMATED! A Pawn merged with its alternate-timeline self into the Sentient Mathematical Theorem "${winnerRuntime.piece.theoremAxiom || '⊢ ∀t < t₀ : ¬∃Monarch [Q.E.D.]'}" and retroactively checkmated the Eternal Monarch on Turn 1 (Yesterday) at Square ${sq}!`
                      : `Regicide at Square ${sq} in ${sim.multiverse.activeTimelineId}! ${winnerRuntime.spec.warriorTitle} defeated the Eternal Monarch in single combat.`,
                  });
                  confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });

                  if (sim.autoPlayDemo) {
                    setTimeout(() => {
                      if (simRef.current.autoPlayDemo) {
                        handleResetGame();
                        simRef.current.autoPlayDemo = true;
                        setAutoPlayDemo(true);
                      }
                    }, 3200);
                  }
                }

                const nextFaction: Faction = sim.turnFaction === 'w' ? 'b' : 'w';
                sim.turnFaction = nextFaction;
                sim.turnNumber += 1;
                syncActiveBranchFromSim();
                setMultiverseState({ ...sim.multiverse });
                setTurnFaction(nextFaction);
                setTurnNumber(sim.turnNumber);

                // If this was a Guided Causal Assassination in an alternate timeline, automatically converge back to TL-PRIME!
                if (sim.autoConvergeToPrimeAfterDuel) {
                  sim.autoConvergeToPrimeAfterDuel = false;
                  sim.phase = 'CHESS_VIEW';
                  sim.attackerRuntime = null;
                  sim.defenderRuntime = null;
                  sim.pendingMove = null;
                  sim.duelCenterWorld.set(0, 0, 0);
                  setPhase('CHESS_VIEW');
                  setKoBanner(null);
                  setTimeout(() => {
                    handleTriggerConvergence('TL-PRIME');
                  }, 250);
                  return;
                }

                if (!sim.autoPlayDemo && sim.gameMode === 'vs_ai' && nextFaction === 'b' && loserRuntime.piece.type !== 'k') {
                  setTimeout(() => {
                    const currentSim = simRef.current;
                    if (currentSim.autoPlayDemo || currentSim.phase !== 'CHESS_VIEW' || currentSim.turnFaction !== 'b') return;
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
              sim.duelInRealm = false;
              sim.duelOnWatch = false;
              sim.horologiumSweepTimer = 0;
              sim.duelCenterWorld.set(0, 0, 0);
              sim.demoBoardTimer = 0;
              sim.demoPendingDecision = null;
              if (sim.controls) {
                sim.controls.enabled = true;
              }
              setPhase('CHESS_VIEW');
              setKoBanner(null);
              syncBoardHighlights();
            }
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
            const targetWorldY = baseStageY + f.y * 0.72;
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

            // Keep head level and lock iris/pupil focus + fierce standoff squint dead-center into the lens during Sergio Leone Crash-Zooms!
            if (sim.phase === 'FIGHT_INTRO' && (sim.introShotIndex === 0 || sim.introShotIndex === 1)) {
              rig.headGroup.rotation.set(0, 0, 0);
              rig.bodyPivot.rotation.set(0, 0, 0);
              const microTremor = Math.sin(elapsed * 24) * 0.0008;
              rig.leftPupilPivot.position.set(microTremor, 0, 0.006);
              rig.rightPupilPivot.position.set(microTremor, 0, 0.006);
              rig.leftPupilPivot.scale.setScalar(1.24);
              rig.rightPupilPivot.scale.setScalar(1.24);
              rig.leftUpperLid.position.y = 0.0082;
              rig.rightUpperLid.position.y = 0.0082;
              rig.leftUpperLid.rotation.z = 0.19;
              rig.rightUpperLid.rotation.z = 0.19;
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
          const midY = baseStageY + 0.96 + Math.max(atk.y, def.y) * 0.22;
          const midZ = sim.duelCenterWorld.z;
          const sep = Math.abs(atk.x - def.x);

          let targetFov = 38;
          let fovDampSpeed = 14;
          let targetDutchRoll = 0;
          let camLerpSpeed = 14;

          if (sim.phase === 'TRANSITION_TO_FIGHT') {
            _camTargetPos.set(midX, baseStageY + 1.75, midZ + 5.0);
            _camLookTarget.set(midX, baseStageY + 1.0, midZ);
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
              const hWorldY = baseStageY + human.y * 0.72;
              const hEyeH = getWarriorEyeHeightWorld(human.piece.type);
              const oWorldX = sim.duelCenterWorld.x + opponent.x * 0.72;
              const oWorldY = baseStageY + opponent.y * 0.72;
              const oEyeH = getWarriorEyeHeightWorld(opponent.piece.type);

              _camTargetPos.set(hWorldX, hWorldY + hEyeH, midZ);
              _camLookTarget.set(oWorldX, oWorldY + oEyeH * 0.82, midZ);
              targetFov = 56;
              fovDampSpeed = 24;
              targetDutchRoll = 0;
              camLerpSpeed = 28;
            }
          } else if (sim.phase === 'FIGHT_OUTRO') {
            // Unobstructed Heroic 3rd-Person Low-Angle Orbit around the Victorious Warrior!
            const winnerWorldX =
              def.hp <= 0 || (atk.hp > 0 && atk.hp / atk.maxHp >= def.hp / def.maxHp)
                ? atkWorldX
                : defWorldX;
            const winnerIsAtk = winnerWorldX === atkWorldX;
            const orbitSweep = Math.sin(sim.phaseTimer * 0.75) * 0.95;
            _camTargetPos.set(
              winnerWorldX + (winnerIsAtk ? 0.65 : -0.65) + orbitSweep,
              baseStageY + 1.18,
              midZ + 2.75
            );
            _camLookTarget.set(winnerWorldX, baseStageY + 1.08, midZ);
            targetFov = 28;
            fovDampSpeed = 14;
            targetDutchRoll = winnerIsAtk ? 0.045 : -0.045;
            camLerpSpeed = 12;
          } else if (sim.combatCameraMode === 'first_person') {
            // FIRST-PERSON VISOR COMBAT MODE (with Free Mouse-Look Pitch/Yaw Offset!)
            const hWorldX = sim.duelCenterWorld.x + human.x * 0.72 - human.facing * 0.26;
            const hWorldY = baseStageY + human.y * 0.72;
            const hPhaseZ = human.wPhaseTimerMs > 0 ? human.wPhaseOffset * 0.65 : 0;
            const hWorldZ = midZ + hPhaseZ;
            const hEyeH = getWarriorEyeHeightWorld(human.piece.type);

            const oWorldX = sim.duelCenterWorld.x + opponent.x * 0.72;
            const oWorldY = baseStageY + opponent.y * 0.72;
            const oPhaseZ = opponent.wPhaseTimerMs > 0 ? opponent.wPhaseOffset * 0.65 : 0;
            const oWorldZ = midZ + oPhaseZ;
            const oEyeH = getWarriorEyeHeightWorld(opponent.piece.type);

            const walkBob =
              human.action === 'walk_fwd' || human.action === 'walk_back'
                ? Math.sin(elapsed * 14) * 0.035
                : Math.sin(elapsed * 2.5) * 0.008;

            const camPosX = hWorldX;
            const camPosY = hWorldY + hEyeH + walkBob;
            const camPosZ = hWorldZ;
            _camTargetPos.set(camPosX, camPosY, camPosZ);

            // Base vector toward opponent + user mouse-look yaw/pitch rotation!
            const baseDX = oWorldX - camPosX;
            const baseDY = oWorldY + oEyeH * 0.78 - camPosY;
            const baseDZ = oWorldZ - camPosZ;
            const baseDist = Math.max(1.5, Math.hypot(baseDX, baseDZ));
            const baseYaw = Math.atan2(baseDX, baseDZ) + sim.mouseLook.fightLookYaw;
            const basePitch = Math.atan2(baseDY, baseDist) - sim.mouseLook.fightLookPitch;

            _camLookTarget.set(
              camPosX + Math.sin(baseYaw) * Math.cos(basePitch) * baseDist,
              camPosY + Math.sin(basePitch) * baseDist,
              camPosZ + Math.cos(baseYaw) * Math.cos(basePitch) * baseDist
            );
            targetFov = sim.activeIntervention
              ? 68
              : human.action === 'special'
              ? 64
              : human.wPhaseTimerMs > 0
              ? 66
              : 56;
            fovDampSpeed = 18;
            targetDutchRoll =
              human.action === 'hitstun'
                ? 0.08
                : human.wPhaseTimerMs > 0
                ? 0.05 * human.wPhaseOffset
                : 0;
            camLerpSpeed = 28;
          } else {
            // Optional Side Arena Camera (Toggled via 'V' key or HUD button, with full 360° Mouse Orbit & Scroll Zoom!)
            const baseDist = THREE.MathUtils.clamp(
              4.45 + sep * 0.45 + sim.mouseLook.fightCamDistOffset,
              2.2,
              11.5
            );
            const orbitYaw = sim.mouseLook.fightLookYaw;
            const orbitPitch = THREE.MathUtils.clamp(0.22 + sim.mouseLook.fightLookPitch, -0.15, 1.15);
            const horizDist = Math.cos(orbitPitch) * baseDist;
            _camTargetPos.set(
              midX + Math.sin(orbitYaw) * horizDist,
              baseStageY + Math.max(0.45, 1.1 + Math.sin(orbitPitch) * baseDist),
              midZ + Math.cos(orbitYaw) * horizDist
            );
            _camLookTarget.set(midX, midY, midZ);
            targetFov = 38;
            fovDampSpeed = 12;
            targetDutchRoll = 0;
            camLerpSpeed = 12;
          }

          // If combatCameraMode just switched between first_person and side_arena, snap camera immediately
          // so it never flies through the back of a warrior's helmet or across bystander pieces!
          if (sim.combatCameraMode !== prevCombatCamMode) {
            prevCombatCamMode = sim.combatCameraMode;
            camera.position.copy(_camTargetPos);
            sim.currentLookAt.copy(_camLookTarget);
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

          // 4B. STRICT CAMERA SIGHTLINE & PROXIMITY OCCLUSION GUARD:
          // Guarantees no 3D fighter or bystander chess piece can EVER sit in front of the camera lens
          // and cast a black silhouette across the viewport during any fight phase!
          for (const [f, rig] of fighterPairs) {
            if (!rig) continue;
            const distCamToFighter = Math.hypot(
              camera.position.x - rig.root.position.x,
              camera.position.z - rig.root.position.z
            );
            if (sim.phase === 'FIGHT_INTRO' && sim.introShotIndex === 0) {
              rig.root.visible = f === atk;
            } else if (sim.phase === 'FIGHT_INTRO' && sim.introShotIndex === 1) {
              rig.root.visible = f === def;
            } else if ((isFirstPersonActive && f === human) || distCamToFighter < 1.05) {
              rig.root.visible = false;
            } else {
              rig.root.visible = true;
            }
          }

          const camX = camera.position.x;
          const camZ = camera.position.z;
          const lookX = sim.currentLookAt.x;
          const lookZ = sim.currentLookAt.z;
          const rayDX = lookX - camX;
          const rayDZ = lookZ - camZ;
          const rayLenSq = rayDX * rayDX + rayDZ * rayDZ;

          for (const piece of sim.pieces) {
            if (piece.id === atk.piece.id || piece.id === def.piece.id) continue;
            const rig = sim.pieceRigs.get(piece.id);
            if (!rig) continue;

            // Hide all bystanders during extreme eye Crash-Zooms or Subterranean Realm Duels so the lens is 100% clear
            if (
              sim.duelInRealm ||
              (sim.phase === 'FIGHT_INTRO' && (sim.introShotIndex === 0 || sim.introShotIndex === 1))
            ) {
              rig.root.visible = false;
              continue;
            }

            const px = rig.root.position.x;
            const pz = rig.root.position.z;
            const distToCam = Math.hypot(px - camX, pz - camZ);
            const distToStage = Math.hypot(
              px - sim.duelCenterWorld.x,
              pz - sim.duelCenterWorld.z
            );

            // Distance from piece to the camera -> lookAt sightline segment
            let tProj = rayLenSq > 0.0001 ? ((px - camX) * rayDX + (pz - camZ) * rayDZ) / rayLenSq : 0;
            tProj = Math.max(-0.15, Math.min(1.25, tProj));
            const closestX = camX + tProj * rayDX;
            const closestZ = camZ + tProj * rayDZ;
            const distToSightline = Math.hypot(px - closestX, pz - closestZ);

            const isInterveningSupporter =
              sim.activeIntervention?.supporter.pieceId === piece.id;

            // Hide any bystander that is close to the camera lens, inside the sightline corridor, or inside the duel stage!
            if (
              distToCam < 2.85 ||
              (tProj > -0.1 && tProj < 1.15 && distToSightline < 2.35) ||
              (!isInterveningSupporter && distToStage < 4.35)
            ) {
              rig.root.visible = false;
            } else {
              rig.root.visible = true;
            }
          }

          // 5. BATTLE-WORN CRITICAL DUEL SHADER, 3D ARENA FLOOR FRACTURES & LOCALIZED SMOKE (< 30% HP)
          const atkHpRatio = atk.hp / Math.max(1, atk.maxHp);
          const defHpRatio = def.hp / Math.max(1, def.maxHp);
          const minHpRatio = Math.min(atkHpRatio, defHpRatio);

          if (minHpRatio < 0.3) {
            const targetScar = Math.min(1.0, (0.3 - minHpRatio) / 0.22 + 0.38);
            battleWornIntensity = THREE.MathUtils.damp(
              battleWornIntensity,
              targetScar,
              7,
              rawDelta
            );
            battleWornPulse = THREE.MathUtils.damp(battleWornPulse, 0, 5, rawDelta);

            arenaRig.duelFloorScarMesh.visible = battleWornIntensity > 0.01;
            arenaRig.duelFloorScarUniforms.uTime.value = elapsed;
            arenaRig.duelFloorScarUniforms.uIntensity.value = battleWornIntensity;

            battleSmokeTimer += rawDelta;
            if (battleSmokeTimer >= 0.065) {
              battleSmokeTimer = 0;
              if (atkHpRatio < 0.3) {
                spawnBattleSmoke(
                  vfxPool,
                  atkWorldX,
                  atkWorldY + 0.85,
                  atkWorldZ,
                  battleWornIntensity,
                  0xf59e0b
                );
              }
              if (defHpRatio < 0.3) {
                spawnBattleSmoke(
                  vfxPool,
                  defWorldX,
                  defWorldY + 0.85,
                  defWorldZ,
                  battleWornIntensity,
                  0xf43f5e
                );
              }
              // Emit localized smoke & cinders rising from the fractured duel arena floor!
              const crackAngle = Math.random() * Math.PI * 2;
              const crackRad = 0.6 + Math.random() * 2.8;
              spawnBattleSmoke(
                vfxPool,
                sim.duelCenterWorld.x + Math.cos(crackAngle) * crackRad,
                baseStageY + 0.06,
                sim.duelCenterWorld.z + Math.sin(crackAngle) * crackRad * 0.65,
                battleWornIntensity * 0.85,
                0xf59e0b
              );
            }
          } else {
            battleWornIntensity = THREE.MathUtils.damp(battleWornIntensity, 0, 8, rawDelta);
            battleWornPulse = THREE.MathUtils.damp(battleWornPulse, 0, 8, rawDelta);
            arenaRig.duelFloorScarMesh.visible = battleWornIntensity > 0.01;
            arenaRig.duelFloorScarUniforms.uIntensity.value = battleWornIntensity;
          }

          hudSyncAccumulator += rawDelta;
          if (hudSyncAccumulator >= 0.05) {
            hudSyncAccumulator = 0;
            setHudAttacker({ ...atk });
            setHudDefender({ ...def });
            setFightTimer(sim.fightTimer);
          }
        }
      } else if (
        sim.phase === 'REALM_DESCENT' ||
        sim.phase === 'REALM_EXPLORATION' ||
        sim.phase === 'REALM_ASCENT'
      ) {
        // ============================================================================
        // SUBTERRANEAN IMPOSSIBLE REALMS: DESCENT, 3RD-PERSON EXPLORATION & ASCENT
        // ============================================================================
        const rm = sim.realm;
        const exploringPiece = sim.pieces.find((p) => p.id === rm.travelerPieceId) || null;
        const playerRig = rm.travelerPieceId ? sim.pieceRigs.get(rm.travelerPieceId) : undefined;
        const realmMeta = REALM_METADATA[rm.currentRealmId];
        const realmCenter = realmMeta.worldCenter;

        if (sim.firstPersonRig) sim.firstPersonRig.root.visible = false;
        arenaRig.tesseractLines.visible = false;
        arenaRig.entanglementHelixLines.visible = false;
        arenaRig.spotAttacker.intensity = THREE.MathUtils.damp(arenaRig.spotAttacker.intensity, 0, 10, rawDelta);
        arenaRig.spotDefender.intensity = THREE.MathUtils.damp(arenaRig.spotDefender.intensity, 0, 10, rawDelta);

        sim.phaseTimer += rawDelta;

        if (sim.phase === 'REALM_DESCENT') {
          const t = Math.min(1, sim.phaseTimer / 1.15);
          const smoothT = t * t * (3 - 2 * t);

          const entryGateway = BOARD_GATEWAYS.find((g) => g.id === rm.entryGatewayId) || BOARD_GATEWAYS[0];
          boardToWorld(entryGateway.row, entryGateway.col, _vec3A);

          const dstX = realmCenter.x + rm.localPos.x;
          const dstY = realmCenter.y + 0.05;
          const dstZ = realmCenter.z + rm.localPos.z;

          const curX = THREE.MathUtils.lerp(_vec3A.x, dstX, smoothT);
          const curY = THREE.MathUtils.lerp(0.2, dstY, smoothT);
          const curZ = THREE.MathUtils.lerp(_vec3A.z, dstZ, smoothT);

          if (playerRig) {
            playerRig.root.visible = true;
            playerRig.root.position.set(curX, curY, curZ);
            playerRig.root.scale.setScalar(THREE.MathUtils.lerp(1.0, 1.32, smoothT));
            playerRig.root.rotation.y = rm.yaw + (1 - smoothT) * Math.PI * 2;
          }

          _camTargetPos.set(curX, curY + 3.2 + (1 - smoothT) * 2.5, curZ + 5.8);
          _camLookTarget.set(curX, curY + 0.9, curZ - 1.5);
          camera.position.lerp(_camTargetPos, 1 - Math.exp(-14 * rawDelta));
          sim.currentLookAt.lerp(_camLookTarget, 1 - Math.exp(-16 * rawDelta));
          camera.lookAt(sim.currentLookAt);
          camera.fov = THREE.MathUtils.damp(camera.fov, 54, 10, rawDelta);
          camera.updateProjectionMatrix();

          if (t >= 1) {
            sim.phase = 'REALM_EXPLORATION';
            sim.phaseTimer = 0;
            setPhase('REALM_EXPLORATION');
          }
        } else if (sim.phase === 'REALM_ASCENT') {
          const t = Math.min(1, sim.phaseTimer / 1.1);
          const smoothT = t * t * (3 - 2 * t);

          const entryGateway = BOARD_GATEWAYS.find((g) => g.id === rm.entryGatewayId) || BOARD_GATEWAYS[0];
          const exitCoord = rm.ascentTargetCoord || {
            row: entryGateway.row,
            col: entryGateway.col,
            z: entryGateway.z,
            w: entryGateway.w,
          };
          boardToWorld(exitCoord.row, exitCoord.col, _vec3A);

          const srcX = realmCenter.x + rm.localPos.x;
          const srcY = realmCenter.y + 0.5;
          const srcZ = realmCenter.z + rm.localPos.z;

          const curX = THREE.MathUtils.lerp(srcX, _vec3A.x, smoothT);
          const curY = THREE.MathUtils.lerp(srcY, 0.0, smoothT);
          const curZ = THREE.MathUtils.lerp(srcZ, _vec3A.z, smoothT);

          if (playerRig) {
            playerRig.root.visible = true;
            playerRig.root.position.set(curX, curY, curZ);
            playerRig.root.scale.setScalar(THREE.MathUtils.lerp(1.32, 1.0, smoothT));
            playerRig.root.rotation.y =
              (exploringPiece?.faction === 'w' ? Math.PI : 0) + (1 - smoothT) * Math.PI * 2;
          }

          _camTargetPos.set(curX, curY + 4.5 + smoothT * 5.0, curZ + 7.5);
          _camLookTarget.set(curX, curY + 0.6, curZ);
          camera.position.lerp(_camTargetPos, 1 - Math.exp(-14 * rawDelta));
          sim.currentLookAt.lerp(_camLookTarget, 1 - Math.exp(-16 * rawDelta));
          camera.lookAt(sim.currentLookAt);
          camera.fov = THREE.MathUtils.damp(camera.fov, 45, 10, rawDelta);
          camera.updateProjectionMatrix();

          if (t >= 1 && exploringPiece) {
            if (sim.realmsRig) {
              syncRealmEntities3D(sim.realmsRig, [], []);
            }

            exploringPiece.inRealm = null;
            exploringPiece.realmTraversals = (exploringPiece.realmTraversals ?? 0) + 1;
            const targetTimelineId =
              rm.ascentTargetTimelineId || sim.multiverse.activeTimelineId;
            rm.travelerPieceId = null;
            rm.nearbyPortal = null;
            rm.nearbyPortalEval = null;
            rm.ascentTargetTimelineId = null;
            setRealmTraveler(null);
            setNearbyPortal(null);
            setNearbyPortalEval(null);
            setRealmStatusBanner(null);

            let activeTraveler = exploringPiece;
            let targetEnemy = rm.ascentTargetEnemy;

            // If emerging through a TIMELINE_PORTAL into an alternate timeline!
            if (targetTimelineId !== sim.multiverse.activeTimelineId) {
              syncActiveBranchFromSim();
              const deployRes = transitionTravelerToTimeline(
                sim.multiverse,
                exploringPiece,
                sim.multiverse.activeTimelineId,
                targetTimelineId,
                exitCoord
              );
              const dstBranch = switchActiveTimeline(sim.multiverse, targetTimelineId);
              rebuildSceneRigsForTimeline(dstBranch);
              activeTraveler = deployRes.mergedTraveler;
              targetEnemy =
                sim.pieces.find(
                  (p) =>
                    p.id !== activeTraveler.id &&
                    p.faction !== activeTraveler.faction &&
                    p.row === exitCoord.row &&
                    p.col === exitCoord.col &&
                    p.z === exitCoord.z &&
                    p.w === exitCoord.w
                ) || null;
            }

            // Shift active slice view to the emergence square's 4D slice!
            sim.activeSliceW = exitCoord.w;
            sim.activeSliceZ = exitCoord.z;
            sim.targetMoveW = exitCoord.w;
            sim.targetMoveZ = exitCoord.z;
            setActiveSliceW(exitCoord.w);
            setActiveSliceZ(exitCoord.z);
            setTargetMoveW(exitCoord.w);
            setTargetMoveZ(exitCoord.z);

            if (targetEnemy && targetEnemy.faction !== activeTraveler.faction) {
              const ambushMove: MoveOption = {
                from: {
                  row: entryGateway.row,
                  col: entryGateway.col,
                  z: entryGateway.z,
                  w: entryGateway.w,
                },
                to: { ...exitCoord },
                isCapture: true,
                targetPiece: targetEnemy,
                dimensionType: 'REALM_PORTAL_TRAVERSAL',
                dimensionLabel: rm.ascentPortalName || realmMeta.title,
              };
              initiateCombatDuel(activeTraveler, ambushMove, false);
            } else {
              // Peaceful emergence onto the destination square — consumes 1 chess turn!
              activeTraveler.row = exitCoord.row;
              activeTraveler.col = exitCoord.col;
              activeTraveler.z = exitCoord.z;
              activeTraveler.w = exitCoord.w;
              activeTraveler.hasMoved = true;
              activeTraveler.history.push({
                row: exitCoord.row,
                col: exitCoord.col,
                z: exitCoord.z,
                w: exitCoord.w,
                turn: sim.turnNumber + 1,
              });

              if (
                activeTraveler.type === 'p' &&
                (activeTraveler.row === 0 || activeTraveler.row === 7)
              ) {
                activeTraveler.type = 'q';
                activeTraveler.maxHp = ARCHETYPES.q.maxHp;
                activeTraveler.hp = ARCHETYPES.q.maxHp;
                const oldRig = sim.pieceRigs.get(activeTraveler.id);
                if (oldRig && oldRig.root.parent) {
                  const parent = oldRig.root.parent;
                  parent.remove(oldRig.root);
                  const promotedRig = createArticulatedPiece('q', activeTraveler.faction);
                  parent.add(promotedRig.root);
                  sim.pieceRigs.set(activeTraveler.id, promotedRig);
                }
              }

              const fromSq = formatSquareName({ row: entryGateway.row, col: entryGateway.col });
              const toSq = formatSquareName(exitCoord);

              setBattleLogs((prev) => [
                {
                  id: `realm_emerge_${Date.now()}`,
                  turnNumber: sim.turnNumber,
                  summary: `Emerged from ${realmMeta.title} in ${sim.multiverse.activeTimelineId}: ${ARCHETYPES[activeTraveler.type].chessName} ${fromSq} → ${toSq}`,
                  detail: `Warrior HP ${activeTraveler.hp}/${activeTraveler.maxHp}, Meter ${Math.round(activeTraveler.meter)}%.${rm.isParityInverted ? ' Chiral Mirror Parity Active.' : ''}${rm.crucibleAnvilClaimed ? ' Hellfire Tempered.' : ''}`,
                  wasUpset: false,
                  winnerFaction: activeTraveler.faction,
                },
                ...prev.slice(0, 7),
              ]);

              const nextFaction: Faction = sim.turnFaction === 'w' ? 'b' : 'w';
              sim.turnFaction = nextFaction;
              sim.turnNumber += 1;
              syncActiveBranchFromSim();
              setMultiverseState({ ...sim.multiverse });
              sim.phase = 'CHESS_VIEW';
              if (sim.controls) sim.controls.enabled = true;
              setTurnFaction(nextFaction);
              setTurnNumber(sim.turnNumber);
              setPhase('CHESS_VIEW');
              syncBoardHighlights();

              if (!sim.autoPlayDemo && sim.gameMode === 'vs_ai' && nextFaction === 'b') {
                setTimeout(() => {
                  const currentSim = simRef.current;
                  if (
                    currentSim.autoPlayDemo ||
                    currentSim.phase !== 'CHESS_VIEW' ||
                    currentSim.turnFaction !== 'b'
                  )
                    return;
                  const aiDecision = chooseAIMove(currentSim.pieces, 'b');
                  if (aiDecision) {
                    executeChessMove(aiDecision.piece, aiDecision.move);
                  }
                }, 1000);
              }
            }
          }
        } else if (sim.phase === 'REALM_EXPLORATION' && exploringPiece) {
          // ======================================================================
          // REAL-TIME 3RD-PERSON REALM EXPLORATION, HAZARDS, ECHOES & SENTINELS
          // ======================================================================
          rm.portalCooldownSec = Math.max(0, rm.portalCooldownSec - rawDelta);
          rm.hazardCooldownSec = Math.max(0, rm.hazardCooldownSec - rawDelta);
          rm.attackAnimTimerSec = Math.max(0, rm.attackAnimTimerSec - rawDelta);
          rm.dashTimerSec = Math.max(0, rm.dashTimerSec - rawDelta);

          // 1. Third-Person WASD / Arrow Key Movement (or Auto-Play / Click-to-Steer navigation!)
          let moveX = 0;
          let moveZ = 0;
          if (sim.keysHeld['KeyW'] || sim.keysHeld['ArrowUp']) moveZ -= 1;
          if (sim.keysHeld['KeyS'] || sim.keysHeld['ArrowDown']) moveZ += 1;
          if (sim.keysHeld['KeyA'] || sim.keysHeld['ArrowLeft']) moveX -= 1;
          if (sim.keysHeld['KeyD'] || sim.keysHeld['ArrowRight']) moveX += 1;

          if (Math.hypot(moveX, moveZ) > 0.05) {
            rm.steerTargetPortalId = null;
          } else if (rm.steerTargetPortalId || sim.autoPlayDemo || (sim.gameMode === 'vs_ai' && exploringPiece.faction === 'b')) {
            const portals = getPortalsForRealm(rm.currentRealmId);
            const targetP =
              portals.find((p) => p.id === rm.steerTargetPortalId) ||
              portals.find((p) => {
                if (p.kind !== 'BOARD_ASCENT') return false;
                const ev = evaluatePortalBoardExit(
                  p,
                  exploringPiece,
                  sim.pieces,
                  rm.isParityInverted,
                  rm.crucibleAnvilClaimed
                );
                return ev && ev.status !== 'ALLY_OBSTRUCTED';
              }) ||
              portals[0];

            if (targetP) {
              const dx = targetP.localPos.x - rm.localPos.x;
              const dz = targetP.localPos.z - rm.localPos.z;
              const dist = Math.hypot(dx, dz);
              if (dist > 1.05) {
                moveX = dx / dist;
                moveZ = dz / dist;
              } else if (rm.portalCooldownSec <= 0) {
                handleTraverseRealmPortal(targetP);
              }
            }
          }

          const inputLen = Math.hypot(moveX, moveZ);
          const baseMoveSpeed = 6.4 * (rm.dashTimerSec > 0 ? 2.15 : 1.0);
          if (inputLen > 0.01) {
            moveX /= inputLen;
            moveZ /= inputLen;
            rm.velocity.x = moveX * baseMoveSpeed;
            rm.velocity.z = moveZ * baseMoveSpeed;
            const targetYaw = Math.atan2(moveX, moveZ);
            let diffYaw = targetYaw - rm.yaw;
            while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
            while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
            rm.yaw += diffYaw * Math.min(1, rawDelta * 14);
          } else {
            rm.velocity.x *= Math.exp(-14 * rawDelta);
            rm.velocity.z *= Math.exp(-14 * rawDelta);
          }

          rm.localPos.x = THREE.MathUtils.clamp(rm.localPos.x + rm.velocity.x * rawDelta, -16.8, 16.8);
          rm.localPos.z = THREE.MathUtils.clamp(rm.localPos.z + rm.velocity.z * rawDelta, -16.8, 16.8);

          // Vertical Jump & Gravity Physics
          if (rm.localPos.y > 0 || rm.velocity.y !== 0) {
            rm.localPos.y += rm.velocity.y * rawDelta;
            rm.velocity.y -= 24.0 * rawDelta;
            if (rm.localPos.y <= 0) {
              rm.localPos.y = 0;
              rm.velocity.y = 0;
            }
          }

          // 2. REALM II MECHANIC: THE ASHEN CRUCIBLE — MOLTEN LAVA CHANNELS, FORGE PISTONS & HELLFIRE ANVIL
          if (rm.currentRealmId === 'ASHEN_CRUCIBLE') {
            const haz = evaluateCrucibleHazards(rm.localPos.x, rm.localPos.z, elapsed);
            if (haz.nearHellfireAnvil && !rm.crucibleAnvilClaimed) {
              handleTemperAtCrucibleAnvil();
            } else if ((haz.inLavaRiver || haz.hitByForgePiston) && rm.localPos.y < 0.85 && rm.hazardCooldownSec <= 0) {
              rm.hazardCooldownSec = 0.95;
              const dmg = haz.hitByForgePiston ? 12 : 8;
              exploringPiece.hp = Math.max(10, exploringPiece.hp - dmg);
              exploringPiece.persistentBurnMs = Math.max(exploringPiece.persistentBurnMs ?? 0, 4000);
              soundEngine.playCrucibleHazard(false);
              spawnHitSparks(
                vfxPool,
                realmCenter.x + rm.localPos.x,
                realmCenter.y + rm.localPos.y + 0.8,
                realmCenter.z + rm.localPos.z,
                0xf97316,
                22
              );
              setRealmTraveler({ ...exploringPiece });
              setRealmStatusBanner(
                haz.hitByForgePiston
                  ? `CRUSHED BY TITANIC FORGE PISTON (-${dmg} HP & PERSISTENT BURN)!`
                  : `SCORCHED BY MOLTEN SLAG RIVER (-${dmg} HP & PERSISTENT BURN)!`
              );
            }
          }

          // 3. REALM III MECHANIC: THE ECHOING REMNANT — DETERMINISTIC CAUSALITY ECHO REPLAY & ABSORPTION
          if (rm.currentRealmId === 'ECHOING_REMNANT') {
            for (const echo of rm.echoes) {
              if (echo.consumed) continue;
              const ex = THREE.MathUtils.lerp(echo.startLocalPos.x, echo.endLocalPos.x, echo.progress);
              const ez = THREE.MathUtils.lerp(echo.startLocalPos.z, echo.endLocalPos.z, echo.progress);
              const distToEcho = Math.hypot(rm.localPos.x - ex, rm.localPos.z - ez);
              if (distToEcho < 1.95) {
                echo.consumed = true;
                if (echo.faction === exploringPiece.faction) {
                  exploringPiece.meter = Math.min(100, exploringPiece.meter + 18);
                  exploringPiece.hp = Math.min(exploringPiece.maxHp, exploringPiece.hp + 8);
                  soundEngine.playQuantumEntangle(false);
                  spawnAuraPillar(vfxPool, realmCenter.x + ex, realmCenter.z + ez, 0x38bdf8);
                  setRealmStatusBanner('ABSORBED ALLIED TEMPORAL ECHO (+18% METER, +8 HP)!');
                } else {
                  exploringPiece.persistentSlowMs = 3500;
                  soundEngine.playQuantumEntangle(true);
                  spawnShockwave(vfxPool, realmCenter.x + ex, realmCenter.y + 0.2, realmCenter.z + ez, 0xf43f5e, 4.0);
                  setRealmStatusBanner('INTERCEPTED BY ENEMY TEMPORAL ECHO — CHRONO-STASIS APPLIED!');
                }
                setRealmTraveler({ ...exploringPiece });
              }
            }
          }

          // 4. SUBTERRANEAN ENEMY SENTINEL PATROLS & REAL-TIME COMBAT ENCOUNTERS
          for (const sent of rm.sentinels) {
            if (sent.defeated || sent.realmId !== rm.currentRealmId) continue;
            const distToSent = Math.hypot(
              rm.localPos.x - sent.localPos.x,
              rm.localPos.z - sent.localPos.z
            );
            const engageRadius = rm.attackAnimTimerSec > 0 ? 3.35 : 2.15;
            if (distToSent < engageRadius) {
              const realmDuelMove: MoveOption = {
                from: { row: exploringPiece.row, col: exploringPiece.col, z: exploringPiece.z, w: exploringPiece.w },
                to: { row: sent.piece.row, col: sent.piece.col, z: sent.piece.z, w: sent.piece.w },
                isCapture: true,
                targetPiece: sent.piece,
                dimensionType: 'REALM_GATEWAY_DESCENT',
              };
              initiateCombatDuel(exploringPiece, realmDuelMove, false, {
                x: realmCenter.x + (rm.localPos.x + sent.localPos.x) * 0.5,
                y: realmCenter.y,
                z: realmCenter.z + (rm.localPos.z + sent.localPos.z) * 0.5,
                realmTitle: realmMeta.title,
                sentinelId: sent.id,
              });
              break;
            }
          }

          // 5. CHECK PORTAL PROXIMITY & PHYSICAL THRESHOLD CROSSING
          const realmPortals = getPortalsForRealm(rm.currentRealmId);
          let closestPortal: RealmPortalNode | null = null;
          let closestPortalDist = 3.4;
          for (const pNode of realmPortals) {
            const d = Math.hypot(rm.localPos.x - pNode.localPos.x, rm.localPos.z - pNode.localPos.z);
            if (d < closestPortalDist) {
              closestPortalDist = d;
              closestPortal = pNode;
            }
            if (d < 1.35 && rm.portalCooldownSec <= 0) {
              handleTraverseRealmPortal(pNode);
              break;
            }
          }

          if (closestPortal?.id !== rm.nearbyPortal?.id) {
            rm.nearbyPortal = closestPortal;
            const evalRes =
              closestPortal &&
              (closestPortal.kind === 'BOARD_ASCENT' || closestPortal.kind === 'TIMELINE_PORTAL')
                ? (() => {
                    const targetTlId =
                      closestPortal.kind === 'TIMELINE_PORTAL' && closestPortal.targetTimelineId
                        ? closestPortal.targetTimelineId === sim.multiverse.activeTimelineId
                          ? 'TL-PRIME'
                          : closestPortal.targetTimelineId
                        : sim.multiverse.activeTimelineId;
                    const tBranch =
                      ensureBranchHydrated(sim.multiverse, targetTlId) ||
                      ensureBranchHydrated(sim.multiverse, 'TL-PRIME')!;
                    const targetPieces =
                      targetTlId === sim.multiverse.activeTimelineId
                        ? sim.pieces
                        : tBranch.pieces;
                    return evaluatePortalBoardExit(
                      closestPortal,
                      exploringPiece,
                      targetPieces,
                      rm.isParityInverted,
                      rm.crucibleAnvilClaimed,
                      tBranch.name
                    );
                  })()
                : null;
            rm.nearbyPortalEval = evalRes;
            setNearbyPortal(closestPortal);
            setNearbyPortalEval(evalRes);
          }

          // 6. POSITION & ANIMATE THE PLAYER'S 3D WARRIOR RIG IN THE REALM
          if (playerRig) {
            playerRig.root.visible = true;
            playerRig.root.position.set(
              realmCenter.x + rm.localPos.x,
              realmCenter.y + rm.localPos.y,
              realmCenter.z + rm.localPos.z
            );
            playerRig.root.scale.setScalar(1.32);
            playerRig.root.rotation.y = rm.yaw + Math.PI;

            const isMoving = Math.hypot(rm.velocity.x, rm.velocity.z) > 0.35;
            const walkCycle = elapsed * 12;
            playerRig.leftLegPivot.rotation.x = isMoving ? Math.sin(walkCycle) * 0.55 : 0;
            playerRig.rightLegPivot.rotation.x = isMoving ? -Math.sin(walkCycle) * 0.55 : 0;
            playerRig.bodyPivot.position.y =
              0.18 + (isMoving ? Math.abs(Math.sin(walkCycle)) * 0.05 : Math.sin(elapsed * 2.5) * 0.02);

            if (rm.attackAnimTimerSec > 0) {
              const swingT = 1 - rm.attackAnimTimerSec / 0.42;
              playerRig.rightArmPivot.rotation.set(-1.8 + Math.sin(swingT * Math.PI) * 2.2, 0, -0.2);
            } else {
              playerRig.rightArmPivot.rotation.set(
                isMoving ? -Math.sin(walkCycle) * 0.35 : -0.18,
                0,
                -0.08
              );
            }
            playerRig.leftArmPivot.rotation.set(
              isMoving ? Math.sin(walkCycle) * 0.35 : -0.14,
              0,
              0.08
            );
            playerRig.capePivot.rotation.x =
              0.22 + (isMoving ? 0.35 + Math.sin(walkCycle * 1.5) * 0.12 : Math.sin(elapsed * 2.5) * 0.05);

            const hpRatio = exploringPiece.hp / Math.max(1, exploringPiece.maxHp);
            playerRig.vitalityHaloMesh.visible = true;
            playerRig.vitalityHaloUniforms.uTime.value = elapsed;
            playerRig.vitalityHaloUniforms.uHpRatio.value = hpRatio;
            playerRig.vitalityHaloUniforms.uRecoverableRatio.value = hpRatio;
            playerRig.vitalityHaloUniforms.uGuardRatio.value = rm.isParityInverted ? 1.0 : 0.85;
            playerRig.vitalityHaloUniforms.uSpecialReady.value =
              exploringPiece.meter >= ARCHETYPES[exploringPiece.type].special.meterCost ? 1.0 : 0.0;
          }

          // 7. THIRD-PERSON FOLLOW & 360° MOUSE-LOOK CAMERA INSIDE THE SUBTERRANEAN REALM
          const totalRealmYaw = rm.yaw + sim.mouseLook.realmCamYawOffset;
          const rDist = sim.mouseLook.realmCamDistance;
          const rPitch = THREE.MathUtils.clamp(sim.mouseLook.realmCamPitch, -0.2, 1.15);
          const rHoriz = Math.cos(rPitch) * rDist;
          const camBackX = -Math.sin(totalRealmYaw) * rHoriz;
          const camBackZ = -Math.cos(totalRealmYaw) * rHoriz;
          _camTargetPos.set(
            realmCenter.x + rm.localPos.x + camBackX,
            realmCenter.y + rm.localPos.y + Math.max(0.6, 1.1 + Math.sin(rPitch) * rDist),
            realmCenter.z + rm.localPos.z + camBackZ
          );
          _camLookTarget.set(
            realmCenter.x + rm.localPos.x + Math.sin(totalRealmYaw) * 2.2,
            realmCenter.y + rm.localPos.y + 1.15,
            realmCenter.z + rm.localPos.z + Math.cos(totalRealmYaw) * 2.2
          );

          camera.position.lerp(_camTargetPos, 1 - Math.exp(-12 * rawDelta));
          sim.currentLookAt.lerp(_camLookTarget, 1 - Math.exp(-16 * rawDelta));
          camera.lookAt(sim.currentLookAt);
          camera.fov = THREE.MathUtils.damp(
            camera.fov,
            rm.dashTimerSec > 0 ? 64 : 52,
            12,
            rawDelta
          );
          camera.updateProjectionMatrix();
        }
      } else if (sim.phase === 'CAUSAL_COLLAPSE') {
        // ============================================================================
        // REALITY CONVERGENCE & CAUSAL ASSASSINATION COLLAPSE SEQUENCE ON THE 3D BOARD
        // ============================================================================
        sim.phaseTimer += rawDelta;
        const progress = Math.min(1, sim.phaseTimer / 2.4);
        const colRes = sim.activeCollapseResolution;
        const primaryErased = colRes?.[0]?.erasedPiece;

        if (primaryErased) {
          boardToWorld(primaryErased.row, primaryErased.col, _vec3A);
          const orbitAngle = sim.phaseTimer * 1.4;
          _camTargetPos.set(
            _vec3A.x + Math.sin(orbitAngle) * 4.2,
            3.2 + (1 - progress) * 1.5,
            _vec3A.z + Math.cos(orbitAngle) * 4.2 + 2.5
          );
          _camLookTarget.set(_vec3A.x, 0.9 + Math.sin(progress * Math.PI) * 0.8, _vec3A.z);
          camera.position.lerp(_camTargetPos, 1 - Math.exp(-10 * rawDelta));
          sim.currentLookAt.lerp(_camLookTarget, 1 - Math.exp(-14 * rawDelta));
          camera.lookAt(sim.currentLookAt);
          camera.fov = THREE.MathUtils.damp(camera.fov, 34, 10, rawDelta);
          camera.updateProjectionMatrix();

          if (Math.random() < rawDelta * 18) {
            spawnHitSparks(
              vfxPool,
              _vec3A.x + (Math.random() - 0.5) * 0.8,
              0.8 + progress * 1.2,
              _vec3A.z + (Math.random() - 0.5) * 0.8,
              0xd946ef,
              8
            );
          }
        }

        // Levitate, twist, and implode the doomed 3D rig(s) in a quantum singularity!
        for (const dRig of sim.collapseDoomedRigs) {
          dRig.root.position.y = Math.sin(progress * Math.PI * 0.8) * 1.85;
          dRig.root.rotation.y += rawDelta * (8 + progress * 24);
          dRig.root.rotation.z = Math.sin(elapsed * 28) * 0.35 * progress;
          const shrink = Math.max(0.01, 1.0 - Math.pow(progress, 2.2));
          dRig.root.scale.setScalar(shrink);
        }

        if (sim.phaseTimer >= 2.4) {
          for (const dRig of sim.collapseDoomedRigs) {
            dRig.root.parent?.remove(dRig.root);
          }
          sim.collapseDoomedRigs = [];

          const regicideItem = colRes?.find((r) => r.erasedPiece.type === 'k');
          if (regicideItem) {
            setWarVictor({
              faction: regicideItem.event.killerFaction,
              reason: `Multiversal Regicide! The Eternal Monarch's lineage [${regicideItem.event.victimLineageId}] was assassinated in ${regicideItem.event.sourceTimelineName} and erased from ${regicideItem.targetTimelineName} during Reality Convergence!`,
            });
            confetti({ particleCount: 140, spread: 95, origin: { y: 0.5 } });
          }

          sim.activeCollapseResolution = null;
          sim.phase = 'CHESS_VIEW';
          if (sim.controls) sim.controls.enabled = true;
          setPhase('CHESS_VIEW');
          setActiveCollapseBanner(null);
          syncBoardHighlights();
        }
      }

      // Update & Render Live Perspective-Correct Portals (WebGLRenderTarget RTT) for both Board Gateways and Subterranean Realm Portals!
      if (sim.realmsRig && sim.phase !== 'ACADEMIC_SIMULATOR') {
        const exploringPiece = sim.realm.travelerPieceId
          ? sim.pieces.find((p) => p.id === sim.realm.travelerPieceId) ?? null
          : null;

        updateSubterraneanRealmsAndPortals(
          renderer,
          scene,
          camera,
          sim.realmsRig,
          elapsed,
          rawDelta,
          sim.phase,
          sim.realm.currentRealmId,
          exploringPiece,
          sim.pieces,
          sim.realm.isParityInverted,
          sim.realm.crucibleAnvilClaimed,
          sim.realm.echoes,
          sim.realm.sentinels
        );
      }

      // Update the Colossal 3D Multiversal Pocket Watch & its Horological Audio State!
      if (sim.pocketWatchRig && sim.phase !== 'ACADEMIC_SIMULATOR') {
        updateMultiversalPocketWatch(
          sim.pocketWatchRig,
          sim.multiverse,
          elapsed,
          rawDelta,
          sim.imminentParadoxWarning,
          sim.duelOnWatch
        );
        const watchMetrics = computeMultiverseParadoxMetrics(sim.multiverse);
        soundEngine.setWatchParadoxState(
          watchMetrics.visitedCount,
          watchMetrics.paradoxStrain,
          sim.imminentParadoxWarning
        );
      }

      if (battleWornPass) {
        battleWornPass.uniforms.uTime.value = elapsed;
        battleWornPass.uniforms.uIntensity.value = battleWornIntensity;
        battleWornPass.uniforms.uCriticalPulse.value = battleWornPulse;
      }

      if (bloomPass) {
        const isUni = sim.phase === 'ACADEMIC_SIMULATOR';
        bloomPass.strength = isUni ? 0.06 : 0.18;
        bloomPass.threshold = isUni ? 0.94 : 0.88;
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
  }, [
    addCallout,
    executeChessMove,
    executeFighterIntervention,
    handleRealmAction,
    handleResetGame,
    handleTemperAtCrucibleAnvil,
    handleToggleAutoPlayDemo,
    handleTraverseRealmPortal,
    initiateCombatDuel,
    syncBoardHighlights,
  ]);

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
    } else if (preset === 'pocket_watch') {
      // Tilt upward from the chessboard to frame the Colossal Multiversal Pocket Watch in the sky!
      cam.position.set(0, 5.2, 8.8);
      controls.target.set(0, 16.2, -13.2);
    }
    controls.update();
  };

  const handleHoverTimelineOnWatch = useCallback((timelineId: string | null) => {
    const sim = simRef.current;
    sim.multiverse.hoveredTimelineId = timelineId;
  }, []);

  // Playable 5-Stage Multiversal Pocket Watch Evolution Showcase (Requirement 11)
  // Drives genuine multiverse state changes while framing the colossal 3D Pocket Watch above the board!
  const handleAdvanceWatchShowcase = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase !== 'CHESS_VIEW') return;
    if (!soundEngine.muted) {
      soundEngine.startMusic();
    }

    // Ensure camera is tilted up looking at the Colossal Pocket Watch
    handleSelectCameraPreset('pocket_watch');

    const nextStep = (watchShowcaseStep % 5) + 1;
    setWatchShowcaseStep(nextStep);

    if (nextStep === 1) {
      // Stage 1: Prime Timeline — Simple Watch with 1 Hand, record initial Remembered Square at E4
      const primeBranch = switchActiveTimeline(sim.multiverse, 'TL-PRIME');
      const e2Pawn = primeBranch.pieces.find((p) => p.faction === 'w' && p.type === 'p' && p.col === 4);
      if (e2Pawn) {
        recordRememberedSquare(
          sim.multiverse,
          e2Pawn,
          { row: 4, col: 4, z: 0, w: 0 },
          'TL-PRIME',
          1
        );
      }
      rebuildSceneRigsForTimeline(primeBranch);
      soundEngine.playChessSelect();
      setWatchEventBanner({
        title: 'STAGE 1/5 · PRIME REALITY (1 HAND ON THE WATCH)',
        subtitle: 'The watch begins simple over TL-PRIME. Square E4 is recorded in the Remembered-Square ledger.',
      });
    } else if (nextStep === 2) {
      // Stage 2: Enter Timeline Ω-1 -> A 2nd Hand materializes & swings into place!
      const omega1 = switchActiveTimeline(sim.multiverse, 'TL-OMEGA-1');
      rebuildSceneRigsForTimeline(omega1);
      soundEngine.playWatchHandForged();
      if (sim.pocketWatchRig) {
        triggerPocketWatchReaction(sim.pocketWatchRig, 0x38bdf8, 'TL-OMEGA-1', false);
      }
      setWatchEventBanner({
        title: 'STAGE 2/5 · ENTERED TIMELINE Ω-1 (2ND HAND FORGED)',
        subtitle: 'Entering Timeline Ω-1 awakens its Astral Cyan hand, unlocks the outer astrolabe ring, and aligns the Center Jewel Beam.',
      });
    } else if (nextStep === 3) {
      // Stage 3: Visit Timeline Ω-2 and Fork Timeline Ω-3 -> 3rd & 4th Hands accumulate!
      switchActiveTimeline(sim.multiverse, 'TL-OMEGA-2');
      const omega3 = forkTimelineFromBranch(sim.multiverse, 'TL-OMEGA-2', {
        customName: 'Timeline Ω-3 (Astral Divergence)',
      });
      const switched = switchActiveTimeline(sim.multiverse, omega3.id);
      rebuildSceneRigsForTimeline(switched);
      soundEngine.playWatchHandForged();
      if (sim.pocketWatchRig) {
        triggerPocketWatchReaction(sim.pocketWatchRig, 0x34d399, omega3.id, false);
      }
      setWatchEventBanner({
        title: `STAGE 3/5 · ${sim.multiverse.visitedTimelineIds.length} UNIVERSE HANDS & REMEMBERED SQUARES`,
        subtitle: `Visited Ω-2 and forked ${omega3.shortCode}. Multiple hands, memory trails, and 3 orbiting astrolabe rings now track the expanding multiverse.`,
      });
    } else if (nextStep === 4) {
      // Stage 4: Cross-Timeline Causal Assassination -> Victim Hand shudders, Causal Tether Arc forms, Doom Bell tolls!
      const omega1 = switchActiveTimeline(sim.multiverse, 'TL-OMEGA-1');
      const killer = omega1.pieces.find((p) => p.faction === 'w' && p.type === 'n') || omega1.pieces[0];
      const victim = omega1.pieces.find((p) => p.faction === 'b' && p.type === 'q') || omega1.pieces.find((p) => p.faction === 'b');
      if (killer && victim) {
        recordCausalAssassination(
          sim.multiverse,
          'TL-OMEGA-1',
          killer,
          victim,
          { row: victim.row, col: victim.col, z: victim.z, w: victim.w },
          omega1.turnNumber,
          `Cross-Timeline Causal Assassination of ${ARCHETYPES[victim.type].chessName} in Ω-1`,
          false
        );
      }
      rebuildSceneRigsForTimeline(omega1);
      soundEngine.playWatchDoomBell(false);
      if (sim.pocketWatchRig) {
        triggerPocketWatchReaction(sim.pocketWatchRig, 0xf43f5e, 'TL-OMEGA-1', true);
      }
      setWatchEventBanner({
        title: 'STAGE 4/5 · CROSS-TIMELINE ASSASSINATION & CAUSAL TETHER',
        subtitle: 'The Doom Bell tolls, the Ω-1 hand shudders violently, and a crimson 3D Causal Tether Arc links Ω-1 to Prime Reality!',
      });
    } else if (nextStep === 5) {
      // Stage 5: Lethal Remembered-Square Paradox Collision & Timeline Collapse!
      // A warrior in Ω-2 steps onto E4 (remembered from TL-PRIME) -> Fatal Paradox Strike + Timeline Collapse (Hand Cracks & Freezes!)
      const omega2 = switchActiveTimeline(sim.multiverse, 'TL-OMEGA-2');
      collapseTimelineBranch(
        sim.multiverse,
        'TL-OMEGA-2',
        'Paradox Exclusion Rupture: Warrior stepped onto Remembered Square E4 from Prime Reality'
      );
      rebuildSceneRigsForTimeline(omega2);
      soundEngine.playWatchDoomBell(true);
      if (sim.pocketWatchRig) {
        triggerPocketWatchReaction(sim.pocketWatchRig, 0xef4444, 'TL-OMEGA-2', true);
      }
      if (sim.vfxPool) {
        const e4World = boardToWorld(4, 4);
        spawnInterventionRift(sim.vfxPool, 0, 15.5, -12.5, e4World.x, 0.8, e4World.z, 0xef4444);
        spawnShockwave(sim.vfxPool, e4World.x, 0.15, e4World.z, 0xef4444, 7.5);
      }
      setWatchEventBanner({
        title: 'STAGE 5/5 · LETHAL REMEMBERED SQUARE & BROKEN TIMELINE HAND',
        subtitle: 'Timeline Ω-2 collapsed from a Remembered-Square Paradox Collision! Its hand on the watch has cracked at a 35° angle, turned to scorched iron, and fractured the crystal face.',
      });
    }

    setMultiverseState({ ...sim.multiverse });
  }, [rebuildSceneRigsForTimeline, watchShowcaseStep]);

  useEffect(() => {
    if (phase === 'ACADEMIC_SIMULATOR') {
      soundEngine.setMusicMood('ACADEMIC_OFFICE');
    } else if (phase === 'FIGHT_INTRO' || phase === 'FIGHT_ACTIVE' || phase === 'FIGHT_OUTRO') {
      soundEngine.setMusicMood('COMBAT');
    } else if (
      phase === 'REALM_DESCENT' ||
      phase === 'REALM_EXPLORATION' ||
      phase === 'REALM_ASCENT'
    ) {
      soundEngine.setMusicMood('REALM');
    } else if (multiverseState.activeTimelineId !== 'TL-PRIME') {
      soundEngine.setMusicMood('ALTERNATE_TIMELINE');
    } else {
      soundEngine.setMusicMood('CHESS');
    }
  }, [phase, multiverseState.activeTimelineId]);

  const toggleMute = () => {
    const next = !muted;
    soundEngine.muted = next;
    setMuted(next);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07090E] text-slate-100 select-none">
      {/* 1. Strict 3-Zone Top Navigation Bar Contract (Hidden when the Chess Universe has dissolved into the University of Greater Andromeda!) */}
      {phase !== 'ACADEMIC_SIMULATOR' && (
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
            onClick={() => setMultiverseModalOpen(true)}
            className="text-fuchsia-300 hover:text-fuchsia-200 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <GitBranch className="w-3.5 h-3.5 text-fuchsia-400" />
            Multiverse Nexus ({multiverseState.timelines.size} Realities)
          </button>
          <button
            onClick={() =>
              handleSelectCameraPreset(
                cameraPreset === 'pocket_watch' ? 'white_orbit' : 'pocket_watch'
              )
            }
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 font-semibold ${
              cameraPreset === 'pocket_watch'
                ? 'text-amber-300 underline'
                : 'text-amber-400 hover:text-amber-200'
            }`}
            title="Tilt camera upward to inspect the Colossal Multiversal Pocket Watch above the chessboard (C Key)"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            {cameraPreset === 'pocket_watch'
              ? 'Return to Board (C)'
              : `Cosmic Watch (${multiverseState.visitedTimelineIds.length} Hands)`}
          </button>
          <button
            onClick={handleTriggerGuidedAssassinationDemo}
            className="text-rose-300 hover:text-rose-200 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-rose-400" />
            Causal Assassination (Ω-1 → Prime)
          </button>
          <button
            onClick={() => handleTriggerRealmShowcase()}
            className="hover:text-cyan-300 text-cyan-400 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Impossible Realms
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
      )}

      {/* Director's Auto-Play Showcase Banner (Visible across Chess & Combat when Auto-Play Demo is active) */}
      {autoPlayDemo && (
        <div className="pointer-events-auto fixed top-[64px] right-6 z-30 bg-[#071318]/95 border border-emerald-400/70 rounded-xl px-4 py-2.5 shadow-[0_0_28px_rgba(16,185,129,0.25)] flex items-center gap-3.5 max-w-md">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>DIRECTOR&apos;S AUTO-PLAY SHOWCASE ACTIVE</span>
            </div>
            <div className="text-xs font-semibold text-white mt-0.5 truncate">
              {demoDirectorStage}
            </div>
          </div>
          <button
            onClick={handleToggleAutoPlayDemo}
            className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono font-bold text-[11px] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Stop Auto-Play Demo and immediately take manual control of the current board or duel (P Key)"
          >
            Take Control (P)
          </button>
        </div>
      )}

      {/* Dramatic Reality Convergence / Causal Collapse Cinematic Overlay */}
      {phase === 'CAUSAL_COLLAPSE' && activeCollapseBanner && activeCollapseBanner.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-[74px] z-40 flex flex-col items-center px-4">
          <div className="bg-[#0B0616]/95 border-2 border-fuchsia-400 rounded-2xl px-8 py-4 shadow-[0_0_60px_rgba(217,70,239,0.55)] text-center max-w-2xl">
            <div className="text-xs font-mono font-bold tracking-[0.22em] text-fuchsia-300 uppercase flex items-center justify-center gap-2">
              <Skull className="w-4 h-4 text-rose-400 animate-bounce" />
              <span>CAUSAL ASSASSINATION CONVERGING ACROSS REALITIES</span>
              <Skull className="w-4 h-4 text-rose-400 animate-bounce" />
            </div>
            <div className="font-display text-2xl font-extrabold text-white mt-1">
              {activeCollapseBanner
                .map((item) => ARCHETYPES[item.erasedPiece.type].chessName)
                .join(', ')}{' '}
              Erased From {activeCollapseBanner[0].targetTimelineName}!
            </div>
            <div className="mt-2 space-y-1">
              {activeCollapseBanner.map((item) => (
                <div key={item.erasedPiece.id} className="text-xs font-mono text-rose-300">
                  Lineage <span className="text-amber-300 font-bold">[{item.event.victimLineageId}]</span> shattered:{' '}
                  <span className="text-white font-bold">
                    {ARCHETYPES[item.erasedPiece.type].warriorTitle} ({ARCHETYPES[item.erasedPiece.type].chessName})
                  </span>{' '}
                  erased from Square <span className="text-fuchsia-300 font-bold">{item.erasedSquareLabel}</span>!
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Isolated 3D WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        className={`absolute inset-0 z-0 w-full ${
          phase === 'ACADEMIC_SIMULATOR'
            ? 'top-0 h-screen'
            : 'top-[53px] h-[calc(100vh-53px)] cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* 3. Whisper-Quiet Story Chronicle & Multiverse Reality Switcher Strip (during CHESS_VIEW) */}
      {phase === 'CHESS_VIEW' && (
        <div className="pointer-events-none fixed top-[66px] left-6 z-20 flex flex-col gap-2.5 max-w-md">
          {/* Chapter, Active Reality & Quick Branch Switcher */}
          <div className="pointer-events-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] bg-[#080B14]/85 border border-slate-800/90 rounded-xl px-4 py-2.5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[11px] tracking-[0.16em] text-amber-400/90 uppercase font-bold">
                {timelineBranchLabel} · Turn {turnNumber}
              </div>
              <button
                onClick={() => setMultiverseModalOpen(true)}
                className="px-2.5 py-0.5 rounded bg-fuchsia-500/20 hover:bg-fuchsia-500/35 border border-fuchsia-400/60 text-[10px] font-mono font-bold text-fuchsia-200 flex items-center gap-1 cursor-pointer transition-colors"
                title="Open Multiverse Causal Nexus & Lineage Inspector (M Key)"
              >
                <GitBranch className="w-3 h-3" />
                Multiverse (M)
              </button>
            </div>

            <div className="font-display text-base font-bold text-white tracking-wide mt-0.5">
              {activeSliceW !== 0 || activeSliceZ !== 0
                ? `Across the ${formatWName(activeSliceW)} Horizon`
                : turnFaction === 'w'
                ? 'The Solaris Order Commands the Field'
                : 'The Obsidian Dominion Advances'}
            </div>

            {/* Quick Parallel Reality Switcher (Hovering highlights the corresponding hand on the 3D Pocket Watch!) */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 mr-0.5">Realities:</span>
              {Array.from(multiverseState.timelines.values())
                .slice(0, 6)
                .map((br) => {
                  const isCur = br.id === multiverseState.activeTimelineId;
                  const unprop = getPendingCausalBreachesForTimeline(multiverseState, br.id);
                  return (
                    <button
                      key={br.id}
                      onClick={() => handleSwitchTimeline(br.id)}
                      onMouseEnter={() => handleHoverTimelineOnWatch(br.id)}
                      onMouseLeave={() => handleHoverTimelineOnWatch(null)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer flex items-center gap-1 ${
                        br.isCollapsed
                          ? 'bg-rose-950/90 text-rose-300 border border-rose-500/60 line-through'
                          : isCur
                          ? 'bg-fuchsia-500 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
                      }`}
                      title={`${br.name}: ${br.divergenceSummary} (Hover to highlight hand on Cosmic Watch)`}
                    >
                      <span>{br.shortCode}</span>
                      {unprop.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Multiversal Pocket Watch & Remembered-Square Ledger Bar */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-300">
              <span>
                Watch Hands: <strong className="text-amber-300">{multiverseState.visitedTimelineIds.length}</strong> · Remembered Sq:{' '}
                <strong className="text-rose-300">{multiverseState.rememberedSquares.length}</strong>
              </span>
              <button
                onClick={handleAdvanceWatchShowcase}
                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 text-amber-200 font-bold cursor-pointer transition-colors"
                title="Step through the 5-stage Multiversal Pocket Watch Evolution Showcase"
              >
                {watchShowcaseStep === 0
                  ? 'Watch Showcase →'
                  : `Watch Stage ${watchShowcaseStep}/5 →`}
              </button>
            </div>

            {watchEventBanner && (
              <div className="mt-2 bg-[#140C1C]/95 border-l-2 border-amber-400 pl-2.5 py-1.5 pr-2 rounded-r-lg">
                <div className="text-[10px] font-mono font-bold text-amber-300">
                  {watchEventBanner.title}
                </div>
                <div className="text-[10px] text-slate-300 leading-snug mt-0.5">
                  {watchEventBanner.subtitle}
                </div>
              </div>
            )}

            {/* If an alternate-timeline Causal Assassination is ready to converge into Prime Reality, show 1-click Convergence CTA! */}
            {getPendingCausalBreachesForTimeline(multiverseState, 'TL-PRIME').length > 0 && (
              <button
                onClick={() => handleTriggerConvergence('TL-PRIME')}
                className="mt-2 w-full px-3 py-1.5 bg-gradient-to-r from-fuchsia-500 to-rose-500 hover:from-fuchsia-400 hover:to-rose-400 text-slate-950 font-mono font-bold text-[11px] rounded-lg flex items-center justify-center gap-1.5 shadow-lg animate-pulse cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Converge Causal Assassination Into Prime Reality!
              </button>
            )}

            {canRewindTimeline && (
              <button
                onClick={handleChronoRewind}
                className="mt-1.5 w-full px-3 py-1 bg-cyan-950/85 hover:bg-cyan-900 border border-cyan-400/40 rounded-lg text-[11px] font-mono text-cyan-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Rewind spacetime causality by 1 turn and fork a parallel timeline branch"
              >
                <RotateCcw className="w-3 h-3 text-cyan-300" />
                Rewind Causality (Δt = -1)
              </button>
            )}
          </div>

          {/* Unseen 4D Cross-Dimensional Threat Whisper */}
          {unseenThreats.length > 0 && (
            <div className="pointer-events-auto bg-[#090616]/85 border-l-2 border-purple-400 pl-3 py-1.5 pr-3 rounded-r-lg">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-purple-300">
                <AlertTriangle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>
                  Shadow from {formatWName(unseenThreats[0].attacker.w)} threatens{' '}
                  {formatSquareName({ row: unseenThreats[0].targetRow, col: unseenThreats[0].targetCol })}
                </span>
              </div>
              <button
                onClick={() =>
                  handleSelect4DSlice(unseenThreats[0].attacker.w, unseenThreats[0].attacker.z, true)
                }
                className="mt-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
              >
                Shift Gaze to {formatWName(unseenThreats[0].attacker.w)}
              </button>
            </div>
          )}

          {/* Selected Warrior Story, Multiversal Synod & 4D Tunneling Strip */}
          {selectedPiece && (() => {
            const condRatio = selectedPiece.hp / Math.max(1, selectedPiece.maxHp);
            const conditionStory =
              condRatio > 0.75
                ? 'Radiant & Unscathed'
                : condRatio > 0.35
                ? 'Armor Scored in Battle'
                : 'Pauldrons Sundered · Embers Rising';
            const reachableGatewayMove = simRef.current.validMoves.find(
              (m) => m.dimensionType === 'REALM_GATEWAY_DESCENT'
            );
            const counterparts = getCounterpartManifestationsForPiece(
              multiverseState,
              selectedPiece,
              multiverseState.activeTimelineId,
              simRef.current.pieces
            );
            return (
              <div className="pointer-events-auto bg-[#0B0E17]/85 border border-slate-800/90 rounded-xl px-3.5 py-2.5 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                      <span>
                        { academicColloquium?.active
                          ? `🎓 ${getProfessorPersona(selectedPiece).academicTitle}`
                          : selectedPiece.isSentientTheorem
                          ? '⊢ Sentient Mathematical Theorem'
                          : ARCHETYPES[selectedPiece.type].warriorTitle }
                      </span>
                      {selectedPiece.isSentientTheorem && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                            selectedPiece.theoremStatus === 'PUBLISHED'
                              ? 'bg-sky-400/25 border border-sky-300/80 text-sky-200'
                              : 'bg-amber-400/25 border border-amber-300/80 text-amber-200'
                          }`}
                        >
                          {selectedPiece.theoremStatus === 'PUBLISHED'
                            ? '⊢ PUBLISHED Q.E.D.'
                            : '🎓 PREPRINT UNDER PEER REVIEW'}
                        </span>
                      )}
                      {selectedPiece.isChronocrator && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/70 text-[9px] font-mono text-amber-300">
                          ⌚ CHRONOCRATOR
                        </span>
                      )}
                      {Boolean(selectedPiece.synodStacks && selectedPiece.synodStacks > 0) && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-400/20 border border-cyan-400/70 text-[9px] font-mono text-cyan-200">
                          ✦ SYNOD ×{selectedPiece.synodStacks}
                        </span>
                      )}
                    </div>
                    {selectedPiece.theoremAxiom && (
                      <div className="text-[10px] font-mono font-bold text-sky-300 mt-0.5">
                        {selectedPiece.theoremAxiom}
                      </div>
                    )}
                    {academicColloquium?.active && (
                      <div className="text-[10px] font-mono text-amber-200/90 mt-0.5">
                        {getProfessorPersona(selectedPiece).department} ·{' '}
                        <span className="text-amber-300">
                          {getProfessorPersona(selectedPiece).elbowPatchStyle}
                        </span>
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-amber-300/90">
                      {ARCHETYPES[selectedPiece.type].chessName} at{' '}
                      {formatSquareName({ row: selectedPiece.row, col: selectedPiece.col })} ·{' '}
                      <span className={condRatio < 0.35 ? 'text-rose-400' : 'text-slate-300'}>
                        {conditionStory}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleEntangleSelectedPiece}
                    className="px-2 py-1 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-400/50 rounded text-[10px] font-mono text-cyan-200 transition-colors cursor-pointer shrink-0"
                    title="Bind this warrior in a Quantum Bell Pair with an ally"
                  >
                    {selectedPiece.entangledWithId ? '|Φ⁺⟩ Re-Bind' : '|Φ⁺⟩ Soul-Bind'}
                  </button>
                </div>

                {/* Sentient Mathematical Theorem Action for Pawns (Merge -> Peer Review -> Publish -> Checkmate Yesterday!) */}
                {selectedPiece.type === 'p' && (
                  <button
                    onClick={() =>
                      handleCheckmateYesterdayShowcase(
                        Boolean(
                          selectedPiece.isSentientTheorem &&
                            selectedPiece.theoremStatus === 'PUBLISHED'
                        )
                      )
                    }
                    className="mt-2 w-full px-3 py-1.5 bg-gradient-to-r from-sky-500/30 to-amber-500/30 hover:from-sky-500/45 hover:to-amber-500/45 border border-sky-400/75 rounded-lg text-[10px] font-mono font-bold text-sky-100 flex items-center justify-between transition-colors cursor-pointer shadow-[0_0_18px_rgba(56,189,248,0.25)]"
                    title="Merge this Pawn with its alternate-timeline self to formulate a Sentient Mathematical Theorem, undergo Academic Peer Review as Tweed-Suited Professors, and unlock Checkmate Yesterday!"
                  >
                    <span>
                      {selectedPiece.isSentientTheorem
                        ? selectedPiece.theoremStatus === 'PUBLISHED'
                          ? '⊢ Execute Published Q.E.D. Checkmate Yesterday'
                          : '🎓 Continue Academic Peer Review (In Session)'
                        : '🎓 Merge Alternate Pawn → Develop Sentient Theorem'}
                    </span>
                    <span className="text-amber-300 font-bold">
                      {selectedPiece.isSentientTheorem
                        ? selectedPiece.theoremStatus === 'PUBLISHED'
                          ? 'Δt = −1 →'
                          : 'Peer Review →'
                        : 'Preprint →'}
                    </span>
                  </button>
                )}

                {/* Multiversal Synod Counterpart Resonance & Quantum Swap */}
                {counterparts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80">
                    <div className="text-[10px] font-mono text-cyan-300 font-bold flex items-center justify-between">
                      <span>✦ Multiversal Synod Counterparts:</span>
                      <span className="text-[9px] text-slate-400">
                        {selectedPiece.type === 'p'
                          ? 'Merge into Sentient Theorem!'
                          : 'Swap & Fuse (+L-Leaps)'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {counterparts.slice(0, 4).map((cp) => (
                        <button
                          key={cp.timelineId}
                          onClick={() => handleSynodTranspose(cp.timelineId)}
                          onMouseEnter={() => handleHoverTimelineOnWatch(cp.timelineId)}
                          onMouseLeave={() => handleHoverTimelineOnWatch(null)}
                          className="px-2 py-1 rounded bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-400/60 text-[10px] font-mono text-cyan-100 flex items-center gap-1 cursor-pointer transition-colors"
                          title={`Quantum-Swap with counterpart in ${cp.timelineName} at ${cp.squareLabel} (+25 HP, +30% Meter, Synod L-Leaps)`}
                        >
                          <span className="text-amber-300 font-bold">{cp.shortCode}</span>
                          <span>→ {cp.squareLabel}</span>
                          {cp.occupantOnActiveBoard && (
                            <span className="text-rose-400 font-bold">⚔</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ascend to Colossal Pocket Watch Horologium Duel */}
                <button
                  onClick={() => handleAscendToPocketWatchDuel(selectedPiece)}
                  className="mt-2 w-full px-3 py-1.5 bg-gradient-to-r from-amber-500/25 to-fuchsia-500/25 hover:from-amber-500/40 hover:to-fuchsia-500/40 border border-amber-400/60 rounded-lg text-[10px] font-mono font-bold text-amber-200 flex items-center justify-between transition-colors cursor-pointer"
                  title="Ascend with this warrior to fight atop the Colossal Multiversal Pocket Watch in the sky! Victory crowns them Chronocrator & resurrects fallen allies!"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    <span>Ascend to Pocket Watch Duel</span>
                  </span>
                  <span className="text-amber-300">Crown Chronocrator →</span>
                </button>

                {/* If this piece can step onto a Board Gateway (e.g. C3, D3, B5, G4, E6, F6), offer 1-click Descent! */}
                {reachableGatewayMove && (
                  <button
                    onClick={() => executeChessMove(selectedPiece, reachableGatewayMove)}
                    className="mt-2 w-full px-3 py-1.5 bg-purple-950/90 hover:bg-purple-900 border border-purple-400/60 rounded-lg text-[11px] font-mono font-bold text-purple-200 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>
                      ⟁ Descend {formatSquareName(reachableGatewayMove.to)} Gateway
                    </span>
                    <span className="text-amber-300">
                      {reachableGatewayMove.realmId
                        ? REALM_METADATA[reachableGatewayMove.realmId].title
                        : 'Enter Realm'}{' '}
                      →
                    </span>
                  </button>
                )}

                {/* 4D Move Projection Selector */}
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Orbit className="w-3 h-3 text-cyan-400" />
                    Step Across:
                  </span>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        [-1, 'Kata (-W)'],
                        [0, 'Prime'],
                        [1, 'Ana (+W)'],
                      ] as [number, string][]
                    ).map(([wVal, label]) => (
                      <button
                        key={wVal}
                        onClick={() => handleSelect4DSlice(wVal, targetMoveZ, false)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                          targetMoveW === wVal
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Pre-Commit Duel Standoff Whisper */}
          {hoveredCaptureMove && hoveredCaptureMove.targetPiece && selectedPiece && (() => {
            const hoverSupport = computeSquareSupportAnalysis(
              simRef.current.pieces,
              hoveredCaptureMove.to,
              selectedPiece.faction,
              hoveredCaptureMove.targetPiece.faction,
              [selectedPiece.id, hoveredCaptureMove.targetPiece.id]
            );
            const readyAllies = hoverSupport.attackerSupporters.filter((s) => s.canIntervene);
            const readyEnemies = hoverSupport.defenderSupporters.filter((s) => s.canIntervene);
            return (
              <div className="bg-[#0B0E17]/90 border-l-2 border-rose-500 pl-3 py-2 pr-3.5 rounded-r-xl shadow-2xl">
                <div className="font-display text-xs font-bold text-rose-300 tracking-wide uppercase">
                  Challenge {ARCHETYPES[hoveredCaptureMove.targetPiece.type].warriorTitle} at{' '}
                  {formatSquareName(hoveredCaptureMove.to)}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-emerald-300">
                    {readyAllies.length} Allied {readyAllies.length === 1 ? 'Vanguard' : 'Vanguards'} Ready
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-rose-300">
                    {readyEnemies.length} Enemy {readyEnemies.length === 1 ? 'Sentinel' : 'Sentinels'} Ready
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 3B. Standalone University of Greater Andromeda Playable Week & 6-Year Academic Life Simulator */}
      {phase === 'ACADEMIC_SIMULATOR' && academicColloquium?.active && (
        <AcademicColloquiumOverlay
          colloquium={academicColloquium}
          onEnterUniversityOffice={handleEnterUniversityOffice}
          onWalkToRoom={handleWalkToRoom}
          onSetDrawerTab={handleSetDrawerTab}
          onSelectEmail={handleSelectAcademicEmail}
          onKickCoffeeMachine={handleKickCoffeeMachine}
          onJoinOrLeaveCafeteriaQueue={handleJoinOrLeaveCafeteriaQueue}
          onDropOffShirtAtCleaner={handleDropOffShirtAtCleaner}
          onPickUpCleanedShirt={handlePickUpCleanedShirt}
          onBuyNewShirtAtHaberdashery={handleBuyNewShirtAtHaberdashery}
          onCommuteHomeForSpareShirt={handleCommuteHomeForSpareShirt}
          onToggleDriveCar={handleToggleDriveCar}
          onOpenTransitModal={handleOpenTransitModal}
          onCloseTransitModal={handleCloseTransitModal}
          onBoardTransitToStation={handleBoardTransitToStation}
          onAttendScheduledMeetingInRoom={handleAttendScheduledMeetingInRoom}
          onTalkToNpcInRoom={handleTalkToNpcInRoom}
          onSelectBoundaryGauge={handleSelectBoundaryGauge}
          onToggleJacobianSign={handleToggleJacobianSign}
          onRunChiralLabExperiment={handleRunChiralLabExperiment}
          onToggleRookCitations={handleToggleRookCitations}
          onToggleGrantLineItem={handleToggleGrantLineItem}
          onSubmitGrantBudgetProposal={handleSubmitGrantBudgetProposal}
          onPayMonthlyMortgage={handlePayMonthlyMortgage}
          onAttemptIllegalDepartmentalReimbursement={handleAttemptIllegalDepartmentalReimbursement}
          onAdvanceTimeMinutes={handleAdvanceTimeMinutes}
          onSleepUntilNextMorning={handleSleepUntilNextMorning}
          onSubmitToJournalOfTransfiniteCausality={handleSubmitToJournalOfTransfiniteCausality}
          onSellEquipmentForPerseusFee={handleSellEquipmentForPerseusFee}
          onOpenAcceptanceLetter={handleOpenAcceptanceLetter}
          onBeginRealityShatter={handleBeginRealityShatter}
          onConcludePublicationAndRestorePieces={handleConcludePublicationAndRestorePieces}
          uniFirstPerson={uniFirstPerson}
          freeMouseLook={freeMouseLook}
          onToggleUniFirstPerson={() => {
            const nextFp = !simRef.current.mouseLook.uniFirstPerson;
            simRef.current.mouseLook.uniFirstPerson = nextFp;
            if (!nextFp && simRef.current.mouseLook.uniCamDistance < 1.8) {
              simRef.current.mouseLook.uniCamDistance = 5.6;
            }
            setUniFirstPerson(nextFp);
          }}
          onToggleFreeMouseLook={() => {
            const nextFree = !simRef.current.mouseLook.freeLookActive;
            simRef.current.mouseLook.freeLookActive = nextFree;
            setFreeMouseLook(nextFree);
          }}
          onResetUniCamera={() => {
            simRef.current.mouseLook.uniCamYaw = 0;
            simRef.current.mouseLook.uniCamPitch = 0.42;
            simRef.current.mouseLook.uniCamDistance = 6.2;
          }}
        />
      )}

      {/* 4. Campaign Victory Modal (Regicide) */}
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

      {/* 5. Diegetic Story-Driven Combat Overlay (Lower-third letterbox inscriptions & Visor Rim) */}
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
        onSelectSupporter={handleSelectSupporter}
        onTriggerIntervention={handleTriggerIntervention}
        koNarrative={koBanner}
      />

      {/* 6. Subterranean Impossible Realms Diegetic Overlay (During REALM_DESCENT, REALM_EXPLORATION & REALM_ASCENT) */}
      <RealmHudOverlay
        phase={phase}
        activeRealmId={activeRealmId}
        traveler={realmTraveler}
        allPieces={simRef.current.pieces}
        isParityInverted={realmParityInverted}
        crucibleAnvilClaimed={realmCrucibleClaimed}
        nearbyPortal={nearbyPortal}
        nearbyPortalEval={nearbyPortalEval}
        statusBanner={realmStatusBanner}
        onTraversePortal={handleTraverseRealmPortal}
        onSteerTowardPortal={handleSteerTowardPortal}
        onRealmAction={handleRealmAction}
      />

      {/* 7. Unified Collapsible Bottom Control Dock (during CHESS_VIEW) */}
      {phase === 'CHESS_VIEW' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(1080px,96vw)] flex flex-col items-center pointer-events-auto">
          <button
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="mb-1 px-3 py-1 text-xs font-mono text-slate-300 bg-[#0B0E17]/95 border border-slate-800 rounded-t-lg hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {dockCollapsed ? '▴ Show 4D Hypercube Navigator & Impossible Realms (H)' : '▾ Hide Controls (H)'}
          </button>

          {!dockCollapsed && (
            <div className="w-full bg-[#0B0E17]/95 border border-slate-800 rounded-xl px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAutoPlayDemo}
                  className={`px-3 py-2 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    autoPlayDemo
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-[0_0_18px_rgba(52,211,153,0.35)]'
                      : 'bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-400/60 text-emerald-200'
                  }`}
                  title="Watch an autonomous AI-vs-AI showcase demonstrating 4D Quantum Chess, Spaghetti Western Crash-Zooms, First-Person Visor Combat, and Tactical Board Interventions! (P Key)"
                >
                  {autoPlayDemo ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {autoPlayDemo ? 'Pause Demo (P)' : 'Auto-Play Demo (P)'}
                </button>
                <button
                  onClick={() => setMultiverseModalOpen(true)}
                  className="px-3 py-2 bg-fuchsia-950/95 hover:bg-fuchsia-900 border border-fuchsia-400/70 text-fuchsia-200 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Open the Multiversal Causal Nexus to inspect parallel timelines, Global Piece Lineages, and trigger Reality Convergence! (M Key)"
                >
                  <GitBranch className="w-3.5 h-3.5 text-fuchsia-300" />
                  Multiverse Nexus (M)
                </button>
                <button
                  onClick={handleTriggerGuidedAssassinationDemo}
                  className="px-3 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Enter Timeline Ω-1, assassinate the exposed Obsidian Queen, and converge her death back into Prime Reality!"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Causal Assassination (Ω-1)
                </button>
                <button
                  onClick={() => handleTriggerRealmShowcase()}
                  className="px-3 py-2 bg-cyan-950/95 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-200 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Descend with a warrior through a Board Gateway Well into the 3D Subterranean Realms (The Shattered Mirror, The Ashen Crucible, The Echoing Remnant)!"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  Descend Into Realms
                </button>
                <button
                  onClick={() => handleAscendToPocketWatchDuel()}
                  className="px-3 py-2 bg-amber-950/95 hover:bg-amber-900 border border-amber-400/70 text-amber-200 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Ascend into the sky to fight a real-time 3D duel directly atop the spinning gears and hands of the Colossal Multiversal Pocket Watch!"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  Watch Ascension Duel
                </button>
                <button
                  onClick={() => handleCheckmateYesterdayShowcase(false)}
                  className="px-3 py-2 bg-gradient-to-r from-sky-500 to-amber-400 hover:from-sky-400 hover:to-amber-300 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_18px_rgba(56,189,248,0.3)]"
                  title="Develop a Sentient Mathematical Theorem by merging a Pawn with its alternate self -> All pieces become Tweed-Suited Professors for Peer Review, Revisions & Tenure Defense -> Publish to unlock Checkmate Yesterday!"
                >
                  <GraduationCap className="w-4 h-4 text-slate-950" />
                  <span>
                    {academicColloquium?.active
                      ? '🎓 Peer Review in Session'
                      : simRef.current.pieces.some(
                          (p) => p.isSentientTheorem && p.theoremStatus === 'PUBLISHED'
                        )
                      ? '⊢ Q.E.D. Checkmate Yesterday!'
                      : '🎓 Develop Theorem & Peer Review'}
                  </span>
                </button>
                <button
                  onClick={handleTrigger4DHyperScenario}
                  className="px-3 py-2 bg-purple-950/90 hover:bg-purple-900 border border-purple-500/50 text-purple-200 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Shift pieces across the 4th spatial dimension (Ana +W / Kata -W) to experience Unseen 4D Threats & Cross-Dimensional Ambushes!"
                >
                  <Orbit className="w-3.5 h-3.5 text-purple-400" />
                  4D Hyper-Ambush
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
                      ['pocket_watch', 'Watch (C)'],
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
                      MULTIVERSAL CHRONICLE:
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

      {/* 9. Multiversal Causal Nexus, Lineage Inspector & Reality Convergence Modal */}
      <MultiverseModal
        multiverse={multiverseState}
        activePieces={simRef.current.pieces}
        selectedPiece={selectedPiece}
        isOpen={multiverseModalOpen}
        onClose={() => setMultiverseModalOpen(false)}
        onSwitchTimeline={handleSwitchTimeline}
        onForkTimeline={handleForkTimeline}
        onDeployPieceToTimeline={handleDeployPieceToTimeline}
        onTriggerConvergence={handleTriggerConvergence}
        onTriggerGuidedAssassinationDemo={handleTriggerGuidedAssassinationDemo}
        onRewindLastAssassination={handleRewindLastAssassination}
      />
    </div>
  );
}
