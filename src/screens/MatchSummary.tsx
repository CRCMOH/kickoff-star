import { useCareerStore } from '../store/careerStore'
import { TeamCrest } from '../components/ui'

interface MatchSummaryProps {
  rating: number
  goals: number
  assists: number
  won: boolean
  drew: boolean
  injury?: { severity: string; weeksOut: number; description: string } | null
  wasSubbed?: boolean
  /** P40: sent off — takes precedence over the plain "substituted" note. */
  redCarded?: boolean
  /** Set for drawn knockout ties settled on penalties. */
  shootout?: { won: boolean } | null
  onDone: () => void
}

export default function MatchSummary({ rating, goals, assists, won, drew, injury, wasSubbed, redCarded, shootout, onDone }: MatchSummaryProps) {
  // P60 — reference: a "round results" list showing the rest of the
  // division's results, not just your own. The data already existed
  // (batch-sim computes every fixture in the round, not just yours) — it
  // was just never surfaced anywhere. Read directly from the store rather
  // than prop-drilling through Career.tsx's existing call site.
  const league = useCareerStore((s) => s.league)
  const academyLeague = useCareerStore((s) => s.academyLeague)
  const calendar = useCareerStore((s) => s.calendar)
  const division = academyLeague
    ? academyLeague.divisions[academyLeague.playerDivision]
    : league
    ? league.divisions[league.playerDivision]
    : null
  const weekNumber = calendar?.currentWeek.weekNumber
  const roundFixtures = division && weekNumber
    ? division.fixtures.filter((f) => f.week === weekNumber && f.played && f.homeGoals !== null && f.awayGoals !== null)
    : []
  const teamById = new Map((division?.teams ?? []).map((t) => [t.id, t] as const))

  const ratingColor = rating >= 7.5 ? 'text-green-500' : rating >= 6.5 ? 'text-ks-gold' : rating >= 5 ? 'text-ks-ink' : 'text-orange-400'
  const resultText = shootout ? (shootout.won ? 'Win on pens' : 'Loss on pens') : won ? 'Win' : drew ? 'Draw' : 'Loss'
  const resultColor = shootout ? (shootout.won ? 'text-green-500' : 'text-red-500') : won ? 'text-green-500' : drew ? 'text-ks-muted' : 'text-red-500'

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 25%, rgba(212,175,55,0.08), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <div className="font-display tracking-widest text-[11px] text-ks-muted uppercase mb-2">match summary</div>
          <div className={`font-display text-4xl tracking-wide ${resultColor}`}>{resultText}</div>
        </div>

        <div className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-5 mb-4 text-center">
          <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-2">your rating</div>
          <div className={`font-display text-6xl ${ratingColor}`}>{rating.toFixed(1)}</div>
        </div>

        {redCarded && (
          <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
            <div className="font-display tracking-widest text-[10px] text-red-400 uppercase mb-1">sent off</div>
            <p className="text-ks-ink text-sm leading-relaxed">You were shown a red card and your side had to see out the rest of the match a man down.</p>
            <p className="text-[11px] text-ks-muted mt-1">You'll miss your next match through suspension.</p>
          </div>
        )}
        {injury && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3 mb-4">
            <div className="font-display tracking-widest text-[10px] text-red-400 uppercase mb-1">injury</div>
            <p className="text-ks-ink text-sm leading-relaxed">{injury.description}</p>
            {injury.weeksOut > 0 && <p className="text-[11px] text-ks-muted mt-1">Out for approximately {injury.weeksOut} week{injury.weeksOut === 1 ? '' : 's'}.</p>}
          </div>
        )}
        {!injury && !redCarded && wasSubbed && (
          <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 mb-4">
            <p className="text-ks-muted text-sm">You were substituted before full-time.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 text-center">
            <div className="text-[10px] text-ks-muted uppercase tracking-wider mb-1">goals</div>
            <div className="font-display text-2xl text-ks-ink">{goals}</div>
          </div>
          <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 text-center">
            <div className="text-[10px] text-ks-muted uppercase tracking-wider mb-1">assists</div>
            <div className="font-display text-2xl text-ks-ink">{assists}</div>
          </div>
        </div>

        {roundFixtures.length > 0 && (
          <div className="mb-5">
            <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-2">round results</div>
            <div className="rounded-xl border border-ks-border bg-[#0f0f0d] divide-y divide-ks-border/50">
              {roundFixtures.map((f) => {
                const home = teamById.get(f.homeTeamId)
                const away = teamById.get(f.awayTeamId)
                if (!home || !away) return null
                return (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2.5">
                    <TeamCrest primary={home.primaryColor} secondary={home.secondaryColor} short={home.short} size="sm" />
                    <span className="text-[12px] text-ks-ink flex-1 truncate">{home.name}</span>
                    <span className="font-display text-ks-gold text-sm tabular-nums px-1">{f.homeGoals} : {f.awayGoals}</span>
                    <span className="text-[12px] text-ks-ink flex-1 truncate text-right">{away.name}</span>
                    <TeamCrest primary={away.primaryColor} secondary={away.secondaryColor} short={away.short} size="sm" />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button onClick={onDone} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]">
          continue
        </button>
      </div>
    </div>
  )
}
