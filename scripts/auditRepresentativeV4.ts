import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { createRegionalCamp, recordCampAssessment, simulateNpcCampAssessments, advanceRegionalCamp, userCampStanding } from '../src/engine/regionalSelectionV4'
import { buildNationalShortlist, selectNational23 } from '../src/engine/nationalPathwayV4'

const world=createYouthWorld('rep-audit','greenwood')
const schoolId=world.selectedSchoolId??world.schools[0].id
let camp=createRegionalCamp(world,'north',{id:'user',name:'Career Player',age:16,position:'ST',overall:61,schoolId},30)
assert.equal(camp.trialists.length,60)
camp=simulateNpcCampAssessments(camp,world,1)
camp=recordCampAssessment(camp,'user','technical',.91)
camp=recordCampAssessment(camp,'user','position-test',.89)
camp=advanceRegionalCamp(camp)
assert.equal(camp.trialists.filter(p=>p.selected).length,35)
camp=simulateNpcCampAssessments(camp,world,2)
camp=recordCampAssessment(camp,'user','small-sided',.9)
camp=recordCampAssessment(camp,'user','trial-match',.93)
camp=advanceRegionalCamp(camp)
assert.equal(camp.finalSquadIds.length,23)
assert.equal(camp.trialists.filter(p=>p.selected).length,23)
const standing=userCampStanding(camp)
assert(standing&&standing.total>1,'user must be ranked against actual positional competitors')

const squads=[camp.trialists.filter(p=>p.selected)]
for(let i=1;i<8;i++){
 let other=createRegionalCamp(world,`region-${i}`,{id:`u-${i}`,name:`Player ${i}`,age:16,position:'CM',overall:58,schoolId},30)
 other=simulateNpcCampAssessments(other,world,1);other=advanceRegionalCamp(other)
 other=simulateNpcCampAssessments(other,world,2);other=advanceRegionalCamp(other)
 squads.push(other.trialists.filter(p=>p.selected))
}
let national=buildNationalShortlist('England',squads)
assert(national.shortlist.length<=46)
national=selectNational23(national)
assert.equal(national.finalSquadIds.length,23)
assert(national.shortlist.filter(p=>p.selected).every(p=>p.schoolId&&p.regionId))
console.log('V4 representative pathway audit passed',{regionalPool:60,firstCut:35,final:23,userStanding:standing,nationalShortlist:national.shortlist.length,nationalFinal:national.finalSquadIds.length})
