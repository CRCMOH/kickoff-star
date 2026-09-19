export interface Venue {
  id:string;name:string;city:string;capacity:number;surface:'grass'|'artificial'|'mixed';quality:number
  floodlights:boolean;clubhouse:boolean;trainingPitches:number
}
export interface ClubIdentity {
  teamId:string;shortName:string;primaryVenueId:string;trainingVenueId:string;reputation:number
}
const NAMES=['Community Ground','Athletic Park','Memorial Field','Riverside Ground','Academy Fields','Sports Campus','Civic Stadium','Youth Arena']
function h(s:string){let x=0;for(const c of s)x=(x*31+c.charCodeAt(0))>>>0;return x}
export function buildPersistentVenues(teamIds:string[],seed:string):{venues:Venue[];identities:ClubIdentity[]}{
 const venues:Venue[]=[],identities:ClubIdentity[]=[]
 teamIds.forEach((teamId)=>{
  const n=h(seed+'|'+teamId),venue:Venue={id:`venue-${teamId}`,name:`${teamId.split('-').slice(0,2).map(x=>x[0]?.toUpperCase()+x.slice(1)).join(' ')} ${NAMES[n%NAMES.length]}`,city:'Local District',capacity:500+n%4501,surface:n%5===0?'artificial':n%7===0?'mixed':'grass',quality:45+n%46,floodlights:n%3!==0,clubhouse:n%4!==0,trainingPitches:1+n%3}
  venues.push(venue);identities.push({teamId,shortName:teamId.split('-').slice(0,2).join(' '),primaryVenueId:venue.id,trainingVenueId:venue.id,reputation:45+(n>>>4)%46})
 })
 return{venues,identities}
}
