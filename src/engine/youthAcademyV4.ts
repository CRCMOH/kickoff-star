import type { Position } from '../types/attributes'
import type { AcademyClub, YouthWorld } from '../types/youthWorld'

export type AcademyTrialSessionKind = 'technical' | 'small-sided' | 'tactical' | 'full-match'
export type AcademyOfferStatus = 'pending' | 'negotiating' | 'accepted' | 'declined' | 'expired'

export interface AcademyTrialSession {
  week: number
  kind: AcademyTrialSessionKind
  score: number
  note: string
}

export interface AcademyTrialCampaign {
  clubId: string
  startedWeek: number
  sessions: AcademyTrialSession[]
  complete: boolean
  finalScore: number | null
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

function roll(world: YouthWorld, salt: string): number {
  let h=2166136261
  const s=world.seed+'|academy-v4|'+salt
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0)/4294967295
}

function positionNeed(club:AcademyClub, position:Position):number {
  return (club.positionNeeds[position]??50)/100
}

export function startAcademyTrial(world:YouthWorld, clubId:string, week:number):AcademyTrialCampaign|null {
  const club=world.academyClubs.find(c=>c.id===clubId)
  const interest=world.scouting.academyInterest[clubId]
  if(!club||!interest||interest.status!=='trial-ready'||interest.matchesSeen<2)return null
  return {clubId,startedWeek:week,sessions:[],complete:false,finalScore:null}
}

/**
 * A trial is four interactive football sessions. The UI supplies a 0..1
 * performance result from the existing gameplay/drill layer; the academy
 * engine weights each day differently so one bad drill does not kill a career.
 */
export function recordAcademyTrialSession(
  world:YouthWorld,
  campaign:AcademyTrialCampaign,
  week:number,
  kind:AcademyTrialSessionKind,
  rawPerformance:number,
  position:Position,
):AcademyTrialCampaign {
  if(campaign.complete||campaign.sessions.some(s=>s.kind===kind))return campaign
  const club=world.academyClubs.find(c=>c.id===campaign.clubId)
  if(!club)return campaign
  const need=positionNeed(club,position)
  const pressure=.92+club.prestige/900
  const adjusted=clamp(rawPerformance*(.9+need*.18)/pressure,0,1)
  const note=adjusted>=.78?'You stood out.'
    : adjusted>=.62?'A strong session.'
    : adjusted>=.46?'You stayed in the conversation.'
    :'You have work to do in the remaining sessions.'
  const sessions=[...campaign.sessions,{week,kind,score:adjusted,note}]
  const complete=sessions.length>=4
  const weights:Record<AcademyTrialSessionKind,number>={technical:.2,'small-sided':.24,tactical:.2,'full-match':.36}
  const total=sessions.reduce((n,s)=>n+s.score*weights[s.kind],0)
  const used=sessions.reduce((n,s)=>n+weights[s.kind],0)
  return {...campaign,sessions,complete,finalScore:complete?clamp(total/used,0,1):null}
}

function offerScore(world:YouthWorld,club:AcademyClub,trialScore:number,position:Position,index:number){
  const scout=world.scouting.academyInterest[club.id]
  const interest=(scout?.interest??0)/100
  const awareness=(scout?.awareness??0)/100
  const need=positionNeed(club,position)
  const variance=roll(world,`offer-${club.id}-${index}`)*.14
  return trialScore*.48+interest*.24+awareness*.08+need*.14+variance
}

/**
 * After a completed academy trial, produce 3-6 offers from the global academy
 * network. The trial club gets a home-club boost, but other clubs can enter
 * after watching the trial/showcase. Prestige alone never guarantees an offer.
 */
export function generateAcademyOffers(
  world:YouthWorld,
  campaign:AcademyTrialCampaign,
  position:Position,
  week:number,
):AcademyOfferV4[] {
  if(!campaign.complete||campaign.finalScore===null)return []
  const trialClub=world.academyClubs.find(c=>c.id===campaign.clubId)
  if(!trialClub)return []
  const ranked=world.academyClubs
    .map((club,index)=>{
      let score=offerScore(world,club,campaign.finalScore!,position,index)
      if(club.id===campaign.clubId)score+=.16
      if(club.region===trialClub.region)score+=.025
      return {club,score}
    })
    .filter(x=>x.score>=.49)
    .sort((a,b)=>b.score-a.score)

  // Locked design: a successful trial phase should create a real decision,
  // minimum 3 and maximum 6. If the threshold produced fewer than three, the
  // best scouting fits fill the remaining slots rather than inventing clubs.
  const pool=ranked.length>=3?ranked:world.academyClubs
    .map((club,index)=>({club,score:offerScore(world,club,campaign.finalScore!,position,index)+(club.id===campaign.clubId ? .16 : 0)}))
    .sort((a,b)=>b.score-a.score)
  const desired=clamp(3+Math.floor(campaign.finalScore*4),3,6)
  const unique=pool.filter((x,i,a)=>a.findIndex(y=>y.club.id===x.club.id)===i).slice(0,desired)

  return unique.map(({club,score},i)=>{
    const scholarship=Math.round((35+club.prestige*.9+score*75)/5)*5
    const pathwayPromise:AcademyOfferV4['pathwayPromise']=score>=.82?'fast-track':score>=.66?'rotation-track':'development'
    return {
      id:`academy-offer-${week}-${club.id}`,clubId:club.id,clubName:club.name,country:club.region,
      prestige:club.prestige,coaching:club.coaching,facilities:club.facilities,scholarship,
      pathwayPromise,expiresWeek:week+2,status:'pending',interest:Math.round(clamp(score,0,1)*100),
    }
  })
}

export function expireAcademyOffers(offers:AcademyOfferV4[],week:number):AcademyOfferV4[]{
  return offers.map(o=>o.status==='pending'&&week>o.expiresWeek?{...o,status:'expired' as const}:o)
}

export function chooseAcademyOffer(offers:AcademyOfferV4[],offerId:string):AcademyOfferV4[]{
  return offers.map(o=>o.id===offerId&&o.status==='pending'
    ?{...o,status:'negotiating' as const}
    :o.status==='pending'?{...o,status:'declined' as const}:o)
}
