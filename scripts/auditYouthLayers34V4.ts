import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { applyTrialOutcome, respondToSundayApproach } from '../src/engine/youthPathways'
import { buildYouthWeekSchedule, simulateScheduleEnergy } from '../src/engine/youthSchedule'
import { academyTrialInvites, applyScoutedPerformance, scoutsAttending, scoutingSummary } from '../src/engine/youthScoutingV4'

let world=createYouthWorld('layer34-audit','greenwood')
world=applyTrialOutcome(world,.58).world
assert.equal(world.pathway.schoolTier,'first-team')

// V5 routes are exclusive: a School career must never silently add grassroots football.
world={...world,pathway:{...world.pathway,sundayClubId:null,route:'school'}}
const w8=buildYouthWeekSchedule(world,8,84)
const active8=w8.events.filter(e=>!e.blockedReason)
assert(active8.some(e=>e.kind==='school-match'))
assert(!active8.some(e=>e.kind==='sunday-match'))
assert.equal(new Set(active8.map(e=>e.day)).size,active8.length)
const energy8=simulateScheduleEnergy(w8,84)
assert(energy8.matchStarts.length>=1)
assert(energy8.matchStarts.every(m=>m.energy>=0&&m.energy<=100))

// Representative duty outranks lower-priority football when calendar conflicts.
world={...world,pathway:{...world.pathway,representative:'regional-squad'}}
const w32=buildYouthWeekSchedule(world,32,90)
const active25=w32.events.filter(e=>!e.blockedReason)
assert(active25.some(e=>e.kind==='representative-duty'))
assert(!active25.some(e=>e.kind==='sunday-match'), 'national duty should override Sunday League in tournament week')

// Cut players have no mandatory school match but can take Sunday path.
let cut=createYouthWorld('cut34','riverside')
cut=applyTrialOutcome(cut,.02).world
cut={...cut,pathway:{...cut.pathway,sundayClubId:cut.sundayClubs[0].id,route:'grassroots'}}
const cutWeek=buildYouthWeekSchedule(cut,10,75)
assert(!cutWeek.events.some(e=>!e.blockedReason&&e.kind==='school-match'))
assert(cutWeek.events.some(e=>!e.blockedReason&&e.kind==='sunday-match'))

// Scouting attendance is competition-sensitive and deterministic for a given world/week.
const schoolVisits=scoutsAttending(world,{week:13,competition:'school-cup',position:'WG',playerTier:'first-team',majorFixture:true})
const schoolVisits2=scoutsAttending(world,{week:13,competition:'school-cup',position:'WG',playerTier:'first-team',majorFixture:true})
assert.deepEqual(schoolVisits,schoolVisits2)

// Build genuine academy interest through repeated observed high-level performance.
// The player should not receive a trial merely because of OVR; multiple observed matches are required.
let prospect=createYouthWorld('elite-prospect','westview')
prospect=applyTrialOutcome(prospect,.78).world
for(let week=13;week<=17;week++){
  prospect=applyScoutedPerformance(prospect,{
    week,competition:'school-cup',position:'WG',rating:8.7,minutes:90,
    goals:1,assists:1,saves:0,tackles:1,interceptions:0,keyPasses:2,cleanSheet:false,
  })
}
for(let week=25;week<=29;week++){
  prospect={...prospect,pathway:{...prospect.pathway,representative:'regional-squad'}}
  prospect=applyScoutedPerformance(prospect,{
    week,competition:'national-championship',position:'WG',rating:8.8,minutes:90,
    goals:1,assists:1,saves:0,tackles:0,interceptions:0,keyPasses:3,cleanSheet:false,
  })
}
for(let week=38;week<=40;week++){
  prospect=applyScoutedPerformance(prospect,{
    week,competition:'showcase',position:'WG',rating:9.0,minutes:90,
    goals:2,assists:1,saves:0,tackles:0,interceptions:0,keyPasses:3,cleanSheet:false,
  })
}
const summary=scoutingSummary(prospect)
assert(summary.knownScoutVisits>0)
assert(summary.monitoring+summary.watchlists+summary.trialReady>0)
const invites=academyTrialInvites(prospect)
assert(invites.length<=3)
assert(invites.every(club=>prospect.scouting.academyInterest[club.id].matchesSeen>=2))

// Bad performances can cool interest rather than every scout endlessly climbing.
const before=Math.max(...Object.values(prospect.scouting.academyInterest).map(i=>i.interest))
prospect=applyScoutedPerformance(prospect,{
  week:41,competition:'friendly',position:'WG',rating:4.7,minutes:90,
  goals:0,assists:0,saves:0,tackles:0,interceptions:0,keyPasses:0,cleanSheet:false,
})
const after=Math.max(...Object.values(prospect.scouting.academyInterest).map(i=>i.interest))
assert(after<=before+5)

console.log('V5 route scheduling/scouting audit passed')
console.log({
  week8Congestion:w8.congestion,
  week8EndEnergy:energy8.endEnergy,
  nationalWeekEvents:active25.map(e=>e.kind),
  academyClubs:prospect.academyClubs.length,
  scouting:summary,
  trialInvites:invites.map(c=>c.name),
})
