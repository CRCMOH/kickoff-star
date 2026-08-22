import { rand } from './rng'
import type { CalendarState, CalendarWeek, DayOfWeek, CalendarEvent } from '../types/calendar'
import { buildSeasonSchedule, allMatchWeeks, competitionRoundForWeek, type CompetitionRoundSpec } from './season'

const DAY_ORDER: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// Season length. Bumped from 34 (Phase 8's 9-fixture season) to fit the full
// multi-competition calendar: 22-round Sunday League + School Cup (group+KO)
// + Sunday Cup (KO) + 2 school friendlies, per the locked 30+ matches/season spec.
export const SEASON_WEEKS = 44

function id() { return crypto.randomUUID() }

export function nextUnresolvedEvent(state: CalendarState): CalendarEvent | null {
  const byDay = new Map(state.currentWeek.events.map((e) => [e.day, e]))
  for (const day of DAY_ORDER) {
    const event = byDay.get(day)
    if (event && !event.resolved) return event
  }
  return null
}

export function markResolved(state: CalendarState, eventId: string): CalendarState {
  return {
    ...state,
    currentWeek: {
      ...state.currentWeek,
      events: state.currentWeek.events.map((e) => (e.id === eventId ? { ...e, resolved: true } : e)),
    },
  }
}

// Phase 17: match weeks are now derived from the generic season scheduler
// instead of a hand-picked set. This is the ONE registry of which
// competitions produce a matchday this season — P18-24 add entries here
// (Sunday Cup, School Cup, Academy cups, internationals) and the scheduler
// automatically seats them into free weeks with zero collisions.
//
// Right now only the Sunday League is registered, so behaviour is unchanged
// from the old hardcoded set (9 rounds spread across 34 weeks) — this is
// the plumbing for later phases, not a rules change on its own.
export const COMPETITION_SPECS: CompetitionRoundSpec[] = [
  { id: 'sundayLeague', rounds: 22 }, // shared slot: Sunday League (grassroots) AND Academy league (mutually exclusive phases)
  { id: 'schoolCup', rounds: 5 }, // 3 group rounds (field 16, groups of 4) + 2 knockout rounds (semi, final) — grassroots only
  { id: 'sundayCup', rounds: 4 }, // pure knockout, field 16 -> 4 rounds — grassroots only
  { id: 'schoolFriendlies', rounds: 2 }, // fixed, 2/year per spec — grassroots only
  // Phase 21: Academy gets the same cup depth as grassroots, per the locked
  // product strategy ("same depth applied to academy competitions"). These
  // slots sit unused during the grassroots phase and vice versa for the
  // grassroots-only ones above — phases never run concurrently so nothing
  // collides, it's just some slots are a no-op depending on which phase.
  { id: 'academyLeagueCup', rounds: 5 }, // U18 PL Cup equivalent — group + knockout
  { id: 'academyKnockoutCup', rounds: 4 }, // FA Youth Cup equivalent — pure knockout
]

export const SEASON_SCHEDULE = buildSeasonSchedule(SEASON_WEEKS, COMPETITION_SPECS)

// Kept as a Set export for backward compatibility with existing call sites
// (careerStore, FixturesTab) — now the UNION of every registered competition's
// match weeks, not just the league's.
export const MATCH_WEEKS = allMatchWeeks(SEASON_SCHEDULE)

// Which competition (and which round within it) is being played on a given
// calendar week — the piece careerStore needs once more than one competition
// can produce a matchday in the same season.
export function competitionForWeek(weekNumber: number) {
  return competitionRoundForWeek(SEASON_SCHEDULE, weekNumber)
}

// Which competitions actually RUN in each career phase. The scheduler seats
// all of them (phases share the same calendar shape), but during grassroots
// the academy cups are dormant and vice versa. A week whose competition is
// dormant for the current phase is NOT a matchday for the player — it renders
// as extra training instead (fixes the Phase 25 audit's "20 dead matchdays").
export type CareerPhase = 'grassroots-trials' | 'grassroots-season' | 'academy'
const GRASSROOTS_ACTIVE = new Set(['sundayLeague', 'schoolCup', 'sundayCup', 'schoolFriendlies'])
const ACADEMY_ACTIVE = new Set(['sundayLeague', 'academyLeagueCup', 'academyKnockoutCup'])

export function isCompetitionActive(competitionId: string, phase: CareerPhase): boolean {
  const set = phase === 'academy' ? ACADEMY_ACTIVE : GRASSROOTS_ACTIVE
  return set.has(competitionId)
}

// The competition producing the player's Saturday match this week, or null
// (dormant competition or no fixture week at all).
export function activeCompetitionForWeek(weekNumber: number, phase: CareerPhase): { competitionId: string; round: number } | null {
  const comp = competitionForWeek(weekNumber)
  if (!comp) return null
  return isCompetitionActive(comp.competitionId, phase) ? comp : null
}

// Midweek international windows (Wednesdays, like real life) so international
// duty never collides with the packed Saturday club calendar. Four qualifier
// rounds spread through the season, then a three-round finals bracket
// (QF/SF/F) in the run-in.
export const INTERNATIONAL_QUALIFIER_WEEKS = [8, 16, 24, 32]
export const INTERNATIONAL_FINALS_WEEKS = [37, 40, 43]
export function internationalRoundForWeek(weekNumber: number): { stage: 'qualifiers' | 'finals'; round: number } | null {
  const q = INTERNATIONAL_QUALIFIER_WEEKS.indexOf(weekNumber)
  if (q !== -1) return { stage: 'qualifiers', round: q + 1 }
  const f = INTERNATIONAL_FINALS_WEEKS.indexOf(weekNumber)
  if (f !== -1) return { stage: 'finals', round: f + 1 }
  return null
}

export function generateWeek(weekNumber: number, seasonYear: number, phase: CareerPhase = 'grassroots-season', hasInternationalDuty = false): CalendarWeek {
  // International duty takes over the Wednesday slot on window weeks —
  // midweek internationals, so club Saturdays are untouched.
  const internationalWeek = hasInternationalDuty && internationalRoundForWeek(weekNumber) !== null
  const events: CalendarEvent[] = [
    { id: id(), day: 'mon', type: 'training', title: 'finishing training', resolved: false },
    internationalWeek
      ? { id: id(), day: 'wed', type: 'match', title: 'international duty', resolved: false }
      : { id: id(), day: 'wed', type: 'training', title: 'tactical training', resolved: false },
    { id: id(), day: 'fri', type: 'school', title: 'off the pitch', resolved: false },
  ]
  // Phase 15: Tue and Thu were completely empty every single week — the calendar
  // only ever had 5 of 7 days doing anything. Using one of them for a second life
  // event on roughly half of weeks is free density with no rebalancing.
  if (weekNumber > 1 && rand() < 0.45) {
    events.push({ id: id(), day: 'tue', type: 'school', title: 'off the pitch', resolved: false })
  }

  // P32 — STREET GAMES. Player feedback: "it can sometimes get boring waiting
  // an entire week to play a match". Thursday was the last completely dead day
  // in the week, so it becomes the mid-week football slot: either a kickabout
  // that turns up (street) or the coach running a small-sided game instead of
  // a drill session. Never on a week you already have midweek international
  // duty — two midweek games is too much on a 15-year-old's legs.
  if (weekNumber > 2 && !internationalWeek) {
    const roll = rand()
    if (roll < 0.34) {
      events.push({ id: id(), day: 'thu', type: 'street', title: 'a game down the park', resolved: false })
    } else if (roll < 0.5) {
      events.push({ id: id(), day: 'thu', type: 'street', title: 'small-sided session', resolved: false })
    }
  }
  if (activeCompetitionForWeek(weekNumber, phase) !== null) {
    events.push({ id: id(), day: 'sat', type: 'match', title: 'matchday', resolved: false })
  } else {
    events.push({ id: id(), day: 'sat', type: 'training', title: 'extra training', resolved: false })
  }
  events.push({ id: id(), day: 'sun', type: 'rest', title: 'rest day', resolved: false })
  return { weekNumber, seasonYear, events }
}

export interface WeekAdvanceResult {
  calendar: CalendarState
  seasonEnded: boolean
  newAge: number
  reachedAgeCap: boolean
}

// Advance the week, handling season rollover and age increment.
// Age ticks each season (player ages ~1 year per season). Age cap = 20 (fail check upstream).
export function advanceWeek(state: CalendarState, currentAge: number, phase: CareerPhase = 'grassroots-season', hasInternationalDuty = false): WeekAdvanceResult {
  const isSeasonEnd = state.currentWeek.weekNumber >= SEASON_WEEKS
  const nextWeekNum = isSeasonEnd ? 1 : state.currentWeek.weekNumber + 1
  const nextSeason = isSeasonEnd ? state.currentWeek.seasonYear + 1 : state.currentWeek.seasonYear
  const newAge = isSeasonEnd ? currentAge + 1 : currentAge

  return {
    calendar: {
      currentWeek: generateWeek(nextWeekNum, nextSeason, phase, hasInternationalDuty),
      history: [...state.history, state.currentWeek].slice(-6),
    },
    seasonEnded: isSeasonEnd,
    newAge,
    reachedAgeCap: newAge >= 20,
  }
}

// NOTE: restRecovery() lived here until Phase 11. Rest recovery is now owned entirely by
// engine/energy.ts (baseRecovery + recoveryFor) so there is exactly ONE recovery curve in
// the codebase. Leaving a second one here would guarantee they drift apart.
