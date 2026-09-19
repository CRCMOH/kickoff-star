import type { Position } from '../types/attributes'
import type { RegionalTrialist } from './regionalSelectionV4'

export interface RepresentativePlayer {
  id:string;name:string;position:Position;overall:number;schoolId:string;regionId:string
  championshipRating:number;championshipMinutes:number;selected:boolean
}
export interface NationalSelection {
  countryId:string
  shortlist:RepresentativePlayer[]
  finalSquadIds:string[]
}
export interface InternationalTeam {
  id:string;name:string;strength:number
}

const NATIONAL_LIMITS:Record<string,number>={GK:3,CB:4,FB:4,CM:4,WM:2,WG:3,ST:3}

export function buildNationalShortlist(countryId:string,regionalSquads:RegionalTrialist[][]):NationalSelection{
  const candidates=regionalSquads.flat().filter(p=>p.selected).map((p,i):RepresentativePlayer=>({
    id:p.id,name:p.name,position:p.position,overall:p.overall,schoolId:p.schoolId,regionId:p.regionId,
    championshipRating:6+((p.campScore+i%7)%24)/10,championshipMinutes:180+(i%5)*55,selected:false,
  })).sort((a,b)=>b.championshipRating-a.championshipRating||b.championshipMinutes-a.championshipMinutes)
  return{countryId,shortlist:candidates.slice(0,46),finalSquadIds:[]}
}

export function selectNational23(selection:NationalSelection):NationalSelection{
  const picked:RepresentativePlayer[]=[]
  for(const [pos,limit] of Object.entries(NATIONAL_LIMITS)){
    picked.push(...selection.shortlist.filter(p=>p.position===pos).sort((a,b)=>b.championshipRating-a.championshipRating||b.championshipMinutes-a.championshipMinutes).slice(0,limit))
  }
  const unique=new Map(picked.map(p=>[p.id,p]))
  if(unique.size<23){
    for(const p of selection.shortlist){if(unique.size>=23)break;if(!unique.has(p.id))unique.set(p.id,p)}
  }
  const ids=new Set([...unique.keys()].slice(0,23))
  return{...selection,finalSquadIds:[...ids],shortlist:selection.shortlist.map(p=>({...p,selected:ids.has(p.id)}))}
}

export function internationalTeams(countryId:string):InternationalTeam[]{
  const names=['England Schools','South Africa Schools','Spain Schools','Germany Schools','France Schools','Italy Schools','Netherlands Schools','Portugal Schools']
  return names.map((name,i)=>({id:`intl-${i}`,name,strength:66+(i*3)%12})).map(t=>countryId&&t.name.toLowerCase().startsWith(countryId.toLowerCase())?{...t,strength:t.strength+2}:t)
}

export function internationalFormatNote(){
  return 'International qualifying/finals calendar remains intentionally unlocked until its dates are reconciled with representative duty and academy assessment.'
}
