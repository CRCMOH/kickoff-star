import type { Position } from '../types/attributes'

export interface PlayerMatchStats {
  goals: number
  assists: number
  shots: number
  shotsOnTarget: number
  keyPasses: number
  tacklesWon: number
  interceptions: number
  headersWon: number
  saves: number
  shotsFaced: number
  goalsConceded: number
  penaltySaves: number
  highDifficultySaves: number
  distributionCompleted: number
  distributionAttempted: number
}

export function emptyMatchStats(): PlayerMatchStats {
  return {
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    keyPasses: 0,
    tacklesWon: 0,
    interceptions: 0,
    headersWon: 0,
    saves: 0,
    shotsFaced: 0,
    goalsConceded: 0,
    penaltySaves: 0,
    highDifficultySaves: 0,
    distributionCompleted: 0,
    distributionAttempted: 0,
  }
}

export function savePercentage(stats: PlayerMatchStats): number | null {
  if (stats.shotsFaced <= 0) return null
  return Math.round((stats.saves / stats.shotsFaced) * 100)
}

export function cleanSheet(stats: PlayerMatchStats, position: Position): boolean {
  return position === 'GK' && stats.goalsConceded === 0
}

export function distributionPercentage(stats: PlayerMatchStats): number | null {
  if (stats.distributionAttempted <= 0) return null
  return Math.round((stats.distributionCompleted / stats.distributionAttempted) * 100)
}

/**
 * Rating context is position-aware. The result alone never decides a rating,
 * but a goalkeeper/defender cannot be detached from a defensive collapse.
 */
export function defensiveContextAdjustment(position: Position, goalsConceded: number, stats: PlayerMatchStats): number {
  if (position === 'GK') {
    const savePct = savePercentage(stats)
    let adjustment = 0
    if (goalsConceded >= 3) adjustment -= Math.min(1.35, (goalsConceded - 2) * 0.22)
    if (savePct !== null && stats.shotsFaced >= 4) {
      if (savePct >= 85) adjustment += 0.45
      else if (savePct >= 75) adjustment += 0.20
      else if (savePct < 55) adjustment -= 0.35
    }
    adjustment += Math.min(0.6, stats.highDifficultySaves * 0.12)
    adjustment += Math.min(0.5, stats.penaltySaves * 0.5)
    return adjustment
  }

  if (position === 'CB' || position === 'FB') {
    if (goalsConceded <= 1) return 0.12
    if (goalsConceded >= 5) return -Math.min(0.9, (goalsConceded - 3) * 0.18)
  }
  return 0
}
