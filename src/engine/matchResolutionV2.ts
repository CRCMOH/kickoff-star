import type { Team } from './teams'
import type { ChanceTier } from './match'
import { createMatchEnvironment, expectedGoalChance } from './matchModel'

export interface ScoreSnapshot {
  homeScore: number
  awayScore: number
  minute: number
  playerIsHome: boolean
}

export interface ResolvedDriveShot {
  goal: boolean
  onTarget: boolean
  xg: number
  goalChance: number
  scoringHome: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function chanceXg(tier: ChanceTier): number {
  return tier === 'clear' ? 0.42 : tier === 'good' ? 0.22 : 0.09
}

/**
 * Drop-in V3.2 resolver for the existing drive engine. It deliberately uses
 * the real home/away teams and current score, so teammate/opponent chances no
 * longer have independent 60/40/22 percent goal rolls.
 *
 * IMPORTANT: xG is unconditional goal probability. A goal is therefore rolled
 * first and is automatically on target. Only a non-goal receives the separate
 * on-target/save roll. This mirrors the green 100k simulator and liveMatchV2.
 */
export function resolveLegacyDriveShot(
  homeTeam: Team,
  awayTeam: Team,
  snapshot: ScoreSnapshot,
  byPlayerTeam: boolean,
  tier: ChanceTier,
  goalRoll: number,
  targetRoll: number,
): ResolvedDriveShot {
  const env = createMatchEnvironment(homeTeam, awayTeam)
  const scoringHome = byPlayerTeam ? snapshot.playerIsHome : !snapshot.playerIsHome
  const ownGoals = scoringHome ? snapshot.homeScore : snapshot.awayScore
  const oppGoals = scoringHome ? snapshot.awayScore : snapshot.homeScore
  const matchXg = scoringHome ? env.homeXg : env.awayXg
  const xg = chanceXg(tier)
  const goalChance = expectedGoalChance(xg, ownGoals, matchXg, ownGoals, oppGoals, snapshot.minute)
  const goal = goalRoll < goalChance

  const nonGoalOnTargetChance = clamp(0.31 + xg * 0.58, 0.28, 0.70)
  const onTarget = goal || targetRoll < nonGoalOnTargetChance

  return { goal, onTarget, xg, goalChance, scoringHome }
}

/** Convenience adapter for match.ts so both teammate and opponent auto chances
 * pass exactly the same score snapshot into the V3.2 resolver. */
export function scoreSnapshot(homeScore: number, awayScore: number, minute: number, playerIsHome: boolean): ScoreSnapshot {
  return { homeScore, awayScore, minute, playerIsHome }
}
