import assert from 'node:assert/strict'
import { initInternationalWorld, advanceInternationalStage, recordNationResult } from '../src/engine/international'
import { internationalCalendarV5, initYouthInternationalV5, youthInternationalWindow } from '../src/engine/youthInternationalV5'

const world=initInternationalWorld('South Africa')
assert.equal(world.qualifyingGroup.teams.length,5)
assert(world.qualifyingGroup.teams.every(t=>t.id.startsWith('nation-')))
assert.equal(new Set(world.qualifyingGroup.teams.map(t=>t.name)).size,5)
assert.deepEqual(internationalCalendarV5().map(x=>x.week),[8,16,24,32,37,40,43])
assert.equal(youthInternationalWindow(37)?.stage,'finals')
const v5=initYouthInternationalV5('rsa')
assert.equal(v5.qualifyingGroup.teams[0].name,'South Africa')
assert(v5.qualifyingGroup.teams.every(t=>t.id.startsWith('nation-')))
// Force a completed qualifying campaign with four wins for the player's nation.
let q=world
for(const f of world.qualifyingGroup.fixtures){
 if(f.homeTeamId===world.nationTeamId)q=recordNationResult(q,f.awayTeamId,2,0,true)
 else if(f.awayTeamId===world.nationTeamId)q=recordNationResult(q,f.homeTeamId,2,0,false)
}
q={...q,qualifyingGroup:{...q.qualifyingGroup,fixtures:q.qualifyingGroup.fixtures.map(f=>f.played?f:{...f,played:true,homeGoals:1,awayGoals:0})}}
q=advanceInternationalStage(q)
assert.equal(q.stage,'finals')
assert.equal(q.finalsTeams.length,8)
assert(q.finalsTeams.every(t=>t.id.startsWith('nation-')))
console.log('V5 international audit passed',{qualifierWeeks:[8,16,24,32],finalsWeeks:[37,40,43],countries:q.finalsTeams.map(t=>t.name)})
