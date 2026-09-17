import type { Team } from './teams'
import type { Position } from '../types/attributes'
import { createMatchEnvironment, expectedGoalChance, type MatchEnvironment } from './matchModel'
import { defensiveContextAdjustment, type PlayerMatchStats } from './matchStats'

export interface LiveMatchModel {
  environment: MatchEnvironment
  homeGoals: number
  awayGoals: number
  homeRealisedXg: number
  awayRealisedXg: number
  homeShots: number
  awayShots: number
  homeShotsOnTarget: number
  awayShotsOnTarget: number
}

export type LiveSide = 'home' | 'away'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function initLiveMatchModel(home: Team, away: Team): LiveMatchModel {
  return {
    environment: createMatchEnvironment(home, away),
    homeGoals: 0,
    awayGoals: 0,
    homeRealisedXg: 0,
    awayRealisedXg: 0,
    homeShots: 0,
    awayShots: 0,
    homeShotsOnTarget: 0,
    awayShotsOnTarget: 0,
  }
}

export function eventXgForTier(tier: 'half' | 'good' | 'clear'): number {
  return tier === 'clear' ? 0.42 : tier === 'good' ? 0.22 : 0.09
}

/** Resolve a non-player shot through the same xG environment as the match. */
export function resolveLiveShot(model: LiveMatchModel, side: LiveSide, tier: 'half' | 'good' | 'clear', minute: number, random: number, onTargetRandom: number): { model: LiveMatchModel; goal: boolean; onTarget: boolean; xg: number } {
  const xg = eventXgForTier(tier)
  const home = side === 'home'
  const ownGoals = home ? model.homeGoals : model.awayGoals
  const oppGoals = home ? model.awayGoals : model.homeGoals
  const matchXg = home ? model.environment.homeXg : model.environment.awayXg
  const chance = expectedGoalChance(xg, ownGoals, matchXg, ownGoals, oppGoals, minute)

  // xG is unconditional goal probability. Goals are automatically on target;
  // only non-goals use the separate on-target/save roll.
  const goal = random < chance
  const nonGoalOnTargetChance = clamp(0.31 + xg * 0.58, 0.28, 0.70)
  const onTarget = goal || onTargetRandom < nonGoalOnTargetChance

  let next: LiveMatchModel = {
    ...model,
    homeShots: model.homeShots + (home ? 1 : 0),
    awayShots: model.awayShots + (home ? 0 : 1),
    homeRealisedXg: model.homeRealisedXg + (home ? xg : 0),
    awayRealisedXg: model.awayRealisedXg + (home ? 0 : xg),
    homeShotsOnTarget: model.homeShotsOnTarget + (home && onTarget ? 1 : 0),
    awayShotsOnTarget: model.awayShotsOnTarget + (!home && onTarget ? 1 : 0),
  }

  if (goal) {
    next = {
      ...next,
      homeGoals: next.homeGoals + (home ? 1 : 0),
      awayGoals: next.awayGoals + (home ? 0 : 1),
    }
  }
  return { model: next, goal, onTarget, xg }
}

/**
 * V3.2 final rating guard. A 9.0 means an exceptional match, not merely a
 * sequence of successful UI moments. Contribution raises the attainable
 * ceiling while defensive context can punish genuine collapses.
 */
export function finalizePlayerRating(rawRating: number, position: Position, stats: PlayerMatchStats, teamGoals: number, goalsConceded: number): number {
  let rating = rawRating + defensiveContextAdjustment(position, goalsConceded, stats)
  const directContributions = stats.goals + stats.assists
  const defensiveContributions = stats.tacklesWon + stats.interceptions + stats.headersWon

  let ceiling = 8.2
  if (directContributions >= 1) ceiling += 0.35
  if (directContributions >= 2) ceiling += 0.35
  if (directContributions >= 3) ceiling += 0.45
  if ((position === 'CB' || position === 'FB') && defensiveContributions >= 5) ceiling += 0.45
  if (position === 'GK') {
    if (stats.saves >= 5) ceiling += 0.30
    if (stats.saves >= 8) ceiling += 0.35
    if (stats.penaltySaves > 0) ceiling += 0.35
    if (goalsConceded === 0 && stats.shotsFaced >= 4) ceiling += 0.25
  }
  if (teamGoals === 0 && directContributions === 0 && position !== 'GK') ceiling = Math.min(ceiling, 8.35)
  if (goalsConceded >= 5 && (position === 'GK' || position === 'CB' || position === 'FB')) ceiling = Math.min(ceiling, 8.15)

  rating = Math.min(rating, ceiling)
  return Number(clamp(rating, 1, 10).toFixed(1))
}
