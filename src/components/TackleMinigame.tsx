import { useEffect, useRef, useState } from 'react'
import type { ExecutionGrade, ExecutionSpec } from '../engine/execution'
import { gradeFromStop } from '../engine/execution'
import { sfx } from '../engine/audio'
import { haptics } from '../engine/haptics'
import type { ChanceTier } from '../engine/match'

// P67 — last-ditch tackle. An attacker closing on goal; too early is a
// foul risk, too late and they're past you. Same contract/grading.
// P67 (parameterization pass) — real chance tier sets how much room you
// actually have: a half-chance defensive situation means the attacker's
// already bearing down (starts closer), a clear defensive read gives more
// time before they arrive.

const TARGET = 0.5
const START_GAP: Record<ChanceTier, number> = { clear: 0.55, good: 0.4, half: 0.25 }

export default function TackleMinigame({ spec, label, onResolve, tier = 'good' }: {
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
        <span className="text-[10px] text-ks-muted">{locked ? '' : ready ? 'tap to make the challenge' : 'tracking his run…'}</span>
      </div>

      <button
        onClick={lock}
        disabled={!!locked || !ready}
        className="relative w-full h-32 rounded-xl border border-ks-border bg-gradient-to-b from-[#1a3a1e] to-[#0f2412] overflow-hidden active:scale-[0.995] transition-transform disabled:active:scale-100"
      >
        {/* zones — the real window to win the ball clean */}
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

        {/* the attacker, closing in from the right — how much ground they
            cover is scaled by the real chance tier, less room on a
            half-chance, more warning on a clear defensive read */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-red-500/80 rounded-sm"
          style={{ right: `${8 + (1 - marker) * 76 * (START_GAP[tier] / 0.4)}%` }}
        />

        {/* you, planted, timing the lunge */}
        <div className="absolute top-1/2 -translate-y-1/2 left-[8%] w-4 h-8 bg-ks-gold rounded-sm" />
      </button>

      {locked && (
        <div className={`text-center font-display text-xs tracking-widest uppercase ${locked.grade === 'perfect' ? 'text-green-500' : locked.grade === 'good' ? 'text-ks-gold' : locked.grade === 'ok' ? 'text-orange-500' : 'text-red-500'}`}>
          {locked.grade === 'perfect' ? 'won it clean' : locked.grade === 'good' ? 'got there first' : locked.grade === 'ok' ? 'scrappy, but cleared' : 'beaten'}
        </div>
      )}
    </div>
  )
}
