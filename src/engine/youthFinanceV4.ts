import type { FinanceTransaction, YouthFinanceState, YouthWorld } from '../types/youthWorld'

function clamp(v:number,lo:number,hi:number){return Math.max(lo,Math.min(hi,v))}
function txId(world:YouthWorld,week:number,label:string){
  return `fin-${week}-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${world.finances.transactions.length+1}`
}

export interface FinanceActionResult {
  world: YouthWorld
  ok: boolean
  reason?: string
  amount?: number
}

type FinanceCategory=FinanceTransaction['category']

function post(world:YouthWorld,week:number,amount:number,category:FinanceCategory,description:string):YouthWorld{
  const t:FinanceTransaction={id:txId(world,week,description),week,amount,category,description}
  return {
    ...world,
    finances:{
      ...world.finances,
      balance:Math.max(0,world.finances.balance+amount),
      transactions:[...world.finances.transactions,t].slice(-120),
      totalEarned:world.finances.totalEarned+(amount>0?amount:0),
      totalSpent:world.finances.totalSpent+(amount<0?-amount:0),
    },
  }
}

export function processMonthlyAllowance(world:YouthWorld,week:number,age:number,parentBond=0):YouthWorld{
  if(week-world.finances.lastAllowanceWeek<4)return world
  const base=10+Math.max(0,age-13)*8
  const supportMod=world.finances.familySupportLevel==='limited'?.72:world.finances.familySupportLevel==='strong'?1.28:1
  const bondMod=1+clamp(parentBond/333,-.3,.3)
  const amount=Math.max(4,Math.round(base*supportMod*bondMod))
  let next=post(world,week,amount,'allowance','Family allowance')
  next={...next,finances:{...next.finances,familyAllowancePerMonth:amount,lastAllowanceWeek:week}}
  return next
}

export interface YouthExpense {
  id:string
  label:string
  category:FinanceCategory
  cost:number
  mandatory:boolean
  description:string
  effect:'logistics'|'recovery'|'equipment'|'none'
}

export const YOUTH_EXPENSES:YouthExpense[]=[
  {id:'bus-local',label:'Local transport',category:'transport',cost:4,mandatory:false,description:'Bus/taxi contribution for an optional local session.',effect:'logistics'},
  {id:'showcase-travel',label:'Showcase travel contribution',category:'showcase',cost:12,mandatory:true,description:'Travel contribution for an invitation-only showcase.',effect:'logistics'},
  {id:'academy-travel',label:'Academy trial travel',category:'trial',cost:16,mandatory:true,description:'Travel contribution for an academy assessment.',effect:'logistics'},
  {id:'recovery-basic',label:'Recovery session',category:'recovery',cost:10,mandatory:false,description:'Stretching, ice and supervised recovery.',effect:'recovery'},
  {id:'boots-basic',label:'Replacement boots',category:'equipment',cost:35,mandatory:false,description:'Reliable replacement boots; no direct attribute boost.',effect:'equipment'},
  {id:'meal-matchday',label:'Matchday meal',category:'food',cost:6,mandatory:false,description:'A proper pre/post-match meal; no permanent stat boost.',effect:'none'},
]

export function youthExpense(id:string){return YOUTH_EXPENSES.find(x=>x.id===id)}

function clubSupport(world:YouthWorld){
  return world.sundayClubs.find(c=>c.id===world.pathway.sundayClubId)?.transportSupport??'none'
}

export function transportCostFor(world:YouthWorld,baseCost:number,context:'school'|'sunday'|'showcase'|'academy'):number{
  if(context==='school')return 0
  if(context==='sunday'){
    const support=clubSupport(world)
    if(support==='full')return 0
    if(support==='partial')return Math.ceil(baseCost*.5)
  }
  return baseCost
}

export function payYouthExpense(world:YouthWorld,week:number,expenseId:string,context?:'school'|'sunday'|'showcase'|'academy'):FinanceActionResult{
  const expense=youthExpense(expenseId)
  if(!expense)return {world,ok:false,reason:'Unknown expense.'}
  let cost=expense.cost
  if(expense.category==='transport'&&context)cost=transportCostFor(world,cost,context)

  if(cost===0){
    return {world:post(world,week,0,'club-support',context==='school'?'School-covered transport':'Club-covered transport'),ok:true,amount:0}
  }

  if(world.finances.balance<cost){
    if(!expense.mandatory)return {world,ok:false,reason:'Not enough money.',amount:cost}
    const shortfall=cost-world.finances.balance
    let next=post(world,week,shortfall,'academy-support',expense.category==='trial'?'Academy travel bursary':'Youth opportunity travel support')
    next=post(next,week,-cost,expense.category,expense.label)
    return {world:next,ok:true,amount:cost,reason:'Support covered the shortfall.'}
  }

  let next=post(world,week,-cost,expense.category,expense.label)
  if(expense.effect==='recovery')next={...next,finances:{...next.finances,recoveryCredits:next.finances.recoveryCredits+1}}
  if(expense.effect==='equipment')next={...next,finances:{...next.finances,bootsCondition:100}}
  return {world:next,ok:true,amount:cost}
}

export interface YouthOddJob {
  id:string
  label:string
  pay:number
  energyCost:number
  minAge:number
  availability:'weekday'|'saturday'
}

export const YOUTH_ODD_JOBS:YouthOddJob[]=[
  {id:'carwash',label:'Wash cars',pay:12,energyCost:16,minAge:14,availability:'saturday'},
  {id:'garden',label:'Help with a garden',pay:18,energyCost:24,minAge:14,availability:'saturday'},
  {id:'shop-help',label:'Help at a local shop',pay:22,energyCost:28,minAge:15,availability:'saturday'},
  {id:'coach-kids',label:'Help coach younger kids',pay:20,energyCost:20,minAge:15,availability:'weekday'},
  {id:'ref-juniors',label:'Referee a junior match',pay:25,energyCost:28,minAge:16,availability:'saturday'},
]

export function availableYouthJobs(age:number){return YOUTH_ODD_JOBS.filter(j=>age>=j.minAge)}

export function workYouthJob(world:YouthWorld,week:number,jobId:string,age:number,currentEnergy:number,hasSaturdayFootball:boolean):FinanceActionResult&{energyCost?:number}{
  const job=YOUTH_ODD_JOBS.find(j=>j.id===jobId)
  if(!job||age<job.minAge)return {world,ok:false,reason:'Job unavailable.'}
  if(job.availability==='saturday'&&hasSaturdayFootball)return {world,ok:false,reason:'You are committed to football on Saturday.'}
  if(currentEnergy-job.energyCost<25)return {world,ok:false,reason:'You are too tired to safely take this job.'}
  if(world.finances.transactions.some(t=>t.week===week&&t.category==='odd-job'))return {world,ok:false,reason:'You already worked an odd job this week.'}
  return {world:post(world,week,job.pay,'odd-job',job.label),ok:true,amount:job.pay,energyCost:job.energyCost}
}

export function applySundayClubSupport(world:YouthWorld,week:number):YouthWorld{
  const club=world.sundayClubs.find(c=>c.id===world.pathway.sundayClubId)
  if(!club)return world
  if(club.transportSupport==='none')return world
  const passes=club.transportSupport==='full'?4:2
  let next={...world,finances:{...world.finances,transportPasses:world.finances.transportPasses+passes,transportPass:club.transportSupport==='full'}}
  next=post(next,week,0,'club-support',`${club.name}: ${club.transportSupport} travel support`)
  return next
}

export function ageBoots(world:YouthWorld,weeks=1):YouthWorld{
  return {...world,finances:{...world.finances,bootsCondition:clamp(world.finances.bootsCondition-weeks*2,0,100)}}
}

export function consumeTransportPass(world:YouthWorld):YouthWorld{
  if(world.finances.transportPasses<=0)return world
  return {...world,finances:{...world.finances,transportPasses:world.finances.transportPasses-1}}
}

export function consumeRecoveryCredit(world:YouthWorld):YouthWorld{
  if(world.finances.recoveryCredits<=0)return world
  return {...world,finances:{...world.finances,recoveryCredits:world.finances.recoveryCredits-1}}
}

export function financeSummary(world:YouthWorld){
  return {
    balance:world.finances.balance,
    familySupportLevel:world.finances.familySupportLevel,
    monthlyAllowance:world.finances.familyAllowancePerMonth,
    totalIncome:world.finances.totalEarned,
    totalSpent:world.finances.totalSpent,
    transportPasses:world.finances.transportPasses,
    recoveryCredits:world.finances.recoveryCredits,
    bootsCondition:world.finances.bootsCondition,
    recent:world.finances.transactions.slice(-8),
  }
}
