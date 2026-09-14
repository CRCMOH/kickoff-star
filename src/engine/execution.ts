import { rand } from './rng'
import { effectiveValues } from './economy'
import type { Player } from '../types/player'

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export type ExecutionGrade = 'perfect' | 'good' | 'ok' | 'miss'

export interface ExecutionSpec {
  perfect: number
  good: number
  ok: number
  sweepMs: number
}

export const GRADE_LABEL: Record<ExecutionGrade, string> = {
  perfect: 'clean strike',
  good: 'good contact',
  ok: 'scuffed',
  miss: 'mistimed',
}

export const GRADE_COLOR: Record<ExecutionGrade, string> = {
  perfect: 'text-green-500',
  good: 'text-ks-gold',
  ok: 'text-orange-500',
  miss: 'text-red-500',
}

export function qualityOf(grade: ExecutionGrade): number {
  switch (grade) {
    case 'perfect': return 1.0
    case 'good': return 0.72
    case 'ok': return 0.34
    case 'miss': return 0.0
  }
}

function executionSkill(player: Player): number {
  const v = effectiveValues(player)
  if (player.attributes.kind === 'goalkeeper') {
    return ((v.reflexes ?? 8) + (v.gkPositioning ?? 8)) / 2
  }
  return ((v.composure ?? 8) + (v.concentration ?? 8)) / 2
}

export function executionSpecFor(player: Player, baseCeiling: number, matchStamina: number): ExecutionSpec {
  const skill = executionSkill(player)
  const skillMod = 0.78 + (skill / 20) * 0.44
  const fatigueMod = 0.78 + (clamp(matchStamina, 0, 100) / 100) * 0.22
  const riskMod = 0.72 + clamp(baseCeiling, 0, 1) * 0.5
  const mod = skillMod * fatigueMod * riskMod

  return {
    perfect: clamp(0.075 * mod, 0.040, 0.105),
    good: clamp(0.165 * mod, 0.100, 0.215),
    ok: clamp(0.300 * mod, 0.200, 0.360),
    sweepMs: Math.round(clamp(1500 * (0.75 + riskMod * 0.35) * (0.85 + fatigueMod * 0.2), 850, 1900)),
  }
}

export function gradeFromStop(position: number, target: number, spec: ExecutionSpec): ExecutionGrade {
  const offset = Math.abs(position - target)
  if (offset <= spec.perfect) return 'perfect'
  if (offset <= spec.good) return 'good'
  if (offset <= spec.ok) return 'ok'
  return 'miss'
}

// V3.1 player-feedback pass: 14% was mathematically safe but too subtle in
// actual play. A player could make the right read, nail the mini-game and still
// feel as if the input had almost no effect. 18% keeps decision quality ahead
// of execution while making clean manual play materially improve the odds.
export const EXECUTION_SWING = 0.18

export function adjustChance(baseChance: number, grade: ExecutionGrade): number {
  const q = qualityOf(grade)
  const factor = (1 - EXECUTION_SWING) + q * (EXECUTION_SWING * 2)
  return clamp(baseChance * factor, 0.02, 0.97)
}

export function ratingNudgeFor(grade: ExecutionGrade): number {
  switch (grade) {
    case 'perfect': return 0.30
    case 'good': return 0.14
    case 'ok': return 0
    case 'miss': return -0.18
  }
}

export function autoResolveGrade(player: Player, matchStamina: number): ExecutionGrade {
  const skill = executionSkill(player)
  const fatigue = clamp(matchStamina, 0, 100) / 100
  const goodChance = clamp(0.35 + (skill / 20) * 0.3 * fatigue, 0.25, 0.7)
  const r = rand()
  if (r < goodChance) return 'good'
  if (r < goodChance + 0.45) return 'ok'
  return 'miss'
}
