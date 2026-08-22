import { useEffect, useRef, useState } from 'react'
import type { ExecutionGrade, ExecutionSpec } from '../engine/execution'
import { gradeFromStop } from '../engine/execution'
import { sfx } from '../engine/audio'
import { haptics } from '../engine/haptics'
import type { ChanceTier } from '../engine/match'

// P67 — Joel: "the mini games need to make sense... if it's a shooting
// opportunity can't we put a goal and a goalkeeper, the player chooses
// where he's gonna shoot." Same exact contract as TimingBar (spec/label/
// onResolve), same underlying gradeFromStop math and the same fairness
// rule (execution nudges the band the simulation already set, never
// overrides it) — this is a drop-in visual replacement, not a new
// balance system. The reticle sweeps across the goal mouth instead of an
// abstract bar; the "sweet spot" sits toward the far post from where the
// keeper is standing, so aiming away from the keeper visually IS the good
// zone, matching real shot-placement instinct instead of an arbitrary
// center target.
// P67 (parameterization pass) — real chance tier shifts where the keeper
// is actually standing: a half-chance means they're already set and
// central (genuinely harder to beat), a clear chance catches them still
// shifting toward one side, leaving more real space.

const KEEPER_POSITION: Record<ChanceTier, number> = { clear: 0.22, good: 0.28, half: 0.36 }

export default function ShootingMinigame({ spec, label, onResolve, tier = 'good' }: {
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
  const keeperPos = KEEPER_POSITION[tier]
  // sweet spot sits a fixed distance from wherever the keeper actually is
  // this time, capped so it never runs off the goal mouth
  const TARGET = Math.min(0.85, keeperPos + 0.44)

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
        <span className="text-[10px] text-ks-muted">{locked ? '' : ready ? 'tap to strike' : 'lining it up…'}</span>
      </div>

      <button
        onClick={lock}
        disabled={!!locked || !ready}
        className="relative w-full h-40 rounded-xl border border-ks-border bg-gradient-to-b from-[#1a3a1e] to-[#0f2412] overflow-hidden active:scale-[0.995] transition-transform disabled:active:scale-100"
      >
        {/* goal frame */}
        <div className="absolute left-[8%] right-[8%] top-3 h-20 border-2 border-white/70 border-b-0" />
        {/* net texture */}
        <div className="absolute left-[8%] right-[8%] top-3 h-20 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 6px,#fff 6px,#fff 7px),repeating-linear-gradient(90deg,transparent,transparent 6px,#fff 6px,#fff 7px)' }} />

        {/* zones along the goal mouth — widest first so they layer correctly */}
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

        {/* keeper — planted slightly toward the near side, explaining why the far side is the real opening */}
        <div className="absolute top-9 flex flex-col items-center" style={{ left: `${8 + keeperPos * 84}%`, transform: 'translateX(-50%)' }}>
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-4 h-6 bg-red-500 rounded-sm -mt-0.5" />
        </div>

        {/* aim reticle sweeping across the goal mouth */}
        <div
          className="absolute top-1 w-1 h-24 bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.8)] transition-none"
          style={{ left: `${8 + marker * 84}%`, transform: 'translateX(-50%)' }}
        />

        {/* the ball, sitting below, ready to strike */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border border-black/30" />
      </button>

      {locked && (
        <div className={`text-center font-display text-xs tracking-widest uppercase ${locked.grade === 'perfect' ? 'text-green-500' : locked.grade === 'good' ? 'text-ks-gold' : locked.grade === 'ok' ? 'text-orange-500' : 'text-red-500'}`}>
          {locked.grade === 'perfect' ? 'top corner' : locked.grade === 'good' ? 'good strike' : locked.grade === 'ok' ? 'scuffed' : 'straight at him'}
        </div>
      )}
    </div>
  )
}
