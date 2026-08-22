import type { Player } from '../types/player'
import { rand } from './rng'
import type { Position } from '../types/attributes'

// ============================================================================
// FOOTBALL ENGINE — Section 5 (Substitutions & Fatigue)
// Per locked spec: fatigue accrues per drive by time-slice/intensity/position,
// feeds back into probability + involvement; subs are rating/fatigue/tactical-
// triggered for AI, narrative for the player; sub limits vary by competition tier;
// GK subs kept rare/high-drama.
// ============================================================================

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// Position fatigue multiplier — wingers/fullbacks cover more ground (spec).
const POSITION_FATIGUE_RATE: Record<Position, number> = {
  GK: 0.35, CB: 0.6, FB: 1.15, CM: 1.0, WM: 1.1, WG: 1.2, ST: 0.95,
}

// Stamina cost for a single drive, scaled by time slice + whether the player was involved.
export function driveStaminaCost(position: Position, driveMinutes: number, wasInvolved: boolean): number {
  const rate = POSITION_FATIGUE_RATE[position] ?? 1.0
  const base = driveMinutes * 0.35 // baseline drain per minute of play
  const involvementCost = wasInvolved ? driveMinutes * 0.25 : 0 // sprinting into a chance costs more
  return (base + involvementCost) * rate
}

// Live in-match stamina state (separate from the player's persistent fitness.stamina,
// which represents week-to-week energy — this is the 0-100 "matchSharpness" for THIS game).
export interface MatchFatigue {
  matchStamina: number // 0-100, starts near the player's current weekly stamina
  substituted: boolean
  subMinute: number | null
}

export function initMatchFatigue(player: Player): MatchFatigue {
  // starting match sharpness is capped by weekly stamina — tired going in, tired earlier
  return { matchStamina: clamp(player.fitness.stamina, 20, 100), substituted: false, subMinute: null }
}

export function applyDriveFatigue(state: MatchFatigue, cost: number): MatchFatigue {
  return { ...state, matchStamina: clamp(state.matchStamina - cost, 0, 100) }
}

// Fatigue modifier on option success (spec: Section 2 probability formula input).
// Tired players get a real but not crushing penalty.
export function fatigueModifier(matchStamina: number): number {
  if (matchStamina > 60) return 1.0
  if (matchStamina > 35) return 0.92
  if (matchStamina > 15) return 0.8
  return 0.65
}

// --- AI substitution logic ---
export interface SubDecision {
  shouldSub: boolean
  reason: 'fatigue' | 'poor-rating' | 'tactical' | null
}

export function evaluateSub(
  position: Position, matchStamina: number, liveRating: number, minute: number, teamLosing: boolean
): SubDecision {
  // GK subs are rare/high-drama — only genuine injury-tier fatigue collapse forces one
  if (position === 'GK') {
    if (matchStamina < 8) return { shouldSub: true, reason: 'fatigue' }
    return { shouldSub: false, reason: null }
  }

  // P31b. Two bugs lived here.
  //
  // First these were CERTAINTIES — cross a line and you were always hooked,
  // which created a death spiral in a weak team (few chances → low rating →
  // subbed → fewer chances). So I made them probabilistic.
  //
  // That was worse. This function is called ONCE PER DRIVE, and there are ~37
  // drives a match, so a "0.3 chance" applied across the last nine drives
  // compounded to 96%. Measured: 95% of matches ended in a substitution.
  //
  // These are now PER-DRIVE hazard rates, sized so the cumulative chance over
  // the window they apply to lands where it should. Roughly: ~7 drives in the
  // last 18 minutes, so p=0.05/drive ≈ 30% across that window.
  if (matchStamina < 12 && minute > 70) return { shouldSub: true, reason: 'fatigue' } // genuinely finished
  if (matchStamina < 22 && minute > 70 && rand() < 0.05) return { shouldSub: true, reason: 'fatigue' }
  if (liveRating < 4.6 && minute > 65 && rand() < 0.045) return { shouldSub: true, reason: 'poor-rating' }
  if (teamLosing && minute > 74 && matchStamina < 35 && rand() < 0.035) return { shouldSub: true, reason: 'tactical' }
  return { shouldSub: false, reason: null }
}

export const SUB_REASON_TEXT: Record<NonNullable<SubDecision['reason']>, string> = {
  fatigue: 'The legs have gone. The coach is bringing on fresh energy.',
  'poor-rating': 'It hasn\'t been your day. The coach has seen enough.',
  tactical: 'The coach is chasing the game and switching things up.',
}

// Impact-sub involvement boost: elevated odds for the first few drives after entry (spec).
export function impactSubBoost(minutesSinceEntry: number): number {
  if (minutesSinceEntry <= 15) return 1.35
  if (minutesSinceEntry <= 30) return 1.1
  return 1.0
}

// Sub limits by competition tier (spec: grassroots more lenient, pro stricter).
export const SUB_LIMITS: Record<'grassroots' | 'academy' | 'pro', number> = {
  grassroots: 5,
  academy: 5,
  pro: 3,
}
