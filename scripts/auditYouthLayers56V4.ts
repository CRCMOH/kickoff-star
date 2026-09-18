import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { applyTrialOutcome } from '../src/engine/youthPathways'
import {
  groupStanding,
  initInterSchools,
  initMinorSchoolCup,
  initNationalChampionship,
  initRegionalSchools,
  initSundayLeague,
  nextFixtureForTeam,
  recordLeagueResult,
  recordKnockoutResult,
  simulateGroupRound,
  simulateKnockoutRound,
  simulateLeagueRound,
  teamStanding,
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

// Inter-schools league: six schools, five rounds, full standings.
let inter=initInterSchools(world)
assert.equal(inter.teams.length,6)
assert.equal(Math.max(...inter.fixtures.map(f=>f.round)),5)
while(!inter.complete){
  const before=inter.currentRound
  inter=simulateLeagueRound(inter,world.seed)
  if(inter.currentRound===before&&!inter.complete){
    const fx=inter.fixtures.find(f=>f.round===before&&!f.played)
    if(fx)inter=recordLeagueResult(inter,fx.id,1,0)
  }
}
assert(inter.standings.every(s=>s.played===5))
assert.equal(inter.standings.reduce((n,s)=>n+s.points,0)>0,true)
assert(teamStanding(inter,world.selectedSchoolId!)!==null)

// Regional Schools: 24 schools, four groups of six, top two, QF/SF/F.
let regional=initRegionalSchools(world)
assert.equal(regional.teams.length,24)
assert.equal(Object.keys(regional.groups).length,4)
assert(Object.values(regional.groups).every(g=>g.length===6))
let guard=0
while(regional.stage!=='complete'&&guard++<20){
  regional=simulateGroupRound(regional,world.seed)
}
assert.equal(regional.stage,'complete')
assert(regional.championId)
assert.equal(regional.qualifiedTeamIds.length,8)
assert.equal(regional.eliminatedTeamIds.length,23)
assert(groupStanding(regional,world.selectedSchoolId!)!==undefined)

// National representative tournament: 8 regions -> groups -> semis -> final.
let national=initNationalChampionship(world)
guard=0
while(national.stage!=='complete'&&guard++<15)national=simulateGroupRound(national,world.seed+'-national')
assert.equal(national.stage,'complete')
assert(national.championId)

// Minor invitational: eight-school knockout with manual player result support.
let minor=initMinorSchoolCup(world)
assert.equal(minor.teams.length,8)
const ownFixture=nextFixtureForTeam(minor.fixtures,world.selectedSchoolId!)
assert(ownFixture)
minor=recordKnockoutResult(minor,ownFixture!.id,2,1,world.seed)
guard=0
while(minor.stage!=='complete'&&guard++<8)minor=simulateKnockoutRound(minor,world.seed)
assert.equal(minor.stage,'complete')
assert(minor.championId)

// Sunday League initializes only from a chosen grassroots club and has 11 rounds.
world={...world,pathway:{...world.pathway,sundayClubId:world.sundayClubs[0].id,route:'school-and-sunday'}}
const sunday=initSundayLeague(world)
assert.equal(sunday.teams.length,12)
assert.equal(Math.max(...sunday.fixtures.map(f=>f.round)),11)

// Finance: allowance, support and no negative balance.
const opening=world.finances.balance
world=processMonthlyAllowance(world,4,14,0)
assert(world.finances.balance>opening)

const poor={...world,finances:{...world.finances,balance:1}}
const optional=payYouthExpense(poor,5,'recovery-basic')
assert.equal(optional.ok,false)
assert.equal(optional.world.finances.balance,1)

const mandatory=payYouthExpense(poor,5,'academy-travel','academy')
assert.equal(mandatory.ok,true)
assert.equal(mandatory.world.finances.balance,0)
assert(mandatory.world.finances.transactions.some(t=>t.description.includes('bursary')))

// School travel is always covered. Sunday support modifies grassroots transport.
assert.equal(transportCostFor(world,8,'school'),0)
const fullClub=world.sundayClubs.find(c=>c.transportSupport==='full')
if(fullClub){
  let supported={...world,pathway:{...world.pathway,sundayClubId:fullClub.id}}
  assert.equal(transportCostFor(supported,8,'sunday'),0)
  supported=applySundayClubSupport(supported,8)
  assert(supported.finances.transportPasses>=4)
}

// Odd jobs are age/energy/time gated; one job per week.
assert(availableYouthJobs(14).length>0)
const job=availableYouthJobs(14)[0]
const worked=workYouthJob(world,9,job.id,14,90,false)
assert.equal(worked.ok,true)
assert((worked.energyCost??0)>0)
assert.equal(workYouthJob(worked.world,9,job.id,14,90,false).ok,false)
assert.equal(workYouthJob(world,10,job.id,14,30,false).ok,false)
assert.equal(workYouthJob(world,11,job.id,14,90,true).ok,false)

const fin=financeSummary(worked.world)
assert(fin.balance>=0)
assert(fin.totalIncome>=job.pay)

console.log('V4 layers 5-6 audit passed')
console.log({
  interSchoolsChampion:inter.standings[0].teamId,
  regionalChampion:regional.championId,
  nationalChampion:national.championId,
  minorCupChampion:minor.championId,
  sundayRounds:Math.max(...sunday.fixtures.map(f=>f.round)),
  finance:fin,
})
