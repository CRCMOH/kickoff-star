import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { applyTrialOutcome } from '../src/engine/youthPathways'
import {
  initializeCompetitionWorld, simulateLeagueRound, simulateGroupRound,
  simulateKnockoutRound, teamStanding, groupStanding,
} from '../src/engine/youthCompetitionsV4'
import {
  applyMatchdayFinances, applyMonthlyAllowance, buyYouthExpense, financeSummary,
  weeklyFinancePlan, workYouthJob,
} from '../src/engine/youthFinancesV4'

let world=initializeCompetitionWorld(createYouthWorld('layers56-audit','greenwood'))
world=applyTrialOutcome(world,.66).world

const inter=world.competitionWorld.interSchools!
assert.equal(inter.teams.length,6)
assert.equal(inter.fixtures.length,15)
assert(inter.teams.some(t=>t.id==='greenwood'))

let interRun=inter
let guard=0
while(!interRun.complete&&guard++<10) interRun=simulateLeagueRound(interRun,'inter-audit')
assert(interRun.complete)
assert.equal(interRun.standings.reduce((n,s)=>n+s.played,0),30)
assert(interRun.standings.reduce((n,s)=>n+s.points,0)>=25)
assert(teamStanding(interRun,'greenwood'))

let regional=world.competitionWorld.regionalSchools!
assert.equal(regional.teams.length,24)
assert.equal(Object.keys(regional.groups).length,4)
for(const ids of Object.values(regional.groups))assert.equal(ids.length,6)
guard=0
while(regional.stage!=='complete'&&guard++<20) regional=simulateGroupRound(regional,'regional-audit')
assert.equal(regional.stage,'complete')
assert(regional.championId)
assert.equal(regional.eliminatedTeamIds.length,23)
assert(groupStanding(world.competitionWorld.regionalSchools!,'greenwood'))

let national=world.competitionWorld.nationalChampionship!
guard=0
while(national.stage!=='complete'&&guard++<15) national=simulateGroupRound(national,'national-audit')
assert.equal(national.stage,'complete')
assert(national.championId)
assert.equal(national.teams.length,8)

let minor=world.competitionWorld.minorSchoolCup!
guard=0
while(minor.stage!=='complete'&&guard++<8) minor=simulateKnockoutRound(minor,'minor-audit')
assert.equal(minor.stage,'complete')
assert(minor.championId)
assert.equal(minor.eliminatedTeamIds.length,7)

world={...world,pathway:{...world.pathway,sundayClubId:world.sundayClubs[0].id,route:'school-and-sunday'}}
world=initializeCompetitionWorld(world)
let sunday=world.competitionWorld.sundayLeague!
assert.equal(sunday.teams.length,12)
guard=0
while(!sunday.complete&&guard++<20) sunday=simulateLeagueRound(sunday,'sunday-audit')
assert(sunday.complete)
assert.equal(sunday.fixtures.length,66)

const starting=world.finances.balance
world=applyMatchdayFinances(world,{week:8,age:14,type:'school',away:true})
assert(world.finances.balance<=starting)
const afterSchool=world.finances.balance
world=applyMatchdayFinances(world,{week:9,age:14,type:'representative',away:true})
assert.equal(world.finances.balance,afterSchool,'fully funded representative duty must not create or remove pocket money')

while(world.finances.balance>=7){
  const bought=buyYouthExpense(world,10,'recovery-basic')
  if(!bought.ok)break
  world=bought.world
}
const lowBalance=world.finances.balance
world=applyMatchdayFinances(world,{week:11,age:14,type:'school',away:false})
assert(world.finances.balance>=0)
assert(world.finances.transactions.some(t=>t.week===11&&t.category==='club-support')||lowBalance>=3)

const beforeAllowance=world.finances.balance
const w4=applyMonthlyAllowance(world,4,14)
assert.equal(w4.finances.balance,beforeAllowance)
const w5=applyMonthlyAllowance(world,5,14)
assert(w5.finances.balance>beforeAllowance)

const tiredJob=workYouthJob(w5,6,14,'carwash',35)
assert.equal(tiredJob.ok,false)
const job=workYouthJob(w5,6,14,'carwash',80)
assert(job.ok)
const repeat=workYouthJob(job.world,6,14,'carwash',80)
assert.equal(repeat.ok,false)
const tooYoung=workYouthJob(job.world,7,14,'junior-ref',90)
assert.equal(tooYoung.ok,false)

const club=job.world.sundayClubs.find(c=>c.id===job.world.pathway.sundayClubId)
const plan=weeklyFinancePlan(job.world,8,14,true,true)
assert(plan.expectedEssentialCosts>=3)
assert.equal(plan.clubSupport,club?.transportSupport??'none')

const summary=financeSummary(job.world)
assert(summary.bootsCondition<=82)
assert(summary.totalEarned>=summary.balance)
assert(summary.lastTransactions.length<=5)

console.log('V4 layers 5-6 audit passed')
console.log({
  interSchoolsChampion:interRun.standings[0].teamId,
  regionalChampion:regional.championId,
  nationalChampion:national.championId,
  minorCupChampion:minor.championId,
  sundayLeagueChampion:sunday.standings[0].teamId,
  finance:summary,
})
