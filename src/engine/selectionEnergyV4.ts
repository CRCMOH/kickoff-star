export interface SelectionEnergyInput {energy:number;importance:number;form:number;role:'starter'|'rotation'|'bench'|'development';daysSinceLastMatch:number;injured:boolean}
export interface SelectionEnergyResult {available:boolean;startChance:number;minutesCap:number;fatigueRisk:'low'|'medium'|'high'|'critical';reason:string}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))
export function selectionFromEnergy(x:SelectionEnergyInput):SelectionEnergyResult{
 if(x.injured)return{available:false,startChance:0,minutesCap:0,fatigueRisk:'critical',reason:'Unavailable through injury.'}
 const role={starter:24,rotation:8,bench:-10,development:-22}[x.role]
 const recovery=x.daysSinceLastMatch>=5?10:x.daysSinceLastMatch>=3?3:-10
 const startChance=clamp(Math.round(x.energy*.58+x.form*4+role+recovery+x.importance*.08),2,98)
 const minutesCap=x.energy>=75?90:x.energy>=60?82:x.energy>=45?68:x.energy>=30?45:25
 const fatigueRisk=x.energy<30?'critical':x.energy<45?'high':x.energy<62?'medium':'low'
 const available=x.energy>=20
 return{available,startChance,minutesCap,fatigueRisk,reason:!available?'Too fatigued to be safely selected.':x.energy<45?'Selection possible, but fatigue limits expected minutes.':'Available for normal selection.'}
}
export function postMatchEnergy(startEnergy:number,minutes:number,matchIntensity:number,travelLoad=0){
 const cost=(minutes/90)*(18+matchIntensity*12)+travelLoad
 return clamp(Math.round(startEnergy-cost),0,100)
}
