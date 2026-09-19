import type { Position } from '../types/attributes'
import type { AcademyClub, YouthWorld } from '../types/youthWorld'

export type AcademyAssessmentKind = 'technical' | 'pressure' | 'trial-match' | 'final-match' | 'retest'
export type AcademyOfferStatus = 'pending' | 'negotiating' | 'accepted' | 'declined' | 'expired'
export type AcademyAssessmentWeek = 1 | 2 | 3

export interface AcademyAssessmentSession {
  week: AcademyAssessmentWeek
  kind: AcademyAssessmentKind
  technical: number
  match: number
  discipline: number
  consistency: number
  note: string
}

export interface AcademyTrialCampaign {
  clubId: string
  startedWeek: number
  playerAge: number
  invitationWindow: 'october-year-three'
  sessions: AcademyAssessmentSession[]
  complete: boolean
  passed: boolean | null
  finalScore: number | null
  vacancyScore: number | null
}

export interface AcademyOfferV4 {
  id: string
  clubId: string
  clubName: string
  country: string
  prestige: number
  coaching: number
  facilities: number
  scholarship: number
  pathwayPromise: 'development' | 'rotation-track' | 'fast-track'
  expiresWeek: number
  status: AcademyOfferStatus
  interest: number
}

function clamp(v:number,lo:number,hi:number){return Math.max(lo,Math.min(hi,v))}
function roll(world:YouthWorld,salt:string){let h=2166136261;const s=world.seed+'|academy-v4|'+salt;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0)/4294967295}
function positionNeed(club:AcademyClub,position:Position){return(club.positionNeeds[position]??50)/100}

export function academyAssessmentEligible(world:YouthWorld,clubId:string,playerAge:number,calendarMonth:number):boolean {
  const interest=world.scouting.academyInterest[clubId]
  return playerAge>=16&&calendarMonth===10&&!!interest&&interest.status==='trial-ready'&&interest.matchesSeen>=3&&interest.awareness>=35&&interest.interest>=45
}

export function startAcademyTrial(world:YouthWorld,clubId:string,week:number,playerAge=16,calendarMonth=10):AcademyTrialCampaign|null {
  if(!academyAssessmentEligible(world,clubId,playerAge,calendarMonth))return null
  return {clubId,startedWeek:week,playerAge,invitationWindow:'october-year-three',sessions:[],complete:false,passed:null,finalScore:null,vacancyScore:null}
}

/**
 * Three-week academy assessment.
 * Week 1: position-relevant technical testing.
 * Week 2: pressure work, small-sided scenarios and a trial match.
 * Week 3: final trial match plus a targeted retest.
 *
 * Inputs are 0..1 scores produced by the playable mini-games/match layer.
 * Final weighting is locked to the V5 design:
 * technical 30%, trial matches 45%, decisions/discipline 15%, consistency 10%.
 */
export function recordAcademyTrialSession(
  world:YouthWorld,
  campaign:AcademyTrialCampaign,
  assessmentWeek:AcademyAssessmentWeek,
  kind:AcademyAssessmentKind,
  scores:{technical:number;match:number;discipline:number;consistency:number},
  position:Position,
):AcademyTrialCampaign {
  if(campaign.complete||campaign.sessions.some(s=>s.week===assessmentWeek&&s.kind===kind))return campaign
  const club=world.academyClubs.find(c=>c.id===campaign.clubId)
  if(!club)return campaign
  const pressure=.94+club.prestige/1200
  const need=.94+positionNeed(club,position)*.12
  const adj=(v:number)=>clamp(v*need/pressure,0,1)
  const session:AcademyAssessmentSession={
    week:assessmentWeek,kind,
    technical:adj(scores.technical),match:adj(scores.match),
    discipline:adj(scores.discipline),consistency:adj(scores.consistency),
    note:'Assessment saved. Coaches will compare this against the positional pool.',
  }
  const sessions=[...campaign.sessions,session]
  const hasW1=sessions.some(s=>s.week===1&&s.kind==='technical')
  const hasW2=sessions.some(s=>s.week===2&&s.kind==='pressure')&&sessions.some(s=>s.week===2&&s.kind==='trial-match')
  const hasW3=sessions.some(s=>s.week===3&&s.kind==='final-match')&&sessions.some(s=>s.week===3&&s.kind==='retest')
  const complete=hasW1&&hasW2&&hasW3
  if(!complete)return{...campaign,sessions}

  const avg=(key:keyof Pick<AcademyAssessmentSession,'technical'|'match'|'discipline'|'consistency'>)=>{
    const relevant=sessions.map(s=>s[key] as number).filter(v=>v>0)
    return relevant.length?relevant.reduce((a,b)=>a+b,0)/relevant.length:0
  }
  const finalScore=clamp(avg('technical')*.30+avg('match')*.45+avg('discipline')*.15+avg('consistency')*.10,0,1)
  const vacancyScore=positionNeed(club,position)
  const passLine=clamp(.57+(club.prestige-80)*.004-vacancyScore*.07,.53,.68)
  return{...campaign,sessions,complete:true,passed:finalScore>=passLine,finalScore,vacancyScore}
}

function offerScore(world:YouthWorld,club:AcademyClub,trialScore:number,position:Position,index:number){
  const scout=world.scouting.academyInterest[club.id]
  return trialScore*.48+((scout?.interest??0)/100)*.24+((scout?.awareness??0)/100)*.08+positionNeed(club,position)*.14+roll(world,`offer-${club.id}-${index}`)*.14
}

/** Passing creates scholarship negotiations; it never transfers the player immediately. */
export function generateAcademyOffers(world:YouthWorld,campaign:AcademyTrialCampaign,position:Position,week:number):AcademyOfferV4[]{
  if(!campaign.complete||!campaign.passed||campaign.finalScore===null)return[]
  const trialClub=world.academyClubs.find(c=>c.id===campaign.clubId)
  if(!trialClub)return[]
  const scored=world.academyClubs.map((club,index)=>{
    let score=offerScore(world,club,campaign.finalScore!,position,index)
    if(club.id===campaign.clubId)score+=.16
    if(club.region===trialClub.region)score+=.025
    return{club,score}
  }).sort((a,b)=>b.score-a.score)
  const qualified=scored.filter(x=>x.score>=.49)
  const pool=qualified.length>=3?qualified:scored
  const desired=clamp(3+Math.floor(campaign.finalScore*4),3,6)
  return pool.slice(0,desired).map(({club,score})=>({
    id:`academy-offer-${week}-${club.id}`,clubId:club.id,clubName:club.name,country:club.region,
    prestige:club.prestige,coaching:club.coaching,facilities:club.facilities,
    scholarship:Math.round((35+club.prestige*.9+score*75)/5)*5,
    pathwayPromise:score>=.82?'fast-track':score>=.66?'rotation-track':'development',
    expiresWeek:week+2,status:'pending',interest:Math.round(clamp(score,0,1)*100),
  }))
}

export function expireAcademyOffers(offers:AcademyOfferV4[],week:number):AcademyOfferV4[]{return offers.map(o=>o.status==='pending'&&week>o.expiresWeek?{...o,status:'expired' as const}:o)}
export function chooseAcademyOffer(offers:AcademyOfferV4[],offerId:string):AcademyOfferV4[]{return offers.map(o=>o.id===offerId&&o.status==='pending'?{...o,status:'negotiating' as const}:o.status==='pending'?{...o,status:'declined' as const}:o)}
