import type { Player } from '../../types/player'
import type { Division } from '../../engine/league'
import { sortStandings, divisionLabel } from '../../engine/league'
import { academyDivisionLabel } from '../../engine/academy'
import { teamOverall, type Team } from '../../engine/teams'
import { Panel, Bar, StatRow, TeamCrest } from '../../components/ui'

function ordinal(n: number): string {
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

export default function ClubTab({ player, playerTeam, division, isAcademy }: {
  player: Player
  playerTeam: Team
  division: Division
  isAcademy: boolean
}) {
  const sorted = sortStandings(division.standings)
  const pos = sorted.findIndex((s) => s.teamId === playerTeam.id) + 1
  const standing = sorted.find((s) => s.teamId === playerTeam.id)
  const rivals = division.teams.filter((t) => t.id !== playerTeam.id)
  const divName = isAcademy
    ? academyDivisionLabel(division.tier as 1 | 2)
    : divisionLabel(division.tier)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-3 flex items-center gap-3">
        <TeamCrest primary={playerTeam.primaryColor} secondary={playerTeam.secondaryColor} short={playerTeam.short} />
        <div className="flex-1 min-w-0">
          <div className="font-display tracking-wide text-ks-ink text-base leading-tight truncate">{playerTeam.name}</div>
          <div className="text-[10px] text-ks-muted">
            {divName} &middot; {pos > 0 ? ordinal(pos) : '—'} &middot; prestige {playerTeam.prestige}/10
          </div>
        </div>
        <div className="text-center shrink-0">
          <div className="text-[9px] text-ks-muted uppercase tracking-wider">strength</div>
          <div className="font-display text-ks-gold text-lg">{teamOverall(playerTeam)}</div>
        </div>
      </div>

      <Panel title="💪 team strength">
        <div className="flex flex-col gap-1.5">
          {(['attack', 'midfield', 'defense'] as const).map((line) => (
            <div key={line} className="flex items-center gap-2">
              <span className="text-[10px] text-ks-muted capitalize w-16">{line}</span>
              <Bar value={playerTeam.ratings[line]} max={99} />
              <span className="text-[10px] text-ks-ink w-6 text-right">{playerTeam.ratings[line]}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="📊 your standing">
        <div className="flex flex-col gap-1.5">
          <StatRow label="squad role" value={<span className="capitalize">{player.squadRole ?? 'TBD'}</span>} />
          <StatRow label="position" value={pos > 0 ? ordinal(pos) : '—'} />
          <StatRow label="played" value={standing?.played ?? 0} />
          <StatRow label="record" value={`${standing?.won ?? 0}W ${standing?.drawn ?? 0}D ${standing?.lost ?? 0}L`} />
          <StatRow label="points" value={standing?.points ?? 0} />
          <StatRow
            label="goal difference"
            value={(() => {
              const gd = (standing?.goalsFor ?? 0) - (standing?.goalsAgainst ?? 0)
              return `${gd > 0 ? '+' : ''}${gd}`
            })()}
          />
        </div>
      </Panel>

      <Panel title={`rivals — ${divName}`}>
        <div className="flex flex-col gap-2">
          {rivals.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5">
              <TeamCrest primary={t.primaryColor} secondary={t.secondaryColor} short={t.short} size="sm" />
              <span className="text-[11px] text-ks-ink flex-1 truncate">{t.name}</span>
              <span className="text-[10px] text-ks-muted">strength {teamOverall(t)}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* P63 — "we need top goalscorer/assist/rating screens." Real,
          honest scope: other teams in the division are abstract entities
          with no individual player roster at all (only your own team has
          named players) — a true rival-player leaderboard would need full
          generated squads for every team in the game, which is a much
          bigger feature. What's genuinely real: team-level goals for/
          against from the actual season, plus your own tracked stats in
          context — shown here rather than faking opponent player names. */}
      {/* P64 — real top-scorer leaderboard, now that every team has 4
          tracked notable players and batch-sim actually attributes goals
          to them. Not fabricated — every name/goal count here comes from
          the real simulated season. */}
      <Panel title={`top scorers — ${divName}`}>
        <div className="flex flex-col gap-1.5">
          {division.teams
            .flatMap((t) => t.notablePlayers.map((p) => ({ ...p, teamShort: t.short, isPlayerTeam: t.id === playerTeam.id })))
            .filter((p) => p.seasonGoals > 0)
            .sort((a, b) => b.seasonGoals - a.seasonGoals)
            .slice(0, 5)
            .map((p, i) => (
              <div key={`${p.teamShort}-${p.name}`} className="flex items-center gap-2 text-[11px]">
                <span className="text-ks-muted w-4">{i + 1}</span>
                <span className={`flex-1 truncate ${p.isPlayerTeam ? 'text-ks-gold' : 'text-ks-ink'}`}>{p.name}</span>
                <span className="text-ks-muted w-9">{p.teamShort}</span>
                <span className="text-ks-ink tabular-nums w-4 text-right">{p.seasonGoals}</span>
              </div>
            ))}
        </div>
      </Panel>

      <Panel title="⚽ top scoring teams">
        <div className="flex flex-col gap-1.5">
          {[...division.standings].sort((a, b) => b.goalsFor - a.goalsFor).slice(0, 5).map((s, i) => (
            <div key={s.teamId} className="flex items-center gap-2 text-[11px]">
              <span className="text-ks-muted w-4">{i + 1}</span>
              <span className={`flex-1 truncate ${s.teamId === playerTeam.id ? 'text-ks-gold' : 'text-ks-ink'}`}>{s.teamName}</span>
              <span className="text-ks-ink tabular-nums">{s.goalsFor} scored</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="🗓️ your season">
        <div className="flex flex-col gap-1.5">
          <StatRow label="goals" value={player.seasonGoals ?? 0} />
          <StatRow label="assists" value={player.seasonAssists ?? 0} />
          <StatRow
            label="average rating"
            value={
              (player.matchRatings ?? []).length > 0
                ? ((player.matchRatings ?? []).reduce((a, b) => a + b, 0) / (player.matchRatings ?? []).length).toFixed(1)
                : '—'
            }
          />
        </div>
      </Panel>
    </div>
  )
}
