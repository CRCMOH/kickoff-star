import { useState } from 'react'

interface HalfTimeBreakProps{homeShort:string;awayShort:string;homeScore:number;awayScore:number;playerRating:number;coachTrust:number;onContinue:()=>void}
function coachReaction(r:number,t:number){const warm=t>3,cold=t<-3;if(r>=7.3)return{tone:'good',line:warm?"That's exactly what I want to see. Keep going.":"Good half. Don't get complacent."};if(r<=5.6)return{tone:'hard',line:cold?"I don't know what that was. Sort it out, second half.":"Not good enough. I know you can do better than that."};return{tone:'neutral',line:warm?"Solid enough. A bit more from you and we're laughing.":"It's even. Give me more in the second half."}}
const MENTALITIES=[['composed','Stay composed','Keep making the right football decisions.'],['aggressive','Raise the intensity','Play the second half on the front foot.'],['expressive','Back yourself','Take responsibility when your moment comes.']] as const
export default function HalfTimeBreak({homeShort,awayShort,homeScore,awayScore,playerRating,coachTrust,onContinue}:HalfTimeBreakProps){
 const reaction=coachReaction(playerRating,coachTrust);const [choice,setChoice]=useState<string|null>(null)
 return <div className="halftime-room fixed inset-0 z-[70] flex flex-col items-center justify-center px-5">
  <div className="locker-light"/><div className="relative z-10 max-w-md w-full">
   <div className="ht-kicker">DRESSING ROOM · HALF TIME</div>
   <div className="ht-score"><span>{homeShort}</span><b>{homeScore}<i>—</i>{awayScore}</b><span>{awayShort}</span></div>
   <div className="coach-talk"><div className="coach-badge">COACH</div><p>“{reaction.line}”</p><small>YOUR RATING <b>{playerRating.toFixed(1)}</b></small></div>
   <div className="text-[8px] uppercase tracking-[.25em] text-ks-muted text-center mb-2">Second-half mentality</div>
   <div className="grid gap-2 mb-4">{MENTALITIES.map(([id,title,desc],i)=><button key={id} onClick={()=>setChoice(id)} className={'mentality-choice '+(choice===id?'selected':'')} style={{animationDelay:`${i*80}ms`}}><span>0{i+1}</span><div><b>{title}</b><small>{desc}</small></div></button>)}</div>
   <button disabled={!choice} onClick={onContinue} className="ht-continue w-full rounded-xl py-3.5 font-display tracking-widest text-sm disabled:opacity-30">SECOND HALF →</button>
  </div>
 </div>
}
