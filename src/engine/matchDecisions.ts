import type { Player } from '../types/player'
import { effectiveValues } from './economy'
import type { KeyMoment } from './match'
import type { Decision, DecisionOption } from '../types/decision'
import type { OutfieldAttribute, GoalkeeperAttribute } from '../types/attributes'
import { scenarioById } from './matchScenarios'

export type AnyAttribute = OutfieldAttribute | GoalkeeperAttribute
function id() { return crypto.randomUUID() }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

interface MomentOption {
  label: string
  hint: string
  baseCeiling: number
  keyAttributes: AnyAttribute[]
  reward: number
}

function attrValue(player: Player, attr: AnyAttribute): number {
  // P29: equipment boosts apply through effectiveValues (capped at potential)
  const values = effectiveValues(player)
  return values[attr] ?? 8
}

// baseCeiling × attribute modifier × confidence/mental (risk-weighted) — same shape as training/spec.
export function optionChance(player: Player, o: MomentOption, tier: string): number {
  const avg = o.keyAttributes.length ? o.keyAttributes.reduce((s, a) => s + attrValue(player, a), 0) / o.keyAttributes.length : 10
  const attrMod = 0.5 + (avg / 20) * 0.55
  const risk = 1 - o.baseCeiling
  const mentalMod = 1 + (player.confidence.value / 40) * (0.5 + risk)
  const tierMod = tier === 'clear' ? 1.1 : tier === 'good' ? 1.0 : 0.82 // half-chance harder
  return clamp(o.baseCeiling * attrMod * mentalMod * tierMod, 0.05, 0.96)
}

function buildOptions(player: Player, pool: MomentOption[], tier: string): DecisionOption[] {
  return pool.map((o) => ({
    id: id(),
    label: o.label,
    hint: o.hint,
    successChance: optionChance(player, o, tier),
    // reward tier carried via successChance ordering; screen reads reward separately
    onSuccess: { narrative: '' },
    onFailure: { narrative: '' },
  }))
}

// Option pools by situation.
const GK_POOLS: Record<string, MomentOption[]> = {
  onevone: [
    { label: 'stand tall', hint: 'make yourself big', baseCeiling: 0.6, keyAttributes: ['gkPositioning', 'reflexes'], reward: 3 },
    { label: 'rush and smother', hint: 'commit early', baseCeiling: 0.5, keyAttributes: ['reflexes', 'handling'], reward: 3 },
    { label: 'stay back, react', hint: 'safe', baseCeiling: 0.72, keyAttributes: ['reflexes'], reward: 2 },
  ],
  shot: [
    { label: 'catch it', hint: 'no rebound', baseCeiling: 0.55, keyAttributes: ['handling', 'reflexes'], reward: 3 },
    { label: 'parry wide', hint: 'safe hands', baseCeiling: 0.78, keyAttributes: ['reflexes'], reward: 2 },
    { label: 'block with body', hint: 'last resort', baseCeiling: 0.82, keyAttributes: ['gkPositioning'], reward: 1 },
  ],
}

// P37: a goalkeeper choosing how to start play — mirrors the training
// gk-distribution drill options (short/reliable vs long/risky) so the same
// attribute (distribution) matters in a real match, not just training.
const GK_DISTRIBUTION_POOL: MomentOption[] = [
  { label: 'roll to full-back', hint: 'reliable', baseCeiling: 0.86, keyAttributes: ['distribution'], reward: 1 },
  { label: 'throw to the wing', hint: 'quick, needs accuracy', baseCeiling: 0.7, keyAttributes: ['distribution', 'reflexes'], reward: 2 },
  { label: 'long ball forward', hint: 'ambitious, high reward', baseCeiling: 0.52, keyAttributes: ['distribution'], reward: 3 },
]

const DEF_POOL: MomentOption[] = [
  { label: 'slide tackle', hint: 'all or nothing', baseCeiling: 0.5, keyAttributes: ['tackling', 'agility'], reward: 3 },
  { label: 'jockey and delay', hint: 'buy time for cover', baseCeiling: 0.75, keyAttributes: ['positioning', 'concentration'], reward: 2 },
  { label: 'shepherd wide', hint: 'safe', baseCeiling: 0.82, keyAttributes: ['positioning', 'pace'], reward: 1 },
]

const ATT_POOLS: Record<string, MomentOption[]> = {
  clear: [
    { label: 'first-time finish', hint: 'high risk, high reward', baseCeiling: 0.55, keyAttributes: ['shooting', 'composure'], reward: 3 },
    { label: 'take a touch', hint: 'steadier', baseCeiling: 0.72, keyAttributes: ['composure', 'shooting'], reward: 2 },
    { label: 'round the keeper', hint: 'needs quick feet', baseCeiling: 0.6, keyAttributes: ['dribbling', 'agility'], reward: 2 },
  ],
  good: [
    { label: 'header on goal', hint: 'attack the ball', baseCeiling: 0.55, keyAttributes: ['strength', 'positioning'], reward: 3 },
    { label: 'volley it', hint: 'high risk', baseCeiling: 0.45, keyAttributes: ['shooting', 'agility'], reward: 3 },
    { label: 'cushion to teammate', hint: 'safe, team play', baseCeiling: 0.8, keyAttributes: ['vision', 'passing'], reward: 2 },
  ],
  half: [
    { label: 'snatch a shot', hint: 'tight angle', baseCeiling: 0.4, keyAttributes: ['shooting', 'composure'], reward: 3 },
    { label: 'cut it back', hint: 'find support', baseCeiling: 0.7, keyAttributes: ['vision', 'passing'], reward: 2 },
    { label: 'win a corner', hint: 'safe', baseCeiling: 0.85, keyAttributes: ['dribbling'], reward: 1 },
  ],
}

export interface MatchDecisionBundle {
  decision: Decision
  rewards: number[] // reward tier per option, index-aligned
  maxReward: number
  /** Phase 13: per-option baseCeiling, index-aligned. Riskier options get a
   *  tighter timing window, so "high risk" now means harder to EXECUTE too,
   *  not just a lower roll. */
  ceilings: number[]
  /** P67 — per-option keyAttributes, index-aligned, same pattern as
   *  ceilings. Lets the execution layer pick a context-appropriate visual
   *  (a real goal+keeper for a shooting option) instead of always
   *  defaulting to the abstract timing bar. */
  keyAttributes: AnyAttribute[][]
}

// P50 — Joel: matches only ever use the timing bar, and it "gets boring
// fast" — the exact complaint training already solved with mini-game
// variety (P31). Same fix, same principle: the WIDGET varies, the football
// outcome doesn't — this returns a mini-game kind for roughly 40% of
// moments (mixed with the timing bar for variety) using the same
// category-to-kind mapping training already uses, so the two systems feel
// like one game rather than two different interaction languages.
export function miniGameKindForMoment(moment: KeyMoment): 'rondo' | 'targets' | 'sprint' | null {
  if ((moment.minute * 7) % 5 < 2) return null // ~40% of moments
  if (moment.isDistribution) return 'rondo'
  if (moment.isDefensive) return 'sprint'
  return 'targets'
}

// P52 — Joel: a scout doesn't judge a centre-back on goals. Reputation was
// reading only rating + goal/assist involvement — structurally biased
// toward attackers. Rather than hand-tag ~110 existing scenario/moment
// options with an explicit stat field (a large, risky text edit — this
// exact class of bulk edit has corrupted this file before), this infers the
// real stat from what's ALREADY there: the option's own label text already
// says "tackle," "intercept," "header," "square it," etc, because that's
// how the content was naturally written. Pure function, reads only strings
// already in memory — zero risk to the 1400+ lines of authored content.
export function inferStatTag(label: string, isDefensive: boolean, isDistribution: boolean, isGK: boolean, outcomeIsGoodForPlayer: boolean): 'tackle' | 'interception' | 'header' | 'keyPass' | 'save' | null {
  if (!outcomeIsGoodForPlayer) return null
  const l = label.toLowerCase()
  if (isDistribution) return null // distribution success is tracked separately, not a "stat" a scout counts this way
  if (isDefensive && isGK) return 'save'
  if (isDefensive) {
    if (l.includes('intercept') || l.includes('read') || l.includes('step in') || l.includes('cut it out') || l.includes('cut out')) return 'interception'
    if (l.includes('header') || l.includes('aerial') || l.includes('attack it') || l.includes('attack the') || l.includes('jump') || l.includes('win the header')) return 'header'
    return 'tackle' // the honest default for a successful outfield defensive action with no more specific signal
  }
  // Attacking success: a pass-flavoured option is a key pass in its own
  // right, distinct from whether the resulting move became a goal.
  if (l.includes('square') || l.includes('cutback') || l.includes('cut it back') || l.includes('cross') || l.includes('through ball') || l.includes('thread') || l.includes('slide the pass') || l.includes('release') || l.includes('lay it off') || l.includes('pick out')) return 'keyPass'
  return null
}

export function momentToDecision(player: Player, moment: KeyMoment, meta: string): MatchDecisionBundle {
  // P38: an injury decision isn't a football skill check — there's no
  // dribbling or shooting involved in deciding whether to ask for a
  // substitution. Fixed options, not run through optionChance/attributes.
  if (moment.isInjuryDecision) {
    return {
      decision: {
        id: id(),
        context: 'match',
        situation: moment.situation,
        meta,
        options: [
          { id: id(), label: 'play through it', hint: 'risk it', successChance: 1, onSuccess: { narrative: '' }, onFailure: { narrative: '' } },
          { id: id(), label: 'ask to come off', hint: 'protect yourself', successChance: 1, onSuccess: { narrative: '' }, onFailure: { narrative: '' } },
        ],
      },
      // successChance is irrelevant here — resolveInjuryDecision reads WHICH
      // option was picked, not whether a roll succeeded. Reward/ceiling are
      // unused for this moment type but kept populated so the bundle shape
      // stays uniform for any code that reads it generically.
      rewards: [1, 1],
      maxReward: 1,
      ceilings: [1, 1],
      keyAttributes: [[], []],
    }
  }

  // P38: a scenario beat carries its own authored options — route to those
  // instead of the flat pools below, which remain exactly as they were for
  // every moment that isn't part of a scenario.
  if (moment.scenarioId && moment.beatId) {
    const scen = scenarioById(moment.scenarioId)
    const beatDef = scen?.beats[moment.beatId]
    if (scen && beatDef) {
      return scenarioBeatToDecision(player, beatDef.situation, beatDef.options, moment.tier, meta)
    }
  }

  const isGK = player.position === 'GK'
  let pool: MomentOption[]
  if (moment.isDefensive && isGK) {
    pool = moment.tier === 'clear' ? GK_POOLS.onevone : GK_POOLS.shot
  } else if (moment.isDistribution) {
    pool = GK_DISTRIBUTION_POOL
  } else if (moment.isDefensive) {
    pool = DEF_POOL
  } else {
    pool = ATT_POOLS[moment.tier] ?? ATT_POOLS.good
  }

  const options = buildOptions(player, pool, moment.tier)
  return {
    decision: {
      id: id(),
      context: isGK && (moment.isDefensive || moment.isDistribution) ? 'gk' : 'match',
      situation: moment.situation,
      meta,
      options,
    },
    rewards: pool.map((o) => o.reward),
    maxReward: Math.max(...pool.map((o) => o.reward)),
    ceilings: pool.map((o) => o.baseCeiling),
    keyAttributes: pool.map((o) => o.keyAttributes),
  }
}

// P38 — bridges a scenario BEAT into the exact same Decision shape a
// single-shot moment uses, reusing optionChance so both are balanced by one
// formula. The UI and the timing-bar execution flow don't know or care
// whether they're inside a scenario or a plain moment.
export function scenarioBeatToDecision(player: Player, beatSituation: string, options: import('./matchScenarios').ScenarioOption[], tier: string, meta: string): MatchDecisionBundle {
  const isGK = player.position === 'GK'
  const decisionOptions = options.map((o) => ({
    id: id(),
    label: o.label,
    hint: o.hint,
    successChance: optionChance(player, o, tier),
    onSuccess: { narrative: '' },
    onFailure: { narrative: '' },
  }))
  return {
    decision: { id: id(), context: isGK ? 'gk' : 'match', situation: beatSituation, meta, options: decisionOptions },
    rewards: options.map((o) => o.reward),
    maxReward: Math.max(...options.map((o) => o.reward)),
    ceilings: options.map((o) => o.baseCeiling),
    keyAttributes: options.map((o) => o.keyAttributes),
  }
}
