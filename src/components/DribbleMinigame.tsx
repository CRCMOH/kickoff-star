import { useEffect, useRef, useState } from 'react'
import type { ExecutionGrade, ExecutionSpec } from '../engine/execution'
import { gradeFromStop } from '../engine/execution'
import { sfx } from '../engine/audio'
import { haptics } from '../engine/haptics'
import type { ChanceTier } from '../engine/match'

// P67 — 1v1 dribble. A defender squares up directly in front of you; the
// sweet spot is the moment their weight shifts, opening a lane past them.
// Same contract/grading as the rest.
// P67 (parameterization pass) — Joel: "dribble pass 1 or 2 or 3 defenders."
// The real chance tier already tracked by the match engine drives how many
// defenders actually show — clear chance = 1, good = 2, half-chance = 3.
// This is purely visual; the underlying difficulty already varies
// correctly by attributes via ExecutionSpec, this just represents that
// difficulty honestly instead of always showing the same lone defender
// regardless of how contested the real chance was.

const TARGET = 0.5
const DEFENDER_COUNT: Record<ChanceTier, number> = { clear: 1, good: 2, half: 3 }

export default function DribbleMinigame({ spec, label, onResolve, tier = 'good' }: {
  spec: ExecutionSpec
  label: string
  onResolve: (grade: ExecutionGrade, position: number) => void
  tier?: ChanceTier
}) {
  const [position, setPosition] = useState(0)
  const [locked, setLocked] = useState<{ pos: number; grade: ExecutionGrade } | null>(null)
  const [ready, setReady] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const lockedRef = useRef(false)

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setReady(true), 480)
    return () => window.clearTimeout(readyTimer)
  }, [])

  useEffect(() => {
    if (!ready) return
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t
      const elapsed = t - startRef.current
      const cycle = (elapsed % (spec.sweepMs * 2)) / spec.sweepMs
      setPosition(cycle <= 1 ? cycle : 2 - cycle)
      if (!lockedRef.current) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [spec.sweepMs, ready])

  const lock = () => {
    if (lockedRef.current || !ready) return
    lockedRef.current = true
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    const grade = gradeFromStop(position, TARGET, spec)
    if (grade === 'perfect' || grade === 'good') { sfx.perfect(); haptics.success() }
    else if (grade === 'miss') { sfx.miss(); haptics.fail() }
    else { haptics.tap() }
    setLocked({ pos: position, grade })
    window.setTimeout(() => onResolve(grade, position), 620)
  }

  const marker = locked ? locked.pos : position
  // the defender leans opposite whichever side the ball currently favours —
  // a simple, readable tell for "the gap is opening on the other side"
  const defenderLean = (marker - 0.5) * -14

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-display tracking-widest text-[10px] text-ks-gold uppercase">{label}</span>
        <span className="text-[10px] text-ks-muted">{locked ? '' : ready ? 'tap to go' : 'sizing him up…'}</span>
      </div>

      <button
        onClick={lock}
        disabled={!!locked || !ready}
        className="relative w-full h-32 rounded-xl border border-ks-border bg-gradient-to-b from-[#1a3a1e] to-[#0f2412] overflow-hidden active:scale-[0.995] transition-transform disabled:active:scale-100"
      >
        {/* zones — where the defender's weight is genuinely beaten */}
        {[
          { half: spec.ok, cls: 'bg-orange-500/15' },
          { half: spec.good, cls: 'bg-ks-gold/25' },
          { half: spec.perfect, cls: 'bg-green-500/40' },
        ].map((z, i) => (
          <div
            key={i}
            className={`absolute top-2 bottom-2 ${z.cls}`}
            style={{ left: `${10 + (TARGET - z.half) * 80}%`, width: `${z.half * 160}%` }}
          />
        ))}

        {/* the defender(s), spaced across your path, leaning with the read —
            count driven by the real chance tier, not always just one */}
        {Array.from({ length: DEFENDER_COUNT[tier] }).map((_, i) => {
          const spread = DEFENDER_COUNT[tier] === 1 ? [0.5] : DEFENDER_COUNT[tier] === 2 ? [0.38, 0.62] : [0.3, 0.5, 0.7]
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 w-5 h-9 bg-blue-500/80 rounded-sm transition-transform"
              style={{ left: `${spread[i] * 100}%`, transform: `translate(-50%,-50%) rotate(${i === Math.floor(DEFENDER_COUNT[tier] / 2) ? defenderLean : 0}deg)` }}
            />
          )
        })}

        {/* the ball, at your feet, tracking the burst */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border border-black/30"
          style={{ left: `${10 + marker * 80}%` }}
        />
      </button>

      {locked && (
        <div className={`text-center font-display text-xs tracking-widest uppercase ${locked.grade === 'perfect' ? 'text-green-500' : locked.grade === 'good' ? 'text-ks-gold' : locked.grade === 'ok' ? 'text-orange-500' : 'text-red-500'}`}>
          {locked.grade === 'perfect' ? 'gone, clean past him' : locked.grade === 'good' ? 'through the gap' : locked.grade === 'ok' ? 'brushed off him' : 'dispossessed'}
        </div>
      )}
    </div>
  )
}
