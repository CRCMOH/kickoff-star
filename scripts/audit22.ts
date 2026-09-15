// AUDIT 22 — Monte Carlo-style fairness matrix + repetition/content scan.
// Uses the real V3.1 chance/execution formulas. The matrix is deterministic
// because these functions return probabilities; expected successes over 10k
// identical attempts are therefore probability * 10,000.
import { readFileSync } from 'fs'
import { optionChance } from '../src/engine/matchDecisions'
import { adjustChance, type ExecutionGrade } from '../src/engine/execution'
import type { Player } from '../src/types/player'
import type { OutfieldAttribute } from '../src/types/attributes'

let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

const attrs: OutfieldAttribute[] = ['passing','shooting','dribbling','tackling','pace','strength','stamina','agility','vision','composure','positioning','concentration']
function player(skill: number): Player {
  const values = Object.fromEntries(attrs.map(a => [a, skill])) as Record<OutfieldAttribute, number>
  return {
    id: `audit-${skill}`, name: 'Audit Player', position: 'ST', preferredFoot: 'right', heightCm: 178,
    attributes: { kind: 'outfield', values }, potential: 18,
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 100 },
    careerClock: { ageYears: 16, phase: 'academy', grassrootsSeason: null }, schoolId: null, trialWeekCompleted: 3,
    trainingMomentum: 0, matchRatings: [], seasonGoals: 0, seasonAssists: 0,
    injury: null, recentInjuryCount: 0, matchesSinceReturn: 0, coachTrust: 0, reputation: 0,
    scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 0, academyClubName: 'Audit Academy', turnedPro: null, squadRole: 'starting-xi',
  }
}

const weak = player(6)
const developed = player(15)
const options = {
  strong: { label: 'safe pass', hint: 'reliable', baseCeiling: 0.82, keyAttributes: ['passing','vision'] as OutfieldAttribute[], reward: 1 },
  good: { label: 'take the chance', hint: 'balanced', baseCeiling: 0.65, keyAttributes: ['shooting','composure'] as OutfieldAttribute[], reward: 2 },
  risky: { label: 'ambitious attempt', hint: 'high reward', baseCeiling: 0.42, keyAttributes: ['shooting','composure'] as OutfieldAttribute[], reward: 3 },
}
const grades: ExecutionGrade[] = ['perfect','good','ok','miss']
const expected = (p: Player, o: typeof options.strong, grade: ExecutionGrade) => adjustChance(optionChance(p, o, 'good'), grade)

console.log('\n[A] 10,000-attempt expected outcome matrix')
for (const [name, p] of [['weak', weak], ['developed', developed]] as const) {
  console.log(`\n  ${name.toUpperCase()} PLAYER`)
  for (const [risk, o] of Object.entries(options)) {
    const row = grades.map(g => `${g} ${(expected(p, o, g)*100).toFixed(1)}% / ${(expected(p,o,g)*10000).toFixed(0)}`).join(' | ')
    console.log(`  ${risk.padEnd(6)} ${row}`)
  }
}

console.log('\n[B] fairness invariants')
for (const p of [weak, developed]) {
  check(expected(p, options.strong, 'perfect') > expected(p, options.good, 'perfect'), 'strong football option beats balanced option with equal execution')
  check(expected(p, options.good, 'perfect') > expected(p, options.risky, 'perfect'), 'balanced option beats risky option with equal execution')
  for (const o of Object.values(options)) {
    check(expected(p, o, 'perfect') > expected(p, o, 'good'), 'perfect execution beats good execution')
    check(expected(p, o, 'good') > expected(p, o, 'ok'), 'good execution beats scuffed execution')
    check(expected(p, o, 'ok') > expected(p, o, 'miss'), 'scuffed execution beats a miss')
  }
}
for (const o of Object.values(options)) for (const g of grades) {
  check(expected(developed, o, g) > expected(weak, o, g), `developed attributes beat weak attributes for ${o.label} + ${g}`)
}
check(expected(weak, options.strong, 'perfect') > expected(developed, options.risky, 'miss'), 'smart weak-player choice + perfect input can beat developed-player reckless choice + miss')
check(expected(weak, options.risky, 'perfect') > expected(weak, options.risky, 'miss') + 0.08, 'manual execution materially changes a risky outcome, not cosmetic RNG')

console.log('\n[C] repetition / boredom scan')
const scenarios = readFileSync('src/engine/matchScenarios.ts', 'utf-8')
const drills = readFileSync('src/engine/drills.ts', 'utf-8')
const decisions = readFileSync('src/engine/matchDecisions.ts', 'utf-8')
const career = readFileSync('src/screens/Career.tsx', 'utf-8')
const storylines = readFileSync('src/engine/storylines.ts', 'utf-8')

// matchScenarios is authored through scenario(...), beat(...) and opt(...) helper calls,
// not object literals. Scan the real authoring syntax so this audit measures content
// rather than accidentally reporting zero because of a formatting assumption.
const scenarioIds = new Set([...scenarios.matchAll(/\bscenario\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]))
const beatSituations = [...scenarios.matchAll(/\bbeat\(\s*['"][^'"]+['"]\s*,\s*['"]((?:\\.|[^'"\\])*)['"]\s*,/g)].map(m => m[1].trim().toLowerCase())
const optionLabels = [...scenarios.matchAll(/\bopt\(\s*['"]((?:\\.|[^'"\\])*)['"]\s*,/g)].map(m => m[1].trim().toLowerCase())
const decisionText = [...decisions.matchAll(/(?:situation|label):\s*['"]([^'"]+)['"]/g)].map(m => m[1].trim().toLowerCase())
const situations = [...beatSituations, ...optionLabels, ...decisionText]
const duplicates = situations.filter((s,i,a) => s.length > 12 && a.indexOf(s) !== i)
const drillTitles = [...drills.matchAll(/title:\s*['"]([^'"]+)['"]/g)].map(m => m[1].toLowerCase())
const duplicateDrills = drillTitles.filter((s,i,a) => a.indexOf(s) !== i)

check(scenarioIds.size >= 15, `substantial authored branching match scenario pool exists (${scenarioIds.size} unique scenarios)`)
check(new Set(situations).size >= 100, `substantial unique match situation/option text exists (${new Set(situations).size} unique lines)`)
check(new Set(duplicates).size <= Math.max(8, Math.floor(new Set(situations).size * 0.12)), `exact repeated situation/option text stays low (${new Set(duplicates).size} repeated unique lines)`)
check(new Set(drillTitles).size >= 30, `training has meaningful drill variety (${new Set(drillTitles).size} unique drill titles)`)
check(new Set(duplicateDrills).size === 0, `training drill titles are not exact duplicates (${new Set(duplicateDrills).size})`)

// Verify the real anti-repeat mechanism: maybeStartArc receives recentKeys and excludes
// templates found in the recent history window. The previous audit looked only for a
// variable name (recentArcKeys) that this implementation never used.
const hasRecentArcSuppression =
  /maybeStartArc\([^)]*recentKeys\s*:\s*string\[\]/s.test(storylines) &&
  /!recentKeys\.slice\([^)]*\)\.includes\(t\.key\)/s.test(storylines)
check(hasRecentArcSuppression, 'storyline system remembers recent arc keys and suppresses immediate repeats')

console.log('\n[D] anti-predetermination source checks')
check(decisions.includes('effectiveValues(player)'), 'decision probability reads the actual player attributes')
check(decisions.includes('baseCeiling') && decisions.includes('keyAttributes'), 'option risk and relevant football attributes both feed probability')
const execution = readFileSync('src/engine/execution.ts','utf-8')
check(execution.includes('qualityOf(grade)') && execution.includes('baseChance * factor'), 'manual execution grade modifies the real success probability')
check(!execution.includes("return baseChance\n"), 'execution is not a cosmetic result layered over unchanged odds')

console.log(fails === 0 ? '\n✅ AUDIT 22 PASSED' : `\n❌ AUDIT 22: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
