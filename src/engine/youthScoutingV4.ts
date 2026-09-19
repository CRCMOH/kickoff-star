import type { Position } from '../types/attributes'
import type { AcademyClub, AcademyScoutInterest, CompetitionKind, YouthWorld } from '../types/youthWorld'

function clamp(v:number,lo:number,hi:number){return Math.max(lo,Math.min(hi,v))}

function roll(world: YouthWorld, salt: string): number {
  let h = 2166136261
  const s = world.seed + '|' + salt
  for (let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0)/4294967295
}

export interface ScoutAttendance {
  clubId: string
  clubName: string
  visibleToPlayer: boolean
  reason: string
  weight: number
}

export interface ScoutingMatchContext {
  week: number
  competition: CompetitionKind
  position: Position
  playerTier: 'first-team'|'reserve'|'development'|'cut'
  homeDistrictId?: string
  majorFixture?: boolean
}

function competitionScoutWeight(kind: CompetitionKind): number {
  switch(kind){
    case 'academy-trial': return 1.0
    case 'showcase': return .95
    case 'national-championship': return .9
    case 'school-cup': return .72
    case 'regional-selection': return .78
    case 'school-league': return .38
    case 'sunday-cup': return .4
    case 'sunday-league': return .28
    case 'minor-school-cup': return .3
    case 'reserve-league': return .18
    case 'friendly': return .08
    default: return .12
  }
}

export function scoutsAttending(world: YouthWorld, ctx: ScoutingMatchContext): ScoutAttendance[] {
  const base = competitionScoutWeight(ctx.competition)
  const rep = world.scouting.regionalReputation/100
  const local = world.scouting.localVisibility/100
  const academyExposure = world.scouting.academyExposure/100
  return world.academyClubs
    .map((club,index)=>{
      const positionalNeed=(club.positionNeeds[ctx.position]??50)/100
      const prestigeDifficulty=.75+club.prestige/160
      const chance=clamp((base*.55 + rep*.16 + local*.08 + academyExposure*.18 + positionalNeed*.14)/prestigeDifficulty,0,.97)
      const r=roll(world,`attendance-${ctx.week}-${ctx.competition}-${club.id}-${index}`)
      if(r>=chance)return null
      const visible = ctx.majorFixture || ctx.competition==='showcase' || ctx.competition==='academy-trial' || r < chance*.45
      return {
        clubId:club.id,
        clubName:club.name,
        visibleToPlayer:!!visible,
        reason: ctx.competition==='showcase' ? 'Invited showcase scout'
          : ctx.competition==='national-championship' ? 'National tournament coverage'
          : ctx.competition==='school-cup' ? 'Regional schools scouting'
          : ctx.competition==='sunday-league' ? 'Local grassroots observation'
          : 'Youth recruitment observation',
        weight:chance,
      } satisfies ScoutAttendance
    })
    .filter((x): x is ScoutAttendance => !!x)
    .sort((a,b)=>b.weight-a.weight)
    .slice(0,ctx.majorFixture?5:3)
}

export interface ScoutPerformance {
  week:number
  competition:CompetitionKind
  position:Position
  rating:number
  minutes:number
  goals:number
  assists:number
  saves:number
  tackles:number
  interceptions:number
  keyPasses:number
  cleanSheet:boolean
}

function positionalPerformance(p:ScoutPerformance):number{
  const rating=clamp((p.rating-5.5)/3.5,0,1)
  let output=0
  if(p.position==='GK') output=clamp(p.saves*.05+(p.cleanSheet?.12:0),0,.35)
  else if(p.position==='CB'||p.position==='FB') output=clamp((p.tackles+p.interceptions)*.035+(p.cleanSheet?.08:0)+(p.goals+p.assists)*.06,0,.35)
  else if(p.position==='CM'||p.position==='WM') output=clamp(p.keyPasses*.045+(p.goals+p.assists)*.08,0,.35)
  else output=clamp(p.goals*.12+p.assists*.09+p.keyPasses*.025,0,.35)
  const minutes=clamp(p.minutes/90,0,1)
  return clamp((rating*.76+output)*minutes,0,1.15)
}

function statusFor(awareness:number,interest:number):AcademyScoutInterest['status']{
  if(interest>=76 && awareness>=55)return 'trial-ready'
  if(interest>=52)return 'watchlist'
  if(interest>=26)return 'monitoring'
  if(awareness>=8)return 'aware'
  return 'unknown'
}

function clubById(world:YouthWorld,id:string):AcademyClub|undefined{
  return world.academyClubs.find(c=>c.id===id)
}

export function applyScoutedPerformance(world: YouthWorld, perf: ScoutPerformance): YouthWorld {
  const attendance=scoutsAttending(world,{
    week:perf.week, competition:perf.competition, position:perf.position,
    playerTier:world.pathway.schoolTier,
    majorFixture:['school-cup','regional-selection','national-championship','showcase','academy-trial'].includes(perf.competition),
  })
  const seen=new Set(attendance.map(a=>a.clubId))
  const quality=positionalPerformance(perf)
  const importance=competitionScoutWeight(perf.competition)
  const nextInterest:{[id:string]:AcademyScoutInterest}={...world.scouting.academyInterest}

  for(const club of world.academyClubs){
    const old=nextInterest[club.id]??{clubId:club.id,awareness:0,interest:0,lastSeenWeek:null,matchesSeen:0,status:'unknown' as const}
    if(!seen.has(club.id)){
      const cooled=old.interest>0?Math.max(0,old.interest-.35):0
      nextInterest[club.id]={...old,interest:cooled,status:statusFor(old.awareness,cooled)}
      continue
    }
    const need=(club.positionNeeds[perf.position]??50)/100
    const awarenessGain=4+importance*8+quality*4
    const interestGain=(quality-.38)*10*(.65+importance*.6)*(.75+need*.5)
    const awareness=clamp(old.awareness+awarenessGain,0,100)
    const interest=clamp(old.interest+interestGain,0,100)
    nextInterest[club.id]={
      ...old, awareness, interest, lastSeenWeek:perf.week,
      matchesSeen:old.matchesSeen+1, status:statusFor(awareness,interest),
    }
  }

  const schoolDelta=['school-league','school-cup','minor-school-cup','friendly'].includes(perf.competition)?quality*(perf.competition==='friendly'?1.2:3.5):0
  const grassDelta=['sunday-league','sunday-cup'].includes(perf.competition)?quality*4.2:0
  const regionalDelta=['school-cup','regional-selection','national-championship'].includes(perf.competition)?quality*5.2:0
  const academyDelta=attendance.length?quality*(2+importance*5):0
  const visibleVisits=attendance.filter(a=>a.visibleToPlayer).map(a=>({
    week:perf.week,clubId:a.clubId,competition:perf.competition,reason:a.reason,
  }))

  const scouting={
    ...world.scouting,
    localVisibility:clamp(world.scouting.localVisibility+schoolDelta*.5+grassDelta*.8,0,100),
    schoolReputation:clamp(world.scouting.schoolReputation+schoolDelta,0,100),
    grassrootsReputation:clamp(world.scouting.grassrootsReputation+grassDelta,0,100),
    regionalReputation:clamp(world.scouting.regionalReputation+regionalDelta,0,100),
    academyExposure:clamp(world.scouting.academyExposure+academyDelta,0,100),
    academyInterest:nextInterest,
    knownScoutVisits:[...world.scouting.knownScoutVisits,...visibleVisits].slice(-40),
  }

  const maxInterest=Math.max(0,...Object.values(nextInterest).map(x=>x.interest))
  const maxAware=Math.max(0,...Object.values(nextInterest).map(x=>x.awareness))
  let academyStatus=world.pathway.academyStatus
  if(academyStatus==='none' && (maxAware>=18 || scouting.academyExposure>=18))academyStatus='monitored'
  if((academyStatus==='monitored'||academyStatus==='none') && maxInterest>=76 && maxAware>=55)academyStatus='trial-invited'

  return {
    ...world,currentWeek:Math.max(world.currentWeek,perf.week),
    scouting,
    pathway:{
      ...world.pathway,
      academyStatus,
      exposure:{
        ...world.pathway.exposure,
        school:scouting.schoolReputation,
        grassroots:scouting.grassrootsReputation,
        regional:scouting.regionalReputation,
        academy:scouting.academyExposure,
      },
    },
  }
}

export function academyTrialInvites(world:YouthWorld):AcademyClub[]{
  return Object.values(world.scouting.academyInterest)
    .filter(i=>i.status==='trial-ready'&&i.matchesSeen>=2)
    .sort((a,b)=>b.interest-a.interest)
    .map(i=>clubById(world,i.clubId))
    .filter((x):x is AcademyClub=>!!x)
    .slice(0,3)
}

export function scoutingSummary(world:YouthWorld){
  const interests=Object.values(world.scouting.academyInterest)
  return {
    knownScoutVisits:world.scouting.knownScoutVisits.length,
    monitoring:interests.filter(i=>i.status==='monitoring').length,
    watchlists:interests.filter(i=>i.status==='watchlist').length,
    trialReady:interests.filter(i=>i.status==='trial-ready').length,
    topInterest:interests.sort((a,b)=>b.interest-a.interest)[0]??null,
  }
}
