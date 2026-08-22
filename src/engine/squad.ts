import { rand } from './rng'
// Phase 22a — Tier 1 NPCs: the player's own squad. Real names, a simplified
// attribute set (headline quality, not the full 12-attribute player model —
// that's overkill for 15 people the player doesn't directly control), and
// enough shape to (a) individually affect match outcomes and (b) be named in
// commentary. Growth/transfers/departures are Phase 22b, not this file.

export type SquadPosition = 'GK' | 'CB' | 'FB' | 'CM' | 'WNG' | 'ST'

export interface SquadPlayer {
  id: string
  name: string
  position: SquadPosition
  quality: number // 1-99, single headline number driving involvement odds
  squadRole: 'starter' | 'bench'
  seasonGoals: number
  seasonAssists: number
  careerGoals: number
  careerAssists: number
  careerAppearances: number
}

export const FIRST_NAMES = ['Jamie', 'Callum', 'Ryan', 'Marcus', 'Kai', 'Ollie', 'Ethan', 'Dexter', 'Leo', 'Noah', 'Aaron', 'Josh', 'Tyler', 'Reece', 'Finn']
export const LAST_NAMES = ['Okafor', 'Bennett', 'Sharma', 'Novak', 'Duarte', 'Fitzgerald', 'Osei', 'Mercer', 'Kowalski', 'Hendrix', 'Ashworth', 'Delgado', 'Ferreira', 'Whitlock', 'Nkemelu']

function id() { return crypto.randomUUID() }
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)] }

function generateName(taken: Set<string>): string {
  let name = ''
  let guard = 0
  do {
    name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
    guard++
  } while (taken.has(name) && guard < 50)
  taken.add(name)
  return name
}

// A believable-ish outfield shape: 1 extra GK, 4 CB/FB, 4 CM, 4 WNG/ST split,
// plus 2 bench of mixed positions — 15 teammates total alongside the player
// (16-player squad including the player, matching the locked "16-player squad" note).
const SQUAD_SHAPE: { position: SquadPosition; role: 'starter' | 'bench' }[] = [
  { position: 'GK', role: 'starter' },
  { position: 'CB', role: 'starter' }, { position: 'CB', role: 'starter' },
  { position: 'FB', role: 'starter' }, { position: 'FB', role: 'starter' },
  { position: 'CM', role: 'starter' }, { position: 'CM', role: 'starter' }, { position: 'CM', role: 'starter' },
  { position: 'WNG', role: 'starter' }, { position: 'WNG', role: 'starter' },
  { position: 'ST', role: 'starter' },
  { position: 'GK', role: 'bench' }, { position: 'CB', role: 'bench' }, { position: 'CM', role: 'bench' }, { position: 'ST', role: 'bench' },
]

export function generateSquad(teamPrestige: number): SquadPlayer[] {
  const taken = new Set<string>()
  const base = Math.min(85, Math.max(30, teamPrestige * 8 + 20))
  return SQUAD_SHAPE.map((slot) => ({
    id: id(),
    name: generateName(taken),
    position: slot.position,
    quality: Math.round(clamp(base + (rand() - 0.5) * 24, 15, 95)),
    squadRole: slot.role,
    seasonGoals: 0,
    seasonAssists: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerAppearances: 0,
  }))
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// Weighted pick of who gets credited with a teammate goal/assist — attacking
// positions (ST, WNG) are far more likely to score than a CB, quality breaks
// ties within a position group. This is what makes "individually affect match
// sim" real rather than cosmetic: the SAME auto-resolved chance now has a name
// and a quality-weighted chance of being THIS striker vs THAT one.
const POSITION_ATTACK_WEIGHT: Record<SquadPosition, number> = {
  GK: 0.01, CB: 0.08, FB: 0.18, CM: 0.35, WNG: 0.55, ST: 1.0,
}

export function pickGoalscorer(squad: SquadPlayer[]): SquadPlayer | null {
  const starters = squad.filter((p) => p.squadRole === 'starter' && p.position !== 'GK')
  if (starters.length === 0) return null
  const weights = starters.map((p) => POSITION_ATTACK_WEIGHT[p.position] * (0.4 + p.quality / 100))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rand() * total
  for (let i = 0; i < starters.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return starters[i]
  }
  return starters[starters.length - 1]
}

// Assist goes to someone OTHER than the scorer, weighted toward creative
// positions (WNG/CM) rather than pure finishers.
const POSITION_CREATE_WEIGHT: Record<SquadPosition, number> = {
  GK: 0.02, CB: 0.1, FB: 0.3, CM: 0.7, WNG: 1.0, ST: 0.4,
}

export function pickAssister(squad: SquadPlayer[], scorerId: string): SquadPlayer | null {
  const candidates = squad.filter((p) => p.squadRole === 'starter' && p.id !== scorerId && p.position !== 'GK')
  if (candidates.length === 0 || rand() < 0.25) return null // ~25% of goals are unassisted
  const weights = candidates.map((p) => POSITION_CREATE_WEIGHT[p.position] * (0.4 + p.quality / 100))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rand() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

export function applyTeammateGoal(squad: SquadPlayer[], scorerId: string, assisterId: string | null): SquadPlayer[] {
  return squad.map((p) => {
    if (p.id === scorerId) return { ...p, seasonGoals: p.seasonGoals + 1, careerGoals: p.careerGoals + 1 }
    if (p.id === assisterId) return { ...p, seasonAssists: p.seasonAssists + 1, careerAssists: p.careerAssists + 1 }
    return p
  })
}
