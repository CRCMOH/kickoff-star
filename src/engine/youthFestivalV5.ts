import type { CompetitionTeamEntry, LeagueCompetitionState } from '../types/youthWorld'
import { initLeagueCompetition, simulateLeagueRound } from './youthCompetitionsV4'
export interface FestivalState{day:0|1|2|3;competition:LeagueCompetitionState;matchMinutes:40;complete:boolean;awards:{championId?:string;playerOfFestival?:string}}
export function createThreeDayFestival(id:string,teams:CompetitionTeamEntry[]):FestivalState{
 const chosen=teams.slice(0,4)
 return{day:0,competition:initLeagueCompetition(id,chosen,1),matchMinutes:40,complete:false,awards:{}}
}
export function advanceFestival(state:FestivalState,seed:string,playerTeamId?:string):FestivalState{
 if(state.complete)return state
 const next=simulateLeagueRound(state.competition,seed,playerTeamId)
 const day=Math.min(3,state.day+1) as 0|1|2|3
 const complete=day===3||next.complete
 const champion=complete?[...next.standings].sort((a,b)=>b.points-a.points||b.goalDifference-a.goalDifference)[0]?.teamId:undefined
 return{...state,day,competition:next,complete,awards:{...state.awards,championId:champion}}
}
export const festivalEnergyCost=(minutes=40)=>Math.round((minutes/90)*24)
export const festivalOvernightRecovery=(energy:number)=>Math.min(100,energy+28)
