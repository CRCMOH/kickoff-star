import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import { haptics } from '../engine/haptics'

// P47 — Joel: "when someone scores it's almost impossible to tell they did."
// A goal was rendering as a slightly-bigger feed line and a 0.4s number pop —
// the single biggest scoring moment in football, given the same visual
// weight as a throw-in. This is the fix: a real full-screen takeover, the
// same shape every football game uses for this exact moment — flash, big
// type, a beat, then back to the match. Auto-dismisses; the match clock is
// already paused by the caller for the same duration this is on screen.

export type CelebrationKind = 'player-goal' | 'player-assist' | 'team-goal' | 'concede'

interface CelebrationProps {
  kind: CelebrationKind
  scorerName?: string
  homeShort: string
  awayShort: string
  homeScore: number
  awayScore: number
  minute: number
  avatarId?: number
  onDone: () => void
}

const DURATION_MS = 2000

const KIND_LABEL: Record<CelebrationKind, string> = {
  'player-goal': 'GOAL!',
  'player-assist': 'ASSIST!',
  'team-goal': 'GOAL',
  concede: 'CONCEDED',
}

export default function GoalCelebration({ kind, scorerName, homeShort, awayShort, homeScore, awayScore, minute, avatarId, onDone }: CelebrationProps) {
  const [phase, setPhase] = useState<'flash' | 'hold' | 'out'>('flash')

  useEffect(() => {
    if (kind === 'concede') haptics.fail()
    else haptics.goal()
    const t1 = window.setTimeout(() => setPhase('hold'), 120)
    const t2 = window.setTimeout(() => setPhase('out'), DURATION_MS - 260)
    const t3 = window.setTimeout(onDone, DURATION_MS)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isGood = kind !== 'concede'
  const accent = isGood ? '#d4af37' : '#e0483e'

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center transition-opacity duration-200"
      style={{
        background: isGood
          ? 'radial-gradient(ellipse at center, rgba(212,175,55,0.22), rgba(0,0,0,0.94) 70%)'
          : 'radial-gradient(ellipse at center, rgba(224,72,62,0.16), rgba(0,0,0,0.94) 70%)',
        opacity: phase === 'out' ? 0 : 1,
      }}
    >
      {/* flash frame — a single bright pulse right on impact */}
      {phase === 'flash' && (
        <div className="fixed inset-0 bg-white" style={{ animation: 'goalflash 0.35s ease-out forwards' }} />
      )}

      <div
        className="w-full flex flex-col items-center gap-3"
        style={{
          transform: phase === 'flash' ? 'scale(0.7)' : 'scale(1)',
          opacity: phase === 'flash' ? 0 : 1,
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease-out',
        }}
      >
        {avatarId !== undefined && isGood && (
          <Avatar id={avatarId} size={72} className="mb-1" />
        )}

        {/* P58 — reference video: the GOAL label runs edge-to-edge, letters
            deliberately cropped at the sides on your own goal — the biggest
            moment gets the most visceral typography, not a neatly
            contained label like everything else on screen. */}
        <div
          className={`font-display font-black tracking-[0.1em] uppercase leading-none w-full text-center px-2 ${kind === 'player-goal' ? 'text-8xl' : 'text-6xl'}`}
          style={{ color: accent, textShadow: `0 0 40px ${accent}88`, whiteSpace: 'nowrap' }}
        >
          {KIND_LABEL[kind]}
        </div>

        {scorerName && (
          <div className="text-ks-ink text-lg font-display tracking-wide">{scorerName}</div>
        )}
        <div className="text-ks-muted text-[11px] uppercase tracking-[0.2em]">{minute}'</div>

        <div className="flex items-center gap-4 mt-2 border-t border-white/10 pt-4">
          <span className="font-display text-ks-ink text-base tracking-wide">{homeShort}</span>
          <span className="font-display text-3xl tracking-widest" style={{ color: accent }}>{homeScore}–{awayScore}</span>
          <span className="font-display text-ks-ink text-base tracking-wide">{awayShort}</span>
        </div>
      </div>
    </div>
  )
}
