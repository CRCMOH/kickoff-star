import type { ArcVerdict } from '../engine/storylines'
import { sfx } from '../engine/audio'
import { useEffect } from 'react'

// Phase 28 — a storyline resolving is a BEAT, not a silent stat change. This
// is where "two goals in three weeks or you're benched" actually lands.
export default function ArcVerdictCard({ queue, onDismiss }: { queue: ArcVerdict[]; onDismiss: () => void }) {
  const v = queue[0]

  useEffect(() => {
    if (v?.succeeded) sfx.achievement()
  }, [v])

  if (!v) return null
  const good = v.succeeded

  return (
    <div className="fixed inset-0 z-50 bg-ks-black/95 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className={`font-display tracking-[0.3em] text-[10px] uppercase text-center mb-3 ${good ? 'text-green-500' : 'text-orange-500'}`}>
          {good ? 'storyline complete' : 'storyline failed'}
        </div>
        <div className={`rounded-2xl border px-5 py-6 ${good ? 'border-green-500/40 bg-green-500/5' : 'border-orange-500/40 bg-orange-500/5'}`}>
          <div className="font-display text-ks-ink text-xl tracking-wide text-center mb-1">{v.arc.title}</div>
          <p className="text-[11px] text-ks-muted text-center mb-4">{v.arc.brief}</p>
          <p className="text-sm text-ks-ink leading-relaxed text-center">{v.consequence.narrative}</p>
          {v.consequence.setSquadRole && (
            <p className="text-[11px] text-orange-400 text-center mt-3 uppercase tracking-wider">
              squad role now: {v.consequence.setSquadRole.replace('-', ' ')}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="w-full mt-4 bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-3.5 text-sm uppercase"
        >
          continue
        </button>
      </div>
    </div>
  )
}
