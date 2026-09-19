import type { Position } from '../types/attributes'
import type { YouthNpcPlayer, YouthWorld } from '../types/youthWorld'

export type RegionalCampStage='longlist-60'|'cut-35'|'final-23'|'complete'
export type CampAssessmentKind='technical'|'position-test'|'small-sided'|'trial-match'

export interface RegionalTrialist extends YouthNpcPlayer {
  schoolId:string
  regionId:string
  campScore:number
  assessmentScores:Partial<Record<CampAssessmentKind,number>>
  selected:boolean
  rejectionReason?:string
}
export interface RegionalCamp {
  regionId:string
  startedWeek:number
  stage:RegionalCampStage
  trialists:RegionalTrialist[]
  userPlayerId:string
  finalSquadIds:string[]
}

const FIRST=['Thabo','Musa','Liam','Neo','Ethan','Kabelo','Jayden','Noah','Amir','Kofi','Leo','Mateo','Lucas','Yusuf','Daniel','Siyabonga','Aiden','Tariq']
const LAST=['Mokoena','Dlamini','Jacobs','Smith','Nkosi','Williams','Naidoo','Khumalo','Mensah','Diallo','Santos','Martinez','Clarke','Meyer','Costa','Jansen']
const POS:Position[]=['GK','GK','GK','GK','CB','CB','CB','CB','CB','CB','FB','FB','FB','FB','CM','CM','CM','CM','CM','WM','WM','WG','WG','WG','ST','ST','ST','ST','ST','CB']

function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rnd(seed:string){let x=hash(seed)||1;return()=>{x=Math.imul(x^x>>>15,1|x);x^=x+Math.imul(x^x>>>7,61|x);return((x^x>>>14)>>>0)/4294967296}}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))

function positionalLimits(size:35|23):Record<string,number>{
  return size===23?{GK:3,CB:4,FB:4,CM:4,WM:2,WG:3,ST:3}:{GK:4,CB:6,FB:5,CM:6,WM:3,WG:5,ST:6}
}

function cutByPosition(players:RegionalTrialist[],size:35|23):RegionalTrialist[]{
  const limits=positionalLimits(size),picked:RegionalTrialist[]=[]
  for(const [position,limit] of Object.entries(limits)){
    picked.push(...players.filter(p=>p.position===position).sort((a,b)=>b.campScore-a.campScore).slice(0,limit))
  }
  // Fill rare unallocated slots by merit without violating goalkeeper logic.
  for(const p of [...players].sort((a,b)=>b.campScore-a.campScore)){
    if(picked.length>=size)break
    if(!picked.some(x=>x.id===p.id))picked.push(p)
  }
  return picked.slice(0,size)
}

export function createRegionalCamp(world:YouthWorld,regionId:string,user:{id:string;name:string;age:number;position:Position;overall:number;schoolId:string},week:number):RegionalCamp{
  const r=rnd(`${world.seed}|regional-camp|${regionId}`)
  const eligibleSchools=world.schools.filter(s=>s.districtId.includes(regionId)||world.schools.length<80)
  const schools=eligibleSchools.length?eligibleSchools:world.schools
  const npcs:RegionalTrialist[]=Array.from({length:59},(_,i)=>{
    const school=schools[i%schools.length]
    const overall=clamp(Math.round(42+r()*24+school.footballRating*.08),38,72)
    return{id:`regional-${regionId}-${i}`,name:`${FIRST[Math.floor(r()*FIRST.length)]} ${LAST[Math.floor(r()*LAST.length)]}`,age:14+Math.floor(r()*4),position:POS[i%POS.length],overall,potentialBand:r()>.92?'elite':r()>.7?'high':'normal',form:5.6+r()*2.2,energy:88+Math.round(r()*12),squadTier:'first-team',schoolId:school.id,regionId,campScore:overall*.62+(5.6+r()*2.2)*4.8,assessmentScores:{},selected:false}
  })
  const userTrialist:RegionalTrialist={id:user.id,name:user.name,age:user.age,position:user.position,overall:user.overall,potentialBand:'high',form:6.5,energy:100,squadTier:'first-team',schoolId:user.schoolId,regionId,campScore:user.overall*.62+31,assessmentScores:{},selected:false}
  return{regionId,startedWeek:week,stage:'longlist-60',trialists:[userTrialist,...npcs],userPlayerId:user.id,finalSquadIds:[]}
}

export function recordCampAssessment(camp:RegionalCamp,playerId:string,kind:CampAssessmentKind,score:number):RegionalCamp{
  const trialists=camp.trialists.map(p=>{
    if(p.id!==playerId)return p
    const assessmentScores={...p.assessmentScores,[kind]:clamp(score,0,1)}
    const vals=Object.values(assessmentScores) as number[]
    const assessment=vals.reduce((a,b)=>a+b,0)/Math.max(1,vals.length)
    return{...p,assessmentScores,campScore:p.overall*.38+p.form*3.2+assessment*45}
  })
  return{...camp,trialists}
}

export function simulateNpcCampAssessments(camp:RegionalCamp,world:YouthWorld,stage:number):RegionalCamp{
  const r=rnd(`${world.seed}|${camp.regionId}|camp-stage-${stage}`)
  return{...camp,trialists:camp.trialists.map(p=>{
    if(p.id===camp.userPlayerId)return p
    const assessmentScores={...p.assessmentScores,technical:clamp(.25+p.overall/100*.62+(r()-.5)*.2,0,1),'position-test':clamp(.2+p.overall/100*.68+(r()-.5)*.22,0,1),...(stage>=2?{'small-sided':clamp(.18+p.form/10*.72+(r()-.5)*.22,0,1),'trial-match':clamp(.2+p.form/10*.72+(r()-.5)*.25,0,1)}:{})}
    const vals=Object.values(assessmentScores) as number[],assessment=vals.reduce((a,b)=>a+b,0)/vals.length
    return{...p,assessmentScores,campScore:p.overall*.38+p.form*3.2+assessment*45}
  })}
}

export function advanceRegionalCamp(camp:RegionalCamp):RegionalCamp{
  if(camp.stage==='longlist-60'){
    const selected=cutByPosition(camp.trialists,35),ids=new Set(selected.map(p=>p.id))
    return{...camp,stage:'cut-35',trialists:camp.trialists.map(p=>ids.has(p.id)?{...p,selected:true}:{...p,selected:false,rejectionReason:'Other players ranked higher in your position after the first assessment phase.'})}
  }
  if(camp.stage==='cut-35'){
    const alive=camp.trialists.filter(p=>p.selected),selected=cutByPosition(alive,23),ids=new Set(selected.map(p=>p.id))
    return{...camp,stage:'final-23',finalSquadIds:selected.map(p=>p.id),trialists:camp.trialists.map(p=>ids.has(p.id)?{...p,selected:true}:{...p,selected:false,rejectionReason:p.rejectionReason??'The final squad had limited positional places and stronger camp performances.'})}
  }
  if(camp.stage==='final-23')return{...camp,stage:'complete'}
  return camp
}

export function userCampStanding(camp:RegionalCamp){
  const user=camp.trialists.find(p=>p.id===camp.userPlayerId)
  if(!user)return null
  const same=camp.trialists.filter(p=>p.position===user.position).sort((a,b)=>b.campScore-a.campScore)
  return{rank:same.findIndex(p=>p.id===user.id)+1,total:same.length,score:user.campScore,selected:user.selected,rejectionReason:user.rejectionReason}
}
