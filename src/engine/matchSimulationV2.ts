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
  const r = rng()
  if (r < 0.58) return 0.035 + rng() * 0.075
  if (r < 0.88) return 0.11 + rng() * 0.12
  if (r < 0.98) return 0.24 + rng() * 0.18
  return 0.43 + rng() * 0.22
}

/**
 * xG is the unconditional probability that a shot becomes a goal. We therefore
 * roll the goal first and guarantee that every goal is on target. Non-goal
 * shots receive a separate save/on-target roll. This avoids multiplying xG by
 * the on-target probability a second time.
 */
function resolveShot(xg: number, goalChance: number, rng: RandomSource): { goal: boolean; onTarget: boolean } {
  const goal = rng() < goalChance
  if (goal) return { goal: true, onTarget: true }
  const onTargetChance = clamp(0.30 + xg * 0.55, 0.28, 0.68)
  return { goal: false, onTarget: rng() < onTargetChance }
}

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
  let homeBudget = env.homeXg
  let awayBudget = env.awayXg

  for (let minute = 1; minute <= 90; minute++) {
    const homeShare = clamp(env.homePossession + (homeGoals < awayGoals ? 0.025 : homeGoals - awayGoals >= 3 ? -0.035 : 0), 0.30, 0.70)
    const attackingHome = rng() < homeShare
    const budget = attackingHome ? homeBudget : awayBudget
    if (budget <= 0.01) continue

    const shotRate = clamp(0.075 + budget * 0.012, 0.07, 0.15)
    if (rng() >= shotRate) continue

    const rawXg = Math.min(shotQuality(rng), budget)
    if (rawXg <= 0) continue

    if (attackingHome) {
      homeShots++
      realisedHomeXg += rawXg
      homeBudget = Math.max(0, homeBudget - rawXg * 0.72)
      const chance = expectedGoalChance(rawXg, homeGoals, env.homeXg, homeGoals, awayGoals, minute)
      const shot = resolveShot(rawXg, chance, rng)
      if (shot.onTarget) homeShotsOnTarget++
      if (shot.goal) {
        homeGoals++
        goals.push({ minute, side: 'home', eventXg: rawXg })
      }
    } else {
      awayShots++
      realisedAwayXg += rawXg
      awayBudget = Math.max(0, awayBudget - rawXg * 0.72)
      const chance = expectedGoalChance(rawXg, awayGoals, env.awayXg, awayGoals, homeGoals, minute)
      const shot = resolveShot(rawXg, chance, rng)
      if (shot.onTarget) awayShotsOnTarget++
      if (shot.goal) {
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
