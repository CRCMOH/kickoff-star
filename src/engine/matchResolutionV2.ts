import type { Team } from './teams'
import type { ChanceTier } from './match'
import { createMatchEnvironment, expectedGoalChance } from './matchModel'

export interface ScoreSnapshot {
  homeScore: number
  awayScore: number
  minute: number
  playerIsHome: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function chanceXg(tier: ChanceTier): number {
  return tier === 'clear' ? 0.42 : tier === 'good' ? 0.22 : 0.09
}

/**
 * Drop-in V3.2 resolver for the existing drive engine. It deliberately uses
 * the real home/away teams and current score, so teammate/opponent chances no
 * longer have independent 60/40/22 percent goal rolls.
 */
export function resolveLegacyDriveShot(
  homeTeam: Team,
  awayTeam: Team,
  snapshot: ScoreSnapshot,
  byPlayerTeam: boolean,
  tier: ChanceTier,
  goalRoll: number,
  targetRoll: number,
): { goal: boolean; onTarget: boolean; xg: number; goalChance: number } {
  const env = createMatchEnvironment(homeTeam, awayTeam)
  const scoringHome = byPlayerTeam ? snapshot.playerIsHome : !snapshot.playerIsHome
  const ownGoals = scoringHome ? snapshot.homeScore : snapshot.awayScore
  const oppGoals = scoringHome ? snapshot.awayScore : snapshot.homeScore
  const matchXg = scoringHome ? env.homeXg : env.awayXg
  const xg = chanceXg(tier)

  const onTargetChance = clamp(0.31 + xg * 0.58, 0.28, 0.70)
  const onTarget = targetRoll < onTargetChance
  const goalChance = expectedGoalChance(xg, ownGoals, matchXg, ownGoals, oppGoals, snapshot.minute)

  return { goal: onTarget && goalRoll < goalChance, onTarget, xg, goalChance }
}
