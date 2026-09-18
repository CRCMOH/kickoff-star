import type { Position } from '../types/attributes'
import type { PlayerMatchStats } from './matchStats'

export interface MotmCandidate { id:string; name:string; position:Position; rating:number; stats:PlayerMatchStats }
export interface MotmResult { winner:MotmCandidate; playerWon:boolean }

export function selectManOfTheMatch(candidates:MotmCandidate[],playerId:string):MotmResult|null{
 if(!candidates.length)return null
 const score=(c:MotmCandidate)=>{
  const s=c.stats
  const decisive=s.goals*.18+s.assists*.12+s.penaltySaves*.18+s.highDifficultySaves*.05
  const defensive=(c.position==='GK'||c.position==='CB'||c.position==='FB')?(s.saves*.012+s.tacklesWon*.008+s.interceptions*.01+s.blocks*.012):0
  return c.rating+Math.min(.38,decisive+defensive)
 }
 const winner=[...candidates].sort((a,b)=>score(b)-score(a)||b.rating-a.rating||a.id.localeCompare(b.id))[0]
 return {winner,playerWon:winner.id===playerId}
}

export function simulateMotmField(args:{homeScore:number;awayScore:number;playerIsHome:boolean;player:MotmCandidate;random?:()=>number}):MotmCandidate[]{
 const rng=args.random??Math.random,out:MotmCandidate[]=[args.player]
 const empty=():PlayerMatchStats=>({goals:0,assists:0,shots:0,shotsOnTarget:0,keyPasses:0,passesAttempted:0,passesCompleted:0,progressivePasses:0,chancesCreated:0,dribblesAttempted:0,dribblesCompleted:0,progressiveRuns:0,touches:0,tacklesAttempted:0,tacklesWon:0,interceptions:0,recoveries:0,clearances:0,blocks:0,headersWon:0,duelsWon:0,duelsAttempted:0,saves:0,shotsFaced:0,goalsConceded:0,penaltySaves:0,highDifficultySaves:0,distributionCompleted:0,distributionAttempted:0})
 const positions:Position[]=['GK','CB','CB','FB','FB','CM','CM','WM','WG','ST','ST']
 const sidePlayers:MotmCandidate[][]=[[],[]]

 // First create credible baseline performances for both XIs.
 for(let side=0;side<2;side++)for(let i=0;i<11;i++){
  const home=side===0
  // The controlled player already occupies one XI slot. Do not create a
  // phantom 12th player on their side.
  if(home===args.playerIsHome && positions[i]===args.player.position && !sidePlayers[side].some(p=>p.position===args.player.position)) continue
  const won=home?args.homeScore>args.awayScore:args.awayScore>args.homeScore,drew=args.homeScore===args.awayScore
  const pos=positions[i],st=empty(),conceded=home?args.awayScore:args.homeScore
  let rating=6.0+(won?.24:drew?.06:-.12)+(rng()-.5)*1.25
  if(pos==='GK'){
   st.goalsConceded=conceded
   st.shotsFaced=conceded+2+Math.floor(rng()*5)
   st.saves=Math.max(0,st.shotsFaced-conceded)
   st.highDifficultySaves=Math.min(st.saves,Math.floor(rng()*3))
   if(conceded===0)rating+=.25
   rating+=Math.min(.55,st.saves*.055+st.highDifficultySaves*.08)
  }
  if(pos==='CB'||pos==='FB'){
   st.goalsConceded=conceded
   st.tacklesWon=1+Math.floor(rng()*4);st.interceptions=Math.floor(rng()*4);st.blocks=Math.floor(rng()*3)
   if(pos==='CB')st.headersWon=1+Math.floor(rng()*4)
   if(conceded===0)rating+=.18
   rating+=Math.min(.35,(st.tacklesWon+st.interceptions+st.blocks)*.025)
  }
  if(['CM','WM','WG'].includes(pos)){st.keyPasses=Math.floor(rng()*4);rating+=st.keyPasses*.045}
  const cand={id:`npc-${side}-${i}`,name:`${home?'Home':'Away'} Player ${i+1}`,position:pos,rating,stats:st}
  sidePlayers[side].push(cand);out.push(cand)
 }

 // Allocate EVERY simulated team goal to an actual NPC scorer and, usually,
 // an assister. This creates braces/hat-tricks/multi-assist games naturally
 // and makes the comparison field reflect the scoreline rather than generic 6s.
 for(let side=0;side<2;side++){
  const teamGoals=side===0?args.homeScore:args.awayScore
  // Player goals are already represented by the controlled player's stats;
  // allocating them again to an NPC would invent an extra scorer.
  const goals=Math.max(0,teamGoals-((side===0)===args.playerIsHome?args.player.stats.goals:0))
  const attackers=sidePlayers[side].filter(c=>['ST','WG','WM','CM'].includes(c.position))
  for(let g=0;g<goals;g++){
   const weights=attackers.map(c=>c.position==='ST'?4:c.position==='WG'?3:c.position==='WM'?2:1.5)
   let roll=rng()*weights.reduce((a,b)=>a+b,0),scorer=attackers[0]
   for(let i=0;i<attackers.length;i++){roll-=weights[i];if(roll<=0){scorer=attackers[i];break}}
   scorer.stats.goals++;scorer.stats.shotsOnTarget++;scorer.rating+=.48+(scorer.stats.goals>=2?.10:0)
   if(rng()<.72){
    const creators=attackers.filter(c=>c!==scorer)
    const assister=creators[Math.floor(rng()*creators.length)]
    assister.stats.assists++;assister.stats.keyPasses++;assister.rating+=.30+(assister.stats.assists>=2?.08:0)
   }
  }
 }

 // A small number of genuinely standout non-goal performances should compete
 // for MOTM too: creator masterclasses, keeper heroics and defensive walls.
 for(const side of sidePlayers)for(const c of side){
  if(['CM','WM','WG'].includes(c.position)&&c.stats.keyPasses>=3&&rng()<.22) c.rating+=.30
  if(c.position==='GK'&&c.stats.saves>=5&&rng()<.30) c.rating+=.28
  if((c.position==='CB'||c.position==='FB')&&(c.stats.tacklesWon+c.stats.interceptions+c.stats.blocks)>=7&&rng()<.22)c.rating+=.28
  c.rating=Math.max(4.8,Math.min(9.6,Math.round(c.rating*10)/10))
 }
 if(out.length!==22) throw new Error(`MOTM field invariant failed: expected 22 players, got ${out.length}`)
 return out
}
