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
}

export interface ChessPiece {
  id: string;
  type: PieceType;
  faction: Faction;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  meter: number; // 0 to 100
  kills: number;
  hasMoved: boolean;
}

export interface MoveOption {
  from: BoardCoord;
  to: BoardCoord;
  isCapture: boolean;
  targetPiece?: ChessPiece;
  isPromotion?: boolean;
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
  x: number; // Arena X coordinate (-6.5 to +6.5)
  y: number; // Arena height (0 = ground)
  vx: number;
  vy: number;
  facing: 1 | -1; // 1 = right, -1 = left
  hp: number;
  maxHp: number;
  recoverableHp: number;
  meter: number; // 0 to 100
  guardGauge: number; // 0 to 100
  action: FighterAction;
  actionTimerMs: number;
  actionDurationMs: number;
  hasHitThisAction: boolean;
  specialHitsRemaining: number;
  comboBuffer: AttackInput[];
  comboWindowTimerMs: number;
  activeComboRecipe: ComboRecipe | null;
  comboStepIndex: number;
  hitCount: number; // Current combo hits landed on opponent
  comboDamageAccum: number;
  lastBlockPressTime: number; // For Parry detection (<160ms window)
  superArmorActive: boolean;
  invulnerableTimerMs: number;
  hitFlashTimerMs: number;
}

export interface CombatCallout {
  id: number;
  text: string;
  subtext?: string;
  x: number; // -1 to 1 normalized or world X
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
