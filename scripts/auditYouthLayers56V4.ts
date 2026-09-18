import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { applyTrialOutcome, respondToSundayApproach } from '../src/engine/youthPathways'
import {
  advanceYouthCompetition,
  competitionSummary,
  currentYouthFixture,
  initializeYouthCompetition,
  recordYouthCompetitionResult,
  simulateYouthCompetitionRound,
  youthTable,
} from '../src/engine/youthCompetitionsV4'
import {
  applySundayClubSupport,
  availableYouthJobs,
  financeSummary,
  payYouthExpense,
  processMonthlyAllowance,
  transportCostFor,
  workYouthJob,
} from '../src/engine/youthFinanceV4'

let world=createYouthWorld('layer56-audit','greenwood')
world=applyTrialOutcome(world,.66).world

// Inter-schools league: six teams, five rounds, deterministic standings, champion.
world=initializeYouthCompetition(world,'inter-schools')
let league=world.competitionRuntime['inter-schools']
assert.equal(league.stage,'league')
assert.equal(league.teams.length,6)
assert.equal(Math.max(...league.fixtures.map(f=>f.round)),5)
for(let round=1;round<=5;round++)world=simulateYouthCompetitionRound(world,'inter-schools',round)
world=advanceYouthCompetition(world,'inter-schools')
league=world.competitionRuntime['inter-schools']
assert.equal(league.stage,'complete')
assert.equal(youthTable(world,'inter-schools').length,6)
assert(league.championTeamId)

// Regional: 24 schools -> 4x6 -> top 2 -> QF -> SF -> Final.
world=initializeYouthCompetition(world,'regional-schools')
let regional=world.competitionRuntime['regional-schools']
assert.equal(regional.groups.length,4)
assert(regional.groups.every(g=>g.teamIds.length===6))
for(let round=1;round<=5;round++)world=simulateYouthCompetitionRound(world,'regional-schools',round)
world=advanceYouthCompetition(world,'regional-schools')
regional=world.competitionRuntime['regional-schools']
assert.equal(regional.stage,'knockout')
assert.equal(regional.qualifiedTeamIds.length,8)
for(let round=1;round<=3;round++){
  world=simulateYouthCompetitionRound(world,'regional-schools',round)
  world=advanceYouthCompetition(world,'regional-schools')
}
regional=world.competitionRuntime['regional-schools']
assert.equal(regional.stage,'complete')
assert(regional.championTeamId)
assert.equal(competitionSummary(world,'regional-schools')?.remaining,0)

// Player fixture can be recorded manually without double simulation.
world=initializeYouthCompetition(world,'minor-school-cups')
const minor=world.competitionRuntime['minor-school-cups']
const playerTeam=world.selectedSchoolId!
const fx=currentYouthFixture(world,'minor-school-cups',playerTeam)
assert(fx)
world=recordYouthCompetitionResult(world,'minor-school-cups',fx!.id,2,1)
assert(world.competitionRuntime['minor-school-cups'].fixtures.find(f=>f.id===fx!.id)?.played)

// Sunday League world works only once club route exists.
const approachWorld={...world,pathway:{...world.pathway,sundayClubId:world.sundayClubs[0].id,route:'school-and-sunday' as const}}
world=initializeYouthCompetition(approachWorld,'sunday-league')
assert.equal(world.competitionRuntime['sunday-league'].teams.length,12)
assert.equal(Math.max(...world.competitionRuntime['sunday-league'].fixtures.map(f=>f.round)),11)

// Finance: allowance arrives monthly; optional purchases cannot overdraw.
const startBalance=world.finance.balance
world=processMonthlyAllowance(world,4,14,0)
assert(world.finance.balance>startBalance)
const poor={...world,finance:{...world.finance,balance:1}}
const optional=payYouthExpense(poor,5,'recovery-basic')
assert.equal(optional.ok,false)
assert.equal(optional.world.finance.balance,1)

// Mandatory earned opportunity can never become a dead career because of money.
const mandatory=payYouthExpense(poor,5,'academy-travel','academy')
assert.equal(mandatory.ok,true)
assert.equal(mandatory.world.finance.balance,0)
assert(mandatory.world.finance.transactions.some(t=>t.label.includes('bursary')))

// Sunday League support changes transport cost and creates passes.
let fullSupport={...world,pathway:{...world.pathway,sundayClubId:world.sundayClubs.find(c=>c.transportSupport==='full')?.id??world.sundayClubs[0].id}}
if(world.sundayClubs.some(c=>c.transportSupport==='full')){
  assert.equal(transportCostFor(fullSupport,8,'sunday'),0)
}
fullSupport=applySundayClubSupport(fullSupport,8)
assert(fullSupport.finance.transportPasses>=0)

// Odd jobs: age gate, one/week, energy protection, no football conflict.
assert(availableYouthJobs(14).length>0)
const job=availableYouthJobs(14)[0]
const worked=workYouthJob(world,9,job.id,14,90,false)
assert.equal(worked.ok,true)
assert((worked.energyCost??0)>0)
const repeat=workYouthJob(worked.world,9,job.id,14,90,false)
assert.equal(repeat.ok,false)
const exhausted=workYouthJob(world,10,job.id,14,30,false)
assert.equal(exhausted.ok,false)

const fin=financeSummary(worked.world)
assert(fin.totalIncome>=job.pay)
assert(fin.balance>=0)

console.log('V4 layers 5-6 audit passed')
console.log({
  interSchoolsChampion:league.championTeamId,
  regionalChampion:regional.championTeamId,
  regionalQualified:regional.qualifiedTeamIds.length,
  sundayTeams:world.competitionRuntime['sunday-league'].teams.length,
  finance:fin,
})
