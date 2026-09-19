import assert from 'node:assert/strict'
import { buildSchoolCalendar,buildGrassrootsCalendar,mergeCalendarAfterElimination,calendarHealth } from '../src/engine/careerCalendarV4'
import { emptyStatBook,recordCompetitionStats,competitionAwards } from '../src/engine/competitionStatsV4'
import { generateYouthOffers } from '../src/engine/youthTransfersV4'
import { startAcademyNegotiation,negotiate } from '../src/engine/academyNegotiationV4'
import { buildCareerSummary,shouldEndAtGraduation } from '../src/engine/careerEndV4'
import { migrateYouthSave,YOUTH_SAVE_VERSION,assessLegacyRoute } from '../src/engine/youthSaveV5'
import { createOctoberLeague,advanceOctoberLeague,createThreeDayFestival,advanceFestival } from '../src/engine/youthFestivalV5'

let school=buildSchoolCalendar(1)
assert(school.events.some(e=>e.kind==='schools-october-league'))
assert.equal(school.events.filter(e=>e.kind.startsWith('festival-day')).length,3)
school=mergeCalendarAfterElimination(school,'school','regional-schools',28)
assert(school.events.some(e=>e.replacement&&e.week===29))
const grass=buildGrassrootsCalendar(1)
assert(grass.events.some(e=>e.kind==='grassroots-october-league'))
assert(calendarHealth(grass).activeWeeks>=25)

let book=emptyStatBook('test-cup')
book=recordCompetitionStats(book,[
 {playerId:'st',name:'Striker',teamId:'a',position:'ST',started:true,minutes:90,goals:2,assists:0,cleanSheet:false,saves:0,tackles:1,keyPasses:1,rating:8.8,potm:true},
 {playerId:'gk',name:'Keeper',teamId:'a',position:'GK',started:true,minutes:90,goals:0,assists:0,cleanSheet:true,saves:6,tackles:0,keyPasses:0,rating:8.2,potm:false},
])
const awards=competitionAwards(book)
assert.equal(awards.goldenBoot?.playerId,'st')
assert.equal(awards.goldenGlove?.playerId,'gk')

const offers=generateYouthOffers('school-scholarship',[
 {id:'a',name:'A School',developmentRating:88,distance:12,educationRating:80,strength:78},
 {id:'b',name:'B School',developmentRating:82,distance:5,educationRating:75,strength:74},
 {id:'c',name:'C School',developmentRating:78,distance:9,educationRating:86,strength:71},
],32,{rating:8.1,exposure:72,age:16})
assert(offers.length>=2)
let n=startAcademyNegotiation('o1','academy-a',40,'parent',100)
n=negotiate(n,'push-role',40)
n=negotiate(n,'push-support',41)
assert(n.round>=3&&n.week<=42)

assert(shouldEndAtGraduation(18,true,false,false))
const summary=buildCareerSummary({reason:'graduated-without-academy',age:18,finalOverall:64,peakOverall:66,matches:88,goals:24,assists:19,trophies:['League'],awards:['POTM'],representativeCaps:5})
assert(summary.completed&&summary.legacyScore>0)
const teams=Array.from({length:5},(_,i)=>({id:`t${i}`,name:`Team ${i}`,strength:60+i,source:'school' as const}))
let oct=createOctoberLeague('oct',teams);for(let i=0;i<5;i++)oct=advanceOctoberLeague(oct,'oct-seed')
assert(oct.complete);assert.equal(oct.competition.teams.length,5)
let fest=createThreeDayFestival('fest',teams.slice(0,4));for(let i=0;i<3;i++)fest=advanceFestival(fest,'fest-seed')
assert(fest.complete);assert.equal(fest.matchMinutes,40)
const ambiguous={player:{name:'Dual'},youthWorld:{pathway:{route:'school-and-sunday',sundayClubId:'x'}}}
assert(assessLegacyRoute(ambiguous).needsRouteChoice)
assert.throws(()=>migrateYouthSave(ambiguous),/V5_ROUTE_CHOICE_REQUIRED/)
const migrated=migrateYouthSave({player:{name:'Legacy'}})
assert.equal(migrated.version,YOUTH_SAVE_VERSION)
assert.equal(migrated.payload.player.name,'Legacy')
console.log('V5 remaining systems audit passed',{schoolEvents:school.events.length,grassEvents:grass.events.length,offers:offers.length,negotiationRound:n.round,legacy:summary.legacyScore})
