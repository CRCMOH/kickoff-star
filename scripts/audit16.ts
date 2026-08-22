// AUDIT 16 (P49) — XP-based attribute progression. The existing suite
// doesn't touch this at all: careerSim drives the store directly and never
// exercises TrainingScreen's React-side XP accumulation, and none of the
// other audits know this system exists yet. This is the real check.
import { spendXp, xpCostForLevel, trainingXpForDrill, matchXpEarned, gradeFromRatio, matchPerformanceMultiplier } from '../src/engine/xp'
import { toOvr } from '../src/engine/rating'
import { useCareerStore } from '../src/store/careerStore'

let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

// ---------------------------------------------------------------------------
console.log('\n[A] the cost curve is a real, monotonically increasing escalation')
{
  const samples = [1, 5, 9, 12, 15, 17, 19]
  let prevCost = 0
  let monotonic = true
  for (const l of samples) {
    const cost = xpCostForLevel(l)
    if (cost < prevCost) monotonic = false
    prevCost = cost
  }
  check(monotonic, 'cost per level never decreases as you get better — no late-game discount')
  check(xpCostForLevel(19) / xpCostForLevel(1) >= 20, `going from elite to world-class costs dramatically more than early growth (${xpCostForLevel(19)} vs ${xpCostForLevel(1)})`)
}

// ---------------------------------------------------------------------------
console.log('\n[B] spendXp — continuous, correctly crosses multiple level bands, respects the ceiling')
{
  const r1 = spendXp(5.5, 100, 20)
  check(r1.newLevel > 5.5 && r1.newLevel < 6, 'a partial spend produces a partial (fractional) level — this IS the progress bar')
  check(r1.xpUsed > 0, 'XP is actually consumed by a partial spend')

  // Total cost from level 1 to the ceiling (20) is ~152,200 at the real
  // curve — a pool has to actually exceed that to test the ceiling at all.
  // My first pass at this audit used 100,000, which is LESS than that total,
  // so leftover=0 was correct behavior, not a bug — the pool was fully
  // spent without ever reaching the ceiling. Fixed to a pool that actually
  // crosses it.
  const r2 = spendXp(1, 10_000_000, 20)
  check(r2.newLevel === 20, 'spending reaches the ceiling exactly when the pool is large enough')
  check(r2.leftover > 9_000_000, `XP beyond what the ceiling can absorb is correctly returned, not destroyed (${r2.leftover} left over)`)

  // Same issue: 150 XP against a real cost of 600 for that level can never
  // cross a boundary — not a bug, just an under-sized test pool.
  const r3 = spendXp(5, 700, 20)
  check(r3.levelsCrossed >= 1, 'a pool that actually exceeds the level cost correctly crosses it (drives the flash/reset UI moment)')

  const r4 = spendXp(10, 0, 20)
  check(r4.newLevel === 10 && r4.xpUsed === 0, 'zero XP spent produces zero change — no free growth')
}

// ---------------------------------------------------------------------------
console.log('\n[C] earning scales the way Joel specified — bigger stage, better performance, better execution, all matter')
{
  check(matchXpEarned('academy', 7, 0, 0) > matchXpEarned('grassroots', 7, 0, 0), 'academy football is worth more XP than grassroots at the same rating')
  check(matchXpEarned('international', 7, 0, 0) > matchXpEarned('cup', 7, 0, 0), 'internationals outweigh even cup football')
  check(matchXpEarned('grassroots', 8.5, 0, 0) > matchXpEarned('grassroots', 5.5, 0, 0), 'a good performance earns more than a poor one at the same tier')
  check(matchXpEarned('grassroots', 7, 1, 1) > matchXpEarned('grassroots', 7, 0, 0), 'a goal and an assist genuinely add XP on top of the base')
  check(matchPerformanceMultiplier(9) > matchPerformanceMultiplier(5), 'the performance multiplier itself is monotonic in rating')

  check(trainingXpForDrill('perfect') > trainingXpForDrill('good'), 'perfect execution earns more training XP than good')
  check(trainingXpForDrill('good') > trainingXpForDrill('ok'), 'good earns more than ok')
  check(trainingXpForDrill('ok') > trainingXpForDrill('miss'), 'ok earns more than a miss')
  check(trainingXpForDrill('miss') > 0, 'even a miss earns SOME XP — showing up and trying still counts for something, per the agreed 0.5x floor')
}

// ---------------------------------------------------------------------------
console.log('\n[D] gradeFromRatio — the bridge between a training quality ratio and the shared XP formula')
{
  check(gradeFromRatio(0.95) === 'perfect', 'a near-perfect ratio maps to perfect')
  check(gradeFromRatio(0.6) === 'good', 'a solid ratio maps to good')
  check(gradeFromRatio(0.3) === 'ok', 'a middling ratio maps to ok')
  check(gradeFromRatio(0.1) === 'miss', 'a poor ratio maps to miss')
}

// ---------------------------------------------------------------------------
console.log('\n[E] THE ACTUAL BEHAVIOR CHANGE — training no longer auto-grows attributes; spendAttributeXp does')
{
  const v: Record<string, number> = {}
  for (const k of ['passing', 'shooting', 'dribbling', 'tackling', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) v[k] = 8
  const testPlayer = {
    name: 'Audit16 Player', position: 'ST', potential: 18, attributes: { kind: 'outfield', values: v },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 80 },
    careerClock: { ageYears: 14, phase: 'grassroots-season', grassrootsSeason: 1 },
    matchRatings: [], career: { goals: 0, assists: 0, appearances: 0, wins: 0, cleanSheets: 0, bestRating: 0, motmAwards: 0 },
    coachTrust: 0, reputation: 5, standing: { teammates: 0, fans: 0 }, suspensionMatches: 0,
  } as any

  // Seed the store directly rather than via startNewCareer, which also
  // triggers a real save to IndexedDB — fine in a browser, not available in
  // this Node test environment. Seeding state directly is the correct way
  // to test store LOGIC without depending on browser-only persistence.
  // Real minimal calendar shape, matching exactly what PlayerCreation.tsx's
  // buildInitialCalendar() constructs for a fresh career — an empty stub
  // crashed applyTrainingOutcome's nextUnresolvedEvent() call, which is a
  // gap in this test fixture, not a game bug.
  useCareerStore.setState({
    player: testPlayer,
    calendar: { currentWeek: { weekNumber: 1, seasonYear: 1, events: [] }, history: [] } as any,
  })

  const attr = 'passing'
  const startLevel = v[attr]

  // Simulate what applyTrainingOutcome now does with a large legacy
  // attributeGains payload — it must be ignored entirely.
  useCareerStore.getState().applyTrainingOutcome(
    { grade: 'A', attributeGains: { [attr]: 5 }, objectivesMet: 3, newMomentum: 1, confidenceDelta: 1, intensity: 'normal', energyGrowthMod: 1, intensityGrowthMod: 1, trustDelta: 0 } as any,
    10, null,
  )
  const afterTrainingOnly = (useCareerStore.getState().player!.attributes.values as Record<string, number>)[attr]
  check(afterTrainingOnly === startLevel, `applyTrainingOutcome with a large attributeGains payload does NOT touch the attribute anymore (${startLevel} -> ${afterTrainingOnly}) — XP allocation is the only path now`)

  // Now spend real XP through the real store action and confirm it DOES move.
  const spendResult = useCareerStore.getState().spendAttributeXp(attr, 500)
  const afterSpend = (useCareerStore.getState().player!.attributes.values as Record<string, number>)[attr]
  check(!!spendResult && afterSpend > afterTrainingOnly, `spendAttributeXp DOES grow the attribute through the real store (${afterTrainingOnly} -> ${afterSpend})`)
}

console.log(fails === 0 ? '\n✅ AUDIT 16 PASSED' : `\n❌ AUDIT 16: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
