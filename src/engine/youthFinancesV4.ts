import type { SundayLeagueClub, YouthFinanceState, YouthWorld } from '../types/youthWorld'

function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}
function txId(week:number,category:string,n:number){return `w${week}-${category}-${n}`}

export interface YouthExpense {
  id: string
  name: string
  category: 'transport' | 'food' | 'recovery' | 'equipment'
  cost: number
  optional: boolean
  description: string
  energyGain?: number
  bootsRepair?: number
}

export const YOUTH_EXPENSES: YouthExpense[] = [
  { id:'bus-fare',name:'Bus Fare',category:'transport',cost:4,optional:false,description:'Travel to a local match or training session.' },
  { id:'match-meal',name:'Matchday Meal',category:'food',cost:5,optional:true,description:'A proper pre-match meal. Mostly quality-of-life, not a paywall.' },
  { id:'recovery-basic',name:'Basic Recovery',category:'recovery',cost:7,optional:true,energyGain:8,description:'Stretching, ice and a recovery snack.' },
  { id:'recovery-physio',name:'Community Physio Session',category:'recovery',cost:16,optional:true,energyGain:16,description:'A proper recovery session after a heavy week.' },
  { id:'boots-repair',name:'Repair Boots',category:'equipment',cost:12,optional:true,bootsRepair:28,description:'Studs, stitching and glue. Extends the life of your current boots.' },
  { id:'boots-replace',name:'Replace Worn Boots',category:'equipment',cost:34,optional:true,bootsRepair:100,description:'Reliable youth-level boots. No magical attribute boost.' },
]

export interface YouthOddJob {
  id:string
  name:string
  minAge:number
  pay:number
  energyCost:number
  availableDay:'wednesday'|'saturday'
  description:string
}

export const YOUTH_ODD_JOBS: YouthOddJob[] = [
  {id:'carwash',name:'Wash Cars',minAge:14,pay:10,energyCost:12,availableDay:'saturday',description:'A few hours with buckets and sponges.'},
  {id:'garden',name:'Help With Gardening',minAge:14,pay:13,energyCost:17,availableDay:'saturday',description:'Physical work. Avoid it before a packed match weekend.'},
  {id:'shop-help',name:'Help at a Local Shop',minAge:15,pay:18,energyCost:18,availableDay:'saturday',description:'A longer shift for better money.'},
  {id:'junior-coach',name:'Help Coach Younger Kids',minAge:15,pay:16,energyCost:12,availableDay:'wednesday',description:'Help with cones, drills and a junior session.'},
  {id:'junior-ref',name:'Referee Junior Football',minAge:16,pay:20,energyCost:18,availableDay:'saturday',description:'A small match fee and more time around football.'},
]

export function allowanceAmount(age:number,support:YouthFinanceState['familySupportLevel']):number{
  const base=age<=14?12:age===15?16:age===16?20:24
  const mult=support==='limited'?.7:support==='strong'?1.35:1
  return Math.round(base*mult)
}

function addTransaction(finance:YouthFinanceState,week:number,amount:number,category:YouthFinanceState['transactions'][number]['category'],description:string):YouthFinanceState{
  return {
    ...finance,
    balance:Math.max(0,finance.balance+amount),
    totalEarned:finance.totalEarned+Math.max(0,amount),
    totalSpent:finance.totalSpent+Math.max(0,-amount),
    transactions:[...finance.transactions,{
      id:txId(week,category,finance.transactions.length+1),week,amount,category,description,
    }].slice(-120),
  }
}

/**
 * Essential youth-football costs can never end a career. If the player's
 * pocket-money balance cannot cover compulsory transport, family/club support
 * covers the shortfall and the ledger explains it.
 */
export function chargeEssential(finance:YouthFinanceState,week:number,cost:number,category:'transport'|'food',description:string):YouthFinanceState{
  if(cost<=0)return finance
  const personal=Math.min(finance.balance,cost)
  let next=personal>0?addTransaction(finance,week,-personal,category,description):finance
  const shortfall=cost-personal
  if(shortfall>0){
    next=addTransaction(next,week,shortfall,'club-support',`Support covered essential cost: ${description}`)
    next=addTransaction(next,week,-shortfall,category,description)
  }
  return next
}

export function applyMonthlyAllowance(world:YouthWorld,week:number,age:number):YouthWorld{
  // Approx every four in-game weeks. Week 1 opening balance already exists.
  if(week<=1||((week-1)%4)!==0)return world
  const amount=allowanceAmount(age,world.finances.familySupportLevel)
  return {...world,finances:addTransaction(world.finances,week,amount,'allowance','Monthly family allowance.')}
}

function sundayClub(world:YouthWorld):SundayLeagueClub|undefined{
  return world.pathway.sundayClubId?world.sundayClubs.find(c=>c.id===world.pathway.sundayClubId):undefined
}

export interface MatchCostContext {
  week:number
  age:number
  type:'school'|'reserve'|'sunday'|'representative'|'showcase'|'academy-trial'
  away:boolean
}

export function applyMatchdayFinances(world:YouthWorld,ctx:MatchCostContext):YouthWorld{
  let f=world.finances
  const travelBase=ctx.away?6:3

  if(ctx.type==='school'||ctx.type==='reserve'){
    // School provides team transport for away tournament trips, player covers only local connection.
    const personalTravel=ctx.away?2:3
    f=chargeEssential(f,ctx.week,personalTravel,'transport','Travel to school football.')
    if(ctx.away)f=addTransaction(f,ctx.week,travelBase-personalTravel,'club-support','School covered team transport.')
  }else if(ctx.type==='sunday'){
    const club=sundayClub(world)
    let playerShare=travelBase
    if(club?.transportSupport==='partial')playerShare=Math.ceil(travelBase*.5)
    if(club?.transportSupport==='full')playerShare=0
    if(playerShare>0)f=chargeEssential(f,ctx.week,playerShare,'transport','Travel to Sunday League football.')
    if(playerShare<travelBase)f=addTransaction(f,ctx.week,travelBase-playerShare,'club-support',`${club?.name??'Club'} travel support.`)
    // No youth wage at 14-15. Older community players may receive a small match allowance.
    if(ctx.age>=16){
      const allowance=ctx.age>=17?8:5
      f=addTransaction(f,ctx.week,allowance,'match-allowance','Small grassroots match allowance.')
    }
  }else if(ctx.type==='representative'){
    // Representative duty is fully funded.
    f=addTransaction(f,ctx.week,travelBase+5,'club-support','Regional programme covered travel and match meal.')
  }else if(ctx.type==='showcase'){
    f=chargeEssential(f,ctx.week,Math.max(2,travelBase-2),'transport','Travel to youth showcase.')
  }else if(ctx.type==='academy-trial'){
    // Inviting academy covers the expensive part; player never misses a trial because of money.
    f=addTransaction(f,ctx.week,travelBase,'academy-support','Inviting academy covered trial travel.')
  }

  // Boots wear from actual football, not menus.
  const wear=ctx.type==='representative'||ctx.type==='showcase'?5:ctx.type==='sunday'?4:3
  f={...f,bootsCondition:clamp(f.bootsCondition-wear,0,100)}
  return {...world,finances:f}
}

export function buyYouthExpense(world:YouthWorld,week:number,itemId:string):{world:YouthWorld;ok:boolean;reason?:string;energyGain?:number}{
  const item=YOUTH_EXPENSES.find(x=>x.id===itemId)
  if(!item)return {world,ok:false,reason:'Unknown item.'}
  if(item.optional&&world.finances.balance<item.cost)return {world,ok:false,reason:'Not enough personal money.'}
  let f=world.finances
  if(item.optional){
    f=addTransaction(f,week,-item.cost,item.category,item.name)
  }else{
    f=chargeEssential(f,week,item.cost,item.category as 'transport'|'food',item.name)
  }
  if(item.bootsRepair){
    f={...f,bootsCondition:itemId==='boots-replace'?100:clamp(f.bootsCondition+item.bootsRepair,0,100)}
  }
  return {world:{...world,finances:f},ok:true,energyGain:item.energyGain}
}

export function workYouthJob(world:YouthWorld,week:number,age:number,jobId:string,energy:number):{world:YouthWorld;ok:boolean;reason?:string;energyCost?:number}{
  const job=YOUTH_ODD_JOBS.find(j=>j.id===jobId)
  if(!job)return {world,ok:false,reason:'Unknown job.'}
  if(age<job.minAge)return {world,ok:false,reason:'You are too young for this job.'}
  if(energy-job.energyCost<30)return {world,ok:false,reason:'Too fatigued. The game will not let an odd job ruin match readiness.'}
  const already=world.finances.transactions.some(t=>t.week===week&&t.category==='odd-job')
  if(already)return {world,ok:false,reason:'You already worked an odd job this week.'}
  const finances=addTransaction(world.finances,week,job.pay,'odd-job',job.name)
  return {world:{...world,finances},ok:true,energyCost:job.energyCost}
}

export function weeklyFinancePlan(world:YouthWorld,week:number,age:number,hasSchoolMatch:boolean,hasSundayMatch:boolean){
  const allowance=((week-1)%4===0&&week>1)?allowanceAmount(age,world.finances.familySupportLevel):0
  const schoolTravel=hasSchoolMatch?3:0
  const club=sundayClub(world)
  let sundayTravel=hasSundayMatch?6:0
  if(hasSundayMatch&&club?.transportSupport==='partial')sundayTravel=3
  if(hasSundayMatch&&club?.transportSupport==='full')sundayTravel=0
  const matchAllowance=hasSundayMatch&&age>=16?(age>=17?8:5):0
  return {
    openingBalance:world.finances.balance,
    expectedIncome:allowance+matchAllowance,
    expectedEssentialCosts:schoolTravel+sundayTravel,
    projectedPersonalBalance:Math.max(0,world.finances.balance+allowance+matchAllowance-schoolTravel-sundayTravel),
    clubSupport:club?.transportSupport??'none',
  }
}

export function financeSummary(world:YouthWorld){
  const f=world.finances
  return {
    balance:f.balance,
    familySupport:f.familySupportLevel,
    bootsCondition:f.bootsCondition,
    totalEarned:f.totalEarned,
    totalSpent:f.totalSpent,
    lastTransactions:f.transactions.slice(-5),
  }
}
