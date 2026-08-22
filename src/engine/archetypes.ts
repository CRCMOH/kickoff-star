// Phase 27 — player archetypes. One characteristic picked at onboarding that
// shapes what KIND of player you are: a starting-attribute tilt (boosted
// attributes start higher, the trade-off starts lower) plus a permanent
// passive that nudges an existing system. Passives deliberately hook into
// mechanics that already exist and are already balanced — they shift WITHIN
// audited ranges rather than inventing new math.
import type { Position } from '../types/attributes'

export interface Archetype {
  id: string
  label: string
  tagline: string
  /** attributes that start +2 (clamped to potential-1 as usual) */
  boosts: string[]
  /** attributes that start -1 — every gift costs something */
  tradeoffs: string[]
  /** which passive hook this archetype activates */
  passive: ArchetypePassive
  passiveText: string
  gkAlternative?: { boosts: string[]; tradeoffs: string[] }
}

export type ArchetypePassive =
  | 'clinical' // finishing-type moment chances +4%
  | 'engine' // match stamina drains 12% slower
  | 'leader' // coach trust gains +25%
  | 'maverick' // confidence swings 30% bigger both ways, risky options +3%
  | 'prodigy' // training attribute gains +10%
  | 'wall' // defensive/GK moment chances +4%

export const ARCHETYPES: Archetype[] = [
  {
    id: 'clinical', label: 'The Finisher', tagline: 'Ice in the veins where it matters',
    boosts: ['finishing', 'composure'], tradeoffs: ['strength'],
    passive: 'clinical', passiveText: 'Attacking moments: +4% success chance',
    gkAlternative: { boosts: ['reflexes', 'composure'], tradeoffs: ['distribution'] },
  },
  {
    id: 'engine', label: 'The Engine', tagline: 'Still running when everyone else is walking',
    boosts: ['stamina', 'pace'], tradeoffs: ['vision'],
    passive: 'engine', passiveText: 'Match fatigue drains 12% slower',
    gkAlternative: { boosts: ['handling', 'gkPositioning'], tradeoffs: ['reflexes'] },
  },
  {
    id: 'leader', label: 'The Captain', tagline: 'Coaches build teams around players like this',
    boosts: ['positioning', 'concentration'], tradeoffs: ['dribbling'],
    passive: 'leader', passiveText: 'Coach trust gains +25%',
    gkAlternative: { boosts: ['gkPositioning', 'handling'], tradeoffs: ['reflexes'] },
  },
  {
    id: 'maverick', label: 'The Maverick', tagline: 'Unplayable on a good day. Ask about the bad days.',
    boosts: ['dribbling', 'vision'], tradeoffs: ['concentration'],
    passive: 'maverick', passiveText: 'Risky options +3% — but confidence swings hit 30% harder both ways',
    gkAlternative: { boosts: ['distribution', 'reflexes'], tradeoffs: ['concentration'] },
  },
  {
    id: 'prodigy', label: 'The Student', tagline: 'First on the training ground, last off it',
    boosts: ['firstTouch', 'passing'], tradeoffs: ['pace'],
    passive: 'prodigy', passiveText: 'Training gains +10%',
    gkAlternative: { boosts: ['handling', 'distribution'], tradeoffs: ['reflexes'] },
  },
  {
    id: 'wall', label: 'The Wall', tagline: 'They shall not pass. Simple as that.',
    boosts: ['strength', 'positioning'], tradeoffs: ['finishing'],
    passive: 'wall', passiveText: 'Defensive moments: +4% success chance',
    gkAlternative: { boosts: ['reflexes', 'handling'], tradeoffs: ['distribution'] },
  },
]

export function getArchetype(id: string | null | undefined): Archetype | null {
  return ARCHETYPES.find((a) => a.id === id) ?? null
}

/** Attribute tilt for the chosen archetype, respecting GK's separate attribute set. */
export function archetypeAttributeDeltas(archetype: Archetype, position: Position): Record<string, number> {
  const spec = position === 'GK' && archetype.gkAlternative ? archetype.gkAlternative : archetype
  const deltas: Record<string, number> = {}
  for (const a of spec.boosts) deltas[a] = 2
  for (const a of spec.tradeoffs) deltas[a] = -1
  return deltas
}

// ---- passive hooks, called from the systems they modify ----

export function archetypeMomentBonus(archetypeId: string | null | undefined, isAttackingMoment: boolean, isDefensiveMoment: boolean, optionIsRisky: boolean): number {
  const a = getArchetype(archetypeId)
  if (!a) return 0
  let bonus = 0
  if (a.passive === 'clinical' && isAttackingMoment) bonus += 0.04
  if (a.passive === 'wall' && isDefensiveMoment) bonus += 0.04
  if (a.passive === 'maverick' && optionIsRisky) bonus += 0.03
  return bonus
}

export function archetypeStaminaDrainMultiplier(archetypeId: string | null | undefined): number {
  return getArchetype(archetypeId)?.passive === 'engine' ? 0.88 : 1
}

export function archetypeTrustGainMultiplier(archetypeId: string | null | undefined): number {
  return getArchetype(archetypeId)?.passive === 'leader' ? 1.25 : 1
}

export function archetypeTrainingGainMultiplier(archetypeId: string | null | undefined): number {
  return getArchetype(archetypeId)?.passive === 'prodigy' ? 1.1 : 1
}

export function archetypeConfidenceSwingMultiplier(archetypeId: string | null | undefined): number {
  return getArchetype(archetypeId)?.passive === 'maverick' ? 1.3 : 1
}
