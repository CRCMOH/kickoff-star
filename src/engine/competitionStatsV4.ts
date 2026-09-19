import type { Position } from '../types/attributes'

export interface CompetitionPlayerStats {
  playerId:string;name:string;teamId:string;position:Position
  apps:number;starts:number;minutes:number;goals:number;assists:number;cleanSheets:number;saves:number
  tackles:number;keyPasses:number;ratingTotal:number;potm:number
}
export interface CompetitionStatBook {competitionId:string;players:Record<string,CompetitionPlayerStats>}
export interface MatchStatLine {
  playerId:string;name:string;teamId:string;position:Position;started:boolean;minutes:number;goals:number;assists:number
  cleanSheet:boolean;saves:number;tackles:number;keyPasses:number;rating:number;potm:boolean
}
export interface CompetitionAwards {
  goldenBoot:CompetitionPlayerStats|null;playmaker:CompetitionPlayerStats|null;goldenGlove:CompetitionPlayerStats|null
  playerOfCompetition:CompetitionPlayerStats|null
}

export function emptyStatBook(competitionId:string):CompetitionStatBook{return{competitionId,players:{}}}
export function recordCompetitionStats(book:CompetitionStatBook,lines:MatchStatLine[]):CompetitionStatBook{
  const players={...book.players}
  for(const l of lines){
    const p=players[l.playerId]??{playerId:l.playerId,name:l.name,teamId:l.teamId,position:l.position,apps:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,saves:0,tackles:0,keyPasses:0,ratingTotal:0,potm:0}
    players[l.playerId]={...p,apps:p.apps+1,starts:p.starts+(l.started?1:0),minutes:p.minutes+l.minutes,goals:p.goals+l.goals,assists:p.assists+l.assists,cleanSheets:p.cleanSheets+(l.cleanSheet?1:0),saves:p.saves+l.saves,tackles:p.tackles+l.tackles,keyPasses:p.keyPasses+l.keyPasses,ratingTotal:p.ratingTotal+l.rating,potm:p.potm+(l.potm?1:0)}
  }
  return{...book,players}
}
const avg=(p:CompetitionPlayerStats)=>p.apps?p.ratingTotal/p.apps:0
const sort=(ps:CompetitionPlayerStats[],fn:(a:CompetitionPlayerStats,b:CompetitionPlayerStats)=>number)=>[...ps].sort(fn)[0]??null
export function competitionAwards(book:CompetitionStatBook):CompetitionAwards{
  const ps=Object.values(book.players)
  return{
    goldenBoot:sort(ps,(a,b)=>b.goals-a.goals||b.assists-a.assists||avg(b)-avg(a)),
    playmaker:sort(ps,(a,b)=>b.assists-a.assists||b.keyPasses-a.keyPasses||avg(b)-avg(a)),
    goldenGlove:sort(ps.filter(p=>p.position==='GK'),(a,b)=>b.cleanSheets-a.cleanSheets||b.saves-a.saves||avg(b)-avg(a)),
    playerOfCompetition:sort(ps.filter(p=>p.apps>=2),(a,b)=>(avg(b)+b.potm*.18+b.goals*.035+b.assists*.03)-(avg(a)+a.potm*.18+a.goals*.035+a.assists*.03)),
  }
}
export function leaderboard(book:CompetitionStatBook,metric:'goals'|'assists'|'rating'|'cleanSheets',limit=10){
  const ps=Object.values(book.players)
  return [...ps].sort((a,b)=>metric==='rating'?avg(b)-avg(a):(b[metric] as number)-(a[metric] as number)||avg(b)-avg(a)).slice(0,limit)
}
