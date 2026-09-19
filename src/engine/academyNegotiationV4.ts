export type AgentKind='parent'|'community-agent'|'licensed-agent'|'elite-agent'
export interface YouthAgent {id:string;kind:AgentKind;name:string;weeklyFee:number;signingFeePct:number;negotiation:number;trust:number;network:number;developmentFocus:number}
export interface NegotiationTerms {scholarship:number;travelSupport:number;equipmentSupport:number;rolePromise:'development'|'rotation-track'|'fast-track';releaseClause:boolean}
export interface AcademyNegotiation {
  offerId:string;clubId:string;weekStarted:number;week:number;round:1|2|3|4;agentId:string
  clubPatience:number;relationship:number;terms:NegotiationTerms;status:'active'|'agreed'|'walked-away'|'rejected'
  events:string[]
}
export const AGENTS:YouthAgent[]=[
 {id:'parent',kind:'parent',name:'Parent / Guardian',weeklyFee:0,signingFeePct:0,negotiation:46,trust:100,network:30,developmentFocus:82},
 {id:'community',kind:'community-agent',name:'Community Agent',weeklyFee:4,signingFeePct:3,negotiation:61,trust:72,network:58,developmentFocus:68},
 {id:'licensed',kind:'licensed-agent',name:'Licensed Youth Agent',weeklyFee:9,signingFeePct:6,negotiation:76,trust:66,network:78,developmentFocus:62},
 {id:'elite',kind:'elite-agent',name:'Elite Pathway Agent',weeklyFee:18,signingFeePct:9,negotiation:88,trust:58,network:94,developmentFocus:55},
]
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))
export function startAcademyNegotiation(offerId:string,clubId:string,week:number,agentId:string,baseScholarship:number):AcademyNegotiation{
 return{offerId,clubId,weekStarted:week,week,round:1,agentId,clubPatience:72,relationship:55,terms:{scholarship:baseScholarship,travelSupport:10,equipmentSupport:15,rolePromise:'development',releaseClause:false},status:'active',events:['Talks opened. The club expects a decision within two weeks.']}
}
export type NegotiationChoice='push-money'|'push-role'|'push-support'|'accept'|'walk-away'
export function negotiate(n:AcademyNegotiation,choice:NegotiationChoice,week:number):AcademyNegotiation{
 if(n.status!=='active')return n
 const agent=AGENTS.find(a=>a.id===n.agentId)??AGENTS[0],leverage=agent.negotiation/100
 if(choice==='accept')return{...n,week,status:'agreed',events:[...n.events,'Terms accepted. Registration can now be completed.']}
 if(choice==='walk-away')return{...n,week,status:'walked-away',events:[...n.events,'You ended negotiations.']}
 let patience=n.clubPatience-(10-leverage*5),relationship=n.relationship
 let terms={...n.terms},msg=''
 if(choice==='push-money'){terms.scholarship=Math.round((terms.scholarship+5+leverage*10)/5)*5;patience-=5;msg='Your representative pushed the scholarship package.'}
 if(choice==='push-role'){terms.rolePromise=terms.rolePromise==='development'?'rotation-track':'fast-track';patience-=9;relationship-=3;msg='You asked for a clearer football pathway.'}
 if(choice==='push-support'){terms.travelSupport+=Math.round(5+leverage*5);terms.equipmentSupport+=Math.round(5+leverage*6);patience-=4;msg='You asked the club to improve practical support.'}
 const round=Math.min(4,n.round+1) as 1|2|3|4
 const expired=week>n.weekStarted+2||patience<=15||round>=4&&patience<35
 return{...n,week,round,clubPatience:clamp(patience,0,100),relationship:clamp(relationship,0,100),terms,status:expired?'rejected':'active',events:[...n.events,msg,expired?'The club ended negotiations.':'Talks remain open.']}
}
