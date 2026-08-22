// ============================================================================
// PHASE 33 — CONTRACT LIFECYCLE
//
// Found by playing a career end to end: the scholarship signed in week 78
// expired in week 166, and the career carried on to week 248 still being paid.
// `expiresWeek` was written and never read again. A contract that cannot end
// isn't a contract, and it removed the single biggest source of jeopardy an
// academy career should have — the possibility of not being kept on.
//
// This is the missing half. In the run-in to expiry the club decides whether
// they want you, based on the things the game already tracks. Then either:
//   - they open renewal talks (through the same negotiation pipeline, so a
//     renewal feels like the deal it is), or
//   - they tell you they're not keeping you, and you have a season's run-in to
//     find somewhere else before you're released.
// ============================================================================
import type { Player } from '../types/player'
import { selectionScore } from './selection'
import { standingOf } from './standing'

/** How many weeks before expiry the club makes its decision. */
export const RENEWAL_WINDOW_WEEKS = 8

export type ContractStatus =
  | { kind: 'none' }
  | { kind: 'running'; weeksLeft: number }
  | { kind: 'decision-due'; weeksLeft: number }
  | { kind: 'expired' }

export function contractStatus(player: Player): ContractStatus {
  if (!player.contract) return { kind: 'none' }
  const now = player.totalWeeksElapsed ?? 0
  const weeksLeft = player.contract.expiresWeek - now
  if (weeksLeft <= 0) return { kind: 'expired' }
  if (weeksLeft <= RENEWAL_WINDOW_WEEKS) return { kind: 'decision-due', weeksLeft }
  return { kind: 'running', weeksLeft }
}

/**
 * Does the club want to keep you?
 *
 * Reads the same signals the coach uses to pick a team, plus how the dressing
 * room and supporters feel — a club renews a player the staff rate, the squad
 * wants and the crowd likes. Deliberately forgiving at the margin: being
 * released should be the consequence of a genuinely poor spell, not of one
 * quiet month.
 */
export function renewalVerdict(player: Player): { keep: boolean; score: number; reason: string } {
  const selection = selectionScore(player) // 0-100
  const dressingRoom = (standingOf(player, 'teammates') + 100) / 2 // 0-100
  const crowd = (standingOf(player, 'fans') + 100) / 2
  const apps = player.career?.appearances ?? 0
  const availability = Math.min(1, apps / 40) * 100

  const score = Math.round(selection * 0.45 + dressingRoom * 0.2 + crowd * 0.15 + availability * 0.2)
  const keep = score >= 42

  let reason: string
  if (keep && score >= 70) reason = 'They want you tied down. This is a club planning around you.'
  else if (keep) reason = 'They see enough to keep going, though nobody is calling you the finished article.'
  else if (selection < 35) reason = 'You have not played enough football for them to justify it.'
  else if (dressingRoom < 40) reason = 'The staff have concerns about how you fit in the group.'
  else reason = 'They have decided to go in a different direction.'

  return { keep, score, reason }
}

/**
 * Renewal terms. A player the club is desperate to keep gets a real rise; a
 * marginal one gets offered close to what they're already on. Both are then
 * negotiable through the normal pipeline, so a good agent still matters.
 */
/**
 * A youth scholarship has a ceiling. Caught by the six-season career sim:
 * renewals multiplied the CURRENT wage, so three of them compounded £140 into
 * £554 a week — professional money being paid to a seventeen-year-old on a
 * scholarship, which then broke the money economy downstream. Renewals now
 * improve toward a ceiling rather than scaling off the last deal.
 */
export const SCHOLARSHIP_WAGE_CEILING = 320

export function renewalBaseWage(player: Player, verdictScore: number): number {
  const current = player.contract?.terms.weeklyWage ?? 100
  // 0.95x for a marginal keep, up to ~1.75x for a player they rate highly
  const multiplier = 0.95 + Math.max(0, (verdictScore - 42) / 58) * 0.8
  const raw = current * multiplier
  // Approach the ceiling asymptotically: a big rise is possible from a low
  // wage, but nobody negotiates their way to pro money inside an academy.
  const headroom = Math.max(0, SCHOLARSHIP_WAGE_CEILING - current)
  const capped = current + Math.min(raw - current, headroom * 0.55)
  return Math.max(current, Math.round(Math.min(capped, SCHOLARSHIP_WAGE_CEILING)))
}

/**
 * What happens when a contract runs out and nothing replaced it.
 *
 * Being released isn't necessarily the end — a 16-year-old released by an
 * academy usually drops back into local football and tries again, which is
 * both realistic and keeps the career playable. It only ends things outright
 * if the player has run out of runway.
 */
export function releaseOutcome(player: Player): { endsCareer: boolean; message: string } {
  const age = player.careerClock.ageYears
  const rep = player.reputation ?? 0

  if (age >= 19 && rep < 40) {
    return {
      endsCareer: true,
      message: 'Released, and at nineteen with nobody else calling, that is the end of the road. Not everyone makes it. Most do not.',
    }
  }
  return {
    endsCareer: false,
    message: 'Released. You are back in local football, playing for nothing, with something to prove all over again.',
  }
}
