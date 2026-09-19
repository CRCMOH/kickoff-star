import type { CompetitionKind } from '../types/youthWorld'
export type CareerRoute='school'|'grassroots'|'academy'
export type SeasonPhase='preseason'|'league'|'cup'|'representative'|'october'|'festival'|'offseason'
export interface CareerCalendarEvent{week:number;phase:SeasonPhase;route:CareerRoute;kind:string;title:string;competition?:CompetitionKind;mandatory:boolean;replacement:boolean;priority:number;matchMinutes?:number}
export interface CareerCalendar{year:number;events:CareerCalendarEvent[]}
const e=(week:number,phase:SeasonPhase,route:CareerRoute,kind:string,title:string,mandatory=true,replacement=false,priority=50,competition?:CompetitionKind,matchMinutes=90):CareerCalendarEvent=>({week,phase,route,kind,title,competition,mandatory,replacement,priority,matchMinutes})
export function buildSchoolCalendar(year:number):CareerCalendar{
 const a:CareerCalendarEvent[]=[]
 a.push(e(1,'preseason','school','school-trials','School Trials — Week 1',true,false,100),e(2,'preseason','school','school-trials','School Trials — Week 2',true,false,100),e(3,'preseason','school','school-trials','School Trials — Final Match',true,false,100))
 a.push(e(4,'preseason','school','friendly','School Friendly 1',true,false,50,'friendly'),e(5,'preseason','school','friendly','School Friendly 2',true,false,50,'friendly'))
 for(let r=0;r<18;r++)a.push(e(6+r,'league','school','school-league',`Inter-Schools League — Round ${r+1}`,true,false,70,'school-league'))
 for(let r=0;r<5;r++)a.push(e(24+r,'cup','school','regional-group',`Regional Schools Cup — Group Match ${r+1}`,true,false,85,'school-cup'))
 for(let r=0;r<5;r++)a.push(e(24+r,'league','school','development-comp',`Schools Development Competition — Match ${r+1}`,true,true,55,'friendly'))
 a.push(e(29,'representative','school','regional-camp-60','Regional Selection — 60 Player Camp',false,false,105,'regional-selection'),e(30,'representative','school','regional-camp-35','Regional Selection — Cut to 35',false,false,105,'regional-selection'),e(31,'representative','school','regional-camp-23','Regional Selection — Final 23',false,false,105,'regional-selection'))
 for(let r=0;r<4;r++)a.push(e(32+r,'representative','school','national-championship',`National Schools Championship — Match ${r+1}`,false,false,110,'national-championship'))
 for(let r=0;r<5;r++)a.push(e(36+r,'october','school','schools-october-league',r<4?`October Schools League — Match ${r+1}`:'October Schools League — Bye / Finals',true,true,75,'reserve-league'))
 a.push(e(41,'festival','school','festival-day-1','Youth Festival — Day 1',false,true,80,'showcase',40),e(42,'festival','school','festival-day-2','Youth Festival — Day 2',false,true,80,'showcase',40),e(43,'festival','school','festival-day-3','Youth Festival — Day 3',false,true,80,'showcase',40))
 return{year,events:a}
}
export function buildGrassrootsCalendar(year:number):CareerCalendar{
 const a:CareerCalendarEvent[]=[]
 a.push(e(1,'preseason','grassroots','club-trials','Grassroots Club Trials — Week 1',true,false,100),e(2,'preseason','grassroots','club-trials','Grassroots Club Trials — Week 2',true,false,100),e(3,'preseason','grassroots','club-trials','Grassroots Club Trials — Final Match',true,false,100),e(4,'preseason','grassroots','friendly','Club Friendly 1',true,false,50,'friendly'),e(5,'preseason','grassroots','friendly','Club Friendly 2',true,false,50,'friendly'))
 for(let r=0;r<22;r++)a.push(e(6+r,'league','grassroots','grassroots-league',`Grassroots League — Round ${r+1}`,true,false,70,'sunday-league'))
 ;[9,13,17,21,25].forEach((w,i)=>a.push(e(w,'cup','grassroots','grassroots-cup',`Grassroots Cup — Round ${i+1}`,true,false,85,'minor-school-cup')))
 for(let r=0;r<5;r++)a.push(e(36+r,'october','grassroots','grassroots-october-league',r<4?`October Development League — Match ${r+1}`:'October Development League — Bye / Finals',true,true,75,'reserve-league'))
 a.push(e(41,'festival','grassroots','festival-day-1','Grassroots Festival — Day 1',false,true,80,'showcase',40),e(42,'festival','grassroots','festival-day-2','Grassroots Festival — Day 2',false,true,80,'showcase',40),e(43,'festival','grassroots','festival-day-3','Grassroots Festival — Day 3',false,true,80,'showcase',40))
 return{year,events:a}
}
export function replacementFootball(route:CareerRoute,_from:string,week:number){return Array.from({length:5},(_,i)=>e(week+i+1,'league',route,route==='school'?'school-development':'grassroots-development',route==='school'?`Schools Development Competition — Match ${i+1}`:`Development Fixture — Match ${i+1}`,true,true,55,'friendly'))}
export function mergeCalendarAfterElimination(calendar:CareerCalendar,route:CareerRoute,competition:string,week:number){const keys=new Set(calendar.events.map(x=>`${x.week}|${x.kind}`));return{...calendar,events:[...calendar.events,...replacementFootball(route,competition,week).filter(x=>!keys.has(`${x.week}|${x.kind}`))].sort((a,b)=>a.week-b.week||b.priority-a.priority)}}
export const careerEventsForWeek=(c:CareerCalendar,w:number)=>c.events.filter(x=>x.week===w).sort((a,b)=>b.priority-a.priority)
export function calendarHealth(c:CareerCalendar){const active=new Set(c.events.filter(x=>x.week>=1&&x.week<=43).map(x=>x.week));return{activeWeeks:active.size,deadWeeks:Array.from({length:43},(_,i)=>i+1).filter(w=>!active.has(w))}}
