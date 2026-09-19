export interface CareerSummary {
  completed:boolean;reason:'professional-contract'|'graduated-without-academy'|'released'|'career-ended'
  age:number;finalOverall:number;peakOverall:number;matches:number;goals:number;assists:number
  trophies:string[];awards:string[];representativeCaps:number;academyName?:string;proClubName?:string
  legacyScore:number;headline:string
}
export function buildCareerSummary(input:Omit<CareerSummary,'completed'|'legacyScore'|'headline'>):CareerSummary{
 const legacy=Math.round(input.matches*.35+input.goals*1.8+input.assists*1.35+input.trophies.length*18+input.awards.length*12+input.representativeCaps*2.2+input.peakOverall*.9)
 const headline=input.reason==='professional-contract'?'Dream achieved — professional contract signed.'
  :input.reason==='graduated-without-academy'?'School career complete — no academy place secured before graduation.'
  :input.reason==='released'?'Youth career ends after academy release.':'Youth career complete.'
 return{...input,completed:true,legacyScore:legacy,headline}
}
export function shouldEndAtGraduation(age:number,graduated:boolean,academySigned:boolean,proSigned:boolean){
 return graduated&&!academySigned&&!proSigned&&age>=18
}
