import { useState, useEffect, useRef } from 'react'
import { sfx } from '../engine/audio'
import { haptics } from '../engine/haptics'

// ============================================================================
// PHASE 31 — TRAINING MINI-GAMES
//
// Player report: "training gets boring". It was one interaction repeated
// forever — pick an option, then hit a timing bar. Every drill in every
// session, all career.
//
// These are three genuinely different inputs, chosen per drill so a session
// mixes them up. Each returns the same 0-1 quality score the decision path
// already produces, so the grading, objective and growth systems underneath
// are untouched and stay balanced — only the way you EARN the score changes.
//
//   RONDO     tap in rhythm as the ball goes round. Tests timing consistency.
//   TARGETS   hit the lit zones before they expire. Tests speed and accuracy.
//   SPRINT    alternate taps to drive the shuttle run. Tests sustained effort.
// ============================================================================

export type MiniGameKind = 'rondo' | 'targets' | 'sprint'

export interface MiniGameProps {
  kind: MiniGameKind
  label: string
  /** Difficulty from the drill's ceiling, 0-1 — higher is easier. */
  ceiling: number
  onComplete: (quality: number) => void
}

export default function TrainingMiniGame({ kind, label, ceiling, onComplete }: MiniGameProps) {
  if (kind === 'rondo') return <Rondo label={label} ceiling={ceiling} onComplete={onComplete} />
  if (kind === 'targets') return <Targets label={label} ceiling={ceiling} onComplete={onComplete} />
  return <Sprint label={label} ceiling={ceiling} onComplete={onComplete} />
}

function Shell({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <div className="font-display tracking-widest text-[10px] text-ks-gold uppercase">{label}</div>
        <div className="text-[10px] text-ks-muted">{hint}</div>
      </div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RONDO — tap when the ball reaches the highlighted player. Rhythm and timing.
// ---------------------------------------------------------------------------
function Rondo({ label, ceiling, onComplete }: { label: string; ceiling: number; onComplete: (q: number) => void }) {
  const SLOTS = 6
  const ROUNDS = 5
  const speed = 620 - (1 - ceiling) * 220 // harder drills move faster
  const [active, setActive] = useState(0)
  const [target, setTarget] = useState(2)
  const [round, setRound] = useState(0)
  const [hits, setHits] = useState<number[]>([])
  const [flash, setFlash] = useState<'good' | 'miss' | null>(null)
  const activeRef = useRef(0)

  useEffect(() => {
    const t = window.setInterval(() => {
      setActive((a) => {
        const next = (a + 1) % SLOTS
        activeRef.current = next
        return next
      })
    }, speed)
    return () => window.clearInterval(t)
  }, [speed])

  const tap = () => {
    // distance from the target slot, wrapped
    const d = Math.min(Math.abs(activeRef.current - target), SLOTS - Math.abs(activeRef.current - target))
    const quality = d === 0 ? 1 : d === 1 ? 0.55 : 0.15
    if (quality >= 0.55) { sfx.perfect(); haptics.hit() } else { sfx.miss(); haptics.fail() }
    setFlash(quality >= 0.55 ? 'good' : 'miss')
    window.setTimeout(() => setFlash(null), 220)
    const next = [...hits, quality]
    setHits(next)
    if (next.length >= ROUNDS) {
      onComplete(next.reduce((a, b) => a + b, 0) / next.length)
    } else {
      setRound((r) => r + 1)
      setTarget(Math.floor(Math.random() * SLOTS))
    }
  }

  return (
    <Shell label={label} hint={`Tap when the ball reaches the gold player · ${round + 1}/${ROUNDS}`}>
      <div className="relative aspect-square max-h-56 mx-auto w-full max-w-[14rem]">
        {Array.from({ length: SLOTS }).map((_, i) => {
          const angle = (i / SLOTS) * Math.PI * 2 - Math.PI / 2
          const x = 50 + Math.cos(angle) * 38
          const y = 50 + Math.sin(angle) * 38
          const isTarget = i === target
          const hasBall = i === active
          return (
            <div
              key={i}
              className={`absolute w-9 h-9 -ml-4.5 -mt-4.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                isTarget ? 'border-ks-gold bg-ks-gold/20' : 'border-ks-border bg-[#14140f]'
              }`}
              style={{ left: `${x}%`, top: `${y}%`, marginLeft: '-1.125rem', marginTop: '-1.125rem' }}
            >
              {hasBall && <div className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]" />}
            </div>
          )
        })}
      </div>
      <button
        onClick={tap}
        className={`w-full rounded-xl py-4 font-display tracking-widest text-sm uppercase transition-colors ${
          flash === 'good' ? 'bg-green-500 text-ks-black' : flash === 'miss' ? 'bg-red-500/70 text-white' : 'bg-ks-gold text-ks-black'
        }`}
      >
        {flash === 'good' ? 'yes!' : flash === 'miss' ? 'early' : 'play it'}
      </button>
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// TARGETS — hit lit zones before they expire. Speed and accuracy.
// ---------------------------------------------------------------------------
function Targets({ label, ceiling, onComplete }: { label: string; ceiling: number; onComplete: (q: number) => void }) {
  const GRID = 9
  const ROUNDS = 6
  const window_ms = 900 - (1 - ceiling) * 320
  const [lit, setLit] = useState(() => Math.floor(Math.random() * GRID))
  const [round, setRound] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [expired, setExpired] = useState(false)
  const litAt = useRef(Date.now())

  const advance = (quality: number) => {
    const next = [...scores, quality]
    setScores(next)
    if (next.length >= ROUNDS) {
      onComplete(next.reduce((a, b) => a + b, 0) / next.length)
      return
    }
    setRound((r) => r + 1)
    setLit(Math.floor(Math.random() * GRID))
    litAt.current = Date.now()
    setExpired(false)
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      setExpired(true)
      sfx.miss()
      window.setTimeout(() => advance(0), 260)
    }, window_ms)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  const hit = (i: number) => {
    if (expired) return
    if (i !== lit) { sfx.miss(); haptics.fail(); advance(0.1); return }
    const elapsed = Date.now() - litAt.current
    const quality = Math.max(0.35, 1 - elapsed / window_ms)
    sfx.perfect()
    haptics.hit()
    advance(quality)
  }

  return (
    <Shell label={label} hint={`Hit the lit target before it goes · ${round + 1}/${ROUNDS}`}>
      <div className="grid grid-cols-3 gap-2 max-w-[15rem] mx-auto w-full">
        {Array.from({ length: GRID }).map((_, i) => (
          <button
            key={i}
            onClick={() => hit(i)}
            className={`relative aspect-square rounded-lg border-2 transition-all ${
              i === lit && !expired
                ? 'border-ks-gold bg-ks-gold/25 shadow-[0_0_16px_rgba(212,175,55,0.4)] scale-105'
                : 'border-ks-border bg-[#14140f]'
            }`}
          >
            {/* P53 — Joel/reviewer: "shrinking ring timer so the player knows
                how much time before the lit target disappears," on the
                target itself, not just the shared bar below the whole grid. */}
            {i === lit && !expired && (
              <svg key={round} className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18" cy="18" r="16" fill="none" stroke="#d4af37" strokeWidth="2.5"
                  strokeDasharray={2 * Math.PI * 16}
                  style={{ animation: `ringshrink ${window_ms}ms linear forwards` }}
                />
              </svg>
            )}
          </button>
        ))}
      </div>
      <div className="h-1 rounded-full bg-[#2a2a27] overflow-hidden">
        <div
          key={round}
          className="h-full bg-ks-gold rounded-full"
          style={{ animation: `shrinkbar ${window_ms}ms linear forwards` }}
        />
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// SPRINT — alternate taps to drive a shuttle run. Sustained effort.
// ---------------------------------------------------------------------------
function Sprint({ label, ceiling, onComplete }: { label: string; ceiling: number; onComplete: (q: number) => void }) {
  const DURATION = 5000
  const needed = 26 + Math.round((1 - ceiling) * 16)
  const [taps, setTaps] = useState(0)
  const [side, setSide] = useState<'L' | 'R'>('L')
  const [remaining, setRemaining] = useState(DURATION)
  const done = useRef(false)

  useEffect(() => {
    const started = Date.now()
    const t = window.setInterval(() => {
      const left = DURATION - (Date.now() - started)
      setRemaining(left)
      if (left <= 0 && !done.current) {
        done.current = true
        window.clearInterval(t)
        setTaps((final) => {
          onComplete(Math.max(0, Math.min(1, final / needed)))
          return final
        })
      }
    }, 60)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tap = (s: 'L' | 'R') => {
    if (done.current || s !== side) return
    setTaps((t) => t + 1)
    setSide(s === 'L' ? 'R' : 'L')
    haptics.tap()
    if (taps % 6 === 0) sfx.tap()
  }

  const pct = Math.min(100, (taps / needed) * 100)

  return (
    <Shell label={label} hint={`Alternate taps to sprint · ${Math.max(0, remaining / 1000).toFixed(1)}s`}>
      <div className="h-2 rounded-full bg-[#2a2a27] overflow-hidden">
        <div className="h-full bg-ks-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-center text-[10px] text-ks-muted">{taps} / {needed}</div>
      <div className="grid grid-cols-2 gap-2">
        {(['L', 'R'] as const).map((s) => (
          <button
            key={s}
            onClick={() => tap(s)}
            className={`rounded-xl py-6 font-display tracking-widest text-lg uppercase transition-all ${
              side === s ? 'bg-ks-gold text-ks-black scale-[1.02]' : 'border border-ks-border text-ks-muted/50'
            }`}
          >
            {s === 'L' ? 'left' : 'right'}
          </button>
        ))}
      </div>
    </Shell>
  )
}
