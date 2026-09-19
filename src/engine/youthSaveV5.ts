export const YOUTH_SAVE_VERSION=5
export interface YouthSaveEnvelope<T=unknown>{version:number;savedAt:string;payload:T}
export function wrapYouthSave<T>(payload:T):YouthSaveEnvelope<T>{return{version:YOUTH_SAVE_VERSION,savedAt:new Date().toISOString(),payload}}
export function migrateYouthSave(raw:any):YouthSaveEnvelope<any>{
 if(raw?.version===YOUTH_SAVE_VERSION&&raw.payload)return raw
 const payload=raw?.payload??raw??{}
 // V3/V4 saves remain playable. New systems initialise lazily so migration
 // never fabricates career results, offers, awards or academy achievements.
 return{version:YOUTH_SAVE_VERSION,savedAt:raw?.savedAt??new Date().toISOString(),payload:{
   ...payload,
   v5:payload.v5??{},
   competitionStats:payload.competitionStats??{},
   gazetteStories:payload.gazetteStories??[],
   youthOffers:payload.youthOffers??[],
   academyNegotiation:payload.academyNegotiation??null,
   careerSummary:payload.careerSummary??null,
 }}
}
