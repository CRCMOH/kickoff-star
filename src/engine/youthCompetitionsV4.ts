import type {
  CompetitionFixture, CompetitionStanding, CompetitionTeamEntry, GroupCompetitionState,
  KnockoutCompetitionState, LeagueCompetitionState, YouthWorld,
} from '../types/youthWorld'

function hash(input:string):number{
  let h=2166136261
  for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0
}
function roll(seed:string){return (hash(seed)%100000)/100000}
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}

function emptyStanding(teamId:string):CompetitionStanding{
  return {teamId,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0}
}

function sortTable(rows:CompetitionStanding[]):CompetitionStanding[]{
  return [...rows].sort((a,b)=>
    b.points-a.points ||
    b.goalDifference-a.goalDifference ||
    b.goalsFor-a.goalsFor ||
    a.teamId.localeCompare(b.teamId)
  )
}

function applyScore(rows:CompetitionStanding[],home:string,away:string,hg:number,ag:number):CompetitionStanding[]{
  const out=rows.map(r=>({...r}))
  const h=out.find(r=>r.teamId===home)!
  const a=out.find(r=>r.teamId===away)!
  h.played++;a.played++
  h.goalsFor+=hg;h.goalsAgainst+=ag
  a.goalsFor+=ag;a.goalsAgainst+=hg
  h.goalDifference=h.goalsFor-h.goalsAgainst
  a.goalDifference=a.goalsFor-a.goalsAgainst
  if(hg>ag){h.won++;a.lost++;h.points+=3}
  else if(ag>hg){a.won++;h.lost++;a.points+=3}
  else{h.drawn++;a.drawn++;h.points++;a.points++}
  return sortTable(out)
}

function roundRobin(teamIds:string[],competitionId:string,groupId?:string,legs:1|2=1):CompetitionFixture[]{
  const ids=[...teamIds]
  if(ids.length%2===1)ids.push('__BYE__')
  const n=ids.length
  const rotating=ids.slice(1)
  const fixed=ids[0]
  const fixtures:CompetitionFixture[]=[]
  for(let round=1;round<n;round++){
    const arr=[fixed,...rotating]
    for(let i=0;i<n/2;i++){
      let home=arr[i]
      let away=arr[n-1-i]
      if(home==='__BYE__'||away==='__BYE__')continue
      if((round+i)%2===0)[home,away]=[away,home]
      fixtures.push({
        id:`${competitionId}-${groupId??'league'}-r${round}-${home}-${away}`,
        competitionId,round,stage:groupId?'group':'league',groupId,homeTeamId:home,awayTeamId:away,played:false,
      })
    }
    rotating.unshift(rotating.pop()!)
  }
  if(legs===2){const second=fixtures.map(f=>({...f,id:`${f.id}-leg2`,round:f.round+(n-1),homeTeamId:f.awayTeamId,awayTeamId:f.homeTeamId,played:false,homeGoals:undefined,awayGoals:undefined,winnerId:undefined}));fixtures.push(...second)}
  return fixtures
}

function simGoals(seed:string,home:CompetitionTeamEntry,away:CompetitionTeamEntry):[number,number]{
  const edge=clamp((home.strength-away.strength)/20,-1.25,1.25)
  const hxg=clamp(1.35+edge*.55+.16,.28,3.2)
  const axg=clamp(1.20-edge*.52,.25,3.0)
  const poisson=(lambda:number,key:string)=>{
    // Knuth with deterministic pseudo-random sequence.
    const limit=Math.exp(-lambda)
    let p=1,k=0
    while(p>limit&&k<9){k++;p*=Math.max(.00001,roll(`${seed}|${key}|${k}`))}
    return Math.max(0,k-1)
  }
  return [poisson(hxg,'h'),poisson(axg,'a')]
}

function schoolEntries(world:YouthWorld):CompetitionTeamEntry[]{
  return world.schools.map(s=>({id:s.id,name:s.name,strength:s.footballRating,source:'school' as const}))
}

function selectLocalSchools(world:YouthWorld,count:number):CompetitionTeamEntry[]{
  const all=schoolEntries(world)
  const selected=world.selectedSchoolId
  const chosen=all.find(t=>t.id===selected)
  const school=world.schools.find(s=>s.id===selected)
  const sameDistrict=school ? all.filter(t=>world.schools.find(s=>s.id===t.id)?.districtId===school.districtId&&t.id!==selected) : []
  const rest=all.filter(t=>t.id!==selected&&!sameDistrict.some(x=>x.id===t.id))
  return [...(chosen?[chosen]:[]),...sameDistrict,...rest].slice(0,count)
}

function selectRegionalSchools(world:YouthWorld,count:number):CompetitionTeamEntry[]{
  const all=schoolEntries(world)
  const chosen=all.find(t=>t.id===world.selectedSchoolId)
  const ranked=[...all].sort((a,b)=>b.strength-a.strength)
  const pool=ranked.slice(0,count)
  if(chosen&&!pool.some(t=>t.id===chosen.id))pool[pool.length-1]=chosen
  return pool.sort((a,b)=>a.id.localeCompare(b.id))
}

function representativeEntries(world:YouthWorld):CompetitionTeamEntry[]{
  const names=['Northern Region','Central Region','Southern Region','Western Region','Eastern Region','Coastal Region','Highveld Region','Capital Region']
  return names.map((name,i)=>({
    id:`rep-${i+1}`,name,strength:64+Math.round(roll(`${world.seed}|rep|${i}`)*15),source:'representative' as const,
  }))
}

export function initLeagueCompetition(id:string,teams:CompetitionTeamEntry[],legs:1|2=1):LeagueCompetitionState{
  return {id,kind:'league',teams,fixtures:roundRobin(teams.map(t=>t.id),id,undefined,legs),standings:teams.map(t=>emptyStanding(t.id)),currentRound:1,complete:false}
}

export function initInterSchools(world:YouthWorld):LeagueCompetitionState{
  return initLeagueCompetition('inter-schools',selectLocalSchools(world,10),2)
}

export function initReserveLeague(world:YouthWorld):LeagueCompetitionState{
  return initLeagueCompetition('reserve-league',selectLocalSchools(world,8))
}

export function initSundayLeague(world:YouthWorld):LeagueCompetitionState{
  let clubs=world.sundayClubs.slice(0,12).map(c=>({id:c.id,name:c.name,strength:c.strength,source:'sunday' as const}))
  if(world.pathway.sundayClubId&&!clubs.some(c=>c.id===world.pathway.sundayClubId)){
    const own=world.sundayClubs.find(c=>c.id===world.pathway.sundayClubId)
    if(own)clubs=[{id:own.id,name:own.name,strength:own.strength,source:'sunday' as const},...clubs.slice(0,11)]
  }
  return initLeagueCompetition('sunday-league',clubs,2)
}

function initGroupCompetition(id:string,teams:CompetitionTeamEntry[],groupsCount:number):GroupCompetitionState{
  const groups:Record<string,string[]>={}
  const standings:Record<string,CompetitionStanding[]>={}
  const fixtures:CompetitionFixture[]=[]
  for(let g=0;g<groupsCount;g++){
    const gid=String.fromCharCode(65+g)
    groups[gid]=[]
  }
  // Snake-ish distribution keeps groups balanced by strength.
  const ranked=[...teams].sort((a,b)=>b.strength-a.strength)
  ranked.forEach((team,i)=>{
    const cycle=Math.floor(i/groupsCount)
    const idx=cycle%2===0?i%groupsCount:groupsCount-1-(i%groupsCount)
    groups[String.fromCharCode(65+idx)].push(team.id)
  })
  for(const [gid,ids] of Object.entries(groups)){
    standings[gid]=ids.map(emptyStanding)
    fixtures.push(...roundRobin(ids,id,gid))
  }
  return {id,kind:'groups-knockout',teams,groups,fixtures,standings,currentRound:1,stage:'groups',qualifiedTeamIds:[],eliminatedTeamIds:[],championId:null}
}

export function initOctoberSchoolLeague(world:YouthWorld):LeagueCompetitionState{return initLeagueCompetition('october-schools',selectLocalSchools(world,5),1)}
export function initOctoberGrassrootsLeague(world:YouthWorld):LeagueCompetitionState{
 let clubs=world.sundayClubs.slice(0,5).map(c=>({id:c.id,name:c.name,strength:c.strength,source:'sunday' as const}))
 const own=world.pathway.sundayClubId&&world.sundayClubs.find(c=>c.id===world.pathway.sundayClubId)
 if(own&&!clubs.some(c=>c.id===own.id))clubs[clubs.length-1]={id:own.id,name:own.name,strength:own.strength,source:'sunday' as const}
 return initLeagueCompetition('october-grassroots',clubs,1)
}
export function initRegionalSchools(world:YouthWorld):GroupCompetitionState{
  return initGroupCompetition('regional-schools',selectRegionalSchools(world,24),4)
}

export function initNationalChampionship(world:YouthWorld):GroupCompetitionState{
  return initGroupCompetition('national-championship',representativeEntries(world),2)
}

export function initMinorSchoolCup(world:YouthWorld):KnockoutCompetitionState{
  const teams=selectLocalSchools(world,8)
  const fixtures:CompetitionFixture[]=[]
  for(let i=0;i<8;i+=2){
    fixtures.push({id:`minor-qf-${i/2+1}`,competitionId:'minor-school-cup',round:1,stage:'quarter-final',homeTeamId:teams[i].id,awayTeamId:teams[i+1].id,played:false})
  }
  return {id:'minor-school-cup',kind:'knockout',teams,fixtures,currentRound:1,stage:'quarter-final',eliminatedTeamIds:[],championId:null}
}

function teamMap(teams:CompetitionTeamEntry[]){return new Map(teams.map(t=>[t.id,t]))}

export function recordLeagueResult(state:LeagueCompetitionState,fixtureId:string,hg:number,ag:number):LeagueCompetitionState{
  const fixture=state.fixtures.find(f=>f.id===fixtureId)
  if(!fixture||fixture.played)return state
  const fixtures=state.fixtures.map(f=>f.id===fixtureId?{...f,played:true,homeGoals:hg,awayGoals:ag,winnerId:hg===ag?null:hg>ag?f.homeTeamId:f.awayTeamId}:f)
  const standings=applyScore(state.standings,fixture.homeTeamId,fixture.awayTeamId,hg,ag)
  const roundFixtures=fixtures.filter(f=>f.round===state.currentRound)
  const roundDone=roundFixtures.every(f=>f.played)
  const maxRound=Math.max(...fixtures.map(f=>f.round))
  return {...state,fixtures,standings,currentRound:roundDone?Math.min(maxRound,state.currentRound+1):state.currentRound,complete:fixtures.every(f=>f.played)}
}

export function simulateLeagueRound(state:LeagueCompetitionState,seed:string,excludeTeamId?:string):LeagueCompetitionState{
  let next=state
  const byId=teamMap(state.teams)
  for(const f of state.fixtures.filter(f=>f.round===state.currentRound&&!f.played)){
    if(excludeTeamId&&(f.homeTeamId===excludeTeamId||f.awayTeamId===excludeTeamId))continue
    const h=byId.get(f.homeTeamId),a=byId.get(f.awayTeamId)
    if(!h||!a)continue
    const [hg,ag]=simGoals(`${seed}|${f.id}`,h,a)
    next=recordLeagueResult(next,f.id,hg,ag)
  }
  return next
}

function recomputeGroupStandings(state:GroupCompetitionState,groupId:string,fixture:CompetitionFixture,hg:number,ag:number){
  return {...state.standings,[groupId]:applyScore(state.standings[groupId],fixture.homeTeamId,fixture.awayTeamId,hg,ag)}
}

function koWinner(f:CompetitionFixture,hg:number,ag:number,seed:string):string{
  if(hg>ag)return f.homeTeamId
  if(ag>hg)return f.awayTeamId
  return roll(seed+'|pens')<.5?f.homeTeamId:f.awayTeamId
}

function createKnockoutFixtures(id:string,stage:CompetitionFixture['stage'],round:number,ids:string[]):CompetitionFixture[]{
  const out:CompetitionFixture[]=[]
  for(let i=0;i<ids.length;i+=2){
    out.push({id:`${id}-${stage}-r${round}-${i/2+1}`,competitionId:id,round,stage,homeTeamId:ids[i],awayTeamId:ids[i+1],played:false})
  }
  return out
}

function advanceGroupKnockout(state:GroupCompetitionState):GroupCompetitionState{
  if(state.stage==='groups'){
    const groupFixtures=state.fixtures.filter(f=>f.stage==='group')
    if(!groupFixtures.every(f=>f.played))return state
    const qualified:string[]=[]
    for(const gid of Object.keys(state.groups).sort())qualified.push(...sortTable(state.standings[gid]).slice(0,2).map(x=>x.teamId))
    const all=state.teams.map(t=>t.id)
    const eliminated=all.filter(id=>!qualified.includes(id))
    // 24/4 groups -> QF; 8/2 groups -> SF.
    const stage:CompetitionFixture['stage']=qualified.length===8?'quarter-final':'semi-final'
    const paired:string[]=[]
    if(qualified.length===8){
      // A1-B2, B1-A2, C1-D2, D1-C2.
      const gs=Object.keys(state.groups).sort()
      for(let i=0;i<gs.length;i+=2){
        const g1=sortTable(state.standings[gs[i]]),g2=sortTable(state.standings[gs[i+1]])
        paired.push(g1[0].teamId,g2[1].teamId,g2[0].teamId,g1[1].teamId)
      }
    }else{
      const a=sortTable(state.standings['A']),b=sortTable(state.standings['B'])
      paired.push(a[0].teamId,b[1].teamId,b[0].teamId,a[1].teamId)
    }
    const round=Math.max(...groupFixtures.map(f=>f.round))+1
    return {...state,qualifiedTeamIds:qualified,eliminatedTeamIds:eliminated,stage:stage==='quarter-final'?'quarter-final':'semi-final',currentRound:round,fixtures:[...state.fixtures,...createKnockoutFixtures(state.id,stage,round,paired)]}
  }
  const live=state.fixtures.filter(f=>f.stage===state.stage)
  if(!live.length||!live.every(f=>f.played))return state
  const winners=live.map(f=>f.winnerId!).filter(Boolean)
  const losers=live.map(f=>f.winnerId===f.homeTeamId?f.awayTeamId:f.homeTeamId)
  const eliminated=[...state.eliminatedTeamIds,...losers]
  if(state.stage==='final'){
    return {...state,stage:'complete',eliminatedTeamIds:eliminated,championId:winners[0]??null}
  }
  const nextStage:CompetitionFixture['stage']=state.stage==='quarter-final'?'semi-final':'final'
  const round=state.currentRound+1
  return {...state,stage:nextStage,currentRound:round,eliminatedTeamIds:eliminated,fixtures:[...state.fixtures,...createKnockoutFixtures(state.id,nextStage,round,winners)]}
}

export function recordGroupCompetitionResult(state:GroupCompetitionState,fixtureId:string,hg:number,ag:number,seed='player'):GroupCompetitionState{
  const fixture=state.fixtures.find(f=>f.id===fixtureId)
  if(!fixture||fixture.played)return state
  const winnerId=fixture.stage==='group'?(hg===ag?null:hg>ag?fixture.homeTeamId:fixture.awayTeamId):koWinner(fixture,hg,ag,`${seed}|${fixtureId}`)
  const fixtures=state.fixtures.map(f=>f.id===fixtureId?{...f,played:true,homeGoals:hg,awayGoals:ag,winnerId}:f)
  let next={...state,fixtures}
  if(fixture.stage==='group'&&fixture.groupId)next={...next,standings:recomputeGroupStandings(next,fixture.groupId,fixture,hg,ag)}
  const live=fixtures.filter(f=>f.round===state.currentRound)
  if(live.length&&live.every(f=>f.played)){
    if(state.stage==='groups'){
      const allGroupFixtures=fixtures.filter(f=>f.stage==='group')
      if(allGroupFixtures.every(f=>f.played)) next=advanceGroupKnockout(next)
      else next={...next,currentRound:state.currentRound+1}
    }else{
      next=advanceGroupKnockout(next)
    }
  }
  return next
}

export function simulateGroupRound(state:GroupCompetitionState,seed:string,excludeTeamId?:string):GroupCompetitionState{
  let next=state
  const byId=teamMap(state.teams)
  for(const f of state.fixtures.filter(f=>f.round===state.currentRound&&!f.played)){
    if(excludeTeamId&&(f.homeTeamId===excludeTeamId||f.awayTeamId===excludeTeamId))continue
    const h=byId.get(f.homeTeamId),a=byId.get(f.awayTeamId)
    if(!h||!a)continue
    const [hg,ag]=simGoals(`${seed}|${f.id}`,h,a)
    next=recordGroupCompetitionResult(next,f.id,hg,ag,seed)
  }
  return next
}

export function recordKnockoutResult(state:KnockoutCompetitionState,fixtureId:string,hg:number,ag:number,seed='player'):KnockoutCompetitionState{
  const fixture=state.fixtures.find(f=>f.id===fixtureId)
  if(!fixture||fixture.played)return state
  const winnerId=koWinner(fixture,hg,ag,`${seed}|${fixtureId}`)
  let fixtures=state.fixtures.map(f=>f.id===fixtureId?{...f,played:true,homeGoals:hg,awayGoals:ag,winnerId}:f)
  let next={...state,fixtures}
  const live=fixtures.filter(f=>f.stage===state.stage)
  if(!live.every(f=>f.played))return next
  const winners=live.map(f=>f.winnerId!).filter(Boolean)
  const losers=live.map(f=>f.winnerId===f.homeTeamId?f.awayTeamId:f.homeTeamId)
  const eliminated=[...state.eliminatedTeamIds,...losers]
  if(state.stage==='final')return {...next,stage:'complete',eliminatedTeamIds:eliminated,championId:winners[0]??null}
  const stage:KnockoutCompetitionState['stage']=state.stage==='quarter-final'?'semi-final':'final'
  const round=state.currentRound+1
  fixtures=[...fixtures,...createKnockoutFixtures(state.id,stage,round,winners)]
  return {...next,fixtures,stage,currentRound:round,eliminatedTeamIds:eliminated}
}

export function simulateKnockoutRound(state:KnockoutCompetitionState,seed:string,excludeTeamId?:string):KnockoutCompetitionState{
  let next=state
  const byId=teamMap(state.teams)
  for(const f of state.fixtures.filter(f=>f.round===state.currentRound&&!f.played)){
    if(excludeTeamId&&(f.homeTeamId===excludeTeamId||f.awayTeamId===excludeTeamId))continue
    const h=byId.get(f.homeTeamId),a=byId.get(f.awayTeamId)
    if(!h||!a)continue
    const [hg,ag]=simGoals(`${seed}|${f.id}`,h,a)
    next=recordKnockoutResult(next,f.id,hg,ag,seed)
  }
  return next
}

export function initializeCompetitionWorld(world:YouthWorld):YouthWorld{
  return {
    ...world,
    competitionWorld:{
      interSchools:initInterSchools(world),
      reserveLeague:initReserveLeague(world),
      regionalSchools:initRegionalSchools(world),
      minorSchoolCup:initMinorSchoolCup(world),
      sundayLeague:world.pathway.sundayClubId?initSundayLeague(world):null,
      nationalChampionship:initNationalChampionship(world),
      statBooks:world.competitionWorld.statBooks??{},
    },
  }
}

export function ensureSundayCompetition(world:YouthWorld):YouthWorld{
  if(!world.pathway.sundayClubId||world.competitionWorld.sundayLeague)return world
  return {...world,competitionWorld:{...world.competitionWorld,sundayLeague:initSundayLeague(world)}}
}

export function teamStanding(state:LeagueCompetitionState,teamId:string){
  return state.standings.find(s=>s.teamId===teamId)??null
}

export function groupStanding(state:GroupCompetitionState,teamId:string){
  const gid=Object.keys(state.groups).find(g=>state.groups[g].includes(teamId))
  return gid?state.standings[gid].find(s=>s.teamId===teamId)??null:null
}

export function nextFixtureForTeam(fixtures:CompetitionFixture[],teamId:string){
  return fixtures.find(f=>!f.played&&(f.homeTeamId===teamId||f.awayTeamId===teamId))??null
}
