// Locked spec: 12 attributes total (4 technical, 4 physical, 4 mental), 1-20 scale.
// GK swaps in a separate 4-attribute set instead of the outfield 12.

export type TechnicalAttribute = 'passing' | 'shooting' | 'dribbling' | 'tackling'
export type PhysicalAttribute = 'pace' | 'strength' | 'stamina' | 'agility'
export type MentalAttribute = 'vision' | 'composure' | 'positioning' | 'concentration'

export type OutfieldAttribute = TechnicalAttribute | PhysicalAttribute | MentalAttribute

export type GoalkeeperAttribute = 'reflexes' | 'handling' | 'gkPositioning' | 'distribution'

export const OUTFIELD_ATTRIBUTES: OutfieldAttribute[] = [
  'passing', 'shooting', 'dribbling', 'tackling',
  'pace', 'strength', 'stamina', 'agility',
  'vision', 'composure', 'positioning', 'concentration',
]

export const GOALKEEPER_ATTRIBUTES: GoalkeeperAttribute[] = [
  'reflexes', 'handling', 'gkPositioning', 'distribution',
]

// 1-20 scale per spec. Current Ability is visible-ish via derived grades,
// never shown as a raw number to the player (per locked "hide the CA" rule).
export type AttributeValue = number // 1-20

export interface OutfieldAttributes {
  kind: 'outfield'
  values: Record<OutfieldAttribute, AttributeValue>
}

export interface GoalkeeperAttributes {
  kind: 'goalkeeper'
  values: Record<GoalkeeperAttribute, AttributeValue>
}

export type PlayerAttributes = OutfieldAttributes | GoalkeeperAttributes

export type Position =
  | 'GK'
  | 'CB' | 'FB'
  | 'CM' | 'WM'
  | 'WG' | 'ST'

export function isGoalkeeperPosition(position: Position): boolean {
  return position === 'GK'
}
