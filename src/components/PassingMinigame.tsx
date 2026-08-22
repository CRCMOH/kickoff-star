import { useEffect, useRef, useState } from 'react'
import type { ExecutionGrade, ExecutionSpec } from '../engine/execution'
import { gradeFromStop } from '../engine/execution'
import { sfx } from '../engine/audio'
import { haptics } from '../engine/haptics'
import type { ChanceTier } from '../engine/match'

// P67 — through-ball passing. Same drop-in contract and grading math as
// TimingBar/ShootingMinigame — a real pitch view with defenders as
// obstacles instead of an abstract bar. The gap you're threading toward is
// the sweet spot; a defender's shadow sits either side of it.
// P67 (parameterization pass) — real chance tier drives how contested the
// lane looks: a clear chance has one defender to beat, a half-chance is
// marked by three.

const TARGET = 0.5 // the gap sits centered between the defenders
const DEFENDER_COUNT: Record<ChanceTier, number> = { clear: 1, good: 2, half: 3 }

export default function PassingMinigame({ spec, label, onResolve, tier = 'good' }: {
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

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-display tracking-widest text-[10px] text-ks-gold uppercase">{label}</span>
        <span className="text-[10px] text-ks-muted">{locked ? '' : ready ? 'tap to thread it' : 'reading the lane…'}</span>
      </div>

      <button
        onClick={lock}
        disabled={!!locked || !ready}
        className="relative w-full h-32 rounded-xl border border-ks-border bg-gradient-to-b from-[#1a3a1e] to-[#0f2412] overflow-hidden active:scale-[0.995] transition-transform disabled:active:scale-100"
      >
        {/* pitch lines for context */}
        <div className="absolute inset-x-[10%] top-2 bottom-2 border-l border-r border-white/15" />

        {/* defenders flanking the gap, count driven by real chance tier */}
        {DEFENDER_COUNT[tier] === 1 ? (
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-blue-500/70 rounded-sm" style={{ left: `${10 + (TARGET + spec.ok + 0.06) * 80}%` }} />
        ) : DEFENDER_COUNT[tier] === 2 ? (
          <>
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-blue-500/70 rounded-sm" style={{ left: `${10 + (TARGET - spec.ok - 0.06) * 80}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-blue-500/70 rounded-sm" style={{ left: `${10 + (TARGET + spec.ok + 0.06) * 80}%` }} />
          </>
        ) : (
          <>
            <div className="absolute top-[30%] -translate-y-1/2 w-4 h-8 bg-blue-500/70 rounded-sm" style={{ left: `${10 + (TARGET - spec.ok - 0.1) * 80}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-blue-500/70 rounded-sm" style={{ left: `${10 + (TARGET + spec.ok + 0.06) * 80}%` }} />
            <div className="absolute top-[70%] -translate-y-1/2 w-4 h-8 bg-blue-500/70 rounded-sm" style={{ left: `${10 + TARGET * 80}%` }} />
          </>
        )}

        {/* zones showing the real gap, widest first */}
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

        {/* the ball, tracking toward the gap */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border border-black/30"
          style={{ left: `${10 + marker * 80}%` }}
        />

        {/* a teammate's run waiting on the far side */}
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-6 bg-ks-gold rounded-sm" style={{ right: '6%' }} />
      </button>

      {locked && (
        <div className={`text-center font-display text-xs tracking-widest uppercase ${locked.grade === 'perfect' ? 'text-green-500' : locked.grade === 'good' ? 'text-ks-gold' : locked.grade === 'ok' ? 'text-orange-500' : 'text-red-500'}`}>
          {locked.grade === 'perfect' ? 'splits the defense' : locked.grade === 'good' ? 'gets there' : locked.grade === 'ok' ? 'cut out late' : 'intercepted'}
        </div>
      )}
    </div>
  )
}
