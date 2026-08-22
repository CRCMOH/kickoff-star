import { useEffect, useState } from 'react'
import type { Achievement } from '../engine/achievements'
import { TIER_COLOR, CATEGORY_LABEL } from '../engine/achievements'
import { sfx } from '../engine/audio'

// Phase 16: the ceremony. Achievements are shown one at a time so each lands as its
// own moment.
//
// Audit finding: a strong debut (hat-trick + 9.1 rating) unlocks TEN at once — first
// appearance, first goal, first assist, first clean sheet, first win, brace, hat-trick,
// goal-and-assist, 8.0 rating, 9.0 rating. Ten full-screen celebrations back to back is
// exhausting and makes every one of them feel cheap. So we ceremonially show at most
// CEREMONY_LIMIT, highest tier first, and roll the remainder into a single summary card.
// The player still UNLOCKS all of them — they're all in the trophy cabinet either way.

const CEREMONY_LIMIT = 3

const TIER_RANK = { gold: 0, silver: 1, bronze: 2 } as const

export default function AchievementCeremony({ queue, onDismiss }: {
  queue: Achievement[]
  onDismiss: () => void
}) {
  const [index, setIndex] = useState(0)
  const [entered, setEntered] = useState(false)

  const ordered = [...queue].sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])
  const featured = ordered.slice(0, CEREMONY_LIMIT)
  const remainder = ordered.length - featured.length
  const current = featured[index]
  const isLastFeatured = index === featured.length - 1

  useEffect(() => {
    setEntered(false)
    sfx.achievement()
    const t = window.setTimeout(() => setEntered(true), 30)
    return () => window.clearTimeout(t)
  }, [index])

  if (!current) return null

  const next = () => {
    if (index < featured.length - 1) setIndex(index + 1)
    else onDismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={next}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-sm text-center transition-all duration-500 ${
          entered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <div className="font-display tracking-[0.3em] text-[10px] text-ks-muted uppercase mb-5">
          achievement unlocked
        </div>

        {/* P58 — reference video: achievement unlock as a glossy gold coin/
            medallion instead of a flat bordered circle with a plain star
            character — more dimensional, reads as a real "reward" object. */}
        <svg viewBox="0 0 100 100" className="mx-auto w-24 h-24 mb-5" style={{ filter: `drop-shadow(0 0 20px ${current.tier === 'gold' ? 'rgba(212,175,55,0.5)' : current.tier === 'bronze' ? 'rgba(251,146,60,0.4)' : 'rgba(154,154,146,0.35)'})` }}>
          <defs>
            <radialGradient id={`coinBase-${current.tier}`} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor={current.tier === 'gold' ? '#f5dd8a' : current.tier === 'bronze' ? '#ffcb8a' : '#e5e5e0'} />
              <stop offset="55%" stopColor={current.tier === 'gold' ? '#d4af37' : current.tier === 'bronze' ? '#e8892e' : '#9a9a92'} />
              <stop offset="100%" stopColor={current.tier === 'gold' ? '#9c7d1f' : current.tier === 'bronze' ? '#a85a15' : '#5a5a54'} />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill={`url(#coinBase-${current.tier})`} stroke="#0a0a09" strokeWidth="2" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
          <ellipse cx="38" cy="28" rx="16" ry="9" fill="rgba(255,255,255,0.35)" transform="rotate(-25 38 28)" />
          <path d="M50 25 L57 43 L76 43 L60 55 L66 73 L50 62 L34 73 L40 55 L24 43 L43 43 Z" fill="#0a0a09" opacity="0.85" />
        </svg>

        <div className={`font-display text-2xl tracking-wide mb-2 ${TIER_COLOR[current.tier]}`}>
          {current.title}
        </div>
        <p className="text-ks-ink text-sm leading-relaxed mb-1">{current.description}</p>
        <div className="text-[10px] text-ks-muted uppercase tracking-widest mb-8">
          {current.tier} · {CATEGORY_LABEL[current.category]}
        </div>

        {isLastFeatured && remainder > 0 && (
          <div className="rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-2 mb-5 text-left">
            <div className="text-[10px] text-ks-muted uppercase tracking-widest mb-1.5">
              plus {remainder} more unlocked
            </div>
            <div className="text-[11px] text-ks-ink leading-relaxed">
              {ordered.slice(CEREMONY_LIMIT).map((a) => a.title).join(' · ')}
            </div>
          </div>
        )}

        <button onClick={next} className="text-[11px] text-ks-muted tracking-wide">
          {index < featured.length - 1 ? `tap to continue — ${featured.length - index - 1} more` : 'tap to continue'}
        </button>
      </div>
    </div>
  )
}
