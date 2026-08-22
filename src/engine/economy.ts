// ============================================================================
// PHASE 29 — MONEY, KIT & CONSUMABLES
//
// Design constraint Joel set, and it's the right one: a schoolkid does NOT get
// paid to play. So there are no wages. Money comes from:
//   - a MONTHLY ALLOWANCE from your parents, which scales with your age and
//     with how well you get on with them (a bond that pays a real dividend)
//   - ODD JOBS, which are life events that pay cash but cost energy and can
//     cost you relationships or training time
//   - occasional prize money / vouchers from footballing achievements
//
// Money is spent on things that solve a real problem the player already has:
//   - ENERGY DRINKS, because recovery is genuinely tight (that's the point of
//     the fatigue system, but it needs an outlet you can plan around rather
//     than a wall you hit)
//   - BOOTS AND EQUIPMENT, which grant temporary attribute boosts for a set
//     number of weeks and then wear out
//
// Deliberately NOT included: watch-an-ad-to-refill. Joel's words: he hated the
// one game that did that. Everything here is earnable in-game.
// ============================================================================
// ============================================================================
// PHASE 34 — ENERGY DRINKS AS PERCENTAGES, NOT FLAT VALUES
//
// Redesigned on Joel's note: flat-value drinks (a fixed +18) feel arbitrary
// and get WORSE the more energy you already have — refill "20%" in most
// mobile football games and it visibly doesn't move the bar much, which reads
// as a scam. Percentage-of-max fixes that: the tier promises a fraction of
// the bar and delivers exactly that fraction, always capped at 100 so a full
// bar can never be "wasted" past the ceiling (drinking a 100% tonic at 70
// energy caps at 100, it does not bank the extra 30%).
//
// This also sets the unit reward ads deal in later: "watch an ad, get a free
// 20% tonic" is an honest sentence in a way "watch an ad, get +18 energy" was
// not, and it's the same reason three ads for one 60% refill would feel like
// a scam — the percentage framing makes that maths visible to the player
// instead of hidden in an opaque number.
// ============================================================================
import { rand } from './rng'
import type { Player } from '../types/player'

export type ItemKind = 'consumable' | 'equipment'
export type ItemSlot = 'boots' | 'shinpads' | 'gloves' | 'kit' | 'none'

export interface ShopItem {
  id: string
  name: string
  kind: ItemKind
  slot: ItemSlot
  price: number
  description: string
  /** Consumable: fraction of MAX energy restored, e.g. 0.2 = 20%. Always caps at 100 total. */
  energyPct?: number
  /** Equipment: attribute boosts while worn, and how long it lasts. */
  boosts?: Record<string, number>
  durationWeeks?: number
  /** Goalkeeper-only kit (gloves) — hidden for outfielders and vice versa. */
  gkOnly?: boolean
  outfieldOnly?: boolean
  /** Minimum age before a shop will sell it to you. */
  minAge?: number
}

/** Energy actually gained from a percentage tonic, respecting the 100 cap. */
export function energyGainFromPct(currentStamina: number, pct: number): number {
  return Math.max(0, Math.min(100, currentStamina + pct * 100) - currentStamina)
}

// Prices are set against the allowance curve below: a 14-year-old on ~£12/month
// should feel every purchase, while a 17-year-old on ~£40/month can run a
// decent kit setup and still save. Consumables are cheap and repeatable;
// equipment is a real commitment that expires.
//
// Three honest tiers — the price roughly tracks the percentage, so a player
// comparing them isn't solving a puzzle, they're picking how big a top-up
// they can afford. £/1% is deliberately similar across all three so none of
// them is a trap purchase.
export const SHOP_ITEMS: ShopItem[] = [
  // ---- consumables: 20% / 50% / 100%, always capped at 100 ----
  // Priced at a flat 0.9 £-per-1% across all three tiers, so none is a trap
  // purchase and the biggest tier isn't secretly the best deal. The original
  // cut priced the 100% tier at £60 (0.6 £/%), which quietly made it the
  // cheapest energy per pound and let the best-paying odd job convert its
  // wages into a NET ENERGY GAIN — reopening the exact "jobs beat resting"
  // exploit audit5 exists to catch, just through the new percentage system
  // instead of the old flat one.
  {
    id: 'energy-drink', name: 'Energy Drink (20%)', kind: 'consumable', slot: 'none', price: 18,
    energyPct: 0.2, description: 'A quick top-up. Restores 20% of your energy bar, capped at full.',
  },
  {
    id: 'recovery-shake', name: 'Recovery Shake (50%)', kind: 'consumable', slot: 'none', price: 45,
    energyPct: 0.5, description: 'Proper recovery formula. Restores half your energy bar, capped at full.',
  },
  {
    id: 'ice-bath', name: 'Ice Bath Session (100%)', kind: 'consumable', slot: 'none', price: 90,
    energyPct: 1.0, description: 'An hour at the physio centre. Fills your energy bar completely.',
  },

  // ---- boots ----
  {
    id: 'boots-trainers', name: 'Worn Trainers', kind: 'equipment', slot: 'boots', price: 10,
    boosts: { pace: 1 }, durationWeeks: 8, outfieldOnly: false,
    description: 'Better than nothing. +1 pace for 8 weeks.',
  },
  {
    id: 'boots-speed', name: 'Speed Boots', kind: 'equipment', slot: 'boots', price: 45,
    boosts: { pace: 2, agility: 1 }, durationWeeks: 10,
    description: 'Light, aggressive stud pattern. +2 pace, +1 agility for 10 weeks.',
  },
  {
    id: 'boots-control', name: 'Control Boots', kind: 'equipment', slot: 'boots', price: 45,
    boosts: { firstTouch: 2, passing: 1 }, durationWeeks: 10,
    description: 'Textured upper for grip on the ball. +2 first touch, +1 passing for 10 weeks.',
  },
  {
    id: 'boots-strike', name: 'Strike Boots', kind: 'equipment', slot: 'boots', price: 55,
    boosts: { finishing: 2, composure: 1 }, durationWeeks: 10, minAge: 15,
    description: 'Built for hitting through the ball. +2 finishing, +1 composure for 10 weeks.',
  },
  {
    id: 'boots-elite', name: 'Elite Signature Boots', kind: 'equipment', slot: 'boots', price: 120,
    boosts: { pace: 2, finishing: 2, dribbling: 2 }, durationWeeks: 14, minAge: 16,
    description: 'The ones off the posters. +2 pace, finishing and dribbling for 14 weeks.',
  },

  // ---- protective / support ----
  {
    id: 'shinpads-pro', name: 'Carbon Shinpads', kind: 'equipment', slot: 'shinpads', price: 30,
    boosts: { strength: 2 }, durationWeeks: 12,
    description: 'Take a kick and get up. +2 strength for 12 weeks.',
  },
  {
    id: 'kit-compression', name: 'Compression Base Layer', kind: 'equipment', slot: 'kit', price: 35,
    boosts: { stamina: 2 }, durationWeeks: 12,
    description: 'Keeps the legs going late on. +2 stamina for 12 weeks.',
  },
  {
    id: 'kit-lucky', name: 'Lucky Shirt', kind: 'equipment', slot: 'kit', price: 18,
    boosts: { composure: 1, concentration: 1 }, durationWeeks: 10,
    description: "You know it's nonsense. It still works. +1 composure, +1 concentration for 10 weeks.",
  },

  // ---- academy tier: priced for a scholarship wage, not pocket money ----
  {
    id: 'boots-custom', name: 'Custom-Fit Boots', kind: 'equipment', slot: 'boots', price: 340,
    boosts: { pace: 2, finishing: 2, firstTouch: 2, agility: 1 }, durationWeeks: 20, minAge: 16,
    description: 'Moulded to your feet at the club. +2 pace, finishing and first touch, +1 agility for 20 weeks.',
  },
  {
    id: 'kit-recovery-suit', name: 'Compression Recovery Suit', kind: 'equipment', slot: 'kit', price: 280,
    boosts: { stamina: 3, strength: 1 }, durationWeeks: 20, minAge: 16,
    description: 'What the first team wear after matches. +3 stamina, +1 strength for 20 weeks.',
  },
  {
    id: 'shinpads-carbon-pro', name: 'Pro Carbon Guards', kind: 'equipment', slot: 'shinpads', price: 190,
    boosts: { strength: 2, concentration: 1 }, durationWeeks: 20, minAge: 16,
    description: 'Barely there, take anything. +2 strength, +1 concentration for 20 weeks.',
  },

  // ---- goalkeeper ----
  {
    id: 'gloves-basic', name: 'Match Gloves', kind: 'equipment', slot: 'gloves', price: 25,
    boosts: { handling: 2 }, durationWeeks: 10, gkOnly: true,
    description: 'Fresh latex, proper grip. +2 handling for 10 weeks.',
  },
  {
    id: 'gloves-elite', name: 'Elite Keeper Gloves', kind: 'equipment', slot: 'gloves', price: 70,
    boosts: { handling: 2, reflexes: 2 }, durationWeeks: 12, gkOnly: true, minAge: 15,
    description: 'What the pros wear. +2 handling, +2 reflexes for 12 weeks.',
  },
]

export function shopFor(player: Player): ShopItem[] {
  const isGK = player.position === 'GK'
  const age = player.careerClock.ageYears
  return SHOP_ITEMS.filter((i) => {
    if (i.gkOnly && !isGK) return false
    if (i.outfieldOnly && isGK) return false
    if (i.minAge && age < i.minAge) return false
    return true
  })
}

export function itemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id)
}

// ---------------------------------------------------------------------------
// Owned things
// ---------------------------------------------------------------------------

export interface OwnedEquipment {
  itemId: string
  weeksRemaining: number
}

/** Consumables the player is carrying, as itemId -> count. */
export type Consumables = Record<string, number>

/**
 * The attribute bonuses currently granted by worn equipment. One item per slot
 * is worn at a time (buying a second pair of boots replaces the first), so
 * these can't be stacked indefinitely.
 */
export function equipmentBoosts(equipment: OwnedEquipment[] | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const owned of equipment ?? []) {
    if (owned.weeksRemaining <= 0) continue
    const item = itemById(owned.itemId)
    if (!item?.boosts) continue
    for (const [attr, v] of Object.entries(item.boosts)) out[attr] = (out[attr] ?? 0) + v
  }
  return out
}

/**
 * THE single place attribute values are resolved for gameplay.
 *
 * Equipment boosts are real but bounded: they never raise an attribute above
 * the player's potential, so kit can help you reach your ceiling sooner but
 * can never let you exceed the player you could become. That keeps the
 * potential system meaningful and stops money buying a better career outright.
 */
export function effectiveValues(player: Player): Record<string, number> {
  const base = player.attributes.values as Record<string, number>
  const boosts = equipmentBoosts(player.equipment)
  if (Object.keys(boosts).length === 0) return base
  const out: Record<string, number> = { ...base }
  for (const [attr, v] of Object.entries(boosts)) {
    if (out[attr] === undefined) continue
    out[attr] = Math.min(player.potential, out[attr] + v)
  }
  return out
}

/** Tick equipment life down a week and drop anything worn out. */
export function ageEquipment(equipment: OwnedEquipment[] | undefined): { equipment: OwnedEquipment[]; expired: string[] } {
  const expired: string[] = []
  const next: OwnedEquipment[] = []
  for (const owned of equipment ?? []) {
    const weeksRemaining = owned.weeksRemaining - 1
    if (weeksRemaining <= 0) expired.push(owned.itemId)
    else next.push({ ...owned, weeksRemaining })
  }
  return { equipment: next, expired }
}

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------

/**
 * Monthly allowance. Scales with age (you get more as you get older, like
 * anyone) and with how you're getting on at home — a strong parent bond is
 * worth real money, which gives the relationship layer a concrete payoff
 * beyond confidence. Deliberately modest: this is pocket money, not a wage.
 */
export function monthlyAllowance(player: Player): number {
  const age = player.careerClock.ageYears
  const base = 8 + Math.max(0, age - 13) * 7 // 14yo ~15, 17yo ~36, 19yo ~50
  const parent = (player.relationships ?? []).find((r) => !r.ended && r.kind === 'parent')
  const bond = parent?.bond ?? 0
  // -30% if things are bad at home, +30% if they're great
  const bondMod = 1 + Math.max(-0.3, Math.min(0.3, bond / 333))
  return Math.round(base * bondMod)
}

/** Allowance lands every 4 weeks. */
export const ALLOWANCE_INTERVAL_WEEKS = 4

export function allowanceDue(player: Player): boolean {
  const now = player.totalWeeksElapsed ?? 0
  const last = player.lastAllowanceWeek ?? -ALLOWANCE_INTERVAL_WEEKS
  return now - last >= ALLOWANCE_INTERVAL_WEEKS
}

// ---------------------------------------------------------------------------
// Daily (weekly) rewards
// ---------------------------------------------------------------------------

/**
 * Joel asked for daily rewards. A career game advances in WEEKS, not days, so
 * a literal daily timer would be dead UI most of the time — this is a per-week
 * check-in with a streak, which is the same dopamine loop mapped onto the
 * game's real clock. Rewards are small and cash-or-item, never attribute
 * points, so a streak can't buy a better player.
 */
export interface WeeklyReward {
  day: number
  money?: number
  itemId?: string
  count?: number
  label: string
}

// BALANCE NOTE (careerSim, P29): the first cut paid ~£7/week, which over a
// month out-earned a 15-year-old's entire allowance — a free tap was beating
// the parents who are supposed to be the primary income, and money ran away to
// four figures inside three seasons. Rewards now skew hard toward CONSUMABLES
// (which is what they're for: keeping energy manageable, per Joel's ask) with
// cash as a garnish.
export const REWARD_CYCLE: WeeklyReward[] = [
  { day: 1, money: 2, label: '£2' },
  { day: 2, itemId: 'energy-drink', count: 1, label: '1 Energy Drink' },
  { day: 3, money: 3, label: '£3' },
  { day: 4, itemId: 'energy-drink', count: 1, label: '1 Energy Drink' },
  { day: 5, money: 5, label: '£5' },
  { day: 6, itemId: 'recovery-shake', count: 1, label: '1 Recovery Shake' },
  { day: 7, money: 8, itemId: 'energy-drink', count: 2, label: '£8 + 2 Energy Drinks' },
]

export function rewardForStreak(streak: number): WeeklyReward {
  return REWARD_CYCLE[Math.min(streak, REWARD_CYCLE.length - 1)]
}

// ---------------------------------------------------------------------------
// Odd jobs — the events that let you actually earn
// ---------------------------------------------------------------------------

export interface OddJob {
  id: string
  label: string
  pay: number
  energyCost: number
  description: string
  minAge?: number
}

// Consumable pricing is set against these jobs so that the money->energy
// conversion is always slightly unprofitable (~1.2 energy per pound bought vs
// the energy a shift costs). Energy drinks are therefore a genuine purchase
// you feel, not a currency you farm. Free drinks come from the weekly
// check-in, which is why the reward cycle leans on them.
//
// BALANCE NOTE (audit5 [C]): these were originally priced so that converting a
// job's pay into energy drinks returned MORE energy than the job cost — which
// made grinding jobs a better recovery strategy than resting and inverted the
// whole fatigue system. Jobs are now deliberately a money decision, not an
// energy pump: work costs you more energy than the wages can buy back. What
// you're really buying with a shift is BOOTS.
export const ODD_JOBS: OddJob[] = [
  { id: 'carwash', label: 'Wash cars on the street', pay: 12, energyCost: 16, description: 'A Saturday morning with a bucket and sponge.' },
  { id: 'paper-round', label: 'Paper round', pay: 15, energyCost: 20, description: 'Early starts all week, but steady money.' },
  { id: 'stacking', label: 'Shelf-stacking shift', pay: 28, energyCost: 34, description: 'A proper shift at the local shop. Long one.', minAge: 15 },
  { id: 'coaching', label: 'Help coach the under-9s', pay: 20, energyCost: 26, description: 'Cones, bibs and thirty small children.', minAge: 15 },
  { id: 'refereeing', label: 'Referee a junior match', pay: 25, energyCost: 32, description: 'Nobody thanks a referee, but it pays.', minAge: 16 },
  { id: 'gardening', label: "Neighbour's garden", pay: 18, energyCost: 24, description: 'Heavy work, cash in hand.' },
]

/** One job a week — you have school and football too. */
export function canWorkThisWeek(player: Player): boolean {
  const now = player.totalWeeksElapsed ?? 0
  return (player.lastJobWeek ?? -1) < now
}

export function availableJobs(player: Player): OddJob[] {
  const age = player.careerClock.ageYears
  return ODD_JOBS.filter((j) => !j.minAge || age >= j.minAge)
}

export function randomJob(player: Player): OddJob {
  const jobs = availableJobs(player)
  return jobs[Math.floor(rand() * jobs.length)]
}

export function formatMoney(amount: number): string {
  return `£${Math.round(amount)}`
}


// ---------------------------------------------------------------------------
// Living costs (P30)
// ---------------------------------------------------------------------------

/**
 * Once you're on a scholarship you're paying your own way: digs near the
 * training ground, travel, food, physio you're not entitled to yet. Without
 * this, wages simply piled up — careerSim measured £6,600 banked over three
 * seasons, because the shop was priced against a £30-a-month allowance and
 * suddenly the player is on £140 a week.
 *
 * Costs scale with what you earn (better contract, better digs) but never
 * exceed a fixed share, so a good negotiation always leaves you better off.
 */
export const LIVING_COST_SHARE = 0.42

export function weeklyLivingCost(player: Player): number {
  if (!player.contract) return 0
  return Math.round(player.contract.terms.weeklyWage * LIVING_COST_SHARE)
}
