import type { Position } from '../types/attributes'
import type { PlayerMatchStats } from './matchStats'

const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v))
export interface RatingBreakdown {
  base:number; decisions:number; execution:number; attacking:number; defending:number; background:number; cleanSheet:number; discipline:number; total:number
}

/**
 * V3.2 transparent rating ledger.
 * Calibrated around the measured playable-moment frequency (~5 per match;
 * FB ~7). Decision/execution use AVERAGE quality, not raw moment count, so a
 * position cannot farm rating simply because the engine surfaces more moments.
 * Major football outcomes and position-relevant background work are then
 * credited separately with hard caps.
 */
export function calculatePlayerRating(args:{
 position:Position; stats:PlayerMatchStats; decisionQuality:number; executionQuality:number;
 ratedMoments:number; minutes:number; yellowCards?:number; redCarded?:boolean
}):RatingBreakdown{
 const {position:s,stats:x}=args
 const minutes=Math.max(1,args.minutes), scale=clamp(minutes/90,.25,1)
 const base=6
 // A perfect set of decisions is worth about +0.9; consistently poor choices
 // can cost about the same. This is the heart of a key-moment game.
 const decisions=args.ratedMoments ? clamp((args.decisionQuality-.50)*1.8,-.90,.90) : 0
 const execution=args.ratedMoments ? clamp((args.executionQuality-.60)*1.0,-.45,.40) : 0

 let attacking=0,defending=0,background=0,cleanSheet=0
 // Explicit major events. They matter for everyone, but cannot alone create 10.0.
 attacking += Math.min(1.35,x.goals*.45)
 attacking += Math.min(.96,x.assists*.32)

 if(s==='ST'){ background+=Math.min(.28,x.shotsOnTarget*.055)+Math.min(.18,x.keyPasses*.035) }
 if(s==='WG'){ background+=Math.min(.26,x.dribblesCompleted*.035)+Math.min(.24,x.keyPasses*.04)+Math.min(.16,x.progressiveRuns*.012) }
 if(s==='WM'){ background+=Math.min(.30,x.keyPasses*.045)+Math.min(.22,x.progressivePasses*.018)+Math.min(.16,x.dribblesCompleted*.025) }
 if(s==='CM'){ background+=Math.min(.34,x.keyPasses*.05)+Math.min(.28,x.progressivePasses*.018)+Math.min(.18,(x.interceptions+x.recoveries)*.018) }
 if(s==='FB'){ background+=Math.min(.22,x.progressiveRuns*.025)+Math.min(.20,x.keyPasses*.04); defending+=Math.min(.36,(x.tacklesWon+x.interceptions+x.blocks)*.055) }
 if(s==='CB'){ background+=Math.min(.16,x.progressivePasses*.016); defending+=Math.min(.58,(x.tacklesWon+x.interceptions+x.blocks+x.headersWon)*.06)+Math.min(.18,x.clearances*.025) }
 if(s==='GK'){
   defending+=Math.min(.70,x.saves*.10)+Math.min(.45,x.highDifficultySaves*.15)+Math.min(.45,x.penaltySaves*.45)
   if(x.shotsFaced>=3){const pct=x.saves/Math.max(1,x.shotsFaced);defending+=clamp((pct-.67)*.9,-.28,.22)}
   background+=Math.min(.18,x.distributionCompleted*.006)
 }
 // Clean sheets are meaningful for the defensive unit. Full credit requires
 // meaningful minutes; cameo clean sheets cannot be farmed.
 if(x.goalsConceded===0){
   const minuteFactor=clamp(minutes/75,0,1)
   if(s==='GK') cleanSheet=.30*minuteFactor
   else if(s==='CB') cleanSheet=.25*minuteFactor
   else if(s==='FB') cleanSheet=.20*minuteFactor
 }
 if((s==='GK'||s==='CB'||s==='FB')&&x.goalsConceded>=3) defending-=Math.min(.65,(x.goalsConceded-2)*.16)
 const discipline=-(args.redCarded?.55:0)-Math.min(.24,(args.yellowCards??0)*.12)
 // Background contribution is deliberately capped: the few decisions the
 // player actually makes remain the main controllable source of rating.
 background=clamp(background,-.25,.65)*scale
 attacking*=scale;defending*=scale;cleanSheet*=scale
 const total=Number(clamp(base+decisions+execution+attacking+defending+background+cleanSheet+discipline,1,10).toFixed(1))
 return {base,decisions,execution,attacking,defending,background,cleanSheet,discipline,total}
}
