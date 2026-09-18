import type { Player } from '../../types/player'
import type { Division } from '../../engine/league'
import type { CupWorlds } from '../../engine/save'
import type { CupWorld } from '../../engine/cup'
import { competitionDefinition } from '../../engine/competitionCareer'
import { sortStandings } from '../../engine/league'
import { Panel, EmptyNote } from '../../components/ui'
import { useCareerStore } from '../../store/careerStore'
import { initYouthPathway,pathwayNextStep } from '../../engine/pathway'

function competitionStatus(cup: CupWorld): string {
  if (cup.playerWonCup) return 'Champions'
  if (cup.playerEliminated) return 'Eliminated'
  if (cup.stage === 'group') return 'Group stage'
  if (cup.stage === 'knockout') return `Knockout round ${cup.currentKnockoutRound}`
  return 'Complete'
}

export default function CompetitionHub({ player, division, playerTeamId, cups }: { player: Player; division: Division; playerTeamId: string; cups?: CupWorlds }) {
  const international = useCareerStore((s) => s.international)
  const leagueKey = player.careerClock.phase === 'academy' ? 'academyLeague' : player.grassrootsPath === 'sunday' ? 'sundayLeague' : 'schoolLeague'
  const leagueDef = competitionDefinition(leagueKey)
  const sorted = sortStandings(division.standings)
  const position = sorted.findIndex((s) => s.teamId === playerTeamId) + 1
  const activeCups = cups ? Object.values(cups).filter((c): c is CupWorld => !!c) : []
  const current = player.competitionCareer?.current ?? {}
  const history = player.competitionCareer?.history ?? []
  const pathway=player.pathway??initYouthPathway(player)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-xl border border-ks-gold/35 bg-gradient-to-br from-[#1b180d] to-[#0d0d0b] px-4 py-3">
        <div className="text-[9px] text-ks-gold uppercase tracking-[0.25em]">competition centre</div>
        <div className="font-display text-lg text-ks-ink mt-1">Every match has a consequence.</div>
        <p className="text-[10px] text-ks-muted mt-1">Track your position, cup path, discipline and performance on each stage.</p>
      </div>
      {player.careerClock.phase!=='academy'&&<div className="pathway-map"><div className="pathway-map-head"><span>{pathway.ageGroup} PLAYER PATHWAY</span><b>{pathwayNextStep(player)}</b></div><div className="pathway-track"><PathStep label="School" state="complete"/><PathStep label="Regional XI" state={pathway.regionalSelection==='selected'?'complete':pathway.regionalSelection==='cut'?'missed':pathway.regionalSelection==='not-started'?'locked':'active'}/><PathStep label="National" state={pathway.nationalSelection==='selected'?'complete':pathway.nationalSelection==='cut'?'missed':pathway.nationalSelection==='not-started'?'locked':'active'}/><PathStep label="International" state={pathway.nationalSelection==='selected'?'active':'locked'}/></div><div className="pathway-side-route"><span>Sunday route</span><b>{pathway.sundayStatus.replace('-',' ')}</b><i>{pathway.sundayInterest}% interest</i></div></div>}

      <CompetitionCard name={leagueDef.name} format="League" prestige={leagueDef.prestige} status={position > 0 ? `${position}${position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'} of ${sorted.length}` : 'Not placed'} stats={current[leagueKey]} />
      {activeCups.map((cup) => {
        const def = competitionDefinition(cup.competitionId)
        return <CompetitionCard key={cup.competitionId} name={cup.label} format={def.format === 'group-knockout' ? 'Groups → Knockout' : 'Knockout'} prestige={def.prestige} status={competitionStatus(cup)} stats={current[cup.competitionId]} />
      })}
      {international && (() => {
        const def = competitionDefinition('international')
        const status = international.wonTournament ? 'Champions' : international.stage === 'not-qualified' ? 'Not qualified' : international.stage === 'complete' ? 'Complete' : international.stage === 'finals' ? 'Finals' : 'Qualifiers'
        return <CompetitionCard name={def.name} format="International" prestige={def.prestige} status={status} stats={current.international} />
      })()}

      <Panel title="career competition history">
        {history.length === 0 ? <EmptyNote>Completed seasons will be archived here.</EmptyNote> : (
          <div className="flex flex-col gap-2">
            {[...history].reverse().slice(0, 8).map((entry, i) => (
              <div key={`${entry.competitionId}-${entry.season}-${i}`} className="flex items-center gap-2 border-b border-ks-border/40 pb-2 last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-ks-ink truncate">{entry.competitionName}</div>
                  <div className="text-[9px] text-ks-muted">{entry.season} · {entry.appearances} apps · {entry.goals}G {entry.assists}A</div>
                </div>
                <span className={`text-[9px] uppercase tracking-wider ${entry.outcome === 'Champion' ? 'text-ks-gold' : 'text-ks-muted'}`}>{entry.outcome}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
function PathStep({label,state}:{label:string;state:'complete'|'active'|'missed'|'locked'}){return <div className={`pathway-step ${state}`}><i>{state==='complete'?'✓':state==='missed'?'×':state==='active'?'●':'○'}</i><span>{label}</span></div>}

function CompetitionCard({ name, format, prestige, status, stats }: { name: string; format: string; prestige: number; status: string; stats?: { appearances: number; goals: number; assists: number; averageRating: number; yellowCards: number; redCards: number } }) {
  return (
    <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-sm text-ks-ink">{name}</div>
          <div className="text-[9px] text-ks-muted uppercase tracking-wider mt-0.5">{format} · prestige {prestige}</div>
        </div>
        <span className="rounded-full border border-ks-gold/35 bg-ks-gold/5 px-2 py-1 text-[9px] text-ks-gold uppercase">{status}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-ks-border/50">
        <Mini label="apps" value={stats?.appearances ?? 0} />
        <Mini label="goals" value={stats?.goals ?? 0} />
        <Mini label="assists" value={stats?.assists ?? 0} />
        <Mini label="rating" value={stats?.averageRating || '—'} />
      </div>
      {!!stats && (stats.yellowCards > 0 || stats.redCards > 0) && <div className="text-[9px] text-ks-muted mt-2 text-right">discipline · {stats.yellowCards} yellow · {stats.redCards} red</div>}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return <div className="text-center"><div className="font-display text-sm text-ks-ink">{value}</div><div className="text-[8px] text-ks-muted uppercase tracking-wider">{label}</div></div>
}
