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
