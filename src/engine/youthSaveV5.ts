export const YOUTH_SAVE_VERSION=5
export interface YouthSaveEnvelope<T=unknown>{version:number;savedAt:string;payload:T}
export type LegacyRouteChoice='school'|'grassroots'
export interface LegacyMigrationAssessment{needsRouteChoice:boolean;reason:string|null;suggestedRoute:LegacyRouteChoice|null}
export function wrapYouthSave<T>(payload:T):YouthSaveEnvelope<T>{return{version:YOUTH_SAVE_VERSION,savedAt:new Date().toISOString(),payload}}
export function assessLegacyRoute(raw:any):LegacyMigrationAssessment{
 const p=raw?.payload??raw??{}, route=p?.youthWorld?.pathway?.route??p?.player?.youthRoute
 if(route==='school'||route==='grassroots')return{needsRouteChoice:false,reason:null,suggestedRoute:route}
 if(route==='school-and-sunday'||route==='sunday-only'||(!route&&p?.youthWorld))return{needsRouteChoice:true,reason:'This career was created before V5 separated School and Grassroots into exclusive pathways.',suggestedRoute:route==='sunday-only'?'grassroots':null}
 return{needsRouteChoice:false,reason:null,suggestedRoute:null}
}
export function migrateYouthSave(raw:any,routeChoice?:LegacyRouteChoice):YouthSaveEnvelope<any>{
 if(raw?.version===YOUTH_SAVE_VERSION&&raw.payload)return raw
 const payload=raw?.payload??raw??{}, assessment=assessLegacyRoute(raw)
 if(assessment.needsRouteChoice&&!routeChoice)throw new Error('V5_ROUTE_CHOICE_REQUIRED')
 const chosen=routeChoice??assessment.suggestedRoute
 const youthWorld=payload.youthWorld&&chosen?{...payload.youthWorld,pathway:{...payload.youthWorld.pathway,route:chosen,sundayClubId:chosen==='school'?null:payload.youthWorld.pathway?.sundayClubId??null}}:payload.youthWorld
 const player=payload.player&&chosen?{...payload.player,youthRoute:chosen}:payload.player
 return{version:YOUTH_SAVE_VERSION,savedAt:raw?.savedAt??new Date().toISOString(),payload:{
   ...payload,player,youthWorld,v5:payload.v5??{},competitionStats:payload.competitionStats??{},gazetteStories:payload.gazetteStories??[],youthOffers:payload.youthOffers??[],academyNegotiation:payload.academyNegotiation??null,careerSummary:payload.careerSummary??null,
 }}
}
