// ============================================================================
// PHASE 28 — RELATIONSHIPS
//
// The life layer had no PEOPLE in it. Events referred to "a teammate" or "the
// coach" generically, so nothing accumulated: you could fall out with a
// teammate in week 4 and the game had no idea who that was by week 6.
//
// This gives the career a persistent named cast. Every person has a BOND
// (-100..100) that moves through your choices, drifts on its own, and then
// GATES AND FUELS events — a falling-out with a specific person creates the
// conditions for later events involving that same person. Bonds also feed
// real mechanics (a tight dressing room lifts confidence; a mentor lifts
// training; a hostile coach costs you trust).
//
// Modelled on BitLife's relationship list: named people, a bar per person, a
// set of interactions you can perform any week, and consequences that persist.
// ============================================================================
import { rand } from './rng'
import { FIRST_NAMES, LAST_NAMES } from './squad'

export type RelationshipKind =
  | 'parent' | 'sibling' | 'bestFriend' | 'teammate' | 'rival'
  | 'coach' | 'teacher' | 'partner' | 'agent' | 'mentor'

export interface Relationship {
  id: string
  name: string
  kind: RelationshipKind
  /** -100 (hostile) .. 100 (inseparable) */
  bond: number
  /** Weeks since the last meaningful interaction — drives natural drift. */
  weeksSinceContact: number
  /** Short memory of what's happened between you, newest last (max 4). */
  history: string[]
  /** Set when a relationship ends (moved away, fell out for good, graduated). */
  ended?: boolean
  /**
   * Absolute week of the last player-initiated interaction. Audit finding
   * (P28b): with only an energy cost gating them, spamming "spend time
   * together" pinned EVERY bond at 100 within 12 weeks, permanently maxing
   * the relationship effects and trivialising every bond-gated event and arc.
   * Same class of bug as P11's strictly-dominant intense training. One
   * meaningful interaction per person per week — you can't shortcut a
   * relationship by grinding it in an afternoon.
   */
  lastInteractedWeek?: number
  /** Flavour: what this person does / how you know them. */
  note: string
}

export const KIND_LABEL: Record<RelationshipKind, string> = {
  parent: 'Parent', sibling: 'Sibling', bestFriend: 'Best Friend', teammate: 'Teammate',
  rival: 'Rival', coach: 'Coach', teacher: 'Teacher', partner: 'Partner',
  agent: 'Agent', mentor: 'Mentor',
}

/** People whose bond is structural — never randomly removed from the cast. */
const CORE_KINDS: RelationshipKind[] = ['parent', 'sibling', 'coach']

export function bondLabel(bond: number): string {
  if (bond >= 75) return 'inseparable'
  if (bond >= 45) return 'close'
  if (bond >= 15) return 'good'
  if (bond > -15) return 'neutral'
  if (bond > -45) return 'strained'
  if (bond > -75) return 'bad blood'
  return 'hostile'
}

export function bondColor(bond: number): string {
  if (bond >= 45) return 'text-green-500'
  if (bond >= 15) return 'text-green-400'
  if (bond > -15) return 'text-ks-muted'
  if (bond > -45) return 'text-orange-400'
  return 'text-red-500'
}

function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)] }
function personName(): string { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` }

function make(kind: RelationshipKind, name: string, bond: number, note: string): Relationship {
  return { id: crypto.randomUUID(), name, kind, bond, weeksSinceContact: 0, history: [], note }
}

/**
 * The starting cast, built at career creation. Deliberately small and warm —
 * the interesting relationships (partner, agent, mentor, rivals) ARRIVE later
 * through events, so the list growing is itself a sign of a career developing.
 */
export function initialCast(): Relationship[] {
  const parentName = pick(FIRST_NAMES)
  const siblingName = pick(FIRST_NAMES)
  return [
    make('parent', parentName, 60, 'drives you to every match, rain or shine'),
    make('sibling', siblingName, 45, 'plays in the year below and never lets you forget it'),
    make('bestFriend', personName(), 55, "known each other since primary school"),
    make('coach', personName(), 20, 'runs your side. Hard to read, harder to impress.'),
    make('teacher', personName(), 30, 'thinks you should have a backup plan'),
    make('teammate', personName(), 35, 'plays alongside you every week'),
    make('rival', personName(), -20, 'wants your shirt. Genuinely good, annoyingly.'),
  ]
}

// ---- mutation helpers (pure; the store owns persistence) ----

/**
 * How much of a bond change actually lands.
 *
 * Audit finding (P28b): a flat delta made bonds trivially maxable. Weekly
 * interaction alone drove every bond to 100 in ~15 weeks, because interacting
 * also resets weeksSinceContact — so natural drift never applies to anyone you
 * see regularly, and the gains compounded completely unopposed.
 *
 * Movement AWAY from neutral now meets resistance that grows as the bond
 * approaches its extreme (the same headroom shape training growth uses against
 * potential), while movement BACK toward neutral always lands in full. Getting
 * closer to someone gets harder the closer you already are; losing them can
 * still happen fast. Which is also true of actual relationships.
 */
export function effectiveBondDelta(currentBond: number, delta: number): number {
  const movingAway = Math.sign(delta) === Math.sign(currentBond) && currentBond !== 0
  if (!movingAway) return delta
  const headroom = 1 - Math.pow(Math.abs(currentBond) / 100, 2)
  return delta * Math.max(0.05, headroom)
}

export function adjustBond(list: Relationship[], id: string, delta: number, memory?: string): Relationship[] {
  return list.map((r) => {
    if (r.id !== id) return r
    const bond = Math.max(-100, Math.min(100, r.bond + effectiveBondDelta(r.bond, delta)))
    return {
      ...r,
      bond: Math.round(bond * 10) / 10,
      weeksSinceContact: 0,
      history: memory ? [...r.history, memory].slice(-4) : r.history,
    }
  })
}

export function addPerson(list: Relationship[], kind: RelationshipKind, note: string, bond = 10, name?: string): { list: Relationship[]; person: Relationship } {
  const person = make(kind, name ?? personName(), bond, note)
  return { list: [...list, person], person }
}

export function findByKind(list: Relationship[], kind: RelationshipKind): Relationship | undefined {
  return list.filter((r) => !r.ended && r.kind === kind).sort((a, b) => b.bond - a.bond)[0]
}

export function activeCast(list: Relationship[]): Relationship[] {
  return list.filter((r) => !r.ended)
}

/**
 * Weekly drift. Bonds decay toward neutral when you don't invest in them —
 * the same proportional-with-floor shape the audited trust/confidence decay
 * uses, so this can't produce the bang-bang saturation P24 fixed elsewhere.
 * Core family decays much more slowly; rivals barely warm at all.
 */
export function driftRelationships(list: Relationship[]): Relationship[] {
  return list.map((r) => {
    if (r.ended) return r
    const weeks = r.weeksSinceContact + 1
    // no drift for the first 3 quiet weeks — life has slack in it
    if (weeks <= 3) return { ...r, weeksSinceContact: weeks }
    const rate = CORE_KINDS.includes(r.kind) ? 0.03 : r.kind === 'rival' ? 0.02 : 0.06
    const pull = r.bond * rate
    const step = Math.abs(pull) < 0.5 ? Math.sign(r.bond) * 0.5 : pull
    const bond = Math.abs(r.bond) <= 0.5 ? 0 : r.bond - step
    return { ...r, bond: Math.round(bond * 10) / 10, weeksSinceContact: weeks }
  })
}

// ---- mechanical effects: relationships must PAY OFF, not just decorate ----

export interface RelationshipEffects {
  /** Added to weekly confidence — a warm circle steadies you. */
  confidenceSupport: number
  /** Multiplier on training attribute gains (mentor / coach bond). */
  trainingMultiplier: number
  /** Added to weekly coach trust drift (coach bond). */
  trustDrift: number
  /** Extra weekly energy recovery (home life). */
  energySupport: number
}

export function relationshipEffects(list: Relationship[]): RelationshipEffects {
  const active = activeCast(list)
  const avgSocial = active.filter((r) => ['bestFriend', 'teammate', 'partner', 'sibling'].includes(r.kind))
  const social = avgSocial.length ? avgSocial.reduce((a, r) => a + r.bond, 0) / avgSocial.length : 0
  const home = active.filter((r) => r.kind === 'parent')
  const homeBond = home.length ? home.reduce((a, r) => a + r.bond, 0) / home.length : 0
  const coach = findByKind(active, 'coach')?.bond ?? 0
  const mentor = findByKind(active, 'mentor')?.bond ?? 0

  return {
    // capped deliberately small: this runs EVERY week, and P15/P24 both proved
    // small weekly deltas saturate clamped stats if left unbounded
    confidenceSupport: Math.max(-0.35, Math.min(0.35, (social / 100) * 0.35)),
    trainingMultiplier: 1 + Math.max(-0.08, Math.min(0.12, ((coach + mentor * 1.5) / 250))),
    trustDrift: Math.max(-0.2, Math.min(0.2, (coach / 100) * 0.2)),
    energySupport: Math.max(0, (homeBond / 100) * 2),
  }
}

// ---- player-initiated interactions (the BitLife-style verb list) ----

export interface Interaction {
  id: string
  label: string
  /** Bond change on success / failure. */
  gain: number
  loss: number
  successChance: (r: Relationship) => number
  energyCost: number
  /** Only offered for certain kinds. */
  kinds?: RelationshipKind[]
  memory: string
}

export const INTERACTIONS: Interaction[] = [
  {
    id: 'talk', label: 'Spend time together', gain: 7, loss: -1, energyCost: 3,
    successChance: (r) => 0.75 + r.bond / 400,
    memory: 'you made time for them',
  },
  {
    id: 'train', label: 'Train together', gain: 9, loss: -2, energyCost: 9,
    kinds: ['teammate', 'rival', 'sibling', 'bestFriend', 'mentor'],
    successChance: (r) => 0.62 + r.bond / 350,
    memory: 'you put in extra work together',
  },
  {
    id: 'apologise', label: 'Clear the air', gain: 14, loss: -5, energyCost: 4,
    successChance: (r) => 0.45 + Math.max(0, -r.bond) / 300,
    memory: 'you tried to make peace',
  },
  {
    id: 'ask-advice', label: 'Ask for advice', gain: 8, loss: -1, energyCost: 2,
    kinds: ['parent', 'coach', 'teacher', 'mentor', 'agent'],
    successChance: (r) => 0.7 + r.bond / 400,
    memory: 'you went to them for guidance',
  },
  {
    id: 'confront', label: 'Confront them', gain: 10, loss: -14, energyCost: 5,
    successChance: (r) => 0.4 + r.bond / 500,
    memory: 'you had it out with them',
  },
]

export function interactionsFor(r: Relationship): Interaction[] {
  return INTERACTIONS.filter((i) => !i.kinds || i.kinds.includes(r.kind))
}

/** Has this person already had their meaningful interaction this week? */
export function interactedThisWeek(r: Relationship, currentWeek: number): boolean {
  return r.lastInteractedWeek !== undefined && r.lastInteractedWeek >= currentWeek
}

// ---- cast size management ----
// The cast must not grow without bound: events like a new signing arriving can
// fire every season, and an ever-growing list bloats the save, buries the
// people who matter in the UI, and dilutes the picker. Beyond MAX_ACTIVE_CAST
// the least significant peripheral person quietly drifts out of your life —
// which is also just what happens at that age.
export const MAX_ACTIVE_CAST = 14

export function pruneCast(list: Relationship[]): Relationship[] {
  const active = list.filter((r) => !r.ended)
  if (active.length <= MAX_ACTIVE_CAST) return list
  const prunable = active
    .filter((r) => !CORE_KINDS.includes(r.kind) && r.kind !== 'partner')
    // least invested-in first: weak bond, longest out of contact
    .sort((a, b) => (Math.abs(a.bond) - Math.abs(b.bond)) || (b.weeksSinceContact - a.weeksSinceContact))
  const toEnd = prunable.slice(0, active.length - MAX_ACTIVE_CAST).map((r) => r.id)
  return list.map((r) => (toEnd.includes(r.id) ? { ...r, ended: true } : r))
}

export function resolveInteraction(r: Relationship, interaction: Interaction): { success: boolean; delta: number; memory: string } {
  const success = rand() < Math.max(0.1, Math.min(0.95, interaction.successChance(r)))
  return {
    success,
    delta: success ? interaction.gain : interaction.loss,
    memory: success ? interaction.memory : `${interaction.memory} — it didn't land`,
  }
}
