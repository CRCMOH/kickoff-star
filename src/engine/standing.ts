// ============================================================================
// PHASE 32 — STANDING (coach / teammates / fans)
//
// Requested: three relationship meters that move after EVERY match depending
// on how you performed, and which then feed events that nudge them by small
// margins.
//
// This deliberately does NOT duplicate the existing systems:
//   - coachTrust already exists and is the coach's professional judgement of
//     you. Standing.coach is the same number surfaced as a meter, so there is
//     one source of truth rather than two competing ones.
//   - the named relationship cast (P28) is about individual people you know.
//     Standing is about three GROUPS and their collective mood.
//
// The distinction that makes both worth having: your teammate bond with one
// named person can be excellent while the dressing room as a whole has turned
// on you, and the fans can adore a player the coach has lost patience with.
// ============================================================================
import type { Player } from '../types/player'

export type StandingGroup = 'coach' | 'teammates' | 'fans'

export interface Standing {
  /** -100..100 */
  teammates: number
  fans: number
}

export const STANDING_LABEL: Record<StandingGroup, string> = {
  coach: 'Coach',
  teammates: 'Dressing Room',
  fans: 'Supporters',
}

export function standingLabel(value: number): string {
  if (value >= 70) return 'adored'
  if (value >= 40) return 'well liked'
  if (value >= 15) return 'respected'
  if (value > -15) return 'neutral'
  if (value > -40) return 'doubted'
  if (value > -70) return 'unpopular'
  return 'hostile'
}

export function standingColor(value: number): string {
  if (value >= 40) return 'text-green-500'
  if (value >= 15) return 'text-green-400'
  if (value > -15) return 'text-ks-muted'
  if (value > -40) return 'text-orange-400'
  return 'text-red-500'
}

/** The coach meter reads directly off coachTrust so the two can never disagree. */
export function coachStanding(player: Player): number {
  return Math.max(-100, Math.min(100, (player.coachTrust ?? 0) * 10))
}

export function standingOf(player: Player, group: StandingGroup): number {
  if (group === 'coach') return coachStanding(player)
  const s = player.standing
  return group === 'teammates' ? (s?.teammates ?? 0) : (s?.fans ?? 0)
}

export interface MatchStandingInput {
  rating: number
  goals: number
  assists: number
  won: boolean
  drew: boolean
  /** Did the player actually feature? A watching substitute moves nothing. */
  played: boolean
  isHomeCrowd: boolean
}

export interface StandingDeltas {
  teammates: number
  fans: number
  notes: string[]
}

/**
 * How each group reacts to a performance.
 *
 * The two groups deliberately weight different things, which is the whole
 * point of separating them:
 *   - TEAMMATES care about the result and about you doing your job. They are
 *     forgiving of a quiet game in a win and hard on a selfish one in a loss.
 *   - FANS care about goals and moments. They will love a player who scores in
 *     a defeat and barely notice a solid 7.0 in a draw.
 *
 * Deltas are small by design (the brief said "little margins"): a single match
 * moves these by a few points, so standing is built over a season rather than
 * swinging on one afternoon.
 */
export function standingFromMatch(input: MatchStandingInput): StandingDeltas {
  const notes: string[] = []
  if (!input.played) {
    return { teammates: 0, fans: 0, notes: [] }
  }

  const { rating, goals, assists, won, drew } = input

  // --- teammates: result first, then whether you pulled your weight ---
  let teammates = 0
  if (won) teammates += 2.5
  else if (drew) teammates += 0.5
  else teammates -= 1.5

  if (rating >= 7.5) teammates += 2
  else if (rating >= 6.5) teammates += 1
  else if (rating < 5.5) teammates -= 2
  else if (rating < 6) teammates -= 0.5

  if (assists > 0) teammates += assists * 1.5 // setting others up is dressing-room currency
  if (goals > 0 && rating < 6) teammates -= 1 // scored but otherwise anonymous

  // --- fans: moments and goals ---
  let fans = 0
  if (goals > 0) fans += goals * 3
  if (assists > 0) fans += assists * 1.5
  if (rating >= 8) fans += 2.5
  else if (rating >= 7) fans += 1
  else if (rating < 5.5) fans -= 2

  if (won) fans += 1.5
  else if (!drew) fans -= 1
  // A goal in a defeat still buys you a lot of goodwill on the terraces.
  if (goals > 0 && !won && !drew) { fans += 1.5; notes.push('The supporters noticed who turned up.') }
  if (input.isHomeCrowd) fans *= 1.15 // performances in front of your own crowd count double-ish

  if (rating >= 8 && goals > 0) notes.push('That is the kind of afternoon people remember.')
  if (rating < 5 && !won) notes.push('A performance nobody enjoyed.')

  return {
    teammates: Math.round(teammates * 10) / 10,
    fans: Math.round(fans * 10) / 10,
    notes,
  }
}

export function applyStandingDeltas(current: Standing | undefined, deltas: StandingDeltas): Standing {
  const base = current ?? { teammates: 0, fans: 0 }
  const clamp = (v: number) => Math.max(-100, Math.min(100, Math.round(v * 10) / 10))
  return {
    teammates: clamp(base.teammates + deltas.teammates),
    fans: clamp(base.fans + deltas.fans),
  }
}

/**
 * Weekly drift toward neutral. Same proportional-with-floor shape the audited
 * trust and bond systems use, so standing can't sit pinned at an extreme for a
 * whole career off the back of one good month.
 */
export function driftStanding(current: Standing | undefined): Standing {
  const base = current ?? { teammates: 0, fans: 0 }
  const decay = (v: number) => {
    if (Math.abs(v) <= 0.5) return 0
    const pull = v * 0.04
    const step = Math.abs(pull) < 0.3 ? Math.sign(v) * 0.3 : pull
    return Math.round((v - step) * 10) / 10
  }
  return { teammates: decay(base.teammates), fans: decay(base.fans) }
}

/**
 * What standing actually DOES, so the meters aren't decoration:
 *   - a strong dressing room lifts your match rating slightly (teammates find
 *     you, cover for you, want you to do well)
 *   - hostile supporters make home games harder on the nerves
 */
export function standingMatchEffects(player: Player, isHome: boolean): { ratingBonus: number; confidenceShift: number } {
  const teammates = standingOf(player, 'teammates')
  const fans = standingOf(player, 'fans')
  return {
    // deliberately tiny — this applies to EVERY match
    ratingBonus: Math.max(-0.25, Math.min(0.25, (teammates / 100) * 0.25)),
    confidenceShift: isHome ? Math.max(-0.4, Math.min(0.4, (fans / 100) * 0.4)) : 0,
  }
}
