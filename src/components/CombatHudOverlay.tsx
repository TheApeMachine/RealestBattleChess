import React from 'react';
import { calculateSpecialHitDamage } from '../data/archetypes';
import {
  AttackInput,
  CombatCallout,
  FighterRuntime,
  GamePhase,
} from '../types/game';
import { Shield, Swords, Zap, ArrowLeft, ArrowRight, ArrowUp, Orbit, Clock, Eye, Crosshair } from 'lucide-react';

export type PlayerCombatInputAction =
  | 'left'
  | 'right'
  | 'jump'
  | 'block_down'
  | 'block_up'
  | 'dash_fwd'
  | 'dash_back'
  | 'phase_shift_4d'
  | 'temporal_echo'
  | AttackInput;

interface CombatHudOverlayProps {
  phase: GamePhase;
  attacker: FighterRuntime | null;
  defender: FighterRuntime | null;
  fightTimer: number;
  duelSquareName: string;
  introShotIndex: number;
  combatCameraMode: 'first_person' | 'side_arena';
  onToggleCombatCameraMode: () => void;
  callouts: CombatCallout[];
  dockCollapsed: boolean;
  onToggleDock: () => void;
  onPlayerInput: (action: PlayerCombatInputAction) => void;
}

export const CombatHudOverlay: React.FC<CombatHudOverlayProps> = ({
  phase,
  attacker,
  defender,
  fightTimer,
  duelSquareName,
  introShotIndex,
  combatCameraMode,
  onToggleCombatCameraMode,
  callouts,
  dockCollapsed,
  onToggleDock,
  onPlayerInput,
}) => {
  if (!attacker || !defender) return null;

  const isFightVisible =
    phase === 'TRANSITION_TO_FIGHT' ||
    phase === 'FIGHT_INTRO' ||
    phase === 'FIGHT_ACTIVE' ||
    phase === 'FIGHT_OUTRO';

  if (!isFightVisible) return null;

  const humanFighter = !attacker.isAI ? attacker : !defender.isAI ? defender : attacker;
  const opponentFighter = humanFighter === attacker ? defender : attacker;
  const specialCalc = calculateSpecialHitDamage(humanFighter.spec, opponentFighter.spec);
  const canUseSpecial = humanFighter.meter >= humanFighter.spec.special.meterCost;
  const canUsePhase4D = humanFighter.wPhaseCooldownMs <= 0 && humanFighter.wPhaseTimerMs <= 0;
  const canUseTemporalEcho = humanFighter.meter >= 25 && humanFighter.temporalEchoTimerMs <= 0;

  const isQuantumPhased =
    humanFighter.wPhaseTimerMs > 0 ||
    humanFighter.temporalEchoTimerMs > 0 ||
    opponentFighter.wPhaseTimerMs > 0;

  const isEnemyAttacking =
    opponentFighter.action.startsWith('light') ||
    opponentFighter.action.startsWith('heavy') ||
    opponentFighter.action === 'combo_finisher' ||
    opponentFighter.action === 'special';

  const fighterDistance = Math.abs(humanFighter.x - opponentFighter.x);
  const inStrikeRange = fighterDistance <= humanFighter.spec.light.range + 0.25;

  const atkHpPct = Math.max(0, Math.min(100, (attacker.hp / attacker.maxHp) * 100));
  const atkRecPct = Math.max(0, Math.min(100, (attacker.recoverableHp / attacker.maxHp) * 100));
  const defHpPct = Math.max(0, Math.min(100, (defender.hp / defender.maxHp) * 100));
  const defRecPct = Math.max(0, Math.min(100, (defender.recoverableHp / defender.maxHp) * 100));

  // Forward/Back relative to humanFighter.facing so First-Person controls feel 100% intuitive
  const advanceInput: PlayerCombatInputAction = humanFighter.facing === 1 ? 'right' : 'left';
  const retreatInput: PlayerCombatInputAction = humanFighter.facing === 1 ? 'left' : 'right';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[53px] bottom-0 z-20 flex flex-col justify-between px-4 py-2.5 md:px-6 md:py-3 overflow-hidden">
      {/* MODE 1: SPAGHETTI WESTERN 2.39:1 ANAMORPHIC LETTERBOX BARS & GRINDHOUSE OPTICS DURING STANDOFF INTRO */}
      {(phase === 'TRANSITION_TO_FIGHT' || phase === 'FIGHT_INTRO') && (
        <>
          <div className="fixed inset-x-0 top-[53px] h-14 bg-black z-10 border-b-2 border-amber-500/60 flex items-center justify-between px-6">
            <span className="font-mono text-[11px] tracking-[0.25em] text-amber-400 font-bold">
              ANAMORPHIC CRASH-ZOOM · {introShotIndex === 0 ? '200MM TELEPHOTO (CHALLENGER EYES)' : introShotIndex === 1 ? '200MM TELEPHOTO (DEFENDER EYES)' : 'VISOR LOCK'}
            </span>
            <span className="font-mono text-[11px] tracking-[0.2em] text-rose-400 font-bold">
              SQUARE {duelSquareName.toUpperCase()}
            </span>
          </div>
          <div className="fixed inset-x-0 bottom-0 h-16 bg-black z-10 border-t-2 border-amber-500/60" />
        </>
      )}

      {/* MODE 2: FIRST-PERSON HELMET VISOR PERIMETER & QUANTUM WAVE OVERLAY DURING ACTIVE FIGHT */}
      {phase === 'FIGHT_ACTIVE' && combatCameraMode === 'first_person' && (
        <>
          {/* Curved Helmet Visor Top/Bottom Rim Framing */}
          <div
            className={`fixed inset-x-8 top-[60px] h-8 rounded-b-[100%] border-b-2 transition-colors duration-200 ${
              isQuantumPhased
                ? 'border-cyan-400/60 shadow-[0_6px_24px_rgba(56,189,248,0.28)]'
                : isEnemyAttacking
                ? 'border-rose-500/60'
                : 'border-amber-500/25'
            }`}
          />
          {/* Quantum 4D Superposition Visor Interference Frame when Phased */}
          {isQuantumPhased && (
            <div className="fixed inset-x-4 top-[56px] bottom-4 rounded-3xl border-2 border-purple-500/45 shadow-[inset_0_0_50px_rgba(168,85,247,0.22)] pointer-events-none" />
          )}

          {/* First-Person Center Tactical Combat Reticle & Incoming Strike / Blade Clash Telegraph */}
          <div className="fixed inset-0 top-[53px] flex flex-col items-center justify-center pointer-events-none z-10">
            {humanFighter.action === 'blade_clash' ? (
              <div className="mb-12 px-5 py-2.5 bg-amber-950/95 border-2 border-amber-400 rounded-xl shadow-2xl text-center">
                <div className="font-display text-sm font-extrabold tracking-widest text-amber-300">
                  ⚔ BLADE BIND LOCK! MASH [J] OR [K] TO SHATTER ENEMY GUARD!
                </div>
                <div className="mt-1.5 h-2.5 w-64 bg-slate-900 rounded-full overflow-hidden border border-amber-400/60 mx-auto">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-yellow-200 transition-all duration-75"
                    style={{
                      width: `${Math.max(
                        10,
                        Math.min(
                          90,
                          50 + (humanFighter.clashPower - opponentFighter.clashPower) * 14
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              isEnemyAttacking && (
                <div className="mb-16 px-4 py-1 bg-rose-950/90 border-2 border-rose-400 rounded-md shadow-xl animate-pulse">
                  <span className="font-mono text-xs font-extrabold tracking-widest text-rose-200">
                    ⚠ INCOMING {opponentFighter.spec.chessName.toUpperCase()} STRIKE — HOLD / TAP [S] TO PARRY!
                  </span>
                </div>
              )
            )}

            <div
              className={`relative flex items-center justify-center w-14 h-14 rounded-full border transition-all duration-100 ${
                humanFighter.action === 'blade_clash'
                  ? 'border-amber-300 scale-125'
                  : isEnemyAttacking
                  ? 'border-rose-400/90 scale-110'
                  : inStrikeRange
                  ? 'border-amber-400/80 scale-100'
                  : 'border-slate-500/40 scale-90'
              }`}
            >
              <Crosshair
                className={`w-5 h-5 ${
                  humanFighter.action === 'blade_clash'
                    ? 'text-amber-300'
                    : isEnemyAttacking
                    ? 'text-rose-400'
                    : inStrikeRange
                    ? 'text-amber-400'
                    : 'text-slate-400/60'
                }`}
              />
            </div>

            <div className="mt-2 px-2.5 py-0.5 rounded bg-[#07090E]/85 border border-slate-800/90 font-mono text-[10px] tracking-wider">
              {isQuantumPhased ? (
                <span className="text-cyan-300 font-bold">
                  |ψ⟩ QUANTUM 4D TUNNELING ACTIVE (W = {humanFighter.wPhaseOffset > 0 ? '+1 ANA' : '-1 KATA'})
                </span>
              ) : inStrikeRange ? (
                <span className="text-amber-300 font-semibold">
                  STRIKE RANGE ({fighterDistance.toFixed(1)}m) · [J] LIGHT · [K] HEAVY · [U] SPECIAL
                </span>
              ) : (
                <span className="text-slate-300">
                  DISTANCE {fighterDistance.toFixed(1)}m · PRESS [D] OR [SHIFT] TO ADVANCE
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Top Fighting Game Vitality & Meter HUD */}
      <div className="relative z-20 mx-auto w-full max-w-5xl">
        <div
          className={`grid grid-cols-11 items-center gap-3 px-4 py-2 rounded-xl shadow-2xl border transition-colors ${
            isQuantumPhased
              ? 'bg-[#090614]/95 border-cyan-400/70'
              : 'bg-[#0B0E17]/95 border-slate-800/90'
          }`}
        >
          {/* Left Fighter: Challenger (Attacker) */}
          <div className="col-span-5 flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2 truncate">
                <span className="font-display text-sm md:text-base font-bold tracking-wide text-amber-400 truncate">
                  {attacker.spec.warriorTitle}
                </span>
                <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                  {attacker.piece.faction === 'w' ? 'SOLARIS' : 'OBSIDIAN'} · {attacker.spec.chessName.toUpperCase()} · |W={attacker.piece.w}⟩
                </span>
                {attacker.entangledPartnerName && (
                  <span className="text-[10px] font-mono font-bold text-cyan-300">
                    · |Φ⁺⟩ {attacker.entangledPartnerName.toUpperCase()}
                  </span>
                )}
                {attacker.wPhaseTimerMs > 0 && (
                  <span className="text-[10px] font-mono font-bold text-purple-300">
                    · |ψ⟩ PHASED
                  </span>
                )}
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums text-slate-100 shrink-0">
                {Math.round(attacker.hp)}/{attacker.maxHp} HP
              </span>
            </div>

            {/* Health Bar */}
            <div className="relative h-3.5 w-full overflow-hidden rounded bg-slate-900 border border-slate-700/80">
              <div
                className="absolute inset-y-0 left-0 bg-rose-500/45 transition-all duration-150"
                style={{ width: `${atkRecPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-75"
                style={{ width: `${atkHpPct}%` }}
              />
            </div>

            {/* Guard & Special Meter Row */}
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                  <span>GUARD</span>
                  <span>{Math.round(attacker.guardGauge)}%</span>
                </div>
                <div className="h-1.5 w-full rounded bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 transition-all duration-75"
                    style={{ width: `${attacker.guardGauge}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] font-mono tabular-nums">
                  <span className={attacker.meter >= attacker.spec.special.meterCost ? 'text-amber-300 font-semibold' : 'text-slate-400'}>
                    SPECIAL ({attacker.spec.special.meterCost}%)
                  </span>
                  <span className="text-amber-300">{Math.round(attacker.meter)}%</span>
                </div>
                <div className="relative h-1.5 w-full rounded bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${attacker.meter}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-white"
                    style={{ left: `${attacker.spec.special.meterCost}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Center Clash Clock & POV Toggle */}
          <div className="col-span-1 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-mono tracking-wider text-amber-400 uppercase truncate max-w-full">
              {duelSquareName}
            </span>
            <div className="font-mono text-2xl font-bold tabular-nums text-white leading-tight">
              {Math.ceil(fightTimer)}
            </div>
            <button
              onClick={onToggleCombatCameraMode}
              className="pointer-events-auto mt-0.5 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[9px] font-mono text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
              title="Toggle between First-Person Visor POV and Side Arena Camera (V Key)"
            >
              <Eye className="w-2.5 h-2.5" />
              {combatCameraMode === 'first_person' ? '1P POV (V)' : 'SIDE (V)'}
            </button>
          </div>

          {/* Right Fighter: Defender */}
          <div className="col-span-5 flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs font-semibold tabular-nums text-slate-100 shrink-0">
                {Math.round(defender.hp)}/{defender.maxHp} HP
              </span>
              <div className="flex items-baseline gap-2 truncate justify-end">
                {defender.wPhaseTimerMs > 0 && (
                  <span className="text-[10px] font-mono font-bold text-purple-300">
                    |ψ⟩ PHASED ·
                  </span>
                )}
                {defender.entangledPartnerName && (
                  <span className="text-[10px] font-mono font-bold text-cyan-300">
                    |Φ⁺⟩ {defender.entangledPartnerName.toUpperCase()} ·
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                  |W={defender.piece.w}⟩ · {defender.spec.chessName.toUpperCase()} · {defender.piece.faction === 'w' ? 'SOLARIS' : 'OBSIDIAN'}
                </span>
                <span className="font-display text-sm md:text-base font-bold tracking-wide text-rose-400 truncate">
                  {defender.spec.warriorTitle}
                </span>
              </div>
            </div>

            {/* Health Bar (Right-to-Left fill) */}
            <div className="relative h-3.5 w-full overflow-hidden rounded bg-slate-900 border border-slate-700/80">
              <div
                className="absolute inset-y-0 right-0 bg-amber-500/40 transition-all duration-150"
                style={{ width: `${defRecPct}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-600 to-rose-400 transition-all duration-75"
                style={{ width: `${defHpPct}%` }}
              />
            </div>

            {/* Guard & Special Meter Row */}
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <div className="grid grid-cols-1 gap-0.5">
                <div className="flex justify-between text-[10px] font-mono tabular-nums">
                  <span className="text-rose-300">{Math.round(defender.meter)}%</span>
                  <span className={defender.meter >= defender.spec.special.meterCost ? 'text-rose-300 font-semibold' : 'text-slate-400'}>
                    SPECIAL ({defender.spec.special.meterCost}%)
                  </span>
                </div>
                <div className="relative h-1.5 w-full rounded bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-rose-400 transition-all duration-75 ml-auto"
                    style={{ width: `${defender.meter}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-white"
                    style={{ right: `${defender.spec.special.meterCost}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                  <span>{Math.round(defender.guardGauge)}%</span>
                  <span>GUARD</span>
                </div>
                <div className="h-1.5 w-full rounded bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 transition-all duration-75 ml-auto"
                    style={{ width: `${defender.guardGauge}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Combo Counters & Standoff Title Stamps */}
        <div className="mt-2 grid grid-cols-3 items-start px-1">
          {/* Left Combo Counter */}
          <div className="justify-self-start">
            {defender.hitCount >= 2 && (
              <div className="bg-[#0B0E17]/90 border border-amber-500/50 px-3 py-1 rounded-lg">
                <div className="font-display text-base font-extrabold text-amber-400 tabular-nums">
                  {defender.hitCount} HIT COMBO · {defender.comboDamageAccum} DMG
                </div>
              </div>
            )}
          </div>

          {/* Center Dynamic Callouts */}
          <div className="justify-self-center flex flex-col items-center">
            {phase === 'FIGHT_INTRO' ? (
              <div className="bg-black/95 border-2 border-amber-400 px-6 py-2 rounded-none text-center shadow-2xl">
                {introShotIndex === 0 ? (
                  <>
                    <div className="text-[10px] font-mono tracking-[0.22em] text-amber-300 font-bold">
                      CRASH-ZOOM I · THE CHALLENGER ({attacker.spec.chessName.toUpperCase()})
                    </div>
                    <div className="font-display text-lg md:text-xl font-black text-amber-400 tracking-widest uppercase">
                      {attacker.spec.warriorTitle}
                    </div>
                  </>
                ) : introShotIndex === 1 ? (
                  <>
                    <div className="text-[10px] font-mono tracking-[0.22em] text-rose-300 font-bold">
                      CRASH-ZOOM II · THE DEFENDER ({defender.spec.chessName.toUpperCase()})
                    </div>
                    <div className="font-display text-lg md:text-xl font-black text-rose-400 tracking-widest uppercase">
                      {defender.spec.warriorTitle}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] font-mono tracking-[0.22em] text-cyan-300 font-bold">
                      ENTERING FIRST-PERSON VISOR COMBAT
                    </div>
                    <div className="font-display text-lg md:text-xl font-black text-white tracking-widest uppercase">
                      DRAW WEAPONS · FIGHT!
                    </div>
                  </>
                )}
              </div>
            ) : (
              callouts.slice(-1).map((c) => (
                <div
                  key={c.id}
                  className="bg-[#0B0E17]/95 border border-slate-700 px-4 py-1 rounded-lg text-center shadow-lg"
                >
                  <div className="font-display text-sm font-bold tracking-wide" style={{ color: c.color }}>
                    {c.text}
                  </div>
                  {c.subtext && (
                    <div className="font-mono text-[10px] text-slate-300">
                      {c.subtext}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Right Combo Counter */}
          <div className="justify-self-end text-right">
            {attacker.hitCount >= 2 && (
              <div className="bg-[#0B0E17]/90 border border-rose-500/50 px-3 py-1 rounded-lg">
                <div className="font-display text-base font-extrabold text-rose-400 tabular-nums">
                  {attacker.hitCount} HIT COMBO · {attacker.comboDamageAccum} DMG
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unified Collapsible Bottom Combat Control Dock */}
      <div className="relative z-20 pointer-events-auto mx-auto w-full max-w-5xl flex flex-col items-center">
        <button
          onClick={onToggleDock}
          className="mb-1 px-3 py-1 text-xs font-mono text-slate-300 bg-[#0B0E17]/95 border border-slate-800 rounded-t-lg hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {dockCollapsed ? '▴ Show First-Person Combat & Quantum 4D Controls (H)' : '▾ Hide Controls (H)'}
        </button>

        {!dockCollapsed && (
          <div className="w-full bg-[#0B0E17]/95 border border-slate-800 rounded-xl p-2.5 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
              {/* Left: Movement & Shield Parry Pad */}
              <div className="md:col-span-4 flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                <button
                  onPointerDown={() => onPlayerInput(retreatInput)}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-amber-500/20 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Step Back / Retreat (A / Left Arrow)"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back (A)
                </button>
                <button
                  onPointerDown={() => onPlayerInput('jump')}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-amber-500/20 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Leap (W / Up Arrow)"
                >
                  <ArrowUp className="w-3.5 h-3.5" /> Leap (W)
                </button>
                <button
                  onPointerDown={() => onPlayerInput(advanceInput)}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-amber-500/20 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Advance Forward toward Opponent (D / Right Arrow)"
                >
                  Fwd (D) <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onPointerDown={() => onPlayerInput('block_down')}
                  onPointerUp={() => onPlayerInput('block_up')}
                  onPointerLeave={() => onPlayerInput('block_up')}
                  className="px-2.5 py-2 bg-sky-950/80 hover:bg-sky-900/80 border border-sky-500/40 rounded-lg text-xs font-mono text-sky-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Raise Shield to Guard, or Tap right before impact for Perfect Parry (S / Down)"
                >
                  <Shield className="w-3.5 h-3.5" /> Parry (S)
                </button>
              </div>

              {/* Center: First-Person Strikes & Quantum 4D Superposition Actions */}
              <div className="md:col-span-5 flex flex-wrap items-center justify-center gap-1.5">
                <button
                  onPointerDown={() => onPlayerInput('L')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 rounded-lg text-xs font-semibold text-white flex items-center gap-1 whitespace-nowrap shrink-0 transition-transform cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5 text-sky-400" />
                  Light (J)
                </button>
                <button
                  onPointerDown={() => onPlayerInput('H')}
                  className="px-3 py-2 bg-rose-950/90 hover:bg-rose-900 active:scale-95 border border-rose-500/50 rounded-lg text-xs font-semibold text-rose-100 flex items-center gap-1 whitespace-nowrap shrink-0 transition-transform cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5 text-rose-400" />
                  Heavy (K)
                </button>
                <button
                  onPointerDown={() => onPlayerInput('S')}
                  disabled={!canUseSpecial}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    canUseSpecial
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300 shadow-lg'
                      : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                  title={`${humanFighter.spec.special.name}: ${specialCalc.totalDamage} DMG`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Special (U)
                </button>
                <button
                  onPointerDown={() => onPlayerInput('phase_shift_4d')}
                  disabled={!canUsePhase4D}
                  title="Quantum Tunneling along the W-axis (W = ±1) to phase through 3D attacks and cross-up behind your enemy! (Q Key)"
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    canUsePhase4D
                      ? 'bg-purple-950/90 hover:bg-purple-900 text-purple-200 border border-purple-500/50'
                      : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <Orbit className="w-3.5 h-3.5 text-purple-400" />
                  |ψ⟩ Phase (Q)
                </button>
                <button
                  onPointerDown={() => onPlayerInput('temporal_echo')}
                  disabled={!canUseTemporalEcho}
                  title="Spend 25% Meter to bifurcate into a Quantum Superposition Clone that strikes from behind! (E Key)"
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    canUseTemporalEcho
                      ? 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border border-cyan-500/50'
                      : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Echo (E)
                </button>
              </div>

              {/* Right: Active Archetype Combo Tree Reference */}
              <div className="md:col-span-3 flex flex-col gap-1 border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-200">{humanFighter.spec.chessName} Combos</span>
                  <span className="font-mono text-amber-400">
                    {humanFighter.comboBuffer.length > 0 ? humanFighter.comboBuffer.join(' → ') : 'Ready'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {humanFighter.spec.combos.map((combo) => (
                    <div
                      key={combo.id}
                      className="bg-slate-900/90 border border-slate-800 rounded px-1.5 py-1 text-left"
                    >
                      <div className="font-mono text-[10px] font-bold text-sky-400">
                        {combo.sequence.join('·')}
                      </div>
                      <div className="text-[10px] text-slate-300 truncate" title={combo.description}>
                        {combo.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
