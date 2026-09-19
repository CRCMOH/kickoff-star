import type { CompetitionKind } from '../types/youthWorld'

export type CareerRoute='school'|'grassroots'|'academy'
export type SeasonPhase='preseason'|'league'|'cup'|'representative'|'october'|'festival'|'offseason'
export interface CareerCalendarEvent {
  week:number;phase:SeasonPhase;route:CareerRoute;kind:string;title:string;competition?:CompetitionKind
  mandatory:boolean;replacement:boolean;priority:number
}
export interface CareerCalendar {year:number;events:CareerCalendarEvent[]}

function e(week:number,phase:SeasonPhase,route:CareerRoute,kind:string,title:string,mandatory=true,replacement=false,priority=50,competition?:CompetitionKind):CareerCalendarEvent{
  return{week,phase,route,kind,title,competition,mandatory,replacement,priority}
}

export function buildSchoolCalendar(year:number):CareerCalendar{
  const events:CareerCalendarEvent[]=[]
  for(let w=5;w<=13;w++)events.push(e(w,'league','school','school-league','Inter-Schools League',true,false,70,'school-league'))
  for(let w=15;w<=21;w++)events.push(e(w,'cup','school','regional-schools','Regional Schools Championship',true,false,85,'school-cup'))
  for(let w=23;w<=29;w++)events.push(e(w,'representative','school','representative-window','Regional / National Representative Window',false,false,100,'regional-selection'))
  for(let w=31;w<=34;w++)events.push(e(w,'october','school','schools-october-league','October Schools League',true,true,72,'reserve-league'))
  events.push(e(35,'festival','school','youth-festival-day-1','Youth Football Festival — Day 1',true,true,90,'showcase'))
  events.push(e(36,'festival','school','youth-festival-day-2','Youth Football Festival — Day 2',true,true,90,'showcase'))
  events.push(e(37,'festival','school','youth-festival-day-3','Youth Football Festival — Day 3',true,true,95,'showcase'))
  return{year,events}
}

export function buildGrassrootsCalendar(year:number):CareerCalendar{
  const events:CareerCalendarEvent[]=[]
  for(let w=4;w<=24;w++)events.push(e(w,'league','grassroots','sunday-league','Grassroots League',true,false,70,'sunday-league'))
  for(let w=9;w<=25;w+=4)events.push(e(w,'cup','grassroots','grassroots-cup','Grassroots Cup',true,false,80,'minor-school-cup'))
  for(let w=31;w<=34;w++)events.push(e(w,'october','grassroots','development-october-league','October Development League',true,true,72,'reserve-league'))
  for(let w=35;w<=37;w++)events.push(e(w,'festival','grassroots','youth-festival',`Youth Football Festival — Day ${w-34}`,true,true,90,'showcase'))
  return{year,events}
}

export function replacementFootball(route:CareerRoute,_eliminatedFrom:string,week:number):CareerCalendarEvent[]{
  const title=route==='school'?'School Development Fixture':'Development / Showcase Fixture'
  const kind=route==='school'?'school-development':'grassroots-development'
  return [week+1,week+2,week+3].map(w=>e(w,'league',route,kind,title,true,true,48,'friendly'))
}

export function mergeCalendarAfterElimination(calendar:CareerCalendar,route:CareerRoute,competition:string,week:number):CareerCalendar{
  const existing=new Set(calendar.events.map(x=>`${x.week}|${x.kind}`))
  const add=replacementFootball(route,competition,week).filter(x=>!existing.has(`${x.week}|${x.kind}`))
  return{...calendar,events:[...calendar.events,...add].sort((a,b)=>a.week-b.week||b.priority-a.priority)}
}

export function careerEventsForWeek(calendar:CareerCalendar,week:number){return calendar.events.filter(x=>x.week===week).sort((a,b)=>b.priority-a.priority)}

export function calendarHealth(calendar:CareerCalendar){
  const activeWeeks=new Set(calendar.events.filter(e=>e.week>=4&&e.week<=37).map(e=>e.week))
  return{activeWeeks:activeWeeks.size,deadWeeks:Array.from({length:34},(_,i)=>i+4).filter(w=>!activeWeeks.has(w))}
}
