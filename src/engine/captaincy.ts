import type { Player } from '../types/player'

export type CaptaincyRole='none'|'vice-captain'|'captain'
export interface CaptaincyState { role:CaptaincyRole; matchesAsCaptain:number; matchesAsViceCaptain:number; appointedWeek:number|null; pendingStory?:CaptaincyStory|null }
export interface CaptaincyStory { kind:'vice-appointed'|'captain-appointed'|'captain-demoted'|'leadership-removed'; title:string; body:string }

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
 const dressing=standing?clamp((standing.teammates??0)/10,-10,10):0
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
 let pendingStory=prev.pendingStory??null
 if(role!==prev.role){
  pendingStory=role==='captain'?{kind:'captain-appointed',title:'The Armband',body:'The coach pulls you aside after training. You have earned the trust of the dressing room. From now on, you lead the team as captain.'}
   :role==='vice-captain'&&prev.role==='none'?{kind:'vice-appointed',title:'Leadership Group',body:'The coach asks you to stay behind. Your consistency has been noticed — you are joining the leadership group as vice-captain.'}
   :role==='vice-captain'?{kind:'captain-demoted',title:'A Difficult Conversation',body:'The coach tells you the armband is changing hands. You remain vice-captain, but you will need to rebuild your standing to lead the side again.'}
   :{kind:'leadership-removed',title:'Leadership Change',body:'The coach removes you from the leadership group. Your place can be earned back through consistency and trust.'}
 }
 return {...prev,role,appointedWeek:role!==prev.role?(player.totalWeeksElapsed??0):prev.appointedWeek,pendingStory}
}

export function recordCaptainAppearance(state:CaptaincyState):CaptaincyState{
 if(state.role==='captain')return {...state,matchesAsCaptain:state.matchesAsCaptain+1}
 if(state.role==='vice-captain')return {...state,matchesAsViceCaptain:state.matchesAsViceCaptain+1}
 return state
}

export function clearCaptaincyStory(state:CaptaincyState):CaptaincyState{return {...state,pendingStory:null}}
