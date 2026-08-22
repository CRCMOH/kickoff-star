import { rand } from './rng'
import { effectiveValues } from './economy'
import type { Player } from '../types/player'

// ============================================================================
// PHASE 13 — INTERACTIVE KEY MOMENTS
//
// The gap against New Star Soccer was never simulation depth — ours is deeper. It
// was that our key moments are a MENU. You read a situation, tap one of three
// options, and watch a dice roll resolve. NSS's whole magic is that the moment is
// something you *do*.
//
// So this adds an execution layer on top of the existing resolution: you still make
// the read (which option), then you have to actually land it (a timing input).
//
// THE FAIRNESS RULE, which is the entire reason NSS feels "fair and elite":
//   Execution NUDGES the outcome inside the band the simulation already set.
//   It never overrides it.
//
// A perfect input on a half-chance is still a half-chance — just at the top of its
// range. A fumbled input on a clear chance is still a decent look. Concretely the
// swing is bounded at ±25%, which is enough that skill is clearly felt and not
// enough that a good player can brute-force bad decisions. The audit asserts that
// perfect execution on a poor read never beats sloppy execution on a good read.
// ============================================================================

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export type ExecutionGrade = 'perfect' | 'good' | 'ok' | 'miss'

export interface ExecutionSpec {
  /** Half-widths as a fraction of the track, measured from the centre target. */
  perfect: number
  good: number
  ok: number
  /** Milliseconds for one full sweep across the track. */
  sweepMs: number
}

export const GRADE_LABEL: Record<ExecutionGrade, string> = {
  // P49 — Joel's real playtester feedback: "perfect but still missed, 3
  // times in one match." The mechanics were never broken (EXECUTION_SWING
  // is a deliberate ±14% nudge — attributes and the situation decide the
  // outcome, not this bar). The label was the bug: "perfect" reads as a
  // promise the bar was never making. These now describe the STRIKE, same
  // as the other three always correctly did, not the result.
  perfect: 'clean strike',
  good: 'good contact',
  ok: 'scuffed',
  miss: 'mistimed',
}

export const GRADE_COLOR: Record<ExecutionGrade, string> = {
  perfect: 'text-green-500',
  good: 'text-ks-gold',
  ok: 'text-orange-500',
  miss: 'text-red-500',
}

/** How much of the ±25% band each grade earns. */
export function qualityOf(grade: ExecutionGrade): number {
  switch (grade) {
    case 'perfect': return 1.0
    case 'good': return 0.7
    case 'ok': return 0.35
    case 'miss': return 0.0
  }
}

/** Attributes that govern striking the ball / reacting cleanly under pressure. */
function executionSkill(player: Player): number {
  const v = effectiveValues(player)
  if (player.attributes.kind === 'goalkeeper') {
    return ((v.reflexes ?? 8) + (v.gkPositioning ?? 8)) / 2
  }
  return ((v.composure ?? 8) + (v.concentration ?? 8)) / 2
}

/**
 * Build the timing window for this specific attempt.
 *
 * Three things make it harder: a riskier option (low baseCeiling), a tired player,
 * and low composure. Tying the window to match stamina is deliberate — it's what
 * connects Phase 11's energy system to the thing the player actually feels.
 */
export function executionSpecFor(player: Player, baseCeiling: number, matchStamina: number): ExecutionSpec {
  const skill = executionSkill(player)
  const skillMod = 0.78 + (skill / 20) * 0.44      // 0.78 .. 1.22
  const fatigueMod = 0.78 + (clamp(matchStamina, 0, 100) / 100) * 0.22 // 0.78 .. 1.00
  const riskMod = 0.72 + clamp(baseCeiling, 0, 1) * 0.5 // safe options are more forgiving

  const mod = skillMod * fatigueMod * riskMod

  return {
    perfect: clamp(0.075 * mod, 0.040, 0.105),
    good: clamp(0.165 * mod, 0.100, 0.215),
    ok: clamp(0.300 * mod, 0.200, 0.360),
    // Risky attempts and tired legs sweep faster, so there's less time to read it.
    sweepMs: Math.round(clamp(1500 * (0.75 + riskMod * 0.35) * (0.85 + fatigueMod * 0.2), 850, 1900)),
  }
}

/**
 * Grade a stop.
 * @param position where the marker stopped, 0..1 across the track
 * @param target   centre of the scoring zone, 0..1
 */
export function gradeFromStop(position: number, target: number, spec: ExecutionSpec): ExecutionGrade {
  const offset = Math.abs(position - target)
  if (offset <= spec.perfect) return 'perfect'
  if (offset <= spec.good) return 'good'
  if (offset <= spec.ok) return 'ok'
  return 'miss'
}

/**
 * Bounded swing. This constant IS the fairness guarantee — do not widen casually.
 *
 * Set by simulation, not by feel. The option pools are deliberately near-EV-equal
 * (risky options carry a low ceiling but a high reward tier), which means execution
 * dominates the read at almost any generous swing. At ±25% a PERFECT strike on the
 * worst available option out-earned a SCUFFED strike on the best one (EV 1.41 vs
 * 1.27 over 200k simulated moments) — i.e. skill was overriding judgement, which is
 * exactly the failure mode this layer must avoid.
 *
 * Swept every real option pool across the full attribute range (6-18), all three
 * chance tiers, and all four grades: 16% is the largest swing where the read still
 * dominates everywhere. The binding cases are ATT_POOLS.good and GK_POOLS.onevone,
 * whose options are the closest to EV-identical. Set to 14% for margin.
 *
 * Still clearly felt: a perfect strike is ~33% more likely to come off than a
 * mistimed one.
 */
export const EXECUTION_SWING = 0.14

/**
 * Apply execution to the simulation's success chance.
 * miss → ×0.86, perfect → ×1.14, scaled linearly between.
 */
export function adjustChance(baseChance: number, grade: ExecutionGrade): number {
  const q = qualityOf(grade)
  const factor = (1 - EXECUTION_SWING) + q * (EXECUTION_SWING * 2)
  return clamp(baseChance * factor, 0.02, 0.97)
}

/**
 * Execution also feeds the match rating, so striking the ball cleanly is recognised
 * even when the outcome doesn't fall your way — good process, bad luck.
 */
export function ratingNudgeFor(grade: ExecutionGrade): number {
  switch (grade) {
    case 'perfect': return 0.25
    case 'good': return 0.1
    case 'ok': return 0
    case 'miss': return -0.2
  }
}

/** Auto-resolve for players who'd rather just watch the sim. */
export function autoResolveGrade(player: Player, matchStamina: number): ExecutionGrade {
  // Weighted toward 'good' so opting out isn't punished — but it can't produce
  // 'perfect', so playing the moment yourself is always the higher ceiling.
  const skill = executionSkill(player)
  const fatigue = clamp(matchStamina, 0, 100) / 100
  const goodChance = clamp(0.35 + (skill / 20) * 0.3 * fatigue, 0.25, 0.7)
  const r = rand()
  if (r < goodChance) return 'good'
  if (r < goodChance + 0.45) return 'ok'
  return 'miss'
}
