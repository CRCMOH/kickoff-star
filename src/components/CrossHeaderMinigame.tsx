import { useEffect, useRef, useState } from 'react'
import type { ExecutionGrade, ExecutionSpec } from '../engine/execution'
import { gradeFromStop } from '../engine/execution'
import { sfx } from '../engine/audio'
import { haptics } from '../engine/haptics'
import type { ChanceTier } from '../engine/match'

// P67 — cross and header. Visually two beats (the cross flights in, then
// you attack it), but resolves as one grade like everything else here —
// the header is the decisive action, so that's what the timing check
// actually measures. The cross itself is shown, not skill-checked
// separately; keeping this a genuine drop-in for the existing
// spec/label/onResolve contract rather than needing changes to how a
// moment gets settled.
// P67 (parameterization pass) — real chance tier sets how tightly you're
// marked meeting the ball: a clear chance means real separation from the
// defender, a half-chance means they're right on top of you.

const TARGET = 0.5
const DEFENDER_GAP: Record<ChanceTier, number> = { clear: 0.22, good: 0.12, half: 0.04 }

export default function CrossHeaderMinigame({ spec, label, onResolve, tier = 'good' }: {
  spec: ExecutionSpec
  label: string
  onResolve: (grade: ExecutionGrade, position: number) => void
  tier?: ChanceTier
}) {
  const [crossLanded, setCrossLanded] = useState(false)
  const [position, setPosition] = useState(0)
  const [locked, setLocked] = useState<{ pos: number; grade: ExecutionGrade } | null>(null)
  const [ready, setReady] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const lockedRef = useRef(false)

  // beat 1 — the cross flights in, purely visual, ~700ms
  useEffect(() => {
    const t = window.setTimeout(() => setCrossLanded(true), 700)
    return () => window.clearTimeout(t)
  }, [])

  // beat 2 — the header timing check, only starts once the cross has landed
  useEffect(() => {
    if (!crossLanded) return
    const readyTimer = window.setTimeout(() => setReady(true), 320)
    return () => window.clearTimeout(readyTimer)
  }, [crossLanded])

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

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-display tracking-widest text-[10px] text-ks-gold uppercase">{label}</span>
        <span className="text-[10px] text-ks-muted">
          {locked ? '' : !crossLanded ? 'ball whipped in…' : ready ? 'tap to attack it' : 'meeting the cross…'}
        </span>
      </div>

      <button
        onClick={lock}
        disabled={!!locked || !ready}
        className="relative w-full h-32 rounded-xl border border-ks-border bg-gradient-to-b from-[#1a3a1e] to-[#0f2412] overflow-hidden active:scale-[0.995] transition-transform disabled:active:scale-100"
      >
        {/* the cross, arcing in from the wing during beat 1 */}
        {!crossLanded && (
          <div
            className="absolute w-2.5 h-2.5 rounded-full bg-white border border-black/30 transition-all duration-700 ease-out"
            style={{ left: '85%', top: '75%' }}
          />
        )}

        {/* the header timing check, beat 2 */}
        {crossLanded && (
          <>
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
            {/* a defender contesting the header */}
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-blue-500/70 rounded-sm" style={{ left: `${(TARGET + spec.ok + DEFENDER_GAP[tier]) * 100}%` }} />
            {/* you, timing the jump */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-ks-gold rounded-sm"
              style={{ left: `${10 + marker * 80}%` }}
            />
          </>
        )}
      </button>

      {locked && (
        <div className={`text-center font-display text-xs tracking-widest uppercase ${locked.grade === 'perfect' ? 'text-green-500' : locked.grade === 'good' ? 'text-ks-gold' : locked.grade === 'ok' ? 'text-orange-500' : 'text-red-500'}`}>
          {locked.grade === 'perfect' ? 'powers the header in' : locked.grade === 'good' ? 'gets a real connection' : locked.grade === 'ok' ? 'glancing, off target' : 'outjumped'}
        </div>
      )}
    </div>
  )
}
