import type { YouthOffer, YouthOfferCandidate } from './youthTransfersV4'
import { generateYouthOffers } from './youthTransfersV4'
export interface ScholarshipWindow{week:number;regionId:string;offers:YouthOffer[];open:boolean}
export function schoolScholarshipWindow(week:number,regionId:string,candidates:YouthOfferCandidate[],profile:{rating:number;exposure:number;age:number}):ScholarshipWindow{
 const sameRegion=candidates.filter(c=>c.id.includes(regionId))
 const exceptional=profile.rating>=8.1||profile.exposure>=82
 const pool=exceptional?candidates:sameRegion.length?sameRegion:candidates.slice(0,6)
 return{week,regionId,offers:generateYouthOffers('school-scholarship',pool,week,profile),open:true}
}
export function closeScholarshipWindow(w:ScholarshipWindow){return{...w,open:false}}
