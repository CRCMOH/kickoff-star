import type { Player } from '../types/player'
import { effectiveValues } from './economy'

// Derive a live 1-20 Current Ability from actual attributes, weighted by position.
// This recomputes every render so growth is always reflected (fixes frozen-CA bug).

const OUTFIELD_WEIGHTS: Record<string, Record<string, number>> = {
  ST: { shooting: 3, composure: 2, dribbling: 2, pace: 2, agility: 1, positioning: 1, passing: 1, strength: 1, stamina: 1, vision: 1, tackling: 0.3, concentration: 1 },
  WG: { dribbling: 3, pace: 3, agility: 2, shooting: 1.5, passing: 1.5, vision: 1, composure: 1, stamina: 1, positioning: 1, strength: 0.5, tackling: 0.3, concentration: 1 },
  WM: { passing: 2.5, dribbling: 2, vision: 2, stamina: 2, pace: 1.5, positioning: 1.5, tackling: 1, composure: 1, agility: 1, shooting: 1, strength: 1, concentration: 1 },
  CM: { passing: 3, vision: 2.5, positioning: 2, composure: 2, tackling: 1.5, stamina: 1.5, concentration: 1.5, dribbling: 1, strength: 1, shooting: 1, pace: 1, agility: 1 },
  CB: { tackling: 3, positioning: 3, strength: 2.5, concentration: 2, composure: 1.5, pace: 1.5, passing: 1, stamina: 1, agility: 1, vision: 0.5, shooting: 0.3, dribbling: 0.3 },
  FB: { tackling: 2, positioning: 2, pace: 2.5, stamina: 2.5, dribbling: 1.5, passing: 1.5, strength: 1.5, agility: 1.5, composure: 1, vision: 1, concentration: 1, shooting: 0.5 },
}

const GK_WEIGHTS: Record<string, number> = { reflexes: 3, handling: 2.5, gkPositioning: 2.5, distribution: 1.5 }

export function computeCurrentAbility(player: Player): number {
  // P29: equipment boosts apply through effectiveValues (capped at potential)
  const values = effectiveValues(player)
  const weights = player.position === 'GK' ? GK_WEIGHTS : OUTFIELD_WEIGHTS[player.position]
  if (!weights) return 8
  let sum = 0, wTotal = 0
  for (const [attr, w] of Object.entries(weights)) {
    sum += (values[attr] ?? 0) * w
    wTotal += w
  }
  return wTotal > 0 ? Math.round((sum / wTotal) * 10) / 10 : 8
}

// Convert 1-20 to a 1-99 "OVR" display for the ring, since players expect that scale.
// P50 — widened the floor. Was 30+(ca/20)*69, floor ~33, which meant a
// literal 20s starting OVR was mathematically unreachable regardless of how
// poor a trial went. Checked every consumer first: only display screens
// (PlayerTab/HomeTab/CareerEnd) and this file read it — scouting and
// contract logic all read the raw 1-20 attributes directly, so recalibrating
// the display mapping is safe. Now: ca=1 -> ~24, ca=20 -> 99.
export function toOvr(ca: number): number {
  return Math.round(20 + (ca / 20) * 79) // maps 1-20 -> ~24-99
}
