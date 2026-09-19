import type { YouthRoute } from '../types/youthWorld'
export type StartingYouthRoute = Extract<YouthRoute,'school'|'grassroots'>
export function routeLabel(route:StartingYouthRoute){return route==='school'?'School Football':'Grassroots Football'}
export function routeDescription(route:StartingYouthRoute){return route==='school'
 ? 'Represent a school, climb the school squad, qualify for regional and national representative football, and earn academy attention.'
 : 'Join a community club, play a full grassroots league and cup season, move through stronger divisions, and earn academy attention through club football.'}
