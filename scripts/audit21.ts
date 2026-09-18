// AUDIT 21 — V4 Layers 5 + 6: competition truth and youth finances.
import { readFileSync } from 'fs'
import {
  COMPETITION_DEFINITIONS, archiveCompetitionSeason, competitionDefinition,
  initCompetitionCareer, isEligible, recordCompetitionMatch, recordSelectionResult,
  scoutingPrestigeMultiplier, selectionScore,
} from '../src/engine/competitionCareer'
import {
  TRANSPORT_OPTIONS, bootCondition, bootRiskModifier, initYouthFinance,
  postTransaction, resolveOpportunityFunding, sponsorshipEligible,
} from '../src/engine/youthFinances'
import { formatMoney } from '../src/engine/economy'

let fails = 0
const check = (condition: boolean, message: string) => {
  if (condition) console.log('  ✓', message)
  else { fails++; console.error('  ✗', message) }
}

console.log('\n[A] every scheduled competition has V4 rules')
{
  const source = readFileSync('src/engine/calendar.ts', 'utf-8')
  const ids = [...source.matchAll(/\{ id: '([^']+)', rounds:/g)].map((m) => m[1])
  for (const id of ids) check(!!COMPETITION_DEFINITIONS[id], `${id} has a definition`)
  check(competitionDefinition('international').prestige > competitionDefinition('sundayLeague').prestige, 'international performances carry more scouting value than Sunday League')
  check(scoutingPrestigeMultiplier('international') > scoutingPrestigeMultiplier('sundayLeague'), 'prestige multiplier preserves that ordering')
}

console.log('\n[B] eligibility and selection competitions')
{
  const school = competitionDefinition('schoolCup')
  check(!isEligible(school.eligibility, { age: 15, schoolId: null, isAcademy: false, injured: false }).eligible, 'school registration is enforced')
  check(!isEligible(school.eligibility, { age: 15, schoolId: 'school-1', isAcademy: true, injured: false }).eligible, 'academy players cannot leak into school competitions')
  check(isEligible(school.eligibility, { age: 15, schoolId: 'school-1', isAcademy: false, injured: false }).eligible, 'a valid youth player is eligible')
  const strong = selectionScore({ performance: 90, attributes: 70, coachTrust: 70, fitness: 80, form: 80, mentality: 70 })
  const weak = selectionScore({ performance: 40, attributes: 50, coachTrust: 30, fitness: 60, form: 40, mentality: 50 })
  check(strong > weak, 'selection score rewards the full six-factor profile')
  const selected = recordSelectionResult(initCompetitionCareer(), { competitionId: 'schoolTrials', season: 2027, round: 4, entrants: 60, survivors: 20, score: 78, outcome: 'selected' })
  check(selected.selections.length === 1 && selected.selections[0].outcome === 'selected', 'selection outcome persists in career history')
}

console.log('\n[C] exact competition stats, discipline and archives')
{
  let state = initCompetitionCareer()
  state = recordCompetitionMatch(state, { competitionId: 'schoolCup', season: 2027, started: true, minutes: 90, rating: 8.4, goals: 2, assists: 1, cleanSheet: false, redCarded: true, playerOfMatch: true })
  state = recordCompetitionMatch(state, { competitionId: 'schoolCup', season: 2027, started: false, minutes: 28, rating: 7.2, goals: 0, assists: 1, cleanSheet: false })
  const stats = state.current.schoolCup
  check(stats.appearances === 2 && stats.starts === 1 && stats.minutes === 118, 'apps, starts and minutes are exact')
  check(stats.goals === 2 && stats.assists === 2 && stats.averageRating === 7.8, 'output and average rating are exact')
  check(state.discipline.schoolCup.redCards === 1 && state.discipline.schoolCup.suspensionMatches === 1, 'cards produce competition-specific suspensions')
  state = archiveCompetitionSeason(state, 2027, { schoolCup: 'Champion' })
  check(!state.current.schoolCup && state.history[0].outcome === 'Champion', 'season stats move into the permanent archive')
}

console.log('\n[D] youth finance choices and ledger')
{
  let finances = initYouthFinance('grassroots-season', 'limited')
  finances = postTransaction(finances, 'grassroots-season', { week: 1, amount: 100, category: 'allowance', description: 'Allowance', coveredBy: 'family' })
  finances = postTransaction(finances, 'grassroots-season', { week: 1, amount: -35, category: 'transport', description: 'Taxi', coveredBy: 'player' })
  check(finances.currency === 'ZAR' && finances.transactions.length === 2, 'rand ledger records income and expenses')
  check(formatMoney(35) === 'R35', 'visible currency is South African rand')
  check(new Set(TRANSPORT_OPTIONS.map((o) => o.cost)).size > 2, 'transport offers real cost/reliability choices')
  const trip = { id: 'trial-jhb', title: 'Johannesburg academy trial', travelCost: 480, accommodationCovered: true, mealsCovered: true }
  check(!resolveOpportunityFunding({ opportunity: trip, choice: 'savings', balance: 320, finances, roll: 0 }).canAttend, 'insufficient savings cannot silently fund a trip')
  check(resolveOpportunityFunding({ opportunity: trip, choice: 'coach', balance: 320, finances, roll: 0 }).canAttend, 'coach assistance can unlock an otherwise unaffordable opportunity')
}

console.log('\n[E] equipment remains subtle and local sponsorship stays believable')
{
  check(bootCondition(100) === 'new' && bootCondition(40) === 'worn' && bootCondition(15) === 'poor', 'boot condition bands are correct')
  check(bootRiskModifier(15).injuryRisk > bootRiskModifier(90).injuryRisk, 'poor boots add risk instead of arcade stat points')
  check(!sponsorshipEligible({ age: 14, reputation: 15, nationalAppearances: 0, awards: 0 }), 'ordinary young players do not receive instant sponsorships')
  check(sponsorshipEligible({ age: 16, reputation: 45, nationalAppearances: 2, awards: 0 }), 'real national exposure can unlock a local sponsor')
}

console.log(fails === 0 ? '\n✅ AUDIT 21 PASSED' : `\n❌ AUDIT 21: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
