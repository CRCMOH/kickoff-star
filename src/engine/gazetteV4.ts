export type GazetteCategory='result'|'selection'|'scouting'|'transfer'|'award'|'injury'|'academy'|'career'
export interface GazetteStory {id:string;week:number;category:GazetteCategory;headline:string;body:string;importance:1|2|3|4|5;entityIds:string[]}
export interface GazetteIssue {week:number;stories:GazetteStory[]}

export function story(week:number,category:GazetteCategory,headline:string,body:string,importance:1|2|3|4|5=2,entityIds:string[]=[]):GazetteStory{
  return{id:`gazette-${week}-${category}-${headline.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,28)}`,week,category,headline,body,importance,entityIds}
}
export function buildGazetteIssue(week:number,stories:GazetteStory[]):GazetteIssue{
  return{week,stories:stories.filter(s=>s.week===week).sort((a,b)=>b.importance-a.importance).slice(0,12)}
}
export function resultStory(week:number,competition:string,home:string,away:string,hg:number,ag:number):GazetteStory{
  const winner=hg===ag?'Honours even':hg>ag?`${home} take the points`:`${away} take the points`
  return story(week,'result',`${home} ${hg}–${ag} ${away}`,`${winner} in ${competition}. The result updates the live table and player award races.`,2,[home,away])
}
export function selectionStory(week:number,level:string,player:string,selected:boolean,detail:string):GazetteStory{
  return story(week,'selection',selected?`${player} selected for ${level}`:`${player} misses ${level} cut`,detail,selected?4:3,[player])
}
export function academyStory(week:number,club:string,event:'invite'|'pass'|'fail'|'offer'|'signing',player:string):GazetteStory{
  const headlines={invite:`${club} invite ${player} to assessment`,pass:`${player} passes ${club} assessment`,fail:`${player} falls short at ${club}`,offer:`${club} open scholarship talks`,signing:`${player} joins ${club} academy`}
  return story(week,'academy',headlines[event],event==='fail'?'The academy route remains open through future scouting and development.':'A major youth-career development with pathway consequences.',4,[club,player])
}
