import { emptyMatchStats } from '../src/engine/matchStats'
import { simulateMotmField, selectManOfTheMatch, type MotmCandidate } from '../src/engine/motmV32'
import { calculatePlayerRating } from '../src/engine/ratingSystemV32'
import type { Position } from '../src/types/attributes'

const positions:Position[]=['GK','CB','FB','CM','WM','WG','ST']
const wins:Record<string,number>=Object.fromEntries(positions.map(p=>[p,0]))
const trials=300
for(const position of positions){
 for(let n=0;n<trials;n++){
  const s=emptyMatchStats()
  const goals=n%19===0&&position==='ST'?2:n%11===0&&['ST','WG','WM','CM'].includes(position)?1:0
  const assists=n%13===0&&position!=='GK'?1:0
  s.goals=goals;s.assists=assists
  if(position==='GK'){s.shotsFaced=3+(n%7);s.saves=Math.max(0,s.shotsFaced-(n%3));s.goalsConceded=s.shotsFaced-s.saves;s.highDifficultySaves=n%5===0?2:0}
  if(position==='CB'||position==='FB'){s.goalsConceded=n%4===0?0:1;s.tacklesWon=2+n%4;s.interceptions=1+n%3;s.blocks=n%2;s.headersWon=position==='CB'?2+n%3:1}
  s.keyPasses=n%4;s.progressivePasses=4+n%8;s.dribblesCompleted=n%3;s.progressiveRuns=n%5;s.shotsOnTarget=goals+(n%3)
  const rating=calculatePlayerRating({position,stats:s,decisionQuality:.62+(n%7)*.035,executionQuality:.62+(n%5)*.045,ratedMoments:5,minutes:90}).total
  const player:MotmCandidate={id:'career-player',name:'Test Player',position,rating,stats:s}
  const homeScore=Math.max(goals,n%4),awayScore=n%3
  const result=selectManOfTheMatch(simulateMotmField({homeScore,awayScore,playerIsHome:true,player,random:()=>((n*37+17)%101)/101}),'career-player')
  if(result?.playerWon)wins[position]++
 }
}
console.log('MOTM DISTRIBUTION AUDIT —',trials*positions.length,'player-candidate matches')
for(const p of positions)console.log(p,wins[p],(wins[p]/trials*100).toFixed(1)+'%')
for(const p of positions){
 const rate=wins[p]/trials
 if(wins[p]===0)throw new Error(p+' never won MOTM')
 if(rate>.80)throw new Error(p+' wins MOTM too easily: '+(rate*100).toFixed(1)+'%')
}
console.log('MOTM DISTRIBUTION AUDIT PASSED')
