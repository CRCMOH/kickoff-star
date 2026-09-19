import { NATIONS, getNation } from './nations'
import { generateTeam, type Team } from './teams'
import { generateRoundRobin, generateKnockoutRound, knockoutWinners, type GenericFixture } from './competitions'

export const YOUTH_INTL_QUALIFIER_WEEKS=[8,16,24,32] as const
export const YOUTH_INTL_FINALS_WEEKS=[37,40,43] as const
export type YouthInternationalStage='qualifiers'|'finals'|'complete'|'not-qualified'
export interface YouthInternationalWorldV5{
  nationId:string;nationTeamId:string;qualifyingGroup:{groupId:string;teams:Team[];fixtures:GenericFixture[]}
  qualified:boolean;finalsRounds:GenericFixture[][];currentFinalsRound:number;finalsTeams:Team[]
  stage:YouthInternationalStage;wonTournament:boolean;eliminated:boolean
}
function teamForNation(id:string):Team{
 const n=getNation(id),base=generateTeam(n.strength)
 return{...base,id:`nation-${n.id}`,name:n.name,short:n.short,prestige:n.strength}
}
function orderedOpponents(playerNationId:string){
 const pool=NATIONS.filter(n=>n.id!==playerNationId)
 return [...pool].sort((a,b)=>Math.abs(a.strength-getNation(playerNationId).strength)-Math.abs(b.strength-getNation(playerNationId).strength)||a.id.localeCompare(b.id))
}
export function initYouthInternationalV5(playerNationId:string):YouthInternationalWorldV5{
 const nation=teamForNation(playerNationId),others=orderedOpponents(playerNationId).slice(0,4).map(n=>teamForNation(n.id))
 const teams=[nation,...others]
 return{nationId:playerNationId,nationTeamId:nation.id,qualifyingGroup:{groupId:'QUAL-A',teams,fixtures:generateRoundRobin(teams.map(t=>t.id),1)},qualified:false,finalsRounds:[],currentFinalsRound:0,finalsTeams:[],stage:'qualifiers',wonTournament:false,eliminated:false}
}
export function youthInternationalWindow(week:number){const q=YOUTH_INTL_QUALIFIER_WEEKS.indexOf(week as any);if(q>=0)return{stage:'qualifiers' as const,round:q+1};const f=YOUTH_INTL_FINALS_WEEKS.indexOf(week as any);return f>=0?{stage:'finals' as const,round:f+1}:null}
function table(world:YouthInternationalWorldV5){
 const rows=world.qualifyingGroup.teams.map(t=>({teamId:t.id,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}))
 for(const f of world.qualifyingGroup.fixtures){if(!f.played||f.homeGoals==null||f.awayGoals==null)continue;const h=rows.find(r=>r.teamId===f.homeTeamId)!,a=rows.find(r=>r.teamId===f.awayTeamId)!;h.p++;a.p++;h.gf+=f.homeGoals;h.ga+=f.awayGoals;a.gf+=f.awayGoals;a.ga+=f.homeGoals;if(f.homeGoals>f.awayGoals){h.w++;a.l++;h.pts+=3}else if(f.homeGoals<f.awayGoals){a.w++;h.l++;a.pts+=3}else{h.d++;a.d++;h.pts++;a.pts++}h.gd=h.gf-h.ga;a.gd=a.gf-a.ga}
 return rows.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.teamId.localeCompare(b.teamId))
}
export function internationalTableV5(world:YouthInternationalWorldV5){return table(world)}
export function advanceYouthInternationalV5(world:YouthInternationalWorldV5):YouthInternationalWorldV5{
 if(world.stage==='qualifiers'){
  if(!world.qualifyingGroup.fixtures.every(f=>f.played))return world
  if(!table(world).slice(0,2).some(r=>r.teamId===world.nationTeamId))return{...world,stage:'not-qualified'}
  const finalists=[world.qualifyingGroup.teams.find(t=>t.id===world.nationTeamId)!,...NATIONS.filter(n=>n.id!==world.nationId).sort((a,b)=>b.strength-a.strength||a.id.localeCompare(b.id)).slice(0,7).map(n=>teamForNation(n.id))]
  return{...world,qualified:true,stage:'finals',finalsTeams:finalists,finalsRounds:[generateKnockoutRound(finalists.map(t=>t.id),1)],currentFinalsRound:1}
 }
 if(world.stage==='finals'){const round=world.finalsRounds[world.currentFinalsRound-1];if(!round?.every(f=>f.played))return world;const winners=knockoutWinners(round);if(winners.length<=1)return{...world,stage:'complete',wonTournament:winners[0]===world.nationTeamId};if(!winners.includes(world.nationTeamId))return{...world,stage:'complete',eliminated:true};return{...world,finalsRounds:[...world.finalsRounds,generateKnockoutRound(winners,world.currentFinalsRound+1)],currentFinalsRound:world.currentFinalsRound+1}}
 return world
}
export function internationalCalendarV5(){return[
 {week:8,label:'Qualifier 1'},{week:16,label:'Qualifier 2'},{week:24,label:'Qualifier 3'},{week:32,label:'Qualifier 4'},
 {week:37,label:'International Finals — Quarter-final'},{week:40,label:'International Finals — Semi-final'},{week:43,label:'International Finals — Final'},
]}
