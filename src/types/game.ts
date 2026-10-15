export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Faction = 'w' | 'b';

export type AttackInput = 'L' | 'H' | 'S';

export interface ComboRecipe {
  id: string;
  name: string;
  sequence: AttackInput[];
  finisherMultiplier: number;
  effect: 'launch' | 'knockback' | 'guard_crush' | 'vortex' | 'pierce';
  description: string;
}

export interface MoveFrameData {
  name: string;
  damage: number;
  chipDamage: number;
  startupMs: number;
  activeMs: number;
  recoveryMs: number;
  range: number;
  hitstunMs: number;
  blockstunMs: number;
  knockback: number;
  launchY: number;
  meterGain: number;
  superArmor?: boolean;
}

export type FighterStatusEffectType = 'burn' | 'slow' | 'weakened';

export interface SpecialMoveSpec {
  name: string;
  tagline: string;
  scalingNote: string;
  meterCost: number;
  baseDamage: number;
  range: number;
  startupMs: number;
  activeMs: number;
  recoveryMs: number;
  hits: number;
  unblockable?: boolean;
  statusEffect: FighterStatusEffectType;
  statusDurationMs: number;
}

export interface VictoryTauntSpec {
  id: string;
  name: string;
  quote: string;
  durationMs: number;
  flourishColorHex: number;
}

export interface ArchetypeSpec {
  type: PieceType;
  chessName: string;
  warriorTitle: string;
  tacticalValue: number;
  maxHp: number;
  walkSpeed: number;
  dashSpeed: number;
  jumpForce: number;
  weaponName: string;
  fightingStyle: string;
  light: MoveFrameData;
  heavy: MoveFrameData;
  special: SpecialMoveSpec;
  combos: ComboRecipe[];
  victoryTaunt: VictoryTauntSpec;
}

export interface BoardCoord {
  row: number;
  col: number;
  z?: number; // 3rd spatial axis (0 = Prime Ground, 1 = Astral Stratum)
  w?: number; // 4th spatial axis (-1 = Kata, 0 = Prime, +1 = Ana)
}

export interface SpacetimeWaypoint {
  row: number;
  col: number;
  z: number;
  w: number;
  turn: number;
}

export interface ChessPiece {
  id: string;
  /** Persistent Multiversal Lineage Identity shared by all manifestations of this piece across all timelines */
  lineageId?: string;
  /** Timeline ID where this piece originally manifested */
  originTimelineId?: string;
  type: PieceType;
  faction: Faction;
  row: number;
  col: number;
  z: number; // 0 or 1
  w: number; // -1, 0, +1
  hp: number;
  maxHp: number;
  meter: number; // 0 to 100
  kills: number;
  hasMoved: boolean;
  history: SpacetimeWaypoint[];
  entangledWithId?: string; // Quantum Bell-State Entanglement Partner ID (|Φ⁺⟩)
  // Persistent Subterranean Realm Consequences
  persistentBurnMs?: number;
  persistentSlowMs?: number;
  persistentWeakenedMs?: number;
  mirrorInvertedParity?: boolean;
  realmTraversals?: number;
  inRealm?: RealmId | null;
}

export interface TimelineSnapshot {
  turnNumber: number;
  turnFaction: Faction;
  branchName: string;
  pieces: ChessPiece[];
  /** Sequence watermark for rolling back multiversal branches & causal death events on rewind */
  multiverseSeqWatermark?: number;
  activeTimelineId?: string;
}

export type RealmId = 'SHATTERED_MIRROR' | 'ASHEN_CRUCIBLE' | 'ECHOING_REMNANT';

export type MoveDimensionType =
  | '3D_SLICE'
  | '4D_HYPER_SHIFT'
  | '4D_CROSS_SLICE_STRIKE'
  | 'TEMPORAL_INTERCEPT'
  | 'REALM_GATEWAY_DESCENT'
  | 'REALM_PORTAL_TRAVERSAL'
  | 'MULTIVERSE_ASSASSINATION';

export interface MoveOption {
  from: { row: number; col: number; z: number; w: number };
  to: { row: number; col: number; z: number; w: number };
  isCapture: boolean;
  targetPiece?: ChessPiece;
  isPromotion?: boolean;
  dimensionType?: MoveDimensionType;
  dimensionLabel?: string;
  gatewayId?: string;
  exitGatewayId?: string;
  realmId?: RealmId;
  targetTimelineId?: string;
}

export interface BoardGateway {
  id: string;
  row: number;
  col: number;
  z: number;
  w: number;
  realmId: RealmId;
  name: string;
  transformRuleLabel: string;
  destinationDesc: string;
  colorHex: number;
  spawnLocalPos: { x: number; y: number; z: number };
  spawnYaw: number;
}

export type RealmPortalKind =
  | 'BOARD_ASCENT'
  | 'INTER_REALM'
  | 'MIRROR_INVERTER'
  | 'TIMELINE_PORTAL';

export interface RealmPortalNode {
  id: string;
  realmId: RealmId;
  kind: RealmPortalKind;
  name: string;
  subtitle: string;
  transformFormula: string;
  localPos: { x: number; y: number; z: number };
  yaw: number;
  colorHex: number;
  // For BOARD_ASCENT or TIMELINE_PORTAL portals:
  targetGatewayId?: string;
  targetBoardCoord?: { row: number; col: number; z: number; w: number };
  invertedBoardCoord?: { row: number; col: number; z: number; w: number };
  targetTimelineId?: string;
  // For INTER_REALM or MIRROR_INVERTER portals:
  targetRealmId?: RealmId;
  targetPortalId?: string;
  flipsMirrorParity?: boolean;
}

export interface RealmTemporalEcho {
  id: string;
  sourcePieceId: string;
  pieceType: PieceType;
  faction: Faction;
  fromCoord: SpacetimeWaypoint;
  toCoord: SpacetimeWaypoint;
  startLocalPos: { x: number; y: number; z: number };
  endLocalPos: { x: number; y: number; z: number };
  progress: number;
  speed: number;
  consumed: boolean;
}

export interface RealmEnemySentinel {
  id: string;
  piece: ChessPiece;
  realmId: RealmId;
  localPos: { x: number; y: number; z: number };
  patrolOrigin: { x: number; y: number; z: number };
  patrolRadius: number;
  yaw: number;
  defeated: boolean;
}

export interface UnseenThreatVector {
  attacker: ChessPiece;
  targetRow: number;
  targetCol: number;
  targetZ: number;
  targetW: number;
  axisDescription: string;
}

// ============================================================================
// MULTIVERSAL CHESS, CAUSAL ASSASSINATION & REALITY CONVERGENCE TYPES
// ============================================================================

export interface CausalDeathEvent {
  id: string;
  victimLineageId: string;
  victimPieceId: string;
  victimType: PieceType;
  victimFaction: Faction;
  killerLineageId: string;
  killerPieceId: string;
  killerType: PieceType;
  killerFaction: Faction;
  sourceTimelineId: string;
  sourceTimelineName: string;
  sourceSquare: { row: number; col: number; z: number; w: number };
  sourceSquareLabel: string;
  turnNumber: number;
  combatSummary: string;
  isParadoxStrike?: boolean;
  createdAtSeq: number;
}

export interface CausalCollapseResolution {
  event: CausalDeathEvent;
  targetTimelineId: string;
  targetTimelineName: string;
  erasedPiece: ChessPiece;
  erasedSquareLabel: string;
}

export interface MultiverseMoveRecord {
  seq: number;
  turnNumber: number;
  faction: Faction;
  pieceLineageId: string;
  pieceType: PieceType;
  from: { row: number; col: number; z: number; w: number };
  to: { row: number; col: number; z: number; w: number };
  capturedLineageId?: string;
  capturedType?: PieceType;
  summary: string;
}

export interface VulnerableTargetSummary {
  victimLineageId: string;
  victimType: PieceType;
  victimFaction: Faction;
  victimSquare: { row: number; col: number; z: number; w: number };
  victimSquareLabel: string;
  attackerLineageId: string;
  attackerType: PieceType;
  attackerSquare: { row: number; col: number; z: number; w: number };
  attackerSquareLabel: string;
  move: MoveOption;
  tacticalValue: number;
}

export interface TimelineBranch {
  id: string;
  name: string;
  shortCode: string;
  parentTimelineId: string | null;
  forkTurn: number;
  divergenceSummary: string;
  turnNumber: number;
  turnFaction: Faction;
  /** Live active board pieces when this branch is in the active working set */
  pieces: ChessPiece[];
  /** Base snapshot at the fork point for deterministic lazy reconstruction */
  forkBasePieces: ChessPiece[];
  /** Complete deterministic move history since fork point */
  moveHistory: MultiverseMoveRecord[];
  /** Global CausalDeathEvent IDs that have already been reconciled on this branch */
  appliedDeathEventIds: string[];
  /** Sequence number when this branch was created (used for causal rewind rollback) */
  createdAtSeq: number;
  /** True if currently dehydrated out of the active working set to bound memory */
  isDehydrated?: boolean;
}

export interface MultiverseTravelerState {
  lineageId: string;
  originTimelineId: string;
  currentTimelineId: string;
  entrySquareInOrigin: { row: number; col: number; z: number; w: number };
  turnsSpentInAlternate: number;
  assassinationsInBranch: CausalDeathEvent[];
}

export interface MultiverseState {
  activeTimelineId: string;
  primeTimelineId: string;
  seqCounter: number;
  branchCounter: number;
  maxHydratedWorkingSet: number;
  hydratedOrder: string[];
  timelines: Map<string, TimelineBranch>;
  /** Authoritative global ledger of eliminated piece lineages across the multiverse */
  eliminatedLineages: Map<string, CausalDeathEvent>;
  /** Active cross-timeline traveler tracking so a traveler has a single coherent manifestation */
  activeTraveler: MultiverseTravelerState | null;
}

export type GamePhase =
  | 'CHESS_VIEW'
  | 'REALM_DESCENT'
  | 'REALM_EXPLORATION'
  | 'REALM_ASCENT'
  | 'CAUSAL_COLLAPSE'
  | 'TRANSITION_TO_FIGHT'
  | 'FIGHT_INTRO'
  | 'FIGHT_ACTIVE'
  | 'FIGHT_OUTRO'
  | 'TRANSITION_TO_CHESS'
  | 'GAME_OVER';

export type FighterAction =
  | 'idle'
  | 'walk_fwd'
  | 'walk_back'
  | 'dash_fwd'
  | 'dash_back'
  | 'jump'
  | 'block'
  | 'parry_flash'
  | 'blade_clash'
  | 'light_1'
  | 'light_2'
  | 'light_3'
  | 'heavy_1'
  | 'heavy_2'
  | 'combo_finisher'
  | 'special'
  | 'hitstun'
  | 'knockdown'
  | 'victory'
  | 'victory_taunt'
  | 'defeat';

export const TACTICAL_INTERVENTION_METER_COST = 25;

export type InterventionRiftType =
  | 'PRIME'
  | 'ANA_PLUS_W'
  | 'KATA_MINUS_W'
  | 'ASTRAL_PLUS_Z';

export interface TacticalSupporter {
  pieceId: string;
  type: PieceType;
  faction: Faction;
  row: number;
  col: number;
  z: number;
  w: number;
  meter: number;
  canIntervene: boolean; // true if meter >= 25 and not yet used
  isCrossDimensional: boolean;
  riftType: InterventionRiftType;
  riftColorHex: number;
  interventionName: string;
  interventionTagline: string;
  vectorLabel: string;
}

export interface SquareSupportAnalysis {
  attackerSupporters: TacticalSupporter[];
  defenderSupporters: TacticalSupporter[];
}

export interface ActiveInterventionState {
  supporter: TacticalSupporter;
  callerIsAttacker: boolean;
  timerSec: number;
  durationSec: number;
  impactApplied: boolean;
}

export interface FighterRuntime {
  piece: ChessPiece;
  spec: ArchetypeSpec;
  isAttacker: boolean;
  isAI: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  recoverableHp: number;
  meter: number;
  guardGauge: number;
  action: FighterAction;
  actionTimerMs: number;
  actionDurationMs: number;
  hasHitThisAction: boolean;
  specialHitsRemaining: number;
  comboBuffer: AttackInput[];
  comboWindowTimerMs: number;
  activeComboRecipe: ComboRecipe | null;
  comboStepIndex: number;
  hitCount: number;
  comboDamageAccum: number;
  lastBlockPressTime: number;
  superArmorActive: boolean;
  invulnerableTimerMs: number;
  hitFlashTimerMs: number;
  // 4D Combat Mechanics: W-Axis Phase Shift, Temporal Echo Clone, Blade Clash Lock & Bell Entanglement
  wPhaseOffset: number; // 0 = Prime plane, +1 = Ana Phase, -1 = Kata Phase
  wPhaseTimerMs: number;
  wPhaseCooldownMs: number;
  temporalEchoTimerMs: number;
  temporalEchoX: number;
  temporalEchoFacing: 1 | -1;
  temporalEchoHasStruck: boolean;
  clashLockTimerMs: number;
  clashPower: number;
  entangledPartnerName?: string;
  // Tactical Intervention: The Board Fights Back
  supporters: TacticalSupporter[];
  selectedSupporterIndex: number;
  interventionUsed: boolean;
  sovereignAegisActive: boolean;
  // Combat Status Effects ('burn', 'slow', 'weakened')
  statusBurnTimerMs: number;
  statusBurnTickAccumMs: number;
  statusSlowTimerMs: number;
  statusWeakenedTimerMs: number;
}

export interface CombatCallout {
  id: number;
  text: string;
  subtext?: string;
  x: number;
  y: number;
  color: string;
  createdAt: number;
}

export interface BattleLogEntry {
  id: string;
  turnNumber: number;
  summary: string;
  detail: string;
  wasUpset: boolean;
  winnerFaction: Faction;
}
