import type { Player } from '../types/player'
import { effectiveValues } from './economy'
import type { TrainingGrade } from '../types/training'

// ============================================================================
// COACH TRUST — locked spec: single running score (-10..+10), not sub-scores.
// Decays toward neutral like Momentum/Confidence. Gates squad selection,
// player-choice training slots, substitution timing, and Coach's Notebook tone.
// ============================================================================

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export interface CoachTrust {
  value: number // -10..+10
}

export function initCoachTrust(): CoachTrust {
  return { value: 0 }
}

// Decay toward neutral each week (spec: needs reinforcement, not permanent).
// P24: was a flat -0.3/week step, which worked fine against the old 9-match
// season but produces a bang-bang dynamic (either inert near zero or pinned
// at the cap, nothing stable in between) once matches — and therefore gain
// events — roughly tripled per season. Switched to the same proportional
// decay-with-floor shape decayConfidence already uses successfully, which is
// what actually settles into a stable, non-maxed plateau.
export function decayTrust(trust: CoachTrust): CoachTrust {
  const baseline = 0
  const next = trust.value + (baseline - trust.value) * 0.15
  if (Math.abs(next - baseline) > Math.abs(trust.value - baseline) - 0.4) {
    return { value: trust.value > baseline ? Math.max(baseline, trust.value - 0.8) : Math.min(baseline, trust.value + 0.8) }
  }
  return { value: Math.round(next * 10) / 10 }
}

// Training grade contributes a small, steady trust nudge.
export function trustFromTrainingGrade(trust: CoachTrust, grade: TrainingGrade): CoachTrust {
  const delta = grade === 'A+' ? 0.5 : grade === 'A' ? 0.3 : grade === 'B' ? 0.1 : grade === 'F' ? -0.4 : -0.1
  return { value: clamp(trust.value + delta, -10, 10) }
}

// Training skip hurts trust, less so if skipped while genuinely fatigued (spec nuance).
export function trustFromSkippedTraining(trust: CoachTrust, wasFatigued: boolean): CoachTrust {
  const delta = wasFatigued ? -0.3 : -0.8
  return { value: clamp(trust.value + delta, -10, 10) }
}

// Match performance relative to expectations — bench player overperforming builds
// trust faster than a starter merely matching expectations (spec).
// P24: re-derived against the new proportional decay above via simulation
// (grid search across decay/gain combinations) rather than guessed — these
// values produce a stable spread (weak trends negative, solid stays modest,
// star/elite grow meaningfully over a career without permanently pinning at
// the cap in season 1, which is what the old flat-decay values did once
// match volume roughly tripled).
export function trustFromMatchRating(trust: CoachTrust, rating: number, wasStarter: boolean): CoachTrust {
  let delta: number
  if (rating >= 8) delta = wasStarter ? 1.2 : 1.6
  else if (rating >= 6.5) delta = wasStarter ? 0.47 : 0.65
  else if (rating >= 5) delta = -0.08
  else delta = -0.95
  return { value: clamp(trust.value + delta, -10, 10) }
}

export function trustLabel(value: number): string {
  if (value >= 6) return 'Excellent'
  if (value >= 2) return 'Good'
  if (value >= -2) return 'Neutral'
  if (value >= -6) return 'Strained'
  return 'Poor'
}

// P54 — ChatGPT review: "show an emoji next to the coach so players
// instantly understand where they stand." Same thresholds as trustLabel,
// not a separate scale to keep in sync.
export function trustEmoji(value: number): string {
  if (value >= 6) return '😊'
  if (value >= 2) return '🙂'
  if (value >= -2) return '😐'
  if (value >= -6) return '😕'
  return '😠'
}

// Gates: how many player-choice training slots does trust unlock per week (spec).
export function playerChoiceSlots(trust: number): number {
  if (trust >= 6) return 2
  if (trust >= -2) return 1
  return 0
}

// Squad selection weighting nudge from trust (feeds into the Grassroots season loop later).
export function squadOddsModifier(trust: number): number {
  return 1 + trust / 30 // ±33% swing at the extremes
}

// Coach's Notebook tone — same underlying facts, framed warmer/colder by trust (spec).
export function notebookTone(trust: number): 'warm' | 'neutral' | 'cold' {
  if (trust >= 3) return 'warm'
  if (trust >= -3) return 'neutral'
  return 'cold'
}

// Aggregate helper: given a player's recent history, compute a Coach's Notebook entry.
export function generateNotebookEntry(player: Player, trustValue: number): { strengths: string[]; weaknesses: string[]; recommendation: string } {
  const tone = notebookTone(trustValue)
  const recentRatings = player.matchRatings ?? []
  const avgRating = recentRatings.length ? recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length : 6
  // P29: equipment boosts apply through effectiveValues (capped at potential)
  const values = effectiveValues(player)
  const sorted = Object.entries(values).sort((a, b) => b[1] - a[1])
  const best = sorted[0]?.[0] ?? 'attitude'
  const worst = sorted[sorted.length - 1]?.[0] ?? 'consistency'

  const strengths: string[] = []
  const weaknesses: string[] = []

  if (avgRating >= 7) strengths.push(tone === 'warm' ? `Genuinely excellent recent form — your ${best} stands out.` : `Solid recent form, ${best} is a real strength.`)
  else if (avgRating < 5.5) weaknesses.push(tone === 'cold' ? `Performances have dropped off. Not good enough right now.` : `A dip in form recently — needs addressing.`)

  if (values[worst] < 8) weaknesses.push(tone === 'cold' ? `${worst} is a genuine weakness that's costing you.` : `Room to improve your ${worst}.`)

  if (strengths.length === 0) strengths.push(tone === 'warm' ? 'Good attitude in every session.' : 'Shows up and puts the work in.')

  const recommendation = weaknesses.length
    ? `Spend more time on ${worst}-focused training.`
    : 'Keep doing what you\'re doing.'

  return { strengths, weaknesses, recommendation }
}

/**
 * Phase 15: confidence regression toward the player's personal resting point.
 *
 * Player.confidence.baseline has been documented since day one as "personal resting
 * point this decays toward" — but nothing ever decayed toward it. That left confidence
 * as a pure accumulator against a hard clamp of +/-10, so once the life layer started
 * firing ~49 events a season it pegged at ~+9 under EVERY strategy, including picking
 * options at random. A stat that always reads "maxed" is a stat that has stopped
 * feeding anything, which would have silently switched off the form loop.
 *
 * Pulling ~18% of the way back to baseline each week means a good run still lifts you
 * and holds while you keep performing, but nothing stays at the ceiling for free.
 */
export function decayConfidence(value: number, baseline: number): number {
  const next = value + (baseline - value) * 0.18
  // Always close the gap by at least a whole point, otherwise the asymptote leaves
  // confidence parked just under the ceiling forever.
  if (Math.abs(next - baseline) > Math.abs(value - baseline) - 0.5) {
    return value > baseline ? Math.max(baseline, value - 1) : Math.min(baseline, value + 1)
  }
  return Math.round(next * 10) / 10
}
