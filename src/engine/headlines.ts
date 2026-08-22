// ============================================================================
// PHASE 35 — HEADLINES
//
// Requested as something DIFFERENT to the Gazette: the Gazette is a weekly
// digest you open deliberately, like a local paper. Headlines are the opposite
// — short, immediate, NSS-style news beats that surface themselves right after
// the moment that caused them (a hat-trick, a scout in the stands) or that
// build tension around something live (a title race, a relegation scrap, a
// golden boot chase). They're a toast, not a screen: read it or swipe it away,
// the game never stops for it.
//
// Scope note, stated plainly rather than faked: the game does not simulate
// every player at every AI club, so a genuine league-wide "who's top scorer"
// race isn't data that exists. The golden boot headline instead tracks the
// player against ONE synthetic rival scorer — a plausible tally that drifts
// week to week based on that rival's club strength — which gives the same
// "am I still ahead" tension without pretending to simulate a full division
// of individual goalscorers.
// ============================================================================
import { rand } from './rng'
import type { Player } from '../types/player'
import type { LeagueStanding } from './league'
import { sortStandings } from './league'
import type { ScoutingState } from './scouting'
import { surnameOf } from './commentary'
import { FIRST_NAMES, LAST_NAMES } from './squad'

export type HeadlineTone = 'breaking' | 'buildup' | 'talking-point'

export interface Headline {
  id: string
  tone: HeadlineTone
  text: string // the punchy line, e.g. "HAT-TRICK HERO"
  subtext: string // one supporting sentence
  weekNumber: number
}

function id() { return crypto.randomUUID() }
function mk(tone: HeadlineTone, text: string, subtext: string, week: number): Headline {
  return { id: id(), tone, text, subtext, weekNumber: week }
}

// ---------------------------------------------------------------------------
// POST-MATCH — fired immediately off a single result, so it lands while the
// match is still fresh. Checked once per applied match result.
// ---------------------------------------------------------------------------
export interface PostMatchHeadlineInput {
  player: Player
  rating: number
  goals: number
  assists: number
  won: boolean
  opponentName: string
  weekNumber: number
  /** Watcher count and top interest before this match, to detect a new arrival or a jump. */
  scoutingBefore: ScoutingState
  scoutingAfter: ScoutingState
}

export function checkPostMatchHeadlines(input: PostMatchHeadlineInput): Headline[] {
  const { player, rating, goals, assists, weekNumber } = input
  const surname = surnameOf(player.name)
  const out: Headline[] = []

  if (goals >= 3) {
    out.push(mk('breaking', 'HAT-TRICK HERO', `${surname} scores three against ${input.opponentName}. The kind of afternoon that gets talked about all week.`, weekNumber))
  } else if (rating >= 8.8) {
    out.push(mk('breaking', `${surname.toUpperCase()} INVOLVED IN EVERYTHING`, `A rating of ${rating.toFixed(1)} against ${input.opponentName} — one of those performances where every touch comes off.`, weekNumber))
  } else if (goals >= 1 && assists >= 2) {
    out.push(mk('breaking', 'A HAND IN EVERYTHING', `${surname} scores and sets up two more against ${input.opponentName}. A complete display.`, weekNumber))
  }

  // Scout attention — a brand new watcher, or an existing one jumping tiers.
  const newWatchers = input.scoutingAfter.watchers.filter(
    (w) => !input.scoutingBefore.watchers.some((b) => b.club.id === w.club.id),
  )
  if (newWatchers.length > 0 && rand() < 0.7) {
    const club = newWatchers[0].club
    out.push(mk('talking-point', 'SCOUTS IN THE STANDS', `${club.name} had someone watching ${surname} at the weekend. Word travels fast in this game.`, weekNumber))
  } else {
    const jumped = input.scoutingAfter.watchers.find((w) => {
      const before = input.scoutingBefore.watchers.find((b) => b.club.id === w.club.id)
      return before && before.tier !== w.tier && w.tier === 'national'
    })
    if (jumped && rand() < 0.6) {
      out.push(mk('talking-point', 'INTEREST GOES NATIONAL', `${jumped.club.name}'s interest in ${surname} has stepped up a level after the weekend's performance.`, weekNumber))
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// WEEKLY — checked once a week on the tick, gated so the ticker doesn't spam.
// ---------------------------------------------------------------------------
export interface SyntheticScorer {
  name: string
  club: string
  goals: number
}

/** A lightweight rival scorer, seeded once and drifting weekly — see the file header. */
export function initSyntheticScorer(): SyntheticScorer {
  const names = ['Danny Osei', 'Kai Vermeer', 'Theo Marsh', 'Lucas Idrissi', 'Ryan Kowalski', 'Sam Okonkwo']
  const clubs = ['Hartfield', 'Westgate', 'Millbrook', 'Ashcombe', 'Fenwick', 'Redcliffe']
  const i = Math.floor(rand() * names.length)
  return { name: names[i], club: clubs[i], goals: Math.floor(rand() * 3) }
}

export function driftSyntheticScorer(scorer: SyntheticScorer): SyntheticScorer {
  // Scores roughly every other week, occasionally braces — a believable pace
  // for a division's top forward without simulating actual matches for him.
  const roll = rand()
  const gained = roll < 0.4 ? 1 : roll < 0.5 ? 2 : 0
  return { ...scorer, goals: scorer.goals + gained }
}

export interface WeeklyHeadlineInput {
  player: Player
  weekNumber: number
  seasonWeeks: number
  standings: LeagueStanding[] | null
  playerTeamId: string | null
  scorer: SyntheticScorer
  /** Next unplayed fixture info, if known — used for the "big match coming up" beat. */
  nextFixture: { opponentName: string; isCupKnockout: boolean; cupRoundLabel?: string } | null
  /** Real club names from the division, for world-building transfer stories that have nothing to do with the player. */
  worldTeamNames: string[]
}

const POINTS_TIGHT = 3
const WEEKS_LEFT_FOR_RACE = 10

export function checkWeeklyHeadlines(input: WeeklyHeadlineInput): Headline[] {
  const { weekNumber, standings, playerTeamId, scorer, nextFixture, player } = input
  const out: Headline[] = []
  const weeksLeft = input.seasonWeeks - weekNumber

  if (standings && standings.length >= 4 && weeksLeft > 0 && weeksLeft <= WEEKS_LEFT_FOR_RACE) {
    const sorted = sortStandings(standings)

    // Title race: top two within a handful of points.
    const gapAtTop = sorted[0].points - sorted[1].points
    if (gapAtTop <= POINTS_TIGHT && rand() < 0.35) {
      const involvesPlayer = playerTeamId && sorted.slice(0, 2).some((s) => s.teamId === playerTeamId)
      out.push(mk('talking-point', 'TITLE RACE GOING TO THE WIRE',
        involvesPlayer
          ? `Just ${gapAtTop} point${gapAtTop === 1 ? '' : 's'} between you and top spot with ${weeksLeft} to play. Nobody is looking away from this.`
          : `${sorted[0].teamName} and ${sorted[1].teamName} are separated by just ${gapAtTop} point${gapAtTop === 1 ? '' : 's'} with ${weeksLeft} games left.`,
        weekNumber))
    }

    // Relegation battle: the cutoff zone is bunched up.
    const cutoff = sorted.length - 3 // last relegation spot, matching the existing pyramid rules
    if (cutoff >= 1 && cutoff < sorted.length - 1) {
      const gapAtBottom = sorted[Math.max(0, cutoff - 1)].points - sorted[Math.min(sorted.length - 1, cutoff + 1)].points
      if (gapAtBottom <= POINTS_TIGHT && rand() < 0.3) {
        const involvesPlayer = playerTeamId && sorted.slice(Math.max(0, cutoff - 1), cutoff + 2).some((s) => s.teamId === playerTeamId)
        out.push(mk('talking-point', 'RELEGATION FIGHT INTENSIFIES',
          involvesPlayer
            ? `The bottom of the table is bunched together and your side is right in it. Every point from here matters.`
            : `Four clubs inside three points at the bottom. Somebody's season is about to get very difficult.`,
          weekNumber))
      }
    }
  }

  // Golden boot race — synthetic rival, see file header for why.
  const myGoals = player.seasonGoals ?? 0
  const gap = scorer.goals - myGoals
  if (Math.abs(gap) <= 2 && weekNumber > 6 && rand() < 0.3) {
    if (gap <= 0) {
      out.push(mk('talking-point', 'TOP OF THE SCORING CHARTS',
        `${myGoals} goals this season puts you ahead of ${scorer.name} (${scorer.club}) on ${scorer.goals}. The golden boot is very much alive.`,
        weekNumber))
    } else {
      out.push(mk('talking-point', 'CHASING THE GOLDEN BOOT',
        `${scorer.name} of ${scorer.club} leads the scoring charts on ${scorer.goals}. You're only ${gap} behind on ${myGoals}.`,
        weekNumber))
    }
  }

  // Big match on the horizon.
  if (nextFixture && rand() < 0.4) {
    if (nextFixture.isCupKnockout) {
      out.push(mk('buildup', `${(nextFixture.cupRoundLabel ?? 'CUP TIE').toUpperCase()} THIS WEEK`,
        `${nextFixture.opponentName} stand between you and the next round. Knockout football — one bad night and it's over.`,
        weekNumber))
    }
  }

  // World-building transfer news — deliberately NOT about the player. Two
  // real clubs from the division, a fabricated player, a fabricated fee. This
  // is what makes the league feel like it's alive around you rather than
  // existing purely to produce your fixtures.
  if (input.worldTeamNames.length >= 2 && weekNumber > 3 && rand() < 0.18) {
    const pool = [...input.worldTeamNames]
    const buyerIdx = Math.floor(rand() * pool.length)
    const buyer = pool.splice(buyerIdx, 1)[0]
    const seller = pool[Math.floor(rand() * pool.length)]
    const name = `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}`
    const fee = [15_000, 30_000, 60_000, 120_000, 250_000][Math.floor(rand() * 5)]
    if (buyer && seller && buyer !== seller) {
      // P54 — real feedback: "how do high school teams do 80k transfers,
      // isn't that low-key selling kids?" The underlying mechanism is real
      // and legal — academies do pay development compensation to a young
      // player's previous club, paid club-to-club, never to the player
      // himself — but "TRANSFER CONFIRMED... signing... for a fee" read
      // exactly like an adult transfer with none of that context. Reworded
      // to say plainly what it actually is.
      out.push(mk('talking-point', 'YOUTH MOVE CONFIRMED',
        `${buyer}'s academy have signed ${name} from ${seller}, with development compensation — paid club to club, not to the player — reported around £${(fee / 1000).toFixed(0)}k.`,
        weekNumber))
    }
  }

  return out
}
