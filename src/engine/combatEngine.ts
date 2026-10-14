import { soundEngine } from '../audio/soundEngine';
import { ARCHETYPES, calculateSpecialHitDamage } from '../data/archetypes';
import {
  AttackInput,
  ChessPiece,
  CombatCallout,
  ComboRecipe,
  FighterRuntime,
} from '../types/game';

export const ARENA_HALF_WIDTH = 5.2;
const GRAVITY = 28.0;
const PARRY_WINDOW_MS = 175;
const COMBO_CHAIN_WINDOW_MS = 650;

export function createFighterRuntime(
  piece: ChessPiece,
  isAttacker: boolean,
  isAI: boolean
): FighterRuntime {
  const spec = ARCHETYPES[piece.type];
  // Attacker gets Ambush Initiative (+20% starting tactical meter boost)
  const initialMeter = Math.min(100, piece.meter + (isAttacker ? 20 : 10));

  return {
    piece,
    spec,
    isAttacker,
    isAI,
    x: isAttacker ? -2.6 : 2.6,
    y: 0,
    vx: 0,
    vy: 0,
    facing: isAttacker ? 1 : -1,
    hp: piece.hp,
    maxHp: piece.maxHp,
    recoverableHp: piece.hp,
    meter: initialMeter,
    guardGauge: 100,
    action: 'idle',
    actionTimerMs: 0,
    actionDurationMs: 0,
    hasHitThisAction: false,
    specialHitsRemaining: 0,
    comboBuffer: [],
    comboWindowTimerMs: 0,
    activeComboRecipe: null,
    comboStepIndex: 0,
    hitCount: 0,
    comboDamageAccum: 0,
    lastBlockPressTime: -9999,
    superArmorActive: false,
    invulnerableTimerMs: 0,
    hitFlashTimerMs: 0,
  };
}

function findMatchingCombo(
  recipes: ComboRecipe[],
  sequence: AttackInput[]
): { exact: ComboRecipe | null; partial: ComboRecipe | null } {
  let exact: ComboRecipe | null = null;
  let partial: ComboRecipe | null = null;

  for (const recipe of recipes) {
    if (recipe.sequence.length === sequence.length) {
      if (recipe.sequence.every((val, idx) => val === sequence[idx])) {
        exact = recipe;
      }
    } else if (recipe.sequence.length > sequence.length) {
      if (sequence.every((val, idx) => val === recipe.sequence[idx])) {
        partial = recipe;
      }
    }
  }
  return { exact, partial };
}

export function triggerFighterAttack(
  fighter: FighterRuntime,
  input: AttackInput,
  onCallout: (c: Omit<CombatCallout, 'id' | 'createdAt'>) => void
): boolean {
  if (
    fighter.action === 'hitstun' ||
    fighter.action === 'knockdown' ||
    fighter.action === 'victory' ||
    fighter.action === 'defeat'
  ) {
    return false;
  }

  // Check if currently in an attack: allow combo cancel after startup + 40% active frames
  const isAttacking =
    fighter.action.startsWith('light') ||
    fighter.action.startsWith('heavy') ||
    fighter.action === 'combo_finisher';

  if (fighter.action === 'special') return false;

  if (input === 'S') {
    if (fighter.meter < fighter.spec.special.meterCost) return false;
    fighter.meter -= fighter.spec.special.meterCost;
    fighter.action = 'special';
    fighter.actionTimerMs = 0;
    const sp = fighter.spec.special;
    fighter.actionDurationMs = sp.startupMs + sp.activeMs + sp.recoveryMs;
    fighter.hasHitThisAction = false;
    fighter.specialHitsRemaining = sp.hits;
    fighter.superArmorActive = fighter.spec.type === 'r' || fighter.spec.type === 'k';
    fighter.comboBuffer = [];

    // Knight jumps upward during L-Shift Sky Drop
    if (fighter.spec.type === 'n') {
      fighter.vy = 11.5;
      fighter.vx = fighter.facing * 6.5;
    } else {
      fighter.vx = fighter.facing * 3.5;
    }

    soundEngine.playSpecialActivate();
    onCallout({
      text: sp.name.toUpperCase(),
      subtext: sp.tagline,
      x: fighter.x,
      y: 2.3,
      color: '#f59e0b',
    });
    return true;
  }

  // Can we chain a combo?
  if (isAttacking) {
    const canCancel =
      fighter.action !== 'combo_finisher' &&
      fighter.actionTimerMs >= fighter.actionDurationMs * 0.36;
    if (!canCancel) return false;
  }

  const nextBuffer: AttackInput[] =
    fighter.comboWindowTimerMs > 0 ? [...fighter.comboBuffer, input] : [input];

  const { exact, partial } = findMatchingCombo(fighter.spec.combos, nextBuffer);

  if (exact) {
    // Execute Named Combo Finisher!
    fighter.comboBuffer = [];
    fighter.comboWindowTimerMs = 0;
    fighter.activeComboRecipe = exact;
    fighter.action = 'combo_finisher';
    fighter.actionTimerMs = 0;
    const moveData = input === 'H' ? fighter.spec.heavy : fighter.spec.light;
    fighter.actionDurationMs =
      moveData.startupMs * 0.85 + moveData.activeMs * 1.2 + moveData.recoveryMs;
    fighter.hasHitThisAction = false;
    fighter.superArmorActive = Boolean(moveData.superArmor);
    fighter.vx = fighter.facing * 5.2;

    soundEngine.playSwing(true);
    onCallout({
      text: exact.name,
      subtext: `COMBO FINISHER (${exact.sequence.join(' · ')})`,
      x: fighter.x,
      y: 2.0,
      color: '#38bdf8',
    });
    return true;
  }

  // Otherwise normal Light or Heavy step (either part of a partial combo or fresh start)
  const finalBuffer = partial ? nextBuffer : [input];
  fighter.comboBuffer = finalBuffer;
  fighter.comboWindowTimerMs = COMBO_CHAIN_WINDOW_MS;
  fighter.activeComboRecipe = null;

  const stepNum = finalBuffer.length;
  if (input === 'L') {
    fighter.action = stepNum === 1 ? 'light_1' : stepNum === 2 ? 'light_2' : 'light_3';
    const l = fighter.spec.light;
    fighter.actionDurationMs = l.startupMs + l.activeMs + l.recoveryMs;
    fighter.superArmorActive = false;
    fighter.vx = fighter.facing * 2.8;
    soundEngine.playSwing(false);
  } else {
    fighter.action = stepNum === 1 ? 'heavy_1' : 'heavy_2';
    const h = fighter.spec.heavy;
    fighter.actionDurationMs = h.startupMs + h.activeMs + h.recoveryMs;
    fighter.superArmorActive = Boolean(h.superArmor);
    fighter.vx = fighter.facing * 3.8;
    soundEngine.playSwing(true);
  }

  fighter.actionTimerMs = 0;
  fighter.hasHitThisAction = false;
  return true;
}

export function triggerFighterDash(fighter: FighterRuntime, forward: boolean) {
  if (
    fighter.action === 'hitstun' ||
    fighter.action === 'knockdown' ||
    fighter.action === 'special'
  ) {
    return;
  }
  fighter.action = forward ? 'dash_fwd' : 'dash_back';
  fighter.actionTimerMs = 0;
  fighter.actionDurationMs = 210;
  const dir = forward ? fighter.facing : -fighter.facing;
  fighter.vx = dir * fighter.spec.dashSpeed;
  if (!forward) {
    fighter.invulnerableTimerMs = 110; // Backdash evasion frames
  }
  soundEngine.playSwing(false);
}

export function triggerFighterJump(fighter: FighterRuntime) {
  if (fighter.y > 0.05) return; // Already airborne
  if (
    fighter.action === 'hitstun' ||
    fighter.action === 'knockdown' ||
    fighter.action === 'special'
  ) {
    return;
  }
  fighter.action = 'jump';
  fighter.actionTimerMs = 0;
  fighter.actionDurationMs = 550;
  fighter.vy = fighter.spec.jumpForce;
}

export interface CombatStepEvents {
  cameraShake: number;
  hitstopMs: number;
  sparkWorldPos: { x: number; y: number; color: number } | null;
}

export function stepCombatSimulation(
  f1: FighterRuntime,
  f2: FighterRuntime,
  dtSeconds: number,
  nowMs: number,
  onCallout: (c: Omit<CombatCallout, 'id' | 'createdAt'>) => void
): CombatStepEvents {
  const dtMs = dtSeconds * 1000;
  const events: CombatStepEvents = {
    cameraShake: 0,
    hitstopMs: 0,
    sparkWorldPos: null,
  };

  const fighters = [f1, f2];

  // 1. Update timers, physics, and facing
  for (let i = 0; i < 2; i++) {
    const f = fighters[i];
    const opp = fighters[1 - i];

    f.actionTimerMs += dtMs;
    if (f.comboWindowTimerMs > 0) {
      f.comboWindowTimerMs = Math.max(0, f.comboWindowTimerMs - dtMs);
      if (f.comboWindowTimerMs === 0) {
        f.comboBuffer = [];
      }
    }
    if (f.invulnerableTimerMs > 0) {
      f.invulnerableTimerMs = Math.max(0, f.invulnerableTimerMs - dtMs);
    }
    if (f.hitFlashTimerMs > 0) {
      f.hitFlashTimerMs = Math.max(0, f.hitFlashTimerMs - dtMs);
    }

    // Recoverable HP slowly drains toward actual HP unless rallying
    if (f.recoverableHp > f.hp) {
      f.recoverableHp = Math.max(f.hp, f.recoverableHp - dtSeconds * 8);
    }

    // Regenerate Guard Gauge slowly when not blocking
    if (f.action !== 'block') {
      f.guardGauge = Math.min(100, f.guardGauge + dtSeconds * 14);
    }

    // Horizontal velocity & friction
    f.x += f.vx * dtSeconds;
    const friction = f.y > 0.05 ? 2.5 : 10.5;
    f.vx *= Math.max(0, 1 - friction * dtSeconds);

    // Vertical velocity & gravity
    if (f.y > 0 || f.vy !== 0) {
      f.y += f.vy * dtSeconds;
      f.vy -= GRAVITY * dtSeconds;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
        if (f.action === 'jump') {
          f.action = 'idle';
        }
      }
    }

    // Wall bounce if knocked into the arena edge at high speed
    if (Math.abs(f.x) >= ARENA_HALF_WIDTH) {
      const clampedX = Math.sign(f.x) * ARENA_HALF_WIDTH;
      if (f.action === 'hitstun' && Math.abs(f.vx) > 6.5) {
        f.vx = -f.vx * 0.55;
        f.vy = Math.max(f.vy, 5.0);
        events.cameraShake = Math.max(events.cameraShake, 0.35);
        onCallout({
          text: 'WALL BOUNCE!',
          x: clampedX,
          y: 1.6,
          color: '#f43f5e',
        });
      } else {
        f.vx = 0;
      }
      f.x = clampedX;
    }

    // Prevent overlapping on the ground
    const dist = f.x - opp.x;
    const minSep = 0.92;
    if (Math.abs(dist) < minSep && Math.abs(f.y - opp.y) < 0.9) {
      const push = (minSep - Math.abs(dist)) * 0.5;
      const dir = dist >= 0 ? 1 : -1;
      f.x = Math.max(-ARENA_HALF_WIDTH, Math.min(ARENA_HALF_WIDTH, f.x + dir * push));
      opp.x = Math.max(-ARENA_HALF_WIDTH, Math.min(ARENA_HALF_WIDTH, opp.x - dir * push));
    }

    // Update facing when in neutral states
    if (
      f.action === 'idle' ||
      f.action === 'walk_fwd' ||
      f.action === 'walk_back' ||
      f.action === 'block'
    ) {
      f.facing = opp.x >= f.x ? 1 : -1;
    }

    // Action completion return to neutral
    if (
      f.action !== 'idle' &&
      f.action !== 'walk_fwd' &&
      f.action !== 'walk_back' &&
      f.action !== 'block' &&
      f.action !== 'victory' &&
      f.action !== 'defeat' &&
      f.actionTimerMs >= f.actionDurationMs
    ) {
      if (f.action === 'hitstun' || f.action === 'knockdown') {
        f.hitCount = 0;
        f.comboDamageAccum = 0;
      }
      f.action = 'idle';
      f.actionTimerMs = 0;
      f.superArmorActive = false;
    }
  }

  // 2. Check active attack hitboxes for both fighters
  for (let i = 0; i < 2; i++) {
    const atk = fighters[i];
    const def = fighters[1 - i];

    if (def.hp <= 0 || atk.hp <= 0) continue;

    // Special Move Multi-Hit check
    if (atk.action === 'special' && atk.specialHitsRemaining > 0) {
      const sp = atk.spec.special;
      const elapsedActive = atk.actionTimerMs - sp.startupMs;
      if (elapsedActive >= 0 && elapsedActive <= sp.activeMs) {
        const hitInterval = sp.activeMs / sp.hits;
        const expectedHitsDone = Math.floor(elapsedActive / hitInterval) + 1;
        const hitsDoneSoFar = sp.hits - atk.specialHitsRemaining;

        if (expectedHitsDone > hitsDoneSoFar) {
          atk.specialHitsRemaining--;
          const dist = Math.abs(def.x - atk.x);
          const inFront = (def.x - atk.x) * atk.facing >= -0.4;

          if (dist <= sp.range && inFront && def.invulnerableTimerMs <= 0) {
            const { perHitDamage, underdogBonusPct } = calculateSpecialHitDamage(
              atk.spec,
              def.spec
            );
            resolveStrikeImpact(
              atk,
              def,
              {
                damage: perHitDamage,
                chipDamage: Math.ceil(perHitDamage * 0.25),
                hitstunMs: 420,
                blockstunMs: 240,
                knockback: atk.specialHitsRemaining === 0 ? 4.2 : 1.1,
                launchY: atk.specialHitsRemaining === 0 ? 5.2 : 1.5,
                unblockable: Boolean(sp.unblockable),
                effect: atk.specialHitsRemaining === 0 ? 'launch' : undefined,
                isSpecial: true,
                underdogBonusPct,
              },
              nowMs,
              events,
              onCallout
            );
          }
        }
      }
    }

    // Standard Light / Heavy / Combo Finisher Hit Check
    const isLight = atk.action.startsWith('light');
    const isHeavy = atk.action.startsWith('heavy');
    const isFinisher = atk.action === 'combo_finisher';

    if ((isLight || isHeavy || isFinisher) && !atk.hasHitThisAction) {
      const baseMove = isHeavy || (isFinisher && atk.activeComboRecipe?.sequence.at(-1) === 'H')
        ? atk.spec.heavy
        : atk.spec.light;

      const startup = isFinisher ? baseMove.startupMs * 0.85 : baseMove.startupMs;
      const active = isFinisher ? baseMove.activeMs * 1.2 : baseMove.activeMs;

      if (atk.actionTimerMs >= startup && atk.actionTimerMs <= startup + active) {
        const dist = Math.abs(def.x - atk.x);
        const inFront = (def.x - atk.x) * atk.facing >= -0.25;
        const effectiveRange = isFinisher ? baseMove.range * 1.22 : baseMove.range;

        if (dist <= effectiveRange && inFront && def.invulnerableTimerMs <= 0) {
          atk.hasHitThisAction = true;
          const mult = isFinisher && atk.activeComboRecipe ? atk.activeComboRecipe.finisherMultiplier : 1.0;
          const dmg = Math.round(baseMove.damage * mult);

          atk.meter = Math.min(100, atk.meter + baseMove.meterGain);

          resolveStrikeImpact(
            atk,
            def,
            {
              damage: dmg,
              chipDamage: baseMove.chipDamage,
              hitstunMs: isFinisher ? baseMove.hitstunMs * 1.25 : baseMove.hitstunMs,
              blockstunMs: baseMove.blockstunMs,
              knockback: isFinisher ? baseMove.knockback * 1.35 : baseMove.knockback,
              launchY: isFinisher && atk.activeComboRecipe?.effect === 'launch' ? 7.8 : baseMove.launchY,
              unblockable: false,
              effect: isFinisher ? atk.activeComboRecipe?.effect : undefined,
              isSpecial: false,
              underdogBonusPct: 0,
            },
            nowMs,
            events,
            onCallout
          );
        }
      }
    }
  }

  return events;
}

function resolveStrikeImpact(
  atk: FighterRuntime,
  def: FighterRuntime,
  strike: {
    damage: number;
    chipDamage: number;
    hitstunMs: number;
    blockstunMs: number;
    knockback: number;
    launchY: number;
    unblockable: boolean;
    effect?: ComboRecipe['effect'];
    isSpecial: boolean;
    underdogBonusPct: number;
  },
  nowMs: number,
  events: CombatStepEvents,
  onCallout: (c: Omit<CombatCallout, 'id' | 'createdAt'>) => void
) {
  const isBlocking = def.action === 'block' && !strike.unblockable;

  // Check Perfect Parry (< 175ms since pressing Block)
  if (isBlocking && nowMs - def.lastBlockPressTime <= PARRY_WINDOW_MS) {
    def.action = 'parry_flash';
    def.actionTimerMs = 0;
    def.actionDurationMs = 220;
    def.meter = Math.min(100, def.meter + 24);
    def.hp = Math.min(def.maxHp, def.hp + 5); // Slight rally heal on parry
    atk.vx = -atk.facing * 3.5;

    soundEngine.playBlock(true);
    events.cameraShake = 0.25;
    events.sparkWorldPos = { x: (atk.x + def.x) * 0.5, y: 1.1, color: 0xfef08a };
    onCallout({
      text: 'PERFECT PARRY!',
      subtext: '+24% TACTICAL METER · FRAME ADVANTAGE',
      x: def.x,
      y: 2.1,
      color: '#fde047',
    });
    return;
  }

  // Guard Crush effect breaks block!
  if (isBlocking && strike.effect !== 'guard_crush') {
    const finalChip = strike.effect === 'pierce' ? Math.round(strike.damage * 0.5) : strike.chipDamage;
    def.hp = Math.max(1, def.hp - finalChip);
    def.guardGauge = Math.max(0, def.guardGauge - strike.damage * 1.3);
    def.meter = Math.min(100, def.meter + 6);
    def.vx = atk.facing * strike.knockback * 0.55;

    if (def.guardGauge <= 0) {
      // Guard Broken!
      def.guardGauge = 50;
      def.action = 'hitstun';
      def.actionTimerMs = 0;
      def.actionDurationMs = 680;
      soundEngine.playHit('heavy');
      onCallout({
        text: 'GUARD BROKEN!',
        x: def.x,
        y: 1.9,
        color: '#f43f5e',
      });
    } else {
      soundEngine.playBlock(false);
      events.sparkWorldPos = { x: (atk.x + def.x) * 0.5, y: 1.0, color: 0x93c5fd };
    }
    return;
  }

  // Clean Hit!
  // Combo scaling so infinite loops don't 1-shot, while rewarding 3-5 hit combos
  const scaling = Math.max(0.45, 1 - def.hitCount * 0.08);
  const actualDamage = Math.max(2, Math.round(strike.damage * scaling));

  def.hp = Math.max(0, def.hp - actualDamage);
  def.hitCount += 1;
  def.comboDamageAccum += actualDamage;
  def.hitFlashTimerMs = 130;
  def.meter = Math.min(100, def.meter + 8);

  // Rally tiny bit of recoverable HP for attacker on aggressive combos
  if (atk.hp < atk.recoverableHp) {
    atk.hp = Math.min(atk.recoverableHp, atk.hp + Math.ceil(actualDamage * 0.15));
  }

  if (def.superArmorActive && !strike.isSpecial && strike.effect !== 'guard_crush') {
    // Super-armor absorbs the hitstun!
    soundEngine.playHit('light');
    events.sparkWorldPos = { x: def.x, y: 1.1, color: 0xf59e0b };
    onCallout({
      text: 'SUPER ARMOR!',
      subtext: `-${actualDamage} HP`,
      x: def.x,
      y: 1.8,
      color: '#fbbf24',
    });
    return;
  }

  // Apply hitstun & physics
  def.action = strike.launchY > 4.0 ? 'knockdown' : 'hitstun';
  def.actionTimerMs = 0;
  def.actionDurationMs = strike.hitstunMs;
  def.superArmorActive = false;

  if (strike.effect === 'vortex') {
    // Pull opponent toward attacker
    def.vx = -atk.facing * 3.8;
    def.vy = 3.2;
  } else {
    def.vx = atk.facing * strike.knockback;
    if (strike.launchY > 0 || def.y > 0.1) {
      def.vy = Math.max(strike.launchY, 3.8);
    }
  }

  const isBigHit = strike.damage >= 20 || strike.isSpecial || Boolean(strike.effect);
  soundEngine.playHit(strike.isSpecial ? 'special' : isBigHit ? 'heavy' : 'light');
  events.cameraShake = isBigHit ? 0.32 : 0.14;
  events.sparkWorldPos = {
    x: (atk.x + def.x) * 0.5,
    y: 1.05 + def.y * 0.5,
    color: strike.isSpecial ? 0xf59e0b : isBigHit ? 0xf43f5e : 0x38bdf8,
  };

  if (strike.underdogBonusPct > 0 && atk.specialHitsRemaining === 0) {
    onCallout({
      text: `GIANT SLAYER +${strike.underdogBonusPct}%!`,
      subtext: `${def.hitCount} HIT COMBO · ${def.comboDamageAccum} DMG`,
      x: def.x,
      y: 2.2,
      color: '#34d399',
    });
  } else if (def.hitCount >= 2) {
    onCallout({
      text: `${def.hitCount} HIT COMBO!`,
      subtext: `${def.comboDamageAccum} TOTAL DMG`,
      x: def.x,
      y: 1.85,
      color: isBigHit ? '#f59e0b' : '#38bdf8',
    });
  }
}

export function updateFighterAI(
  ai: FighterRuntime,
  opponent: FighterRuntime,
  dtSeconds: number,
  nowMs: number,
  onCallout: (c: Omit<CombatCallout, 'id' | 'createdAt'>) => void
) {
  if (
    ai.hp <= 0 ||
    opponent.hp <= 0 ||
    ai.action === 'hitstun' ||
    ai.action === 'knockdown' ||
    ai.action === 'special'
  ) {
    return;
  }

  const dist = Math.abs(opponent.x - ai.x);
  const preferredRange = ai.spec.light.range * 0.92;

  // Defensive reaction if opponent is swinging right in front of AI
  const oppAttacking =
    opponent.action.startsWith('light') ||
    opponent.action.startsWith('heavy') ||
    opponent.action === 'combo_finisher' ||
    opponent.action === 'special';

  if (oppAttacking && dist < opponent.spec.heavy.range * 1.15) {
    if (ai.action === 'idle' || ai.action === 'walk_fwd' || ai.action === 'walk_back') {
      if (Math.random() < 0.38) {
        ai.lastBlockPressTime = nowMs - 80; // Occasional smart guard
        ai.action = 'block';
        ai.vx = 0;
        return;
      }
    }
  } else if (ai.action === 'block' && !oppAttacking) {
    ai.action = 'idle';
  }

  // If currently mid-combo, chain the next hit of one of its archetype recipes!
  const isAiAttacking = ai.action.startsWith('light') || ai.action.startsWith('heavy');
  if (isAiAttacking && ai.actionTimerMs >= ai.actionDurationMs * 0.48) {
    if (dist <= ai.spec.heavy.range * 1.15 && Math.random() < 0.45) {
      const targetRecipe = ai.spec.combos[Math.floor(Math.random() * ai.spec.combos.length)];
      const nextStep = targetRecipe.sequence[ai.comboBuffer.length] || 'H';
      triggerFighterAttack(ai, nextStep, onCallout);
      return;
    }
  }

  if (ai.action !== 'idle' && ai.action !== 'walk_fwd' && ai.action !== 'walk_back') {
    return;
  }

  // Unleash Special Move if meter is full and within range!
  if (
    ai.meter >= ai.spec.special.meterCost &&
    dist <= ai.spec.special.range * 0.88 &&
    Math.random() < dtSeconds * 2.4
  ) {
    triggerFighterAttack(ai, 'S', onCallout);
    return;
  }

  // Spacing & Footsies
  if (dist > preferredRange + 0.35) {
    if (dist > 3.6 && Math.random() < dtSeconds * 1.5) {
      triggerFighterDash(ai, true);
    } else {
      ai.action = 'walk_fwd';
      ai.vx = ai.facing * ai.spec.walkSpeed;
    }
  } else {
    // In strike range!
    ai.vx = 0;
    const roll = Math.random();
    if (roll < dtSeconds * 4.2) {
      const attackType: AttackInput = Math.random() < 0.65 ? 'L' : 'H';
      triggerFighterAttack(ai, attackType, onCallout);
    } else if (roll < dtSeconds * 5.0) {
      ai.action = 'walk_back';
      ai.vx = -ai.facing * ai.spec.walkSpeed * 0.75;
    } else {
      ai.action = 'idle';
    }
  }
}
