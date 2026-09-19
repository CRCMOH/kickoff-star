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

function resolveShot(xg: number, goalChance: number, rng: RandomSource): { goal: boolean; onTarget: boolean } {
  const goal = rng() < goalChance
  if (goal) return { goal: true, onTarget: true }
  const onTargetChance = clamp(0.30 + xg * 0.55, 0.28, 0.68)
  return { goal: false, onTarget: rng() < onTargetChance }
}

/**
 * V3.2 statistical match simulator. The pre-match environment defines the
 * expected scoring shape; the event layer then creates enough legitimate shot
 * volume to realise that shape. Budgets are intentionally larger than raw xG
 * because possession selection means each side only receives part of the 90
 * minute event clock. Runaway scores are still suppressed by expectedGoalChance.
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

  // Each side only owns its possession share of the event clock. Scaling the
  // budget compensates for that without inflating the probability of any one
  // shot. This targets ordinary youth-football shot volumes rather than a
  // sequence of independent goal rolls.
  let homeBudget = env.homeXg * 2.15
  let awayBudget = env.awayXg * 2.15

  for (let minute = 1; minute <= 90; minute++) {
    const homeShare = clamp(env.homePossession + (homeGoals < awayGoals ? 0.025 : homeGoals - awayGoals >= 3 ? -0.035 : 0), 0.30, 0.70)
    const attackingHome = rng() < homeShare
    const budget = attackingHome ? homeBudget : awayBudget
    if (budget <= 0.01) continue

    // Roughly 9-14 attempts per team in ordinary matches, with stronger or
    // trailing sides able to generate somewhat more pressure.
    const shotRate = clamp(0.17 + budget * 0.008, 0.16, 0.23)
    if (rng() >= shotRate) continue

    const rawXg = Math.min(shotQuality(rng), budget)
    if (rawXg <= 0) continue

    if (attackingHome) {
      homeShots++
      realisedHomeXg += rawXg
      homeBudget = Math.max(0, homeBudget - rawXg)
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
      awayBudget = Math.max(0, awayBudget - rawXg)
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
