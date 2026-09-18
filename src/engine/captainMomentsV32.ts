import type { MatchState } from './match'

export interface CaptainMoment {
 id:'rally'|'calm'|'demand-focus'|'protect-lead'
 situation:string
 options:{label:string;momentum:number;ratingQuality:number}[]
}

/** Leadership moments are situational and modest: the armband creates agency,
 * not a hidden win button. At most one should be surfaced per match by UI. */
export function captainMomentFor(state:MatchState):CaptainMoment|null{
 const playerScore=state.playerIsHome?state.homeScore:state.awayScore
 const oppScore=state.playerIsHome?state.awayScore:state.homeScore
 const diff=playerScore-oppScore
 if(state.minute>=70&&diff===-1)return {id:'rally',situation:'Your team is fading a goal down. The players look to you.',options:[
  {label:'Demand one last push',momentum:1.4,ratingQuality:.78},{label:'Keep everyone composed',momentum:.8,ratingQuality:.72},{label:'Take the game on yourself',momentum:.3,ratingQuality:.48}]}
 if(state.minute>=20&&state.minute<=65&&diff<=-2)return {id:'demand-focus',situation:'Heads are dropping after a brutal spell. As captain, you have to respond.',options:[
  {label:'Demand focus and shape',momentum:1.0,ratingQuality:.82},{label:'Fire everyone up',momentum:.7,ratingQuality:.67},{label:'Say nothing',momentum:-.2,ratingQuality:.35}]}
 if(state.minute>=15&&state.minute<=55&&diff===-1)return {id:'calm',situation:'The team is rattled after conceding. Your teammates turn to the armband.',options:[
  {label:'Calm them and reset',momentum:.9,ratingQuality:.80},{label:'Raise the intensity',momentum:.6,ratingQuality:.65},{label:'Blame the mistake',momentum:-.6,ratingQuality:.20}]}
 if(state.minute>=75&&diff===1)return {id:'protect-lead',situation:'You are protecting a narrow lead. The team needs direction.',options:[
  {label:'Keep the shape compact',momentum:.7,ratingQuality:.82},{label:'Keep pressing for another',momentum:.3,ratingQuality:.58},{label:'Drop everyone deep',momentum:-.2,ratingQuality:.38}]}
 return null
}

export function applyCaptainMoment(state:MatchState,moment:CaptainMoment,optionIndex:number):MatchState{
 const choice=moment.options[Math.max(0,Math.min(moment.options.length-1,optionIndex))]
 return {...state,momentum:Math.max(-10,Math.min(10,state.momentum+choice.momentum)),decisionQualityTotal:state.decisionQualityTotal+choice.ratingQuality,ratedMoments:state.ratedMoments+1,events:[...state.events,{minute:state.minute,text:`Captain: ${choice.label}.`,kind:'info'}]}
}
