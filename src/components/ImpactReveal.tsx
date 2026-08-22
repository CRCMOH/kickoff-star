import { useState } from 'react'
import AnimatedNumber from './AnimatedNumber'
import FanReactions from './FanReactions'

// P47 — Joel: "the post-match screen needs to show how that match impacted
// your relationships, and it should show the actual number increase, not
// just a green bar." Worth being precise about what's real here: raw
// attributes (passing/shooting/etc) do NOT move from a single match by
// design — only training changes those. What genuinely DOES move from a
// match is confidence, coach trust, reputation, and standing with the
// dressing room and the fans. This screen shows exactly those, with the
// real before/after numbers ticking, not a color change standing in for a
// number the player never actually sees.

export interface ImpactSnapshot {
  confidence: number
  coachTrust: number
  reputation: number
  teammates: number
  fans: number
}

interface Row {
  label: string
  before: number
  after: number
  decimals?: number
  min?: number
  max?: number
}

function ImpactRow({ label, before, after, decimals = 1, min = -10, max = 10 }: Row) {
  const delta = Math.round((after - before) * 10) / 10
  const isUp = delta > 0.05
  const isDown = delta < -0.05
  // P58 — reference video: post-match deltas shown big and bold directly on
  // the row, plus a real bar behind the number — this used to be numbers
  // only, no bar at all, and the delta was a small tucked-away +/- figure.
  const pct = Math.max(0, Math.min(100, ((after - min) / (max - min)) * 100))
  return (
    <div className="py-2.5 border-b border-ks-border/50 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] text-ks-ink">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-display text-ks-ink text-base tabular-nums">
            <AnimatedNumber from={before} to={after} decimals={decimals} />
          </span>
          {(isUp || isDown) && (
            <span className={`text-sm font-display font-black tabular-nums ${isUp ? 'text-green-500' : 'text-red-500'}`}>
              {isUp ? '+' : ''}{delta.toFixed(decimals)}
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[#2a2a27] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${isUp ? 'bg-green-500' : isDown ? 'bg-red-500' : 'bg-ks-gold'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function ImpactReveal({ before, after, playerName, rating, goals, assists, won, drew, onDone }: {
  before: ImpactSnapshot
  after: ImpactSnapshot
  playerName: string
  rating: number
  goals: number
  assists: number
  won: boolean
  drew: boolean
  onDone: () => void
}) {
  const [shown, setShown] = useState(false)
  // a beat before the numbers start moving, so the tick genuinely reads as motion
  useState(() => { window.setTimeout(() => setShown(true), 150) })

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 25%, rgba(212,175,55,0.06), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-1">this week's impact</div>
          <p className="text-[11px] text-ks-muted">what this match actually changed</p>
        </div>

        <div className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-2 mb-5">
          <ImpactRow label="Confidence" before={before.confidence} after={shown ? after.confidence : before.confidence} />
          <ImpactRow label="Coach Trust" before={before.coachTrust} after={shown ? after.coachTrust : before.coachTrust} />
          <ImpactRow label="Reputation" before={before.reputation} after={shown ? after.reputation : before.reputation} decimals={0} min={0} max={100} />
          <ImpactRow label="Dressing Room" before={before.teammates} after={shown ? after.teammates : before.teammates} decimals={0} min={-100} max={100} />
          <ImpactRow label="Supporters" before={before.fans} after={shown ? after.fans : before.fans} decimals={0} min={-100} max={100} />
        </div>

        {/* P54 — Joel: "the page just has 3 things on it, make it feel more
            filled." Reusing real data already on this screen (the fan
            standing delta above) rather than inventing a 4th number just to
            fill space. */}
        <div className="mb-2">
          <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-2">the reaction</div>
          <FanReactions
            playerName={playerName} rating={rating} goals={goals} assists={assists} won={won} drew={drew}
            fansDelta={after.fans - before.fans}
          />
        </div>

        <button onClick={onDone} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)] mt-4">
          continue
        </button>
      </div>
    </div>
  )
}
