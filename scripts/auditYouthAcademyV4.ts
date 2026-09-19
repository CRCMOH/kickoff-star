import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { applyScoutedPerformance, academyTrialInvites } from '../src/engine/youthScoutingV4'
import { generateAcademyOffers, recordAcademyTrialSession, startAcademyTrial } from '../src/engine/youthAcademyV4'

let world=createYouthWorld('academy-layer-audit','greenwood')
assert.equal(world.academyClubs.length,24)
assert(new Set(world.academyClubs.map(c=>c.region)).size>=8)
assert(world.academyClubs.some(c=>c.region==='England'))
assert(world.academyClubs.some(c=>c.region==='South Africa'))
assert(world.academyClubs.some(c=>c.region==='Brazil'))

// Build real scouting evidence; no raw-OVR shortcut into a trial.
for(let week=12;week<=30;week++){
  world=applyScoutedPerformance(world,{
    week,competition:week%3===0?'showcase':'school-cup',position:'ST',
    rating:8.7,minutes:90,goals:2,assists:1,saves:0,tackles:1,interceptions:0,keyPasses:2,cleanSheet:false,
  })
}
const invites=academyTrialInvites(world)
assert(invites.length>0,'sustained elite observed performances should create a trial route')
const club=invites[0]
let trial=startAcademyTrial(world,club.id,31)
assert(trial)
for(const [kind,score] of [['technical',.82],['small-sided',.79],['tactical',.75],['full-match',.86]] as const){
  trial=recordAcademyTrialSession(world,trial!,32,kind,score,'ST')
}
assert.equal(trial!.complete,true)
assert((trial!.finalScore??0)>.6)

const offers=generateAcademyOffers(world,trial!,'ST',34)
assert(offers.length>=3&&offers.length<=6)
assert.equal(new Set(offers.map(o=>o.clubId)).size,offers.length)
assert(offers.every(o=>o.expiresWeek===36))
assert(offers.every(o=>o.status==='pending'))

console.log('V4 academy layer audit passed')
console.log({academies:world.academyClubs.length,countries:new Set(world.academyClubs.map(c=>c.region)).size,trialClub:club.name,trialScore:trial!.finalScore,offers:offers.map(o=>({club:o.clubName,country:o.country,interest:o.interest,path:o.pathwayPromise}))})
