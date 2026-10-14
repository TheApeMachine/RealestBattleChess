import React from 'react';
import { calculateSpecialHitDamage } from '../data/archetypes';
import {
  AttackInput,
  CombatCallout,
  FighterRuntime,
  GamePhase,
} from '../types/game';
import { Shield, Swords, Zap, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

interface CombatHudOverlayProps {
  phase: GamePhase;
  attacker: FighterRuntime | null;
  defender: FighterRuntime | null;
  fightTimer: number;
  duelSquareName: string;
  callouts: CombatCallout[];
  dockCollapsed: boolean;
  onToggleDock: () => void;
  onPlayerInput: (
    action: 'left' | 'right' | 'jump' | 'block_down' | 'block_up' | 'dash_fwd' | 'dash_back' | AttackInput
  ) => void;
}

export const CombatHudOverlay: React.FC<CombatHudOverlayProps> = ({
  phase,
  attacker,
  defender,
  fightTimer,
  duelSquareName,
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

  // Determine which fighter the human player controls (if both AI or PvP, default left or human side)
  const humanFighter = !attacker.isAI ? attacker : !defender.isAI ? defender : attacker;
  const opponentFighter = humanFighter === attacker ? defender : attacker;
  const specialCalc = calculateSpecialHitDamage(humanFighter.spec, opponentFighter.spec);
  const canUseSpecial = humanFighter.meter >= humanFighter.spec.special.meterCost;

  const atkHpPct = Math.max(0, Math.min(100, (attacker.hp / attacker.maxHp) * 100));
  const atkRecPct = Math.max(0, Math.min(100, (attacker.recoverableHp / attacker.maxHp) * 100));
  const defHpPct = Math.max(0, Math.min(100, (defender.hp / defender.maxHp) * 100));
  const defRecPct = Math.max(0, Math.min(100, (defender.recoverableHp / defender.maxHp) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 md:p-6">
      {/* Top Fighting Game Vitality & Meter HUD */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-11 items-start gap-3 bg-[#0B0E17]/95 border border-slate-800/90 px-4 py-3 rounded-xl shadow-2xl">
          {/* Left Fighter: Attacker */}
          <div className="col-span-5 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2 truncate">
                <span className="font-display text-sm md:text-base font-bold tracking-wide text-amber-400 truncate">
                  {attacker.spec.warriorTitle}
                </span>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {attacker.spec.chessName} · Val {attacker.spec.tacticalValue} · Attacker
                </span>
              </div>
              <span className="font-mono text-xs md:text-sm font-semibold tabular-nums text-slate-100 shrink-0">
                {attacker.hp} / {attacker.maxHp} HP
              </span>
            </div>

            {/* Health Bar */}
            <div className="relative h-4 w-full overflow-hidden rounded bg-slate-900 border border-slate-700/80">
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
                <div className="flex justify-between text-[11px] text-slate-400 font-mono tabular-nums">
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
                <div className="flex justify-between text-[11px] font-mono tabular-nums">
                  <span className={attacker.meter >= attacker.spec.special.meterCost ? 'text-amber-300 font-semibold' : 'text-slate-400'}>
                    TACTICAL METER ({attacker.spec.special.meterCost}% REQ)
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

          {/* Center Clash Clock & Square */}
          <div className="col-span-1 flex flex-col items-center justify-center text-center pt-0.5">
            <span className="text-[10px] font-mono tracking-widest text-slate-400">
              SQUARE {duelSquareName}
            </span>
            <div className="my-0.5 font-mono text-2xl md:text-3xl font-bold tabular-nums text-white">
              {Math.ceil(fightTimer)}
            </div>
            <span className="text-[10px] font-mono text-amber-400/90">
              DUEL CLOCK
            </span>
          </div>

          {/* Right Fighter: Defender */}
          <div className="col-span-5 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs md:text-sm font-semibold tabular-nums text-slate-100 shrink-0">
                {defender.hp} / {defender.maxHp} HP
              </span>
              <div className="flex items-baseline gap-2 truncate justify-end">
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  Defender · Val {defender.spec.tacticalValue} · {defender.spec.chessName}
                </span>
                <span className="font-display text-sm md:text-base font-bold tracking-wide text-rose-400 truncate">
                  {defender.spec.warriorTitle}
                </span>
              </div>
            </div>

            {/* Health Bar (Right-to-Left fill) */}
            <div className="relative h-4 w-full overflow-hidden rounded bg-slate-900 border border-slate-700/80">
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
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-rose-300">{Math.round(defender.meter)}%</span>
                  <span className={defender.meter >= defender.spec.special.meterCost ? 'text-rose-300 font-semibold' : 'text-slate-400'}>
                    METER ({defender.spec.special.meterCost}% REQ)
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
                <div className="flex justify-between text-[11px] text-slate-400 font-mono tabular-nums">
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

        {/* Live Combo Counters & Tactical Callouts */}
        <div className="mt-3 flex items-start justify-between px-2">
          {/* Left Combo Counter */}
          <div className="min-h-[48px]">
            {defender.hitCount >= 2 && (
              <div className="bg-[#0B0E17]/90 border border-amber-500/50 px-3 py-1.5 rounded-lg">
                <div className="font-display text-xl font-extrabold text-amber-400 tabular-nums">
                  {defender.hitCount} HIT COMBO
                </div>
                <div className="font-mono text-xs text-slate-300 tabular-nums">
                  {defender.comboDamageAccum} DAMAGE · {attacker.comboBuffer.join(' → ') || 'FINISHER'}
                </div>
              </div>
            )}
          </div>

          {/* Center Dynamic Callouts */}
          <div className="flex flex-col items-center gap-1">
            {phase === 'FIGHT_INTRO' && (
              <div className="bg-[#0B0E17]/95 border border-amber-500/60 px-6 py-2 rounded-xl text-center shadow-2xl">
                <div className="text-xs font-mono text-slate-400">
                  {attacker.spec.chessName.toUpperCase()} (VAL {attacker.spec.tacticalValue}) CHALLENGES {defender.spec.chessName.toUpperCase()} (VAL {defender.spec.tacticalValue})
                </div>
                <div className="font-display text-2xl md:text-3xl font-extrabold text-amber-400 tracking-wider">
                  ENGAGE FOR SQUARE {duelSquareName}
                </div>
              </div>
            )}
            {callouts.slice(-2).map((c) => (
              <div
                key={c.id}
                className="bg-[#0B0E17]/95 border border-slate-700 px-4 py-1.5 rounded-lg text-center shadow-lg"
              >
                <div className="font-display text-base md:text-lg font-bold tracking-wide" style={{ color: c.color }}>
                  {c.text}
                </div>
                {c.subtext && (
                  <div className="font-mono text-[11px] text-slate-300">
                    {c.subtext}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right Combo Counter */}
          <div className="min-h-[48px] text-right">
            {attacker.hitCount >= 2 && (
              <div className="bg-[#0B0E17]/90 border border-rose-500/50 px-3 py-1.5 rounded-lg">
                <div className="font-display text-xl font-extrabold text-rose-400 tabular-nums">
                  {attacker.hitCount} HIT COMBO
                </div>
                <div className="font-mono text-xs text-slate-300 tabular-nums">
                  {attacker.comboDamageAccum} DAMAGE
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unified Collapsible Bottom Combat Control Dock */}
      <div className="pointer-events-auto mx-auto w-full max-w-4xl flex flex-col items-center">
        <button
          onClick={onToggleDock}
          className="mb-1 px-3 py-1 text-xs font-mono text-slate-300 bg-[#0B0E17]/95 border border-slate-800 rounded-t-lg hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          {dockCollapsed ? '▴ Show Combat Controls & Combos (H)' : '▾ Hide Controls (H)'}
        </button>

        {!dockCollapsed && (
          <div className="w-full bg-[#0B0E17]/95 border border-slate-800 rounded-xl p-3 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Left: Movement & Defense Arcade Pad */}
              <div className="md:col-span-4 flex items-center justify-center md:justify-start gap-1.5">
                <button
                  onPointerDown={() => onPlayerInput('left')}
                  className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-amber-500/20 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Move Left (A / Left Arrow)"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> A
                </button>
                <button
                  onPointerDown={() => onPlayerInput('jump')}
                  className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-amber-500/20 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Jump (W / Up Arrow)"
                >
                  <ArrowUp className="w-3.5 h-3.5" /> W
                </button>
                <button
                  onPointerDown={() => onPlayerInput('right')}
                  className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-amber-500/20 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Move Right (D / Right Arrow)"
                >
                  D <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onPointerDown={() => onPlayerInput('block_down')}
                  onPointerUp={() => onPlayerInput('block_up')}
                  onPointerLeave={() => onPlayerInput('block_up')}
                  className="px-3 py-2.5 bg-sky-950/80 hover:bg-sky-900/80 border border-sky-500/40 rounded-lg text-xs font-mono text-sky-200 flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Hold to Guard, Tap right before impact for Perfect Parry (S / Down)"
                >
                  <Shield className="w-3.5 h-3.5" /> Parry / Guard (S)
                </button>
              </div>

              {/* Center: Strike & Tactical-Value Special Buttons */}
              <div className="md:col-span-4 flex items-center justify-center gap-2">
                <button
                  onPointerDown={() => onPlayerInput('L')}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-transform"
                >
                  <Swords className="w-3.5 h-3.5 text-sky-400" />
                  Light (J)
                </button>
                <button
                  onPointerDown={() => onPlayerInput('H')}
                  className="px-3.5 py-2.5 bg-rose-950/90 hover:bg-rose-900 active:scale-95 border border-rose-500/50 rounded-lg text-xs font-semibold text-rose-100 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-transform"
                >
                  <Swords className="w-3.5 h-3.5 text-rose-400" />
                  Heavy (K)
                </button>
                <button
                  onPointerDown={() => onPlayerInput('S')}
                  disabled={!canUseSpecial}
                  className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                    canUseSpecial
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300 shadow-lg'
                      : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Special (U) · {specialCalc.totalDamage} Dmg
                </button>
              </div>

              {/* Right: Active Archetype Combo Tree Reference */}
              <div className="md:col-span-4 flex flex-col gap-1 border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-200">{humanFighter.spec.chessName} Combos</span>
                  <span className="font-mono text-amber-400">
                    Buffer: {humanFighter.comboBuffer.length > 0 ? humanFighter.comboBuffer.join(' → ') : 'Ready'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {humanFighter.spec.combos.map((combo) => (
                    <div
                      key={combo.id}
                      className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1 text-left"
                    >
                      <div className="font-mono text-[11px] font-bold text-sky-400">
                        {combo.sequence.join(' · ')}
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
