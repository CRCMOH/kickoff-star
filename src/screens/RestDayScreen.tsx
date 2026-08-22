import { useState } from 'react'
import type { Player } from '../types/player'
import {
  REST_OPTIONS, netEnergyFor, bandSpec, type RestChoice,
} from '../engine/energy'
import { EnergyMeter } from '../components/EnergySheet'

// Phase 11: the rest day used to auto-resolve into a silent stamina top-up.
// It's now the off-pitch loop's decision point — the one moment each week where
// the player chooses what to trade energy for.

export default function RestDayScreen({ player, onChoose }: {
  player: Player
  onChoose: (choice: RestChoice) => void
}) {
  const [selected, setSelected] = useState<RestChoice>('full-rest')
  const spec = bandSpec(player.fitness.stamina)
  const net = netEnergyFor(player, selected)
  const projected = Math.max(0, Math.min(100, player.fitness.stamina + net))
  const selectedOption = REST_OPTIONS.find((o) => o.id === selected)!

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col px-4 py-8">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(212,175,55,0.06), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }}
      />
      <div className="relative z-10 max-w-md mx-auto w-full flex flex-col flex-1">
        <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-1">sunday</div>
        <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-1">rest day</h1>
        <p className="text-ks-muted text-sm mb-5">How you spend it is up to you.</p>

        <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-3 py-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display tracking-widest text-[10px] text-ks-muted uppercase">energy now</span>
            <span className={`text-[10px] uppercase tracking-wider ${spec.colorClass}`}>{spec.label}</span>
          </div>
          <EnergyMeter stamina={player.fitness.stamina} showLabel={false} />
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-ks-border/40">
            <span className="text-[10px] text-ks-muted uppercase tracking-wider">after this choice</span>
            <span className={`font-display text-sm ${net >= 0 ? 'text-green-500' : 'text-orange-500'}`}>
              {projected} <span className="text-[10px]">({net >= 0 ? '+' : ''}{net})</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {REST_OPTIONS.map((opt) => {
            const isSelected = opt.id === selected
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`text-left rounded-xl border px-3 py-2.5 transition-colors active:scale-[0.99] ${
                  isSelected ? 'border-ks-gold bg-ks-gold/10' : 'border-ks-border bg-[#0f0f0d]'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-display tracking-wide text-sm ${isSelected ? 'text-ks-gold' : 'text-ks-ink'}`}>
                    {opt.label}
                  </span>
                  <span className={`font-display text-[11px] ${
                    netEnergyFor(player, opt.id) >= 0 ? 'text-green-500' : 'text-orange-500'
                  }`}>
                    {netEnergyFor(player, opt.id) >= 0 ? '+' : ''}{netEnergyFor(player, opt.id)} energy
                  </span>
                </div>
                <p className="text-[11px] text-ks-muted leading-relaxed">{opt.blurb}</p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  {opt.confidenceDelta > 0 && (
                    <span className="text-[9px] text-green-500 uppercase tracking-wider">+{opt.confidenceDelta} confidence</span>
                  )}
                  {opt.trustDelta > 0 && (
                    <span className="text-[9px] text-green-500 uppercase tracking-wider">+{opt.trustDelta} coach trust</span>
                  )}
                  {opt.injuryHistoryRelief > 0 && (
                    <span className="text-[9px] text-green-500 uppercase tracking-wider">lower injury risk</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* honest warning rather than a hard block — the player is allowed to make bad calls */}
        {selectedOption.energyCost > 0 && spec.band === 'drained' && (
          <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 mb-4">
            <p className="text-[11px] text-orange-400 leading-relaxed">
              You're already drained. Doing extra now means starting the week worse than you finished it.
            </p>
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={() => onChoose(selected)}
          className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.25)] active:scale-[0.99] transition-transform"
        >
          confirm — {selectedOption.label}
        </button>
      </div>
    </div>
  )
}
