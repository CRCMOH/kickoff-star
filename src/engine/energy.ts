import type { Player } from '../types/player'

// ============================================================================
// PHASE 11 — ENERGY, MADE REAL
//
// Pre-Phase-11 audit finding: weekly energy (player.fitness.stamina) barely did
// anything. It capped starting match sharpness via initMatchFatigue() and that was
// the entire consequence — training growth ignored it completely, and nothing in
// the UI ever explained it. That's why it read as a meaningless number.
//
// This module is now the single source of truth for what energy MEANS. Anything
// that reads or penalises energy goes through here so the UI can describe the
// exact same rules the engine applies — no drift between what we show and what
// we actually compute.
// ============================================================================

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export type EnergyBand = 'fresh' | 'sharp' | 'tired' | 'drained'

export interface BandSpec {
  band: EnergyBand
  label: string
  min: number
  /** Multiplier applied to training attribute growth. */
  growthMod: number
  /** Base chance of picking up a training-ground injury in a session. */
  injuryBase: number
  colorClass: string
  barClass: string
}

// Ordered high → low. Thresholds are the ONLY place band cutoffs are defined.
export const BANDS: BandSpec[] = [
  { band: 'fresh',   label: 'fresh',   min: 80, growthMod: 1.05, injuryBase: 0.000, colorClass: 'text-green-500',  barClass: 'bg-green-500' },
  { band: 'sharp',   label: 'sharp',   min: 60, growthMod: 1.00, injuryBase: 0.005, colorClass: 'text-ks-gold',    barClass: 'bg-ks-gold' },
  { band: 'tired',   label: 'tired',   min: 35, growthMod: 0.85, injuryBase: 0.022, colorClass: 'text-orange-500', barClass: 'bg-orange-500' },
  { band: 'drained', label: 'drained', min: 0,  growthMod: 0.65, injuryBase: 0.055, colorClass: 'text-red-500',    barClass: 'bg-red-500' },
]

export function bandSpec(stamina: number): BandSpec {
  return BANDS.find((b) => stamina >= b.min) ?? BANDS[BANDS.length - 1]
}

export function energyBand(stamina: number): EnergyBand { return bandSpec(stamina).band }
export function energyLabel(stamina: number): string { return bandSpec(stamina).label }

/** Multiplier on training attribute growth. Wired into applyTrainingGrowth. */
export function trainingGrowthModifier(stamina: number): number {
  return bandSpec(stamina).growthMod
}

/**
 * Match starting sharpness. This mirrors initMatchFatigue() exactly — it exists so
 * the UI can show the player what they'll walk onto the pitch with WITHOUT
 * duplicating the rule. Keep the two in sync.
 */
export const MATCH_SHARPNESS_FLOOR = 20
export function matchSharpnessFrom(stamina: number): number {
  return clamp(stamina, MATCH_SHARPNESS_FLOOR, 100)
}

// --- Training intensity (Joel: "need different training options") ---

export type TrainingIntensity = 'light' | 'normal' | 'intense'

export interface IntensitySpec {
  id: TrainingIntensity
  label: string
  blurb: string
  energyMod: number
  /**
   * Growth multiplier BY ENERGY BAND — this is the overtraining model.
   *
   * Balance audit finding: with a single flat growthMod, intense training was strictly
   * dominant. It cost more energy, but because recovery scales with how depleted you are,
   * you landed at almost the same weekly equilibrium (70 vs 73) while gaining 35% more.
   * The "choice" was fake.
   *
   * Now intense only pays when you have the tank for it. Grinding intense while tired is
   * WORSE than training normally — you're breaking your body down faster than it rebuilds.
   * Simulated over 14 weeks: best sustained strategy is normal + full rest (0.85), while
   * intense-while-fresh is the best burst (1.42) and intense-while-tired is punished (0.77).
   */
  growthByBand: Record<EnergyBand, number>
  injuryMod: number
  /** Coach trust nudge for the choice itself — coaches notice who coasts and who grafts. */
  trustDelta: number
}

export const INTENSITIES: IntensitySpec[] = [
  {
    id: 'light', label: 'light',
    blurb: 'Go easy. Saves the legs for matchday, teaches you less.',
    energyMod: 0.55, injuryMod: 0.5, trustDelta: -1,
    growthByBand: { fresh: 0.75, sharp: 0.75, tired: 0.75, drained: 0.75 },
  },
  {
    id: 'normal', label: 'normal',
    blurb: 'Standard session. Balanced cost and reward, whatever shape you\'re in.',
    energyMod: 1.0, injuryMod: 1.0, trustDelta: 0,
    growthByBand: { fresh: 1.0, sharp: 1.0, tired: 1.0, drained: 1.0 },
  },
  {
    id: 'intense', label: 'intense',
    blurb: 'Empty the tank. Huge gains when you\'re fresh — but grinding this while tired is overtraining, and it costs you.',
    energyMod: 1.7, injuryMod: 2.2, trustDelta: 1,
    growthByBand: { fresh: 1.35, sharp: 1.30, tired: 0.90, drained: 0.55 },
  },
]

export function intensitySpec(id: TrainingIntensity): IntensitySpec {
  return INTENSITIES.find((i) => i.id === id) ?? INTENSITIES[1]
}

/** Growth multiplier from the intensity choice, given how fresh the player actually is. */
export function intensityGrowthModifier(id: TrainingIntensity, stamina: number): number {
  return intensitySpec(id).growthByBand[bandSpec(stamina).band]
}

/** Combined growth multiplier — what the player's effort is actually worth right now. */
export function effectiveGrowthModifier(id: TrainingIntensity, stamina: number): number {
  return trainingGrowthModifier(stamina) * intensityGrowthModifier(id, stamina)
}

/**
 * Chance of a training-ground injury for a whole session. New in Phase 11 — previously
 * injuries could ONLY happen in matches, which meant training while drained was free.
 * Kept deliberately low: even intense training while drained is ~12%, and the severity
 * roll skews heavily toward knocks (see rollInjury).
 */
export function trainingInjuryChance(player: Player, intensity: TrainingIntensity): number {
  const base = bandSpec(player.fitness.stamina).injuryBase
  const historyFactor = 1 + (player.recentInjuryCount ?? 0) * 0.4
  return clamp(base * intensitySpec(intensity).injuryMod * historyFactor, 0, 0.15)
}

// --- Rest day: the off-pitch loop ---

export type RestChoice = 'full-rest' | 'recovery' | 'extra-session' | 'switch-off'

export interface RestOption {
  id: RestChoice
  label: string
  blurb: string
  /** Fraction of the standard recovery amount this option grants. */
  recoveryMod: number
  /** Flat energy cost applied BEFORE recovery (extra work costs you). */
  energyCost: number
  confidenceDelta: number
  trustDelta: number
  /** Reduces the rolling recent-injury count that inflates future injury risk. */
  injuryHistoryRelief: number
}

export const REST_OPTIONS: RestOption[] = [
  {
    id: 'full-rest', label: 'full rest',
    blurb: 'Feet up, nothing else. The most energy back, and nothing gained beyond it.',
    recoveryMod: 1.0, energyCost: 0, confidenceDelta: 0, trustDelta: 0, injuryHistoryRelief: 0,
  },
  {
    id: 'recovery', label: 'recovery work',
    blurb: 'Ice baths, stretching, physio room. Less energy back, but your body forgets old knocks.',
    recoveryMod: 0.7, energyCost: 0, confidenceDelta: 0, trustDelta: 0, injuryHistoryRelief: 1,
  },
  {
    id: 'extra-session', label: 'extra session',
    blurb: 'Turn up on your day off. The coach notices — but you start the week tired.',
    recoveryMod: 0.35, energyCost: 8, confidenceDelta: 1, trustDelta: 1, injuryHistoryRelief: 0,
  },
  {
    id: 'switch-off', label: 'switch off',
    blurb: 'See your mates, forget football for a day. Good for the head, less for the legs.',
    recoveryMod: 0.55, energyCost: 0, confidenceDelta: 2, trustDelta: 0, injuryHistoryRelief: 0,
  },
]

export function restOption(id: RestChoice): RestOption {
  return REST_OPTIONS.find((o) => o.id === id) ?? REST_OPTIONS[0]
}

/**
 * Standard recovery amount. recoveryMod scales it per rest option.
 *
 * Deliberately flatter than the old restRecovery() curve (which was missing*0.6 + 10).
 * That curve was so strongly self-correcting that it erased the consequences of any
 * energy decision — however much you burned, you got most of it back, so the rest-day
 * choice barely moved your weekly equilibrium. Flattening it is what makes the
 * off-pitch loop an actual loop: simulated equilibria now spread 82 / 48 / 37 / 17
 * across the four rest choices instead of clustering.
 */
export function baseRecovery(player: Player): number {
  const missing = 100 - player.fitness.stamina
  return Math.round(missing * 0.35) + 20
}

export function recoveryFor(player: Player, choice: RestChoice): number {
  return Math.round(baseRecovery(player) * restOption(choice).recoveryMod)
}

/** Net energy change for a rest choice, for preview in the UI. */
export function netEnergyFor(player: Player, choice: RestChoice): number {
  const opt = restOption(choice)
  const after = clamp(player.fitness.stamina - opt.energyCost + recoveryFor(player, choice), 0, 100)
  return after - player.fitness.stamina
}

// --- Explaining it to the player ---

export interface EnergyEffect {
  label: string
  value: string
  tone: 'good' | 'neutral' | 'bad'
}

/**
 * The live consequences of the player's CURRENT energy, generated from the same
 * constants the engine uses. If a number changes above, this text changes with it.
 */
export function describeEffects(player: Player): EnergyEffect[] {
  const stamina = player.fitness.stamina
  const spec = bandSpec(stamina)
  const growthPct = Math.round((spec.growthMod - 1) * 100)
  const sharpness = matchSharpnessFrom(stamina)
  const injuryPct = trainingInjuryChance(player, 'normal') * 100

  return [
    {
      label: 'training growth',
      value: growthPct === 0 ? 'normal' : `${growthPct > 0 ? '+' : ''}${growthPct}%`,
      tone: growthPct > 0 ? 'good' : growthPct < 0 ? 'bad' : 'neutral',
    },
    {
      label: 'match sharpness',
      value: `starts at ${sharpness}`,
      tone: sharpness >= 80 ? 'good' : sharpness >= 60 ? 'neutral' : 'bad',
    },
    {
      label: 'training injury risk',
      value: injuryPct < 0.5 ? 'negligible' : `${injuryPct.toFixed(1)}% per session`,
      tone: injuryPct < 0.5 ? 'good' : injuryPct < 2.5 ? 'neutral' : 'bad',
    },
  ]
}
