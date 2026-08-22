import type { OutfieldAttribute, GoalkeeperAttribute, Position } from './attributes'

export type TrainingSessionType =
  | 'finishing'
  | 'passing-vision'
  | 'dribbling'
  | 'defending-physical'
  | 'fitness'
  | 'tactical'
  // GK-specific (locked spec Section 3)
  | 'gk-shot-stopping'
  | 'gk-positioning'
  | 'gk-distribution'
  | 'gk-reactions'

type AnyAttribute = OutfieldAttribute | GoalkeeperAttribute

// Session type -> attributes it can improve (locked spec Section 1 mapping)
export const SESSION_ATTRIBUTES: Record<TrainingSessionType, AnyAttribute[]> = {
  finishing: ['shooting', 'composure'],
  'passing-vision': ['passing', 'vision'],
  dribbling: ['dribbling', 'agility'],
  'defending-physical': ['tackling', 'strength', 'positioning'],
  fitness: ['pace', 'stamina'],
  tactical: ['positioning', 'concentration'],
  'gk-shot-stopping': ['reflexes', 'handling'],
  'gk-positioning': ['gkPositioning', 'handling'],
  'gk-distribution': ['distribution'],
  'gk-reactions': ['reflexes', 'handling'],
}

export const SESSION_LABEL: Record<TrainingSessionType, string> = {
  finishing: 'Finishing',
  'passing-vision': 'Passing & Vision',
  dribbling: 'Dribbling',
  'defending-physical': 'Defending & Physical',
  fitness: 'Fitness',
  tactical: 'Tactical',
  'gk-shot-stopping': 'Shot-Stopping',
  'gk-positioning': 'Positioning & Command',
  'gk-distribution': 'Distribution',
  'gk-reactions': 'Reactions',
}

// Position -> weighted session pool (locked spec Section 3). Higher weight = more
// likely to be coach-assigned. Off-pool sessions still allowed but lower-yield.
const OUTFIELD_POOLS: Record<Exclude<Position, 'GK'>, Partial<Record<TrainingSessionType, number>>> = {
  ST: { finishing: 4, dribbling: 2, fitness: 2, 'passing-vision': 1, tactical: 1 },
  WG: { dribbling: 4, 'passing-vision': 2, fitness: 2, finishing: 1, tactical: 1 },
  WM: { 'passing-vision': 3, dribbling: 2, fitness: 2, tactical: 2, 'defending-physical': 1 },
  CM: { 'passing-vision': 4, tactical: 2, 'defending-physical': 2, fitness: 1, finishing: 1 },
  CB: { 'defending-physical': 4, tactical: 2, fitness: 1, 'passing-vision': 1 },
  FB: { 'defending-physical': 3, dribbling: 2, fitness: 3, 'passing-vision': 1 },
}

const GK_POOL: Partial<Record<TrainingSessionType, number>> = {
  'gk-shot-stopping': 4, 'gk-positioning': 3, 'gk-reactions': 2, 'gk-distribution': 1,
}

export function sessionPoolFor(position: Position): Partial<Record<TrainingSessionType, number>> {
  if (position === 'GK') return GK_POOL
  return OUTFIELD_POOLS[position]
}

// Letter grades (locked spec Section 1)
export type TrainingGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

export const GRADE_ORDER: TrainingGrade[] = ['F', 'D', 'C', 'B', 'A', 'A+']

// Grade -> growth multiplier feeding potential-weighted attribute growth
export const GRADE_GROWTH: Record<TrainingGrade, number> = {
  'A+': 1.0, A: 0.75, B: 0.5, C: 0.3, D: 0.12, F: 0.0,
}
