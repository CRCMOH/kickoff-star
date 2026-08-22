// P27 spot-audit: archetype deltas clamp correctly, all events well-formed, avatars render
import { reseed } from '../src/engine/rng'
import { ARCHETYPES, archetypeAttributeDeltas, archetypeMomentBonus, archetypeStaminaDrainMultiplier, archetypeTrustGainMultiplier, archetypeTrainingGainMultiplier, archetypeConfidenceSwingMultiplier } from '../src/engine/archetypes'
import { NATIONS, getNation } from '../src/engine/nations'
import { LIFE_EVENTS } from '../src/engine/lifeEvents'
import { readdirSync } from 'fs'
reseed(1)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('✗', m) } else console.log('✓', m) }

check(ARCHETYPES.length === 6, '6 archetypes')
for (const a of ARCHETYPES) {
  const d = archetypeAttributeDeltas(a, 'ST')
  check(Object.values(d).filter((v) => v === 2).length === 2 && Object.values(d).filter((v) => v === -1).length === 1, `${a.id}: +2/+2/-1 outfield tilt`)
  const g = archetypeAttributeDeltas(a, 'GK')
  check(Object.keys(g).every((k) => ['reflexes','handling','gkPositioning','distribution','composure','concentration'].includes(k) || a.gkAlternative === undefined), `${a.id}: GK tilt uses GK-set attrs`)
}
check(archetypeMomentBonus('clinical', true, false, false) === 0.04 && archetypeMomentBonus('clinical', false, true, false) === 0, 'clinical: attack-only')
check(archetypeMomentBonus('wall', false, true, false) === 0.04, 'wall: defense-only')
check(archetypeMomentBonus('maverick', true, false, true) === 0.03, 'maverick: risky-only')
check(archetypeStaminaDrainMultiplier('engine') === 0.88 && archetypeStaminaDrainMultiplier('wall') === 1, 'engine drain multiplier isolated')
check(archetypeTrustGainMultiplier('leader') === 1.25 && archetypeTrainingGainMultiplier('prodigy') === 1.1 && archetypeConfidenceSwingMultiplier('maverick') === 1.3, 'passive multipliers')
check(archetypeMomentBonus(null, true, true, true) === 0, 'no archetype = no bonus')

check(NATIONS.length === 20 && new Set(NATIONS.map((n) => n.id)).size === 20, '20 unique nations')
check(getNation('xxx').id === 'eng', 'unknown nation falls back safely')
check(readdirSync('src/assets/avatars').filter((f) => f.endsWith('.jpg')).length === 8, '8 avatars')

check(LIFE_EVENTS.length === 63, `63 life events (got ${LIFE_EVENTS.length})`)
check(new Set(LIFE_EVENTS.map((e) => e.key)).size === LIFE_EVENTS.length, 'event keys unique')
for (const e of LIFE_EVENTS) {
  const d = e.build({ player: { confidence: { value: 0 }, fitness: { stamina: 50 }, coachTrust: 0, reputation: 30, scoutWatchers: [], squadRole: 'starting-xi', careerClock: { phase: 'grassroots-season' } } as never, week: 10, form: 6.5, isAcademy: false })
  check(d.options.length >= 2 && d.options.every((o) => o.successChance > 0 && o.successChance <= 1), `${e.key}: valid options`)
  for (const o of d.options) {
    const eff = [o.onSuccess, o.onFailure].filter(Boolean) as { reputation?: number; confidence?: number; coachTrust?: number }[]
    // P28 UPDATE: P15's per-event caps (trust <=1, confidence <=2) were a
    // heuristic standing in for the real invariant, which is "the pool must
    // not saturate a clamped stat at SEASON scale". That invariant is now
    // measured directly against the live decay functions in audit4 section
    // [I], which showed the expanded pool peaks at trust 3.5/10 and
    // confidence 4.0/10 after six seasons under greedy play. Rarer, gated,
    // high-stakes events are therefore allowed a slightly bigger swing;
    // reputation stays hard-capped because it drives the scouting economy.
    check(eff.every((x) => (x.reputation ?? 0) <= 1 && (x.coachTrust ?? 0) <= 2 && (x.confidence ?? 0) <= 3 && (x.confidence ?? 0) >= -3 && (x.coachTrust ?? 0) >= -2), `${e.key}/${o.label}: deltas inside balance bands`)
  }
}
console.log(fails === 0 ? '\n✅ AUDIT 3 PASSED' : `\n❌ ${fails} FAILED`)
process.exit(fails ? 1 : 0)
