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
}

export type MoveDimensionType =
  | '3D_SLICE'
  | '4D_HYPER_SHIFT'
  | '4D_CROSS_SLICE_STRIKE'
  | 'TEMPORAL_INTERCEPT';

export interface MoveOption {
  from: { row: number; col: number; z: number; w: number };
  to: { row: number; col: number; z: number; w: number };
  isCapture: boolean;
  targetPiece?: ChessPiece;
  isPromotion?: boolean;
  dimensionType?: MoveDimensionType;
  dimensionLabel?: string;
}

export interface UnseenThreatVector {
  attacker: ChessPiece;
  targetRow: number;
  targetCol: number;
  targetZ: number;
  targetW: number;
  axisDescription: string;
}

export type GamePhase =
  | 'CHESS_VIEW'
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
  | 'defeat';

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
  // 4D Combat Mechanics: W-Axis Phase Shift & Temporal Echo Clone
  wPhaseOffset: number; // 0 = Prime plane, +1 = Ana Phase, -1 = Kata Phase
  wPhaseTimerMs: number;
  wPhaseCooldownMs: number;
  temporalEchoTimerMs: number;
  temporalEchoX: number;
  temporalEchoFacing: 1 | -1;
  temporalEchoHasStruck: boolean;
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
