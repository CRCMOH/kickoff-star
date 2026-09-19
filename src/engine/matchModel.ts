import type { Team } from './teams'

export interface TeamMatchProfile {
  overall: number
  attack: number
  midfield: number
  defense: number
  goalkeeper: number
  effectiveStrength: number
}

export interface MatchEnvironment {
  home: TeamMatchProfile
  away: TeamMatchProfile
  homePossession: number
  awayPossession: number
  homeXg: number
  awayXg: number
}

export interface MatchContextModifiers {
  homeAdvantage?: number
  homeFatigue?: number
  awayFatigue?: number
  homeMorale?: number
  awayMorale?: number
  homeForm?: number
  awayForm?: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function inferredGoalkeeper(team: Team): number {
  // Teams currently expose ATT/MID/DEF only. Until explicit GK ratings are
  // persisted, derive a conservative keeper rating from the defensive unit.
  // Keeping this isolated makes the later schema migration straightforward.
  return clamp(team.ratings.defense * 0.82 + team.ratings.midfield * 0.18, 1, 99)
}

export function matchProfile(team: Team): TeamMatchProfile {
  const goalkeeper = inferredGoalkeeper(team)
  const overall = team.ratings.attack * 0.30 + team.ratings.midfield * 0.30 + team.ratings.defense * 0.25 + goalkeeper * 0.15
  return {
    overall,
    attack: team.ratings.attack,
    midfield: team.ratings.midfield,
    defense: team.ratings.defense,
    goalkeeper,
    effectiveStrength: overall,
  }
}

/**
 * V3.2 principle: context can tilt a match, never transform a team into a
 * completely different level. All non-rating effects are deliberately small.
 */
function contextualStrength(profile: TeamMatchProfile, fatigue = 0, morale = 0, form = 0): number {
  const context = clamp(morale, -10, 10) * 0.12 + clamp(form, -10, 10) * 0.10 - clamp(fatigue, 0, 100) * 0.018
  return clamp(profile.overall + context, 1, 99)
}

/**
 * Build the statistical shape of a match before individual events are played.
 * A small OVR gap creates a small xG advantage, not a licence for 9-1 scores.
 */
export function createMatchEnvironment(homeTeam: Team, awayTeam: Team, mods: MatchContextModifiers = {}): MatchEnvironment {
  const home = matchProfile(homeTeam)
  const away = matchProfile(awayTeam)
  home.effectiveStrength = contextualStrength(home, mods.homeFatigue, mods.homeMorale, mods.homeForm) + clamp(mods.homeAdvantage ?? 1.5, 0, 3)
  away.effectiveStrength = contextualStrength(away, mods.awayFatigue, mods.awayMorale, mods.awayForm)

  const midfieldGap = (home.midfield - away.midfield) / 100
  const strengthGap = (home.effectiveStrength - away.effectiveStrength) / 100
  const homePossession = clamp(0.50 + midfieldGap * 0.22 + strengthGap * 0.10, 0.34, 0.66)
  const awayPossession = 1 - homePossession

  // Roughly 2.6-2.9 combined baseline xG in an even match. Unit matchups and
  // strength shift that expectation smoothly; neither side receives a giant
  // multiplier merely for being a few rating points stronger.
  const homeAttackEdge = (home.attack - away.defense) / 100
  const awayAttackEdge = (away.attack - home.defense) / 100
  const homeKeeperEdge = (home.goalkeeper - away.attack) / 100
  const awayKeeperEdge = (away.goalkeeper - home.attack) / 100

  const homeXg = clamp(1.42 + strengthGap * 1.45 + homeAttackEdge * 0.95 - awayKeeperEdge * 0.35 + (homePossession - 0.5) * 1.1, 0.25, 3.8)
  const awayXg = clamp(1.28 - strengthGap * 1.45 + awayAttackEdge * 0.95 - homeKeeperEdge * 0.35 + (awayPossession - 0.5) * 1.1, 0.20, 3.6)

  return { home, away, homePossession, awayPossession, homeXg, awayXg }
}

/**
 * As a team scores beyond the amount of danger it has created, another goal
 * becomes progressively less likely. This is not a score cap: freak results
 * remain possible, but the sixth goal is not rolled as cheaply as the first.
 */
export function scoringDiminisher(goals: number, expectedGoals: number): number {
  const excess = Math.max(0, goals - expectedGoals)
  return clamp(Math.pow(0.72, excess), 0.10, 1)
}

export function scoreStateTempo(ownGoals: number, opponentGoals: number, minute: number): number {
  const lead = ownGoals - opponentGoals
  if (lead >= 4) return minute >= 60 ? 0.68 : 0.76
  if (lead === 3) return minute >= 65 ? 0.78 : 0.86
  if (lead === 2 && minute >= 70) return 0.90
  if (lead <= -2 && minute >= 55) return 1.08
  if (lead === -1 && minute >= 70) return 1.06
  return 1
}

export function expectedGoalChance(eventXg: number, goalsAlready: number, matchXg: number, ownGoals: number, opponentGoals: number, minute: number): number {
  return clamp(eventXg * scoringDiminisher(goalsAlready, matchXg) * scoreStateTempo(ownGoals, opponentGoals, minute), 0.005, 0.82)
}
