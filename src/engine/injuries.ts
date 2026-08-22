import { rand } from './rng'
import type { Position } from '../types/attributes'

// ============================================================================
// FOOTBALL ENGINE — Section 6 (Injuries)
// Per locked spec: per-drive risk = base × fatigue(exponential) × intensity ×
// pitch × recent-injury-history; severity tiers Knock/Minor/Moderate/Severe/
// Career-threatening; the old audit's medical-retirement softlock bug is
// explicitly avoided — "career-threatening" is a severity tier with a recovery
// path, never a permanent unresettable flag.
// ============================================================================

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export type InjurySeverity = 'none' | 'knock' | 'minor' | 'moderate' | 'severe' | 'career-threatening'

export interface Injury {
  severity: InjurySeverity
  weeksOut: number
  description: string
  occurredWeek: number
}

// GK risk table is distinct (diving/collisions), not sprinting/tackling-heavy (spec).
const POSITION_INJURY_RISK: Record<Position, number> = {
  GK: 0.55, CB: 0.75, FB: 1.0, CM: 0.85, WM: 0.9, WG: 1.0, ST: 0.95,
}

// Per-drive injury risk roll. Called sparingly (only on meaningfully involved drives,
// not every drive) to keep it computationally light and narratively focused (spec).
export function injuryRisk(
  position: Position, matchStamina: number, intensity: number /* 0-1, tackle/sprint weight */,
  pitchCondition: number /* 0-1, 1 = perfect */, recentInjuryCount: number
): number {
  const base = 0.0011 // ~0.11% baseline per involved drive — tuned so a full match ≈ 2-4% injury chance
  // fatigue is EXPONENTIAL not linear per spec — tired players are much more fragile
  const fatigueFactor = 1 + Math.pow((100 - matchStamina) / 100, 2) * 3
  const intensityFactor = 1 + intensity
  const pitchFactor = 1 + (1 - pitchCondition) * 0.5
  const historyFactor = 1 + recentInjuryCount * 0.4
  const posFactor = POSITION_INJURY_RISK[position] ?? 1.0
  return clamp(base * fatigueFactor * intensityFactor * pitchFactor * historyFactor * posFactor, 0, 0.25)
}

// Roll for an injury; if triggered, determine severity from a weighted distribution.
export function rollInjury(risk: number): Injury | null {
  if (rand() >= risk) return null

  const r = rand()
  let severity: InjurySeverity
  let weeksOut: number
  let description: string

  if (r < 0.5) {
    severity = 'knock'; weeksOut = 0
    description = 'You take a knock but shake it off. No time lost.'
  } else if (r < 0.78) {
    severity = 'minor'; weeksOut = 1 + Math.floor(rand() * 2)
    description = 'A minor knock — you\'ll be back within a couple of weeks.'
  } else if (r < 0.93) {
    severity = 'moderate'; weeksOut = 3 + Math.floor(rand() * 4)
    description = 'A more serious injury. Expect several weeks on the sidelines.'
  } else if (r < 0.985) {
    severity = 'severe'; weeksOut = 8 + Math.floor(rand() * 10)
    description = 'A bad injury. This is a serious setback to your season.'
  } else {
    // Career-threatening: SEVERE, but explicitly NOT a permanent unresettable flag —
    // it's a long layoff with a real recovery path, avoiding the old softlock bug.
    severity = 'career-threatening'; weeksOut = 20 + Math.floor(rand() * 15)
    description = 'A devastating injury. Your recovery will be long, and your career may never be the same — but it isn\'t over.'
  }

  return { severity, weeksOut, description, occurredWeek: 0 }
}

// Recovery sharpness ramp: returning players aren't instantly back to peak (spec).
// Returns a stamina/sharpness cap for the first few matches back.
export function returnSharpnessCap(matchesSinceReturn: number): number {
  if (matchesSinceReturn === 0) return 65
  if (matchesSinceReturn === 1) return 78
  if (matchesSinceReturn === 2) return 90
  return 100
}

export const SEVERITY_LABEL: Record<InjurySeverity, string> = {
  none: 'Fit', knock: 'Knock', minor: 'Minor Injury', moderate: 'Moderate Injury',
  severe: 'Severe Injury', 'career-threatening': 'Serious Injury',
}
