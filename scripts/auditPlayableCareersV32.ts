import { initMatch, advanceToKeyMoment, resolvePlayerMoment, resolveScenarioBeat, resolveInjuryDecision } from '../src/engine/match'
import { momentToDecision } from '../src/engine/matchDecisions'
import { reseed, rand } from '../src/engine/rng'
import { generatePlayerTeam, generateTeam } from '../src/engine/teams'
import type { Player } from '../src/types/player'
import type { Position } from '../src/types/attributes'
import { passPercentage, savePercentage } from '../src/engine/matchStats'

const positions: Position[]=['GK','CB','FB','CM','WM','WG','ST']
const profiles=['developing','solid','elite'] as const
const matchesPerCareer=24
function player(position:Position,level:number):Player{
 const out:any={kind:'outfield',values:{passing:level,shooting:level,dribbling:level,tackling:level,pace:level,strength:level,stamina:level,agility:level,vision:level,composure:level,positioning:level,concentration:level}}
 const gk:any={kind:'goalkeeper',values:{reflexes:level,handling:level,gkPositioning:level,distribution:level}}
 return {id:'audit',name:'Audit Player',position,preferredFoot:'right',heightCm:180,attributes:position==='GK'?gk:out,potential:18,confidence:{value:0,baseline:0},fitness:{stamina:92},careerClock:{ageYears:17,phase:'academy',grassrootsSeason:null},schoolId:null,trialWeekCompleted:3,trainingMomentum:0,matchRatings:[],seasonGoals:0,seasonAssists:0,injury:null,recentInjuryCount:0,matchesSinceReturn:10,coachTrust:5,reputation:0,scoutWatchers:[],contractOffers:[],totalWeeksElapsed:0,academyClubName:'Audit',turnedPro:null,squadRole:'starting-xi'} as Player
}
function choose(bundle:any,profile:string){
 const opts=bundle.decision.options
 // Human-like policy: stronger players make better decisions more often, but
 // do not deterministically spam one option. This keeps shooting/creation mixed.
 const scores=opts.map((o:any,i:number)=>o.successChance*(0.7+0.3*(bundle.rewards[i]||1)/Math.max(1,bundle.maxReward)))
 const ranked=scores.map((v:number,i:number)=>({v,i})).sort((a:any,b:any)=>b.v-a.v)
 const r=rand()
 if(profile==='developing') return r<.45?ranked[0].i:r<.70?(ranked[1]?.i??ranked[0].i):Math.floor(rand()*opts.length)
 if(profile==='solid') return r<.68?ranked[0].i:r<.90?(ranked[1]?.i??ranked[0].i):Math.floor(rand()*opts.length)
 return r<.78?ranked[0].i:r<.96?(ranked[1]?.i??ranked[0].i):Math.floor(rand()*opts.length)
}
function play(p:Player,profile:string,seed:number){
 reseed(seed); const team=generatePlayerTeam('Audit FC',4), opp=generateTeam(4)
 let s=initMatch(p,team,opp,seed%2===0); let guard=0
 while(!s.finished && guard++<300){
  const a=advanceToKeyMoment(s,p); s=a.state
  if(!a.keyMoment) continue
  const m=a.keyMoment
  if(m.isInjuryDecision){s=resolveInjuryDecision(s,false,p);continue}
  const b=momentToDecision(p,m,'audit'); const i=choose(b,profile); const o=b.decision.options[i]
  const success=rand()<o.successChance
  const q=b.maxReward?b.rewards[i]/b.maxReward:.5
  s=m.scenarioId?resolveScenarioBeat(s,m,i,q,success,b.rewards[i],b.maxReward,profile==='elite'?'perfect':profile==='solid'?'good':'ok'):resolvePlayerMoment(s,m,q,success,b.rewards[i],b.maxReward,p.position==='GK'&&m.isDefensive,profile==='elite'?'perfect':profile==='solid'?'good':'ok')
 }
 if(!s.finished) throw new Error('match guard exceeded')
 return s
}
for(const pos of positions) for(let pi=0;pi<profiles.length;pi++){
 const profile=profiles[pi], p=player(pos,[8,12,16][pi]); const totals:any={w:0,d:0,l:0,gf:0,ga:0,r:0,...Object.fromEntries(Object.keys((await import('../src/engine/matchStats')).emptyMatchStats()).map(k=>[k,0]))}
 for(let m=0;m<matchesPerCareer;m++){const s=play(p,profile,3202600+positions.indexOf(pos)*1000+pi*100+m);const gf=s.playerIsHome?s.homeScore:s.awayScore,ga=s.playerIsHome?s.awayScore:s.homeScore;totals[gf>ga?'w':gf===ga?'d':'l']++;totals.gf+=gf;totals.ga+=ga;totals.r+=s.playerRating;for(const k of Object.keys(s.playerStats))totals[k]+=s.playerStats[k as keyof typeof s.playerStats] as number}
 const pp=(totals.passesCompleted/totals.passesAttempted*100)||0, sp=(totals.saves/totals.shotsFaced*100)||0
 console.log(`${pos.padEnd(2)} ${profile.padEnd(10)} W/D/L ${totals.w}/${totals.d}/${totals.l} GF-GA ${totals.gf}-${totals.ga} rating ${(totals.r/matchesPerCareer).toFixed(2)} | G ${totals.goals} A ${totals.assists} shots ${totals.shots}/SOT ${totals.shotsOnTarget} | pass ${totals.passesCompleted}/${totals.passesAttempted} ${pp.toFixed(1)}% prog ${totals.progressivePasses} key ${totals.keyPasses} chances ${totals.chancesCreated} | drib ${totals.dribblesCompleted}/${totals.dribblesAttempted} runs ${totals.progressiveRuns} | tackles ${totals.tacklesWon}/${totals.tacklesAttempted} int ${totals.interceptions} rec ${totals.recoveries} clr ${totals.clearances} blk ${totals.blocks} duels ${totals.duelsWon}/${totals.duelsAttempted} | saves ${totals.saves}/${totals.shotsFaced} ${sp.toFixed(1)}% CS-context ${totals.goalsConceded===0?'yes':'career'} GC ${totals.goalsConceded} dist ${totals.distributionCompleted}/${totals.distributionAttempted}`)
}
console.log('\nDIRECT MATCH.TS 21-CAREER AUDIT COMPLETE — 504 playable matches')


/* V3.2 behaviour isolation audit.
   Same engine + attributes; only the decision personality changes.
   This tells us whether extreme G/A totals come from player choice rather than
   hidden positional forcing in the match engine. */
type Style='balanced'|'safe'|'aggressive'|'creator'|'random'
const styles:Style[]=['balanced','safe','aggressive','creator','random']
function styleChoice(bundle:any,style:Style){
 const opts=bundle.decision.options
 if(style==='random') return Math.floor(rand()*opts.length)
 const text=(i:number)=>((opts[i]?.label||'')+' '+(opts[i]?.description||'')).toLowerCase()
 const score=(i:number)=>{
  const o=opts[i], reward=bundle.rewards[i]||0, t=text(i)
  if(style==='safe') return o.successChance*3 + reward*.03
  if(style==='aggressive') return reward*.35 + (/shoot|strike|finish|header|volley|goal|drill/.test(t)?1.4:0) + o.successChance*.5
  if(style==='creator') return (/pass|cross|cutback|square|through|release|switch|lay|slip|delivery/.test(t)?1.5:0) + o.successChance*1.2 + reward*.08
  return o.successChance*1.8 + reward*.12
 }
 return opts.map((_:any,i:number)=>({i,v:score(i)})).sort((a:any,b:any)=>b.v-a.v)[0].i
}
function playStyle(p:Player,style:Style,seed:number){
 reseed(seed); const team=generatePlayerTeam('Audit FC',4),opp=generateTeam(4)
 let s=initMatch(p,team,opp,seed%2===0),guard=0
 while(!s.finished&&guard++<300){
  const a=advanceToKeyMoment(s,p);s=a.state;if(!a.keyMoment)continue
  const m=a.keyMoment;if(m.isInjuryDecision){s=resolveInjuryDecision(s,false,p);continue}
  const b=momentToDecision(p,m,'audit'),i=styleChoice(b,style),o=b.decision.options[i]
  const success=rand()<o.successChance,q=b.maxReward?b.rewards[i]/b.maxReward:.5
  s=m.scenarioId?resolveScenarioBeat(s,m,i,q,success,b.rewards[i],b.maxReward,'good'):resolvePlayerMoment(s,m,q,success,b.rewards[i],b.maxReward,p.position==='GK'&&m.isDefensive,'good')
 }
 if(!s.finished)throw new Error('style match guard exceeded');return s
}
console.log('\nBEHAVIOUR ISOLATION — identical solid attributes, 48 matches/style')
for(const pos of ['FB','CM','WG','ST'] as Position[]){
 for(const style of styles){
  const p=player(pos,12);let g=0,a=0,sh=0,key=0,r=0
  for(let m=0;m<48;m++){const s=playStyle(p,style,8800000+positions.indexOf(pos)*10000+styles.indexOf(style)*100+m);g+=s.playerStats.goals;a+=s.playerStats.assists;sh+=s.playerStats.shots;key+=s.playerStats.keyPasses;r+=s.playerRating}
  console.log(`${pos} ${style.padEnd(10)} G ${g} A ${a} shots ${sh} key ${key} rating ${(r/48).toFixed(2)}`)
 }
}
console.log('BEHAVIOUR ISOLATION AUDIT COMPLETE — 960 playable matches')


/* Moment-frequency audit: rating weights must be calibrated to what the player
   can actually touch in this key-moment game, not to full-match event counts. */
console.log('\nPLAYABLE MOMENT FREQUENCY — 200 matches/position, solid player, random decisions')
for(const pos of positions){
 const p=player(pos,12);let moments=0,def=0,dist=0,attack=0,mins=0
 const buckets=[0,0,0,0,0,0,0,0,0,0]
 for(let m=0;m<200;m++){
  reseed(9900000+positions.indexOf(pos)*1000+m);const team=generatePlayerTeam('Audit FC',4),opp=generateTeam(4)
  let s=initMatch(p,team,opp,m%2===0),guard=0,mc=0,dc=0,dic=0,ac=0
  while(!s.finished&&guard++<300){
   const a=advanceToKeyMoment(s,p);s=a.state;if(!a.keyMoment)continue
   const km=a.keyMoment;mc++;if(km.isDistribution)dic++;else if(km.isDefensive)dc++;else ac++
   if(km.isInjuryDecision){s=resolveInjuryDecision(s,false,p);continue}
   const b=momentToDecision(p,km,'audit'),i=Math.floor(rand()*b.decision.options.length),o=b.decision.options[i],success=rand()<o.successChance,q=b.maxReward?b.rewards[i]/b.maxReward:.5
   s=km.scenarioId?resolveScenarioBeat(s,km,i,q,success,b.rewards[i],b.maxReward,'good'):resolvePlayerMoment(s,km,q,success,b.rewards[i],b.maxReward,p.position==='GK'&&km.isDefensive,'good')
  }
  moments+=mc;def+=dc;dist+=dic;attack+=ac;mins+=Math.max(0,(s.subMinute??s.minute)-s.entryMinute);buckets[Math.min(9,mc)]++
 }
 console.log(`${pos} avg ${(moments/200).toFixed(2)} moments | attack ${(attack/200).toFixed(2)} defend ${(def/200).toFixed(2)} distribution ${(dist/200).toFixed(2)} | avg mins ${(mins/200).toFixed(1)} | moment-count [${buckets.map((n,i)=>`${i}:${n}`).join(' ')}]`)
}
console.log('PLAYABLE MOMENT FREQUENCY AUDIT COMPLETE — 1,400 matches')


console.log('\nRATING LEDGER CALIBRATION — 100 random-style matches/position')
for(const pos of positions){
 const p=player(pos,12);let sum=0,hi8=0,hi9=0,lo=10,hi=0,cs=0
 for(let m=0;m<100;m++){
  const s=playStyle(p,'random',12300000+positions.indexOf(pos)*1000+m),r=s.playerRating
  sum+=r;if(r>=8)hi8++;if(r>=9)hi9++;lo=Math.min(lo,r);hi=Math.max(hi,r)
  if((pos==='GK'||pos==='CB'||pos==='FB')&&s.playerStats.goalsConceded===0&&((s.ratingBreakdown?.cleanSheet??0)>0))cs++
 }
 const avg=sum/100
 console.log(`${pos} avg ${avg.toFixed(2)} range ${lo.toFixed(1)}-${hi.toFixed(1)} | 8+ ${hi8}% 9+ ${hi9}% | defensive-CS-credit ${cs}`)
 if(avg<5.8||avg>8.0) throw new Error(`${pos} rating average outside calibration band: ${avg.toFixed(2)}`)
 if(hi9>20) throw new Error(`${pos} has too many 9+ ratings: ${hi9}%`)
}
console.log('RATING LEDGER CALIBRATION PASSED — 700 matches')
