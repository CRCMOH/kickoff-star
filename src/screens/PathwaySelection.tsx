import { useState } from 'react'
import { routeDescription,routeLabel,type StartingYouthRoute } from '../engine/youthRouteV5'
export default function PathwaySelection({onChoose}:{onChoose:(route:StartingYouthRoute)=>void}){
 const [selected,setSelected]=useState<StartingYouthRoute|null>(null)
 return <div className="relative min-h-screen w-full bg-ks-black flex flex-col px-5 py-8"><div className="absolute inset-0" style={{background:'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(212,175,55,.10), transparent 60%),linear-gradient(180deg,#0a0a09,#050504)'}}/><div className="relative z-10 max-w-md mx-auto w-full flex flex-col flex-1">
  <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-2">choose your pathway</div><h1 className="font-display text-ks-ink text-2xl tracking-wide">Where does your story begin?</h1><p className="text-ks-muted text-xs mt-2 mb-6">This choice controls your trials, team, competitions and calendar. You cannot play both routes at the same time.</p>
  <div className="flex flex-col gap-3">
   {(['school','grassroots'] as StartingYouthRoute[]).map(route=><button key={route} onClick={()=>setSelected(route)} className={'text-left rounded-2xl border px-5 py-5 transition-all '+(selected===route?'border-ks-gold bg-ks-gold/10':'border-ks-border bg-[#0f0f0d]')}><div className="flex justify-between items-center"><div className="font-display text-lg text-ks-ink">{routeLabel(route)}</div><span className="text-xl">{route==='school'?'◆':'⚽'}</span></div><p className="text-[11px] text-ks-muted mt-2 leading-relaxed">{routeDescription(route)}</p><div className="mt-3 text-[9px] uppercase tracking-wider text-ks-gold">{route==='school'?'School trials · school league · regional selection':'Club trials · grassroots league · grassroots cup'}</div></button>)}
  </div>
  <div className="mt-auto pt-6"><button disabled={!selected} onClick={()=>selected&&onChoose(selected)} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-4 text-sm disabled:opacity-25">{selected?'start '+routeLabel(selected).toLowerCase():'select a pathway'}</button></div>
 </div></div>
}
