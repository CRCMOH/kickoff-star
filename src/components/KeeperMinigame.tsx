import { useEffect, useRef, useState } from 'react'
import type { ExecutionGrade, ExecutionSpec } from '../engine/execution'
import { gradeFromStop } from '../engine/execution'
import { sfx } from '../engine/audio'
import { haptics } from '../engine/haptics'
import type { ChanceTier } from '../engine/match'

// P67 — keeper shot-stopping, the mirror of ShootingMinigame from the other
// side of the ball. A shot is coming in; read the striker's body shape and
// commit to a dive direction. Same contract/grading.
// P67 (parameterization pass) — mirrors ShootingMinigame's tier logic: the
// better the attacker's chance, the further from center the shot is
// genuinely placed, meaning a longer real dive to reach it.

const SHOT_PLACEMENT: Record<ChanceTier, number> = { clear: 0.78, good: 0.7, half: 0.6 }

export default function KeeperMinigame({ spec, label, onResolve, tier = 'good' }: {
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
  const TARGET = SHOT_PLACEMENT[tier]

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
        <span className="text-[10px] text-ks-muted">{locked ? '' : ready ? 'tap to dive' : 'reading his shape…'}</span>
      </div>

      <button
        onClick={lock}
        disabled={!!locked || !ready}
        className="relative w-full h-40 rounded-xl border border-ks-border bg-gradient-to-b from-[#1a3a1e] to-[#0f2412] overflow-hidden active:scale-[0.995] transition-transform disabled:active:scale-100"
      >
        {/* goal frame — you're standing in it this time */}
        <div className="absolute left-[8%] right-[8%] top-3 h-20 border-2 border-white/70 border-b-0" />
        <div className="absolute left-[8%] right-[8%] top-3 h-20 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 6px,#fff 6px,#fff 7px),repeating-linear-gradient(90deg,transparent,transparent 6px,#fff 6px,#fff 7px)' }} />

        {/* the real save window across the goal mouth */}
        {[
          { half: spec.ok, cls: 'bg-orange-500/20' },
          { half: spec.good, cls: 'bg-ks-gold/30' },
          { half: spec.perfect, cls: 'bg-green-500/45' },
        ].map((z, i) => (
          <div
            key={i}
            className={`absolute top-3 h-20 ${z.cls}`}
            style={{ left: `${8 + (TARGET - z.half) * 84}%`, width: `${z.half * 168}%` }}
          />
        ))}

        {/* the striker, below the goal, shot already struck */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-4 h-6 bg-red-500 rounded-sm -mt-0.5" />
        </div>

        {/* you, diving toward the read */}
        <div
          className="absolute top-9 w-4 h-8 bg-ks-gold rounded-sm transition-none"
          style={{ left: `${8 + marker * 84}%`, transform: 'translateX(-50%)' }}
        />
      </button>

      {locked && (
        <div className={`text-center font-display text-xs tracking-widest uppercase ${locked.grade === 'perfect' ? 'text-green-500' : locked.grade === 'good' ? 'text-ks-gold' : locked.grade === 'ok' ? 'text-orange-500' : 'text-red-500'}`}>
          {locked.grade === 'perfect' ? 'brilliant save' : locked.grade === 'good' ? 'palmed away' : locked.grade === 'ok' ? 'parried, dangerous rebound' : 'beaten'}
        </div>
      )}
    </div>
  )
}
