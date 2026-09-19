export type OfferType='school-scholarship'|'grassroots-contract'
export interface YouthOffer {
  id:string;type:OfferType;teamId:string;teamName:string;week:number;expiresWeek:number
  role:'development'|'rotation'|'starter';travelSupport:number;equipmentSupport:number;monthlySupport:number
  educationSupport:number;developmentRating:number;status:'pending'|'accepted'|'declined'|'expired'
}
export interface YouthOfferCandidate {id:string;name:string;developmentRating:number;distance:number;educationRating?:number;strength:number}

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))
export function generateYouthOffers(type:OfferType,candidates:YouthOfferCandidate[],week:number,profile:{rating:number;exposure:number;age:number}):YouthOffer[]{
  const count=clamp(Math.floor(1+profile.exposure/28+(profile.rating>=7.6?1:0)),1,type==='school-scholarship'?4:5)
  return [...candidates].sort((a,b)=>(b.developmentRating+b.strength*.5-a.distance*.18)-(a.developmentRating+a.strength*.5-b.distance*.18)).slice(0,count).map((c)=>{
    const leverage=clamp((profile.rating-6)*18+profile.exposure*.35+c.developmentRating*.2,15,100)
    return{id:`${type}-${week}-${c.id}`,type,teamId:c.id,teamName:c.name,week,expiresWeek:week+2,
      role:leverage>=74?'starter':leverage>=52?'rotation':'development',
      travelSupport:Math.round((8+leverage*.18)/5)*5,equipmentSupport:Math.round((10+leverage*.24)/5)*5,
      monthlySupport:type==='grassroots-contract'?Math.round((15+leverage*.45)/5)*5:0,
      educationSupport:type==='school-scholarship'?Math.round((c.educationRating??50)*.5+leverage*.25):0,
      developmentRating:c.developmentRating,status:'pending'}
  })
}
export function acceptYouthOffer(offers:YouthOffer[],id:string){return offers.map(o=>o.id===id&&o.status==='pending'?{...o,status:'accepted' as const}:o.status==='pending'?{...o,status:'declined' as const}:o)}
export function expireYouthOffers(offers:YouthOffer[],week:number){return offers.map(o=>o.status==='pending'&&week>o.expiresWeek?{...o,status:'expired' as const}:o)}
