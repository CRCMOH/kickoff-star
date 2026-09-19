import type { YouthOffer } from './youthTransfersV4'
export interface GrassrootsContract{clubId:string;clubName:string;division:1|2|3;weeklyWage:number;season:number;status:'active'|'expired'|'released'}
const bands={3:[10,15],2:[20,30],1:[35,50]} as const
export function grassrootsWage(division:1|2|3,standing:number){const [lo,hi]=bands[division];return Math.round(lo+(hi-lo)*Math.max(0,Math.min(1,standing/100)))}
export function signGrassrootsSeason(clubId:string,clubName:string,division:1|2|3,season:number,standing:number):GrassrootsContract{return{clubId,clubName,division,season,weeklyWage:grassrootsWage(division,standing),status:'active'}}
export function seasonBoundaryOffers(current:GrassrootsContract,candidates:YouthOffer[],promoted:boolean){return{current:{...current,status:'expired' as const},offers:candidates,division:promoted?Math.max(1,current.division-1) as 1|2|3:current.division}}
export const transferWindowOpen=(week:number)=>week===44||week===1
