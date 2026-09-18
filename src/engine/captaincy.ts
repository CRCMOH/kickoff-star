import type { Player } from '../types/player'

export type CaptaincyRole='none'|'vice-captain'|'captain'
export interface CaptaincyState { role:CaptaincyRole; matchesAsCaptain:number; matchesAsViceCaptain:number; appointedWeek:number|null }

const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v))

/**
 * Captaincy is earned, never selected by the player. Coach trust is the
 * strongest signal; tenure, role, form, standing and discipline provide
 * supporting evidence. Academy captains require a higher bar than vice-captains.
 */
export function captaincyScore(player:Player):number{
 const ratings=player.seasonRatings??[]
 const recent=ratings.slice(-6)
 const form=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:6
 const trust=clamp(player.coachTrust??0,-10,10)
 const tenure=Math.min(18,(player.seasonAppearances??0)*1.2)
 const role=player.squadRole==='starting-xi'?14:player.squadRole==='bench'?5:0
 const standing=player.standing
 const dressing=standing?clamp(((standing.teammates??0)+(standing.coach??0))/2,-10,10):0
 const discipline=(player.suspensionMatches??0)>0?-14:0
 return trust*2.2+tenure+role+(form-6)*9+dressing*1.1+discipline
}

export function evaluateCaptaincy(player:Player,current?:CaptaincyState):CaptaincyState{
 const prev=current??{role:'none',matchesAsCaptain:0,matchesAsViceCaptain:0,appointedWeek:null}
 const score=captaincyScore(player)
 let role:CaptaincyRole=prev.role
 // Promotion requires sustained status. Demotion has hysteresis so one poor
 // week cannot constantly take the armband away.
 if(role==='none'&&score>=42&&(player.seasonAppearances??0)>=8)role='vice-captain'
 else if(role==='vice-captain'&&score>=60&&(player.seasonAppearances??0)>=10)role='captain'
 else if(role==='captain'&&score<34)role='vice-captain'
 else if(role==='vice-captain'&&score<22)role='none'
 return {...prev,role,appointedWeek:role!==prev.role?(player.totalWeeksElapsed??0):prev.appointedWeek}
}

export function recordCaptainAppearance(state:CaptaincyState):CaptaincyState{
 if(state.role==='captain')return {...state,matchesAsCaptain:state.matchesAsCaptain+1}
 if(state.role==='vice-captain')return {...state,matchesAsViceCaptain:state.matchesAsViceCaptain+1}
 return state
}
