import { useEffect, useMemo, useState } from 'react'

const SHAPE=[{x:50,y:7},{x:16,y:22},{x:38,y:19},{x:62,y:19},{x:84,y:22},{x:26,y:38},{x:50,y:35},{x:74,y:38},{x:22,y:53},{x:50,y:55},{x:78,y:53}]
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}
export type PitchAction='idle'|'attack'|'shot'|'save'|'goal'|'tackle'|'cross'
export default function LiveMatchPitch({momentum,homeColor,awayColor,playerIsHome,minute,action='idle',focusPlayer=false}:{momentum:number;homeColor:string;awayColor:string;playerIsHome:boolean;minute:number;action?:PitchAction;focusPlayer?:boolean}){
 const [pulse,setPulse]=useState(0)
 useEffect(()=>{setPulse(p=>p+1)},[minute])
 const ball=useMemo(()=>{
  const towardHome=momentum<0
  const y=clamp(50-(momentum*(playerIsHome?1:-1)*2.4),18,82)
  return {x:50+Math.sin(pulse*.9)*15,y:towardHome?100-y:y}
 },[momentum,playerIsHome,pulse])
 const actionBall=action==='shot'||action==='goal'?{x:50,y:playerIsHome?5:95}:action==='cross'?{x:playerIsHome?72:28,y:playerIsHome?18:82}:ball
 const shift=clamp(momentum*1.5,-15,15)
 const cameraClass=action==='goal'||action==='shot'?' camera-box':action==='cross'||action==='attack'?' camera-third':''
 return <div className={'live-pitch relative'+cameraClass+(focusPlayer?' player-focus':'')} w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{aspectRatio:'3/2'}}>
  <div className="pitch-vignette absolute inset-0"/>
  <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
   <rect x="2" y="2" width="96" height="96" rx="1" fill="none" stroke="white" strokeWidth=".45"/>
   <line x1="2" y1="50" x2="98" y2="50" stroke="white" strokeWidth=".4"/><circle cx="50" cy="50" r="10" fill="none" stroke="white" strokeWidth=".4"/>
   <rect x="25" y="2" width="50" height="15" fill="none" stroke="white" strokeWidth=".4"/><rect x="25" y="83" width="50" height="15" fill="none" stroke="white" strokeWidth=".4"/>
  </svg>
  {SHAPE.map((p,i)=><div key={'a'+i} className={'match-dot '+(playerIsHome&&i===9?'user-player':'')} style={{left:`${p.x}%`,top:`${clamp(p.y+shift,5,94)}%`,background:homeColor,animationDelay:`${i*.07}s`}}><span>{i+1}</span></div>)}
  {SHAPE.map((p,i)=><div key={'b'+i} className={'match-dot '+(!playerIsHome&&i===9?'user-player':'')} style={{left:`${100-p.x}%`,top:`${clamp(100-p.y-shift,5,94)}%`,background:awayColor,animationDelay:`${i*.07+.2}s`}}><span>{i+1}</span></div>)}
  <div className="match-ball" style={{left:`${ball.x}%`,top:`${ball.y}%`}}>⚽</div>
  {action!=='idle'&&<div className={"pitch-action pitch-action-"+action}>{action==='goal'?'GOAL':action==='save'?'SAVE':action==='shot'?'SHOT':action==='cross'?'CROSS':action==='tackle'?'TACKLE':'ATTACK'}</div>}
  <div className="absolute left-3 bottom-2 text-[8px] uppercase tracking-[.22em] text-white/40">live tactical view</div>
 </div>
}
