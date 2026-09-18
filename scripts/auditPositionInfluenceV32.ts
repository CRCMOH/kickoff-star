import { finalizePlayerRating } from '../src/engine/liveMatchV2'
import { emptyMatchStats, savePercentage, distributionPercentage, type PlayerMatchStats } from '../src/engine/matchStats'
import type { Position } from '../src/types/attributes'

type Level = 'poor' | 'average' | 'excellent'
const positions: Position[] = ['GK','CB','FB','DM','CM','AM','W','ST']

function seeded(seed:number){ let s=seed>>>0; return ()=>{s=(s*1664525+1013904223)>>>0; return s/4294967296} }
function poisson(lambda:number,rng:()=>number){let l=Math.exp(-lambda),p=1,k=0; do{k++;p*=rng()}while(p>l); return k-1}
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}

const influence: Record<Position, Record<Level, number>> = {
 GK:{poor:-0.24,average:0,excellent:0.24}, CB:{poor:-0.14,average:0,excellent:0.14},
 FB:{poor:-0.12,average:0,excellent:0.12}, DM:{poor:-0.12,average:0,excellent:0.12},
 CM:{poor:-0.13,average:0,excellent:0.13}, AM:{poor:-0.17,average:0,excellent:0.17},
 W:{poor:-0.18,average:0,excellent:0.18}, ST:{poor:-0.21,average:0,excellent:0.21},
}

function statsFor(pos:Position, level:Level, rng:()=>number, gf:number,ga:number):PlayerMatchStats {
 const s=emptyMatchStats(); const q=level==='poor'?.35:level==='average'?.62:.86
 if(pos==='GK'){
   s.goalsConceded=ga; s.shotsFaced=ga+poisson(2.4+rng()*2.2,rng); s.saves=Math.max(0,s.shotsFaced-ga)
   s.highDifficultySaves=Math.min(s.saves,Math.round(s.saves*(level==='excellent'?.35:.14)))
   s.penaltySaves=level==='excellent'&&rng()<.04?1:0; s.distributionAttempted=18+Math.floor(rng()*15); s.distributionCompleted=Math.round(s.distributionAttempted*q)
 } else {
   const attack=['AM','W','ST'].includes(pos)
   s.goals=Math.min(gf, poisson((attack?.24:.08)*(level==='excellent'?1.8:level==='poor'?.45:1),rng))
   s.assists=Math.min(Math.max(0,gf-s.goals), poisson((attack?.20:.10)*(level==='excellent'?1.7:level==='poor'?.45:1),rng))
   s.shots=poisson(attack?2.2:.8,rng); s.shotsOnTarget=Math.min(s.shots,Math.round(s.shots*q*.65))
   s.keyPasses=poisson(['CM','AM','W'].includes(pos)?1.5:.5,rng)
   s.tacklesWon=poisson(['CB','FB','DM'].includes(pos)?2.7:1.0,rng); s.interceptions=poisson(['CB','FB','DM','CM'].includes(pos)?1.8:.6,rng); s.headersWon=poisson(pos==='CB'?2.2:.5,rng)
 }
 return s
}

for(const pos of positions){
 for(const level of ['poor','average','excellent'] as Level[]){
  const rng=seeded(20260918+positions.indexOf(pos)*100+['poor','average','excellent'].indexOf(level))
  const N=10000; let w=0,d=0,l=0,gf=0,ga=0,rating=0,r9=0,saves=0,shotsFaced=0,distC=0,distA=0,cs=0
  const scores:Record<string,number>={}
  for(let i=0;i<N;i++){
   // Equal-team baseline around the calibrated V3.2 equal-team scoring shape.
   // Player performance nudges expected goals for/against by position rather than guaranteeing outcomes.
   const delta=influence[pos][level]
   const attacking=['ST','W','AM','CM'].includes(pos)
   const defensive=['GK','CB','FB','DM'].includes(pos)
   const homeLam=clamp(1.17 + (attacking?delta:delta*.45),.35,2.3)
   const awayLam=clamp(1.11 - (defensive?delta:delta*.35),.35,2.3)
   const hg=poisson(homeLam,rng), ag=poisson(awayLam,rng); gf+=hg;ga+=ag
   if(hg>ag)w++; else if(hg===ag)d++; else l++
   scores[`${hg}-${ag}`]=(scores[`${hg}-${ag}`]??0)+1
   const s=statsFor(pos,level,rng,hg,ag)
   const raw=level==='poor'?5.45+rng()*.65:level==='average'?6.15+rng()*.8:7.15+rng()*1.25
   const r=finalizePlayerRating(raw,pos,s,hg,ag); rating+=r;if(r>=9)r9++
   if(pos==='GK'){saves+=s.saves;shotsFaced+=s.shotsFaced;distC+=s.distributionCompleted;distA+=s.distributionAttempted;if(ag===0)cs++}
  }
  const top=Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([s,n])=>`${s} ${(n/N*100).toFixed(1)}%`).join(', ')
  console.log(`${pos.padEnd(2)} ${level.padEnd(9)} W/D/L ${(w/N*100).toFixed(1)}/${(d/N*100).toFixed(1)}/${(l/N*100).toFixed(1)} | goals ${(gf/N).toFixed(2)}-${(ga/N).toFixed(2)} | rating ${(rating/N).toFixed(2)} | 9+ ${(r9/N*100).toFixed(2)}% | top ${top}`)
  if(pos==='GK') console.log(`   GK saves ${(saves/N).toFixed(2)} | faced ${(shotsFaced/N).toFixed(2)} | save% ${(shotsFaced?saves/shotsFaced*100:0).toFixed(1)} | clean sheets ${(cs/N*100).toFixed(1)}% | distribution ${(distA?distC/distA*100:0).toFixed(1)}%`)
 }
}
console.log('\nPOSITION INFLUENCE AUDIT COMPLETE')
