import type { Player } from '../../types/player'
import type { CalendarState } from '../../types/calendar'
import type { LeagueWorld } from '../../engine/league'
import type { AcademyWorld } from '../../engine/academy'
import type { HubTab } from '../../components/navItems'
import Avatar from '../../components/Avatar'
import type { Team } from '../../engine/teams'
import { TeamCrest } from '../../components/ui'
import { monthForWeek } from '../../engine/pathway'
import { arcProgressText } from '../../engine/storylines'
import { isLive } from '../../engine/negotiation'
import { useCareerStore } from '../../store/careerStore'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export default function HomeTab({ player, playerTeam, calendar, offerCount, onOpenOffers, onGoTo, onOpenEnergy, latestGazetteMasthead, onOpenGazette, onOpenInbox }: {
  player: Player
  playerTeam: Team
  calendar: CalendarState
  league: LeagueWorld | null
  academyLeague: AcademyWorld | null
  offerCount: number
  onOpenOffers: () => void
  onGoTo: (tab: HubTab) => void
  onOpenEnergy: () => void
  latestGazetteMasthead: string | null
  onOpenGazette: () => void
  onOpenInbox: () => void
}) {

  const acceptSundayRegistration = useCareerStore(s => s.acceptSundayRegistration)
  const selectionNote = useCareerStore(s => s.selectionNote)
  const economyNote = useCareerStore(s => s.economyNote)
  const events = calendar.currentWeek.events
  const next = events.find(e => !e.resolved)
  const unread = (player.inbox ?? []).filter(e => !e.read)
  const arc = player.activeArcs?.[0]
  const form = player.matchRatings?.slice(-6) ?? []
  const attention = [
    ...(isLive(player.negotiation) ? [{ title: 'Contract talks', detail: 'Review your ongoing negotiation', open: onOpenOffers }] :
      offerCount ? [{ title: `${offerCount} contract offer${offerCount === 1 ? '' : 's'}`, detail: 'Review the terms and your next move', open: onOpenOffers }] : []),
    ...(player.pathway?.sundayStatus === 'squad-offer' ? [{ title: 'Sunday football invitation', detail: 'Accept a place alongside school football · more matches, less recovery', open: acceptSundayRegistration }] : []),
    ...unread.map(e => ({ title: e.title, detail: 'Career inbox · unread', open: onOpenInbox })),
  ]
  return <div className="home-edit">
    <button className="home-identity" onClick={() => onGoTo('player')}>
      <Avatar id={player.avatarId ?? 0} size={48} />
      <div><small>{monthForWeek(calendar.currentWeek.weekNumber)} · WEEK {calendar.currentWeek.weekNumber}</small>
        <h1>{player.name}</h1><p>{playerTeam.name} · {player.position} · {(player.squadRole ?? 'squad').replaceAll('-', ' ')}</p></div>
      <span aria-hidden="true">↗</span>
    </button>
    <section className={`today-feature ${next?.type === 'match' ? 'today-match' : ''}`}>
      <small>{player.injury ? 'RECOVERY' : next ? `NEXT UP · ${next.day.toUpperCase()}` : 'WEEK COMPLETE'}</small>
      {next?.type === 'match' && <div className="mt-3"><TeamCrest primary={playerTeam.primaryColor} secondary={playerTeam.secondaryColor} short={playerTeam.short} /></div>}
      <h2>{player.injury ? 'Your return starts here' : next?.title ?? 'Ready for the next week'}</h2>
      <p>{player.injury ? `${player.injury.weeksRemaining} weeks of recovery remaining.` : next?.type === 'match' ? 'Prepare for kick-off. Your place in the side is shown above.' : next ? 'Your next session is ready. Continue below when you are.' : 'Review your progress or continue to the next week.'}</p>
      <div className="today-rule"><span/>{next?.type === 'match' ? 'MATCHDAY' : 'YOUR CAREER, ONE DAY AT A TIME'}</div>
    </section>
    <div className="readiness-strip" aria-label="Player readiness">
      <button onClick={onOpenEnergy}><small>ENERGY ↗</small><b className={player.fitness.stamina < 35 ? 'text-orange-400' : ''}>{Math.round(player.fitness.stamina)}%</b></button>
      <button onClick={() => onGoTo('player')}><small>RECENT FORM ↗</small><b>{form.length ? (form.reduce((a,b)=>a+b,0)/form.length).toFixed(1) : '—'}</b></button>
      <button onClick={() => onGoTo('people')}><small>CONFIDENCE ↗</small><b>{player.confidence.value > 5 ? 'High' : player.confidence.value > 1 ? 'Steady' : player.confidence.value > -2 ? 'Shaky' : 'Low'}</b></button>
    </div>
    <section className="attention-list">
      <div className="editorial-heading"><h2>Needs your attention</h2><button onClick={onOpenInbox}>Inbox {unread.length ? `(${unread.length})` : '↗'}</button></div>
      {attention.length ? <>
        <button className="attention-row" onClick={attention[0].open}><div><strong>{attention[0].title}</strong><p>{attention[0].detail}</p></div><span>→</span></button>
        {attention.length > 1 && <details><summary>{attention.length - 1} more updates</summary>{attention.slice(1).map((a,i)=><button key={i} className="attention-row" onClick={a.open}><div><strong>{a.title}</strong><p>{a.detail}</p></div><span>→</span></button>)}</details>}
      </> : <p className="quiet-note">You're up to date. Focus on your next session.</p>}
      {(selectionNote || economyNote) && <p className="change-note" role="status">{selectionNote || economyNote}</p>}
    </section>
    <section>
      <div className="editorial-heading"><h2>This week</h2><button onClick={() => onGoTo('fixtures')}>Full schedule ↗</button></div>
      <div className="week-rail">{DAYS.map(day => {
        const entries = events.filter(e => e.day === day)
        return <div key={day} className={entries.some(e=>e === next) ? 'current' : ''}><small>{day}</small><b>{entries.length && entries.every(e=>e.resolved) ? '✓' : entries.some(e=>e.type === 'match') ? '●' : '—'}</b><span>{entries.length ? entries.map(e=>e.title).join(' · ') : 'Rest'}</span></div>
      })}</div>
    </section>
    {arc && <button className="objective-row" onClick={() => onGoTo('people')}><span><small>CURRENT OBJECTIVE</small><strong>{arc.title}</strong><p>{arcProgressText(arc, player)}</p></span><span>↗</span></button>}
    {latestGazetteMasthead && <button className="gazette-brief" onClick={onOpenGazette}><small>THE GAZETTE</small><h2>{latestGazetteMasthead}</h2><span>Read this week's edition ↗</span></button>}
  </div>
}
