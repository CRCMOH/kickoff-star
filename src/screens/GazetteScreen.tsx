import type { GazetteIssue } from '../engine/gazette'

// Phase 25: the weekly newspaper reader. Deliberately reads like a paper, not
// a settings list — masthead up top, articles as columns, kind-tagged so a
// transfer story looks visually distinct from a match recap.
const KIND_LABEL: Record<string, string> = {
  transfer: 'TRANSFER NEWS',
  spotlight: 'PLAYER SPOTLIGHT',
  preview: 'MATCH PREVIEW',
  injury: 'MEDICAL ROOM',
  recap: 'MATCH REPORT',
  filler: 'AROUND THE CLUB',
}

export default function GazetteScreen({ issue, onClose }: { issue: GazetteIssue; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-ks-black overflow-y-auto">
      <div className="max-w-md mx-auto min-h-full flex flex-col">
        <div className="px-4 pt-6 pb-4 border-b-2 border-ks-gold">
          <div className="flex items-center justify-between">
            <span className="font-display tracking-[0.2em] text-[10px] text-ks-muted">WEEK {issue.weekNumber} · SEASON {issue.seasonYear}</span>
            <button onClick={onClose} className="text-ks-muted text-xs">close ✕</button>
          </div>
          <h1 className="font-display text-2xl tracking-wide text-ks-gold mt-2 leading-tight">THE GAZETTE</h1>
          <p className="font-display text-sm text-white/90 mt-1 leading-snug">{issue.masthead}</p>
        </div>

        <div className="flex-1 px-4 py-4 space-y-4">
          {issue.articles.map((article, i) => (
            <div key={i} className="border-b border-ks-border/60 pb-4 last:border-0">
              <span className="font-display tracking-widest text-[9px] text-ks-gold/80 uppercase">{KIND_LABEL[article.kind] ?? article.kind}</span>
              <h2 className="font-display text-base tracking-wide text-white mt-1">{article.headline}</h2>
              <p className="text-sm text-ks-muted mt-1 leading-relaxed">{article.body}</p>
            </div>
          ))}
        </div>

        <div className="px-4 pb-6">
          <button
            onClick={onClose}
            className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3 text-sm"
          >
            back to the club →
          </button>
        </div>
      </div>
    </div>
  )
}
