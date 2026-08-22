import type { Player } from '../../types/player'
import { SEASON_WEEKS } from '../../engine/calendar'
import type { CalendarState } from '../../types/calendar'
import { watchRewardedAd, remainingToday } from '../../engine/ads'
import type { LeagueWorld, Division } from '../../engine/league'
import { sortStandings, divisionLabel } from '../../engine/league'
import type { AcademyWorld } from '../../engine/academy'
import { academyDivisionLabel } from '../../engine/academy'
import { computeCurrentAbility, toOvr } from '../../engine/rating'
import { trustLabel, trustEmoji } from '../../engine/coachTrust'
import { Panel, Bar, OvrRing, StatRow, Section, RadarChart, Icon } from '../../components/ui'
import iconEnergy from '../../assets/icons/energy.png'
import iconConfidence from '../../assets/icons/confidence.png'
import iconWeek from '../../assets/icons/week.png'
import iconTeamSelection from '../../assets/icons/team_selection.png'
import iconGazette from '../../assets/icons/gazette.png'
import iconShape from '../../assets/icons/shape.png'
import iconCareer from '../../assets/icons/career.png'
import iconCoachTrust from '../../assets/icons/coach_trust.png'
import { EnergyMeter } from '../../components/EnergySheet'
import { bandSpec } from '../../engine/energy'
import type { HubTab } from '../../components/navItems'
import Avatar from '../../components/Avatar'
import { getNation } from '../../engine/nations'
import { arcProgressText, weeksLeft } from '../../engine/storylines'
import { formatMoney, itemById } from '../../engine/economy'
import { isLive, STAGE_LABEL } from '../../engine/negotiation'
import { decideSelection, selectionAdvice } from '../../engine/selection'
import { useCareerStore } from '../../store/careerStore'

// color + emoji pairing for the confidence pill, matching the existing
// trustEmoji/trustLabel pattern in coachTrust.ts rather than inventing a new
// visual language for status indicators.
function confidenceMeta(value: number): { label: string; emoji: string; color: string } {
  if (value > 5) return { label: 'high', emoji: '🔥', color: 'text-green-500' }
  if (value > 1) return { label: 'steady', emoji: '🙂', color: 'text-ks-gold' }
  if (value > -2) return { label: 'shaky', emoji: '😬', color: 'text-orange-400' }
  return { label: 'low', emoji: '😟', color: 'text-red-500' }
}

function ordinal(n: number): string {
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export default function HomeTab({ player, calendar, league, academyLeague, offerCount, onOpenOffers, onGoTo, onOpenEnergy, latestGazetteMasthead, onOpenGazette }: {
  player: Player
  calendar: CalendarState
  league: LeagueWorld | null
  academyLeague: AcademyWorld | null
  offerCount: number
  onOpenOffers: () => void
  onGoTo: (tab: HubTab) => void
  onOpenEnergy: () => void
  latestGazetteMasthead: string | null
  onOpenGazette: () => void
}) {
  const consumeItem = useCareerStore((s) => s.consumeItem)
  const restoreEnergyFromAd = useCareerStore((s) => s.restoreEnergyFromAd)
  const economyNote = useCareerStore((s) => s.economyNote)
  const negotiationBeat = useCareerStore((s) => s.negotiationBeat)
  const clearNegotiationBeat = useCareerStore((s) => s.clearNegotiationBeat)
  const selectionNote = useCareerStore((s) => s.selectionNote)
  const eventsByDay = Object.fromEntries(calendar.currentWeek.events.map((e) => [e.day, e]))
  const ovr = toOvr(computeCurrentAbility(player))
  // compact 3-point version of PlayerTab's "shape" radar — a teaser, not a
  // replacement for the full attribute breakdown, so group counts stay small
  // enough to read at a glance without opening the Player tab.
  const isGk = player.attributes.kind === 'goalkeeper'
  const attrValues = player.attributes.values as Record<string, number>
  const shapeGroups: { label: string; attrs: string[] }[] = [
    { label: 'technical', attrs: isGk ? ['reflexes', 'handling', 'distribution'] : ['passing', 'shooting', 'dribbling', 'tackling'] },
    { label: 'physical', attrs: ['pace', 'strength', 'stamina', 'agility'] },
    { label: 'mental', attrs: isGk ? ['gkPositioning', 'concentration'] : ['vision', 'composure', 'positioning', 'concentration'] },
  ]
  const shapePoints = shapeGroups.map((g) => ({
    label: g.label,
    value: g.attrs.reduce((sum, a) => sum + (attrValues[a] ?? 0), 0) / g.attrs.length,
  }))
  const isAcademy = player.careerClock.phase === 'academy'
  const world = isAcademy ? academyLeague : league

  let leaguePos: string | null = null
  let leagueName: string | null = null
  if (world) {
    const division = (world.divisions as Record<number, Division>)[world.playerDivision]
    const sorted = sortStandings(division.standings)
    const pos = sorted.findIndex((s) => s.teamId === world.playerTeamId) + 1
    leaguePos = pos > 0 ? ordinal(pos) : '—'
    leagueName = isAcademy
      ? academyDivisionLabel(world.playerDivision as 1 | 2)
      : divisionLabel(world.playerDivision as 1 | 2 | 3)
  }

  return (
    <div className="flex flex-col gap-2.5 stagger-children">
      {offerCount > 0 && (
        <button
          onClick={onOpenOffers}
          className="rounded-lg border border-ks-gold bg-ks-gold/10 px-3 py-2.5 flex items-center justify-between animate-pulse"
        >
          <span className="text-ks-gold text-sm font-display tracking-wide">
            {offerCount} contract offer{offerCount === 1 ? '' : 's'} waiting
          </span>
          <span className="text-ks-gold text-xs">view →</span>
        </button>
      )}

      {/* a live contract negotiation is the biggest thing happening in your
          life — it belongs at the very top of the week, not buried in scouts */}
      {isLive(player.negotiation) && (
        <button
          onClick={onOpenOffers}
          className="rounded-lg border border-ks-gold bg-gradient-to-r from-ks-gold/15 to-ks-gold/5 px-3 py-2.5 text-left animate-[pulseglow_2.5s_ease-in-out_infinite]"
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-display tracking-widest text-[10px] uppercase text-ks-gold">
              {player.negotiation!.clubName}
            </span>
            <span className="text-[9px] text-ks-muted uppercase tracking-wider">
              {STAGE_LABEL[player.negotiation!.stage]}
            </span>
          </div>
          <p className="text-[11px] text-ks-ink leading-snug">
            {player.negotiation!.awaitingPlayer ? 'They are waiting on your answer →' : 'Talks are ongoing →'}
          </p>
        </button>
      )}

      {negotiationBeat && (
        <button
          onClick={() => clearNegotiationBeat()}
          className="w-full text-left rounded-lg border border-ks-gold/30 bg-ks-gold/5 px-3 py-2 text-[11px] text-ks-gold animate-[coinpop_0.4s_ease-out] flex items-center justify-between gap-2"
        >
          <span>{negotiationBeat}</span>
          <span className="text-ks-muted shrink-0">✕</span>
        </button>
      )}

      {/* P31 — where you stand in the coach's thinking, and how to move up.
          Answers the question "how do I get in the starting eleven?", which
          previously had no visible answer anywhere in the game. */}
      {(() => {
        // P63 — real, confirmed bug: this used to show `decideSelection`'s
        // live, ungated verdict directly — what the coach WOULD decide
        // right now — completely bypassing the sticky-selection lock that
        // actually governs matches (see PlayerTab's Squad Status panel,
        // which does this correctly). Result: this panel could say
        // "Starting XI, 1st choice" while the player was genuinely benched
        // all game, because the real `player.squadRole` was still locked
        // from the last decision and hadn't caught up. Fixed to show the
        // real, locked role as the headline, matching what actually
        // happens on matchday — the live verdict still informs the pecking
        // order number and advice text, which is legitimately live context,
        // just not the thing that gets falsely promised as current reality.
        const v = decideSelection(player, player.squad)
        const actualRole = (player.squadRole ?? v.role) as typeof v.role
        const color = actualRole === 'starting-xi' ? 'text-green-500' : actualRole === 'bench' ? 'text-orange-400' : 'text-red-500'
        const SETTLE_WEEKS = 3
        const weeksSinceSet = (player.totalWeeksElapsed ?? 0) - (player.squadRoleSetWeek ?? 0)
        const weeksLeft = Math.max(0, SETTLE_WEEKS - weeksSinceSet)
        return (
          <div className="rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-2.5 relative overflow-hidden texture-turf">
            <div className="relative z-10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-display tracking-widest text-[10px] text-ks-muted uppercase flex items-center gap-1"><Icon src={iconTeamSelection} />team selection</span>
              <span className={`text-[10px] uppercase tracking-wider ${color}`}>
                {actualRole === 'starting-xi' ? 'starting xi' : actualRole}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-ks-muted w-20 shrink-0">coach's view</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#2a2a27] overflow-hidden">
                <div className={`h-full rounded-full ${v.score >= 65 ? 'bg-green-500' : v.score >= 45 ? 'bg-ks-gold' : 'bg-orange-500'}`} style={{ width: `${v.score}%` }} />
              </div>
              <span className="text-[10px] text-ks-ink w-16 text-right">
                {v.pecking}
                {v.pecking === 1 ? 'st' : v.pecking === 2 ? 'nd' : v.pecking === 3 ? 'rd' : 'th'} choice
              </span>
            </div>
            <p className="text-[10px] text-ks-muted leading-snug">
              {weeksLeft > 0
                ? `The coach won't reconsider the side for ${weeksLeft} more week${weeksLeft === 1 ? '' : 's'}. ${selectionAdvice(v, player)}`
                : selectionAdvice(v, player)}
            </p>
            </div>
          </div>
        )
      })()}

      {selectionNote && (
        <div className="rounded-lg border border-ks-gold/40 bg-ks-gold/10 px-3 py-2 text-[11px] text-ks-gold animate-[coinpop_0.4s_ease-out]">
          {selectionNote}
        </div>
      )}

      {economyNote && (
        <div className="rounded-lg border border-ks-gold/30 bg-ks-gold/5 px-3 py-2 text-[11px] text-ks-gold animate-[coinpop_0.4s_ease-out]">
          {economyNote}
        </div>
      )}

      {/* live storylines — a deadline you're carrying should never be buried */}
      {(player.activeArcs ?? []).map((arc) => (
        <button
          key={arc.id}
          onClick={() => onGoTo('people')}
          className="rounded-lg border border-ks-gold/35 bg-ks-gold/5 px-3 py-2.5 text-left"
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-display tracking-wide text-ks-gold text-[11px] uppercase">{arc.title}</span>
            <span className="text-[9px] text-ks-muted uppercase tracking-wider">
              {weeksLeft(arc, player)}w left
            </span>
          </div>
          <p className="text-[11px] text-ks-ink leading-snug">{arc.brief}</p>
          <p className="text-[10px] text-ks-muted mt-0.5">{arcProgressText(arc, player)}</p>
        </button>
      ))}

      {/* header — tapping opens the full player screen */}
      <button
        onClick={() => onGoTo('player')}
        className="relative overflow-hidden texture-floodlight rounded-lg border border-ks-border bg-gradient-to-br from-[#161510] to-[#0d0d0b] px-3 py-2.5 flex items-center gap-3 text-left active:scale-[0.995] transition-transform"
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 55% 90% at 10% 30%, rgba(212,175,55,0.12), transparent 65%)' }} />
        <Avatar id={player.avatarId ?? 0} size={44} className="relative z-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-display tracking-wide text-ks-ink text-sm leading-tight truncate">{getNation(player.nationality).flag} {player.name}</span>
            <span className="ml-auto font-display text-ks-gold text-[11px] tabular-nums shrink-0">{formatMoney(player.money ?? 0)}</span>
          </div>
          <div className="text-[10px] text-ks-muted">
            {player.position} &middot; age {player.careerClock.ageYears} &middot; {player.preferredFoot} foot
          </div>
        </div>
        <OvrRing value={ovr} />
        <div className="text-center shrink-0">
          <div className="text-[9px] text-ks-muted uppercase tracking-wider">potential</div>
          <div className="font-display text-green-500 text-sm">{player.potential}</div>
        </div>
      </button>

      {/* mini version of PlayerTab's radar — Home previously had no visual
          sense of a player's attribute "shape" at all, only bars elsewhere */}
      <Panel title={<span className="flex items-center gap-1"><Icon src={iconShape} />shape</span>}>
        <RadarChart points={shapePoints} size={180} />
      </Panel>

      {/* Phase 25: the Gazette teaser — a fresh issue drops every week */}
      {latestGazetteMasthead && (
        <button
          onClick={onOpenGazette}
          className="rounded-lg border border-ks-gold/40 bg-[#14120a] px-3 py-2.5 text-left active:scale-[0.995] transition-transform"
        >
          <div className="flex items-center justify-between">
            <span className="font-display tracking-widest text-[9px] text-ks-gold uppercase flex items-center gap-1"><Icon src={iconGazette} />the gazette · this week</span>
            <span className="text-[9px] text-ks-muted">read →</span>
          </div>
          <div className="font-display text-sm text-white mt-1 leading-snug">{latestGazetteMasthead}</div>
        </button>
      )}

      {/* energy — now a real meter with an explainer, not a bare number */}
      <button
        onClick={onOpenEnergy}
        className="rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-2.5 text-left active:scale-[0.995] transition-transform"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] text-ks-muted uppercase tracking-wider flex items-center gap-1">
            <Icon src={iconEnergy} />energy
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`text-[9px] uppercase tracking-wider ${bandSpec(player.fitness.stamina).colorClass}`}>
              {bandSpec(player.fitness.stamina).label}
            </span>
            <span className="text-[9px] text-ks-muted">what's this? →</span>
          </span>
        </div>
        <EnergyMeter stamina={player.fitness.stamina} showLabel={false} />
        {/* P29: energy is deliberately tight, so the fix is always one tap
            away when you're carrying a drink — no hunting through menus. */}
        {(() => {
          const drinks = Object.entries(player.consumables ?? {}).filter(([, n]) => n > 0)
          if (drinks.length === 0 || player.fitness.stamina >= 100) return null
          const [id, n] = drinks[0]
          return (
            <button
              onClick={() => consumeItem(id)}
              className="mt-2 w-full rounded-lg border border-ks-gold/40 bg-ks-gold/5 py-1.5 text-[10px] font-display uppercase tracking-widest text-ks-gold active:scale-[0.99]"
            >
              use {itemById(id)?.name ?? 'drink'} · {n} left
            </button>
          )
        })()}
        {/* P64 — free alternative for players without a drink (or who'd
            rather not spend one) — same 20% restore, paid for by watching
            a real rewarded ad instead of in-game money. */}
        {player.fitness.stamina < 100 && remainingToday('energy') > 0 && (
          <button
            onClick={async () => {
              const reward = await watchRewardedAd('energy')
              if (reward) restoreEnergyFromAd(20)
            }}
            className="mt-2 w-full rounded-lg border border-ks-border bg-[#0f0f0d] py-1.5 text-[10px] font-display uppercase tracking-widest text-ks-muted active:scale-[0.99]"
          >
            watch ad for +20% energy · {remainingToday('energy')} left today
          </button>
        )}
      </button>

      {/* status pills — color-coded confidence (was plain text, easy to miss
          at a glance) plus small icons so the two pills read as distinct
          stats rather than blending into the same gray-on-gray block */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-ks-border bg-[#0f0f0d] px-2 py-2 text-center">
          <div className="text-[9px] text-ks-muted uppercase tracking-wider">confidence</div>
          <div className={`text-sm font-display capitalize flex items-center justify-center gap-1 ${confidenceMeta(player.confidence.value).color}`}>
            <Icon src={iconConfidence} />
            {confidenceMeta(player.confidence.value).label}
          </div>
        </div>
        <div className="rounded-lg border border-ks-border bg-[#0f0f0d] px-2 py-2 text-center">
          <div className="text-[9px] text-ks-muted uppercase tracking-wider">week</div>
          <div className="text-ks-ink text-sm font-display flex items-center justify-center gap-1">
            <Icon src={iconWeek} />
            {calendar.currentWeek.weekNumber}
          </div>
        </div>
      </div>

      <Panel title={<span className="flex items-center gap-1"><Icon src={iconWeek} />week overview</span>}>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day) => {
            const event = eventsByDay[day]
            const isMatch = event?.type === 'match'
            return (
              <div
                key={day}
                className={`rounded-md border px-1 py-1.5 text-center ${
                  event?.resolved ? 'border-green-500/30 bg-green-500/5' :
                  isMatch ? 'border-ks-gold bg-ks-gold/10' : event ? 'border-ks-border bg-[#161613]' : 'border-ks-border/30'
                }`}
              >
                <div className={`text-[8px] uppercase tracking-wider mb-0.5 ${
                  event?.resolved ? 'text-green-500/70' : isMatch ? 'text-ks-gold' : 'text-ks-muted'
                }`}>{day}</div>
                <div className={`text-[8px] leading-tight min-h-5 ${event?.resolved ? 'text-ks-muted line-through' : 'text-ks-ink'}`}>
                  {event ? (event.resolved ? '✓ ' : '') + event.title.split(' ').slice(0, 2).join(' ') : '·'}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

      <Section
        title={<span className="flex items-center gap-1"><Icon src={iconCareer} />career</span>}
        action={
          <button onClick={() => onGoTo('table')} className="text-[9px] text-ks-gold tracking-wide">
            table →
          </button>
        }
      >
        <div className="flex flex-col gap-1.5">
          <StatRow label="path" value={isAcademy ? 'Academy' : 'Grassroots'} />
          {!isAcademy && <StatRow label="season" value={`${player.careerClock.grassrootsSeason ?? '—'} / 4`} />}
          <StatRow label="week" value={`${calendar.currentWeek.weekNumber} / ${SEASON_WEEKS}`} />
          <StatRow label="squad role" value={<span className="capitalize">{player.squadRole ?? 'TBD'}</span>} />
          {leagueName && <StatRow label={isAcademy ? 'academy' : 'league'} value={`${leagueName} · ${leaguePos}`} />}
        </div>
      </Section>

      <Section
        title={<span className="flex items-center gap-1"><Icon src={iconCoachTrust} />coach trust</span>}
        action={
          <button onClick={() => onGoTo('player')} className="text-[9px] text-ks-gold tracking-wide">
            notebook →
          </button>
        }
      >
        <div className="flex items-center gap-3">
          <Bar value={(player.coachTrust ?? 0) + 10} max={20} />
          <span className="text-[11px] text-ks-ink w-20 text-right">{trustEmoji(player.coachTrust ?? 0)} {trustLabel(player.coachTrust ?? 0)}</span>
        </div>
      </Section>
    </div>
  )
}
