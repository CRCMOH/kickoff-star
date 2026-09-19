import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { applyScoutedPerformance, academyTrialInvites } from '../src/engine/youthScoutingV4'
import { generateAcademyOffers, recordAcademyTrialSession, startAcademyTrial } from '../src/engine/youthAcademyV4'
import { buildAcademySeason, proContractEligible, reviewAcademyRole } from '../src/engine/academyCareerV4'

let world=createYouthWorld('academy-layer-audit','greenwood')
assert.equal(world.academyClubs.length,24)
assert(new Set(world.academyClubs.map(c=>c.region)).size>=8)
for(let week=12;week<=34;week++)world=applyScoutedPerformance(world,{week,competition:week%3===0?'showcase':'school-cup',position:'ST',rating:8.8,minutes:90,goals:2,assists:1,saves:0,tackles:1,interceptions:0,keyPasses:2,cleanSheet:false})
const invites=academyTrialInvites(world)
assert(invites.length>0)
const club=invites[0]
let trial=startAcademyTrial(world,club.id,40,16,10)
assert(trial,'academy assessment must open at age 16 in October after sustained scouting')
trial=recordAcademyTrialSession(world,trial!,1,'technical',{technical:.84,match:0,discipline:.82,consistency:.80},'ST')
trial=recordAcademyTrialSession(world,trial!,2,'pressure',{technical:.78,match:.74,discipline:.80,consistency:.79},'ST')
trial=recordAcademyTrialSession(world,trial!,2,'trial-match',{technical:.65,match:.86,discipline:.82,consistency:.83},'ST')
trial=recordAcademyTrialSession(world,trial!,3,'final-match',{technical:.68,match:.88,discipline:.85,consistency:.86},'ST')
trial=recordAcademyTrialSession(world,trial!,3,'retest',{technical:.86,match:.55,discipline:.84,consistency:.85},'ST')
assert.equal(trial!.complete,true)
assert.equal(trial!.passed,true)
const offers=generateAcademyOffers(world,trial!,'ST',43)
assert(offers.length>=3&&offers.length<=6)
assert(offers.every(o=>o.status==='pending'&&o.expiresWeek===45))

const season=buildAcademySeason(club,world.academyClubs,2029,16)
assert.equal(season.squad.players.length,23)
assert(season.fixtures.some(f=>f.competition==='academy-league'))
assert(season.fixtures.some(f=>f.competition==='academy-cup'))
assert(season.fixtures.some(f=>f.competition==='continental-youth'))
const review=reviewAcademyRole('rotation',{averageRating:8.1,minutes:1000,training:86,discipline:91,energy:78,positionCompetition:48})
const developed={...season,proPathwayScore:review.proPathwayScore,releaseRisk:review.releaseRisk}
assert.equal(proContractEligible(developed,17,63),true)
assert.equal(proContractEligible(developed,16,68),false)
assert.equal(proContractEligible({...developed,proPathwayScore:45},18,72),false)

console.log('V4 academy world audit passed')
console.log({academies:world.academyClubs.length,trialScore:trial!.finalScore,offers:offers.length,academyFixtures:season.fixtures.length,review})
