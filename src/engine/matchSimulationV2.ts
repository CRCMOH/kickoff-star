import type { Team } from './teams'
import { createMatchEnvironment, expectedGoalChance, type MatchContextModifiers } from './matchModel'

export interface SimulatedGoal {
  minute: number
  side: 'home' | 'away'
  eventXg: number
}

export interface SimulatedMatch {
  homeGoals: number
  awayGoals: number
  homeXg: number
  awayXg: number
  homeShots: number
  awayShots: number
  homeShotsOnTarget: number
  awayShotsOnTarget: number
  homePossession: number
  awayPossession: number
  goals: SimulatedGoal[]
}

export type RandomSource = () => number

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function shotQuality(rng: RandomSource): number {
  // Most football shots are low-value; genuinely clear chances are uncommon.
  const r = rng()
  if (r < 0.58) return 0.035 + rng() * 0.075
  if (r < 0.88) return 0.11 + rng() * 0.12
  if (r < 0.98) return 0.24 + rng() * 0.18
  return 0.43 + rng() * 0.22
}

/**
 * Event simulator used by V3.2. It produces one coherent match record: score,
 * xG, shots and possession all come from the same events. Player moments can
 * later intercept these events instead of living in a parallel universe.
 */
export function simulateMatchV2(home: Team, away: Team, rng: RandomSource = Math.random, modifiers: MatchContextModifiers = {}): SimulatedMatch {
  const env = createMatchEnvironment(home, away, modifiers)
  let homeGoals = 0
  let awayGoals = 0
  let homeShots = 0
  let awayShots = 0
  let homeShotsOnTarget = 0
  let awayShotsOnTarget = 0
  let realisedHomeXg = 0
  let realisedAwayXg = 0
  const goals: SimulatedGoal[] = []

  // Convert pre-match xG into attacking-event pressure. Each minute has a
  // small chance to produce a shot; the budget prevents independent endless
  // goal rolls while still allowing match-to-match variance.
  let homeBudget = env.homeXg
  let awayBudget = env.awayXg

  for (let minute = 1; minute <= 90; minute++) {
    const homeShare = clamp(env.homePossession + (homeGoals < awayGoals ? 0.025 : homeGoals - awayGoals >= 3 ? -0.035 : 0), 0.30, 0.70)
    const attackingHome = rng() < homeShare
    const budget = attackingHome ? homeBudget : awayBudget
    if (budget <= 0.01) continue

    // ~8-15 shots for ordinary youth matches depending on xG and match state.
    const shotRate = clamp(0.075 + budget * 0.012, 0.07, 0.15)
    if (rng() >= shotRate) continue

    const rawXg = Math.min(shotQuality(rng), budget)
    if (rawXg <= 0) continue

    if (attackingHome) {
      homeShots++
      realisedHomeXg += rawXg
      homeBudget = Math.max(0, homeBudget - rawXg * 0.72)
      const onTarget = rng() < clamp(0.30 + rawXg * 0.55, 0.28, 0.68)
      if (!onTarget) continue
      homeShotsOnTarget++
      const chance = expectedGoalChance(rawXg, homeGoals, env.homeXg, homeGoals, awayGoals, minute)
      if (rng() < chance) {
        homeGoals++
        goals.push({ minute, side: 'home', eventXg: rawXg })
      }
    } else {
      awayShots++
      realisedAwayXg += rawXg
      awayBudget = Math.max(0, awayBudget - rawXg * 0.72)
      const onTarget = rng() < clamp(0.30 + rawXg * 0.55, 0.28, 0.68)
      if (!onTarget) continue
      awayShotsOnTarget++
      const chance = expectedGoalChance(rawXg, awayGoals, env.awayXg, awayGoals, homeGoals, minute)
      if (rng() < chance) {
        awayGoals++
        goals.push({ minute, side: 'away', eventXg: rawXg })
      }
    }
  }

  return {
    homeGoals,
    awayGoals,
    homeXg: Number(realisedHomeXg.toFixed(2)),
    awayXg: Number(realisedAwayXg.toFixed(2)),
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homePossession: Number((env.homePossession * 100).toFixed(1)),
    awayPossession: Number((env.awayPossession * 100).toFixed(1)),
    goals,
  }
}
