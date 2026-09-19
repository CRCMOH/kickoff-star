import { buildSchoolCalendar,buildGrassrootsCalendar } from '../src/engine/careerCalendarV4'
import { createYouthWorld } from '../src/engine/youthWorld'
import { initInterSchools,initSundayLeague,initOctoberSchoolLeague,initOctoberGrassrootsLeague } from '../src/engine/youthCompetitionsV4'
import { selectionFromEnergy } from '../src/engine/selectionEnergyV4'
const ok=(v:boolean,m:string)=>{if(!v)throw new Error(m)}
const school=buildSchoolCalendar(1),grass=buildGrassrootsCalendar(1)
ok(school.events.filter(x=>x.kind==='school-league').length===18,'school calendar must contain 18 league rounds')
ok(grass.events.filter(x=>x.kind==='grassroots-league').length===22,'grassroots calendar must contain 22 league rounds')
ok(school.events.filter(x=>x.kind==='development-comp').length===5,'school replacement competition must have five matches')
ok(school.events.filter(x=>x.kind.startsWith('festival-day')).every(x=>x.matchMinutes===40),'festival matches must be 40 minutes')
const sw=createYouthWorld('audit-school',null,1,'school'),gw=createYouthWorld('audit-grass',null,1,'grassroots')
ok(initInterSchools(sw).teams.length===10&&initInterSchools(sw).fixtures.length===90,'school league must be 10 teams / 90 total fixtures')
ok(initSundayLeague(gw).teams.length===12&&initSundayLeague(gw).fixtures.length===132,'grassroots league must be 12 teams / 132 total fixtures')
ok(initOctoberSchoolLeague(sw).teams.length===5&&initOctoberSchoolLeague(sw).fixtures.length===10,'school October league must be 5 teams / 10 fixtures')
ok(initOctoberGrassrootsLeague(gw).teams.length===5&&initOctoberGrassrootsLeague(gw).fixtures.length===10,'grassroots October league must be 5 teams / 10 fixtures')
ok(selectionFromEnergy({energy:49,importance:50,form:7,role:'starter',daysSinceLastMatch:7,injured:false}).startChance===0,'49 energy must not start')
ok(!selectionFromEnergy({energy:29,importance:50,form:7,role:'starter',daysSinceLastMatch:7,injured:false}).available,'29 energy must not appear')
console.log('V5 route/calendar audit passed')
