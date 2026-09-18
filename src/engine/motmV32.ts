import type { Position } from '../types/attributes'
import type { PlayerMatchStats } from './matchStats'

export interface MotmCandidate { id:string; name:string; position:Position; rating:number; stats:PlayerMatchStats }
export interface MotmResult { winner:MotmCandidate; playerWon:boolean }

/**
 * Proper MOTM comparison. Rating is primary; major decisive contributions
 * break ties. The user's player is never handed MOTM by a fixed threshold.
 */
export function selectManOfTheMatch(candidates:MotmCandidate[],playerId:string):MotmResult|null{
 if(!candidates.length)return null
 const score=(c:MotmCandidate)=>{
  const s=c.stats
  const decisive=s.goals*.18+s.assists*.12+s.penaltySaves*.18+s.highDifficultySaves*.05
  const defensive=(c.position==='GK'||c.position==='CB'||c.position==='FB')?(s.saves*.012+s.tacklesWon*.008+s.interceptions*.01+s.blocks*.012):0
  return c.rating+Math.min(.38,decisive+defensive)
 }
 const winner=[...candidates].sort((a,b)=>score(b)-score(a)||b.rating-a.rating)[0]
 return {winner,playerWon:winner.id===playerId}
}

/**
 * Generate a conservative comparison field for the other 21 players until
 * every NPC has a fully simulated individual stat ledger. Team result and
 * position shape the distribution; ratings remain bounded so MOTM is earned
 * by comparison rather than a hidden player-only threshold.
 */
export function simulateMotmField(args:{homeScore:number;awayScore:number;playerIsHome:boolean;player:MotmCandidate;random?:()=>number}):MotmCandidate[]{
 const rng=args.random??Math.random,out:MotmCandidate[]=[args.player]
 const empty=():PlayerMatchStats=>({goals:0,assists:0,shots:0,shotsOnTarget:0,keyPasses:0,passesAttempted:0,passesCompleted:0,progressivePasses:0,chancesCreated:0,dribblesAttempted:0,dribblesCompleted:0,progressiveRuns:0,touches:0,tacklesAttempted:0,tacklesWon:0,interceptions:0,recoveries:0,clearances:0,blocks:0,headersWon:0,duelsWon:0,duelsAttempted:0,saves:0,shotsFaced:0,goalsConceded:0,penaltySaves:0,highDifficultySaves:0,distributionCompleted:0,distributionAttempted:0})
 const positions:Position[]=['GK','CB','CB','FB','FB','CM','CM','WM','WG','ST','ST']
 for(let side=0;side<2;side++)for(let i=0;i<11;i++){
   const home=side===0,won=home?args.homeScore>args.awayScore:args.awayScore>args.homeScore,drew=args.homeScore===args.awayScore
   const pos=positions[i],st=empty(),goals=home?args.homeScore:args.awayScore,conceded=home?args.awayScore:args.homeScore
   let rating=6.05+(won?.28:drew?.08:-.12)+(rng()-.5)*1.15
   if(pos==='GK'&&conceded===0)rating+=.28
   if((pos==='CB'||pos==='FB')&&conceded===0)rating+=.18
   // Allocate team goals probabilistically to attacking NPCs for MOTM context.
   if(goals>0&&['ST','WG','WM','CM'].includes(pos)&&rng()<Math.min(.62,goals*.18)){st.goals=1;rating+=.48}
   rating=Math.max(4.8,Math.min(8.8,Math.round(rating*10)/10))
   out.push({id:`npc-${side}-${i}`,name:`${home?'Home':'Away'} Player ${i+1}`,position:pos,rating,stats:st})
 }
 return out
}
