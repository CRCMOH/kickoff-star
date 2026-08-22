import { useEffect, useRef, useState } from 'react'
import type { ExecutionGrade, ExecutionSpec } from '../engine/execution'
import { gradeFromStop, GRADE_LABEL, GRADE_COLOR } from '../engine/execution'
import { sfx } from '../engine/audio'
import { haptics } from '../engine/haptics'

// The skill input. A marker sweeps the track; tap to stop it in the zone.
// Deliberately one tap and under two seconds — this sits inside a match, so it has
// to be readable at a glance and never feel like a minigame you have to survive.

const TARGET = 0.5 // zone is centred; the sweep is what varies

export default function TimingBar({ spec, label, onResolve }: {
  spec: ExecutionSpec
  label: string
  onResolve: (grade: ExecutionGrade, position: number) => void
}) {
  const [position, setPosition] = useState(0)
  const [locked, setLocked] = useState<{ pos: number; grade: ExecutionGrade } | null>(null)
  // P44 — real playtester feedback: "timed events are too quick for a first
  // time player, a small countdown would be nice." The marker used to start
  // sweeping the instant this mounted, giving zero time to even see where the
  // zones are before having to react. A brief still beat fixes that without
  // changing the actual skill window once it starts.
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
      // ping-pong across the track so there's always a run-up to read
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
    // brief beat so the player sees where they landed before the outcome
    window.setTimeout(() => onResolve(grade, position), 620)
  }

  const zone = (halfWidth: number, className: string) => (
    <div
      className={`absolute inset-y-0 ${className}`}
      style={{ left: `${(TARGET - halfWidth) * 100}%`, width: `${halfWidth * 200}%` }}
    />
  )

  const marker = locked ? locked.pos : position

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-display tracking-widest text-[10px] text-ks-gold uppercase">{label}</span>
        <span className="text-[10px] text-ks-muted">
          {locked ? '' : ready ? 'tap to strike' : 'get ready…'}
        </span>
      </div>

      <button
        onClick={lock}
        disabled={!!locked || !ready}
        className="relative w-full h-14 rounded-xl border border-ks-border bg-[#0f0f0d] overflow-hidden active:scale-[0.995] transition-transform disabled:active:scale-100"
      >
        {/* zones, widest first so they layer correctly */}
        {zone(spec.ok, 'bg-orange-500/15')}
        {zone(spec.good, 'bg-ks-gold/25')}
        {zone(spec.perfect, 'bg-green-500/40')}

        {/* centre line */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-ks-ink/50" />

        {/* the marker */}
        <div
          className="absolute inset-y-1 w-1 rounded-full bg-ks-ink shadow-[0_0_12px_rgba(255,255,255,0.6)]"
          style={{ left: `calc(${marker * 100}% - 2px)` }}
        />
      </button>

      <div className="h-4 text-center">
        {locked && (
          <span className={`font-display tracking-widest text-[11px] uppercase ${GRADE_COLOR[locked.grade]}`}>
            {GRADE_LABEL[locked.grade]}
          </span>
        )}
      </div>
    </div>
  )
}
