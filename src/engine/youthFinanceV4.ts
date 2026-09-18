import type { YouthFinanceCategory, YouthFinanceState, YouthFinanceTransaction, YouthWorld } from '../types/youthWorld'

function clamp(v:number,lo:number,hi:number){return Math.max(lo,Math.min(hi,v))}
function txId(world:YouthWorld,week:number,label:string){return `fin-${week}-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${world.finance.transactions.length+1}`}

export interface FinanceActionResult {
  world: YouthWorld
  ok: boolean
  reason?: string
  amount?: number
}

function post(world:YouthWorld,week:number,amount:number,category:YouthFinanceCategory,label:string):YouthWorld{
  const t:YouthFinanceTransaction={id:txId(world,week,label),week,amount,category,label}
  const income=amount>0?amount:0
  const spent=amount<0?-amount:0
  return {
    ...world,
    finance:{
      ...world.finance,
      balance:Math.max(0,world.finance.balance+amount),
      transactions:[...world.finance.transactions,t].slice(-120),
      totalIncome:world.finance.totalIncome+income,
      totalSpent:world.finance.totalSpent+spent,
    },
  }
}

export function ensureYouthFinance(world:YouthWorld):YouthWorld{
  if(world.finance)return world
  const finance:YouthFinanceState={
    balance:25,familyAllowancePerMonth:18,lastAllowanceWeek:0,
    transportPasses:0,recoveryCredits:0,transactions:[],totalIncome:0,totalSpent:0,
  }
  return {...world,finance}
}

export function processMonthlyAllowance(world:YouthWorld,week:number,age:number,parentBond=0):YouthWorld{
  const due=week-world.finance.lastAllowanceWeek>=4
  if(!due)return world
  const ageBase=10+Math.max(0,age-13)*8
  const bondMod=1+clamp(parentBond/333,-.3,.3)
  const amount=Math.round(ageBase*bondMod)
  let next=post(world,week,amount,'allowance','Family allowance')
  next={...next,finance:{...next.finance,familyAllowancePerMonth:amount,lastAllowanceWeek:week}}
  return next
}

export interface YouthExpense {
  id:string
  label:string
  category:YouthFinanceCategory
  cost:number
  mandatory:boolean
  description:string
  effect:'logistics'|'recovery'|'equipment'|'none'
}

export const YOUTH_EXPENSES:YouthExpense[]=[
  {id:'bus-local',label:'Local transport',category:'transport',cost:4,mandatory:false,description:'Bus/taxi contribution for a local optional session.',effect:'logistics'},
  {id:'showcase-travel',label:'Showcase travel contribution',category:'showcase',cost:12,mandatory:true,description:'Travel contribution for an invitation-only showcase.',effect:'logistics'},
  {id:'academy-travel',label:'Academy trial travel',category:'trial',cost:16,mandatory:true,description:'Travel contribution for an academy assessment.',effect:'logistics'},
  {id:'recovery-basic',label:'Recovery session',category:'recovery',cost:10,mandatory:false,description:'Stretching, ice and supervised recovery. Adds one recovery credit.',effect:'recovery'},
  {id:'boots-basic',label:'Replacement boots',category:'equipment',cost:35,mandatory:false,description:'Reliable boots. Equipment purchase does not directly add attributes.',effect:'equipment'},
  {id:'meal-matchday',label:'Matchday meal',category:'food',cost:6,mandatory:false,description:'A proper pre/post-match meal. No permanent stat boost.',effect:'none'},
]

export function youthExpense(id:string){return YOUTH_EXPENSES.find(x=>x.id===id)}

function clubSupport(world:YouthWorld){
  const club=world.sundayClubs.find(c=>c.id===world.pathway.sundayClubId)
  return club?.transportSupport??'none'
}

export function transportCostFor(world:YouthWorld,baseCost:number,context:'school'|'sunday'|'showcase'|'academy'):number{
  // Mandatory school travel is school-funded. Representative/national duty is
  // handled by competition organizers elsewhere and never blocks selection.
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
    const label=context==='school'?'School-covered transport':'Club-covered transport'
    return {world:post(world,week,0,'club-support',label),ok:true,amount:0}
  }

  if(world.finance.balance<cost){
    if(expense.mandatory){
      // Critical design rule: money creates context, not dead careers. Family,
      // school or a bursary covers the shortfall for earned showcase/trial duty.
      const shortfall=cost-world.finance.balance
      let next=post(world,week,shortfall,'club-support',expense.category==='trial'?'Academy travel bursary':'Youth travel support')
      next=post(next,week,-cost,expense.category,expense.label)
      if(expense.effect==='recovery')next={...next,finance:{...next.finance,recoveryCredits:next.finance.recoveryCredits+1}}
      return {world:next,ok:true,amount:cost,reason:'Support covered the shortfall.'}
    }
    return {world,ok:false,reason:'Not enough money.',amount:cost}
  }

  let next=post(world,week,-cost,expense.category,expense.label)
  if(expense.effect==='recovery')next={...next,finance:{...next.finance,recoveryCredits:next.finance.recoveryCredits+1}}
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
  const already=world.finance.transactions.some(t=>t.week===week&&t.category==='odd-job')
  if(already)return {world,ok:false,reason:'You already worked an odd job this week.'}
  return {world:post(world,week,job.pay,'odd-job',job.label),ok:true,amount:job.pay,energyCost:job.energyCost}
}

export function applySundayClubSupport(world:YouthWorld,week:number):YouthWorld{
  const club=world.sundayClubs.find(c=>c.id===world.pathway.sundayClubId)
  if(!club)return world
  let next=world
  if(club.transportSupport==='full'){
    next={...next,finance:{...next.finance,transportPasses:next.finance.transportPasses+4}}
    next=post(next,week,0,'club-support',`${club.name}: monthly travel covered`)
  }else if(club.transportSupport==='partial'){
    next={...next,finance:{...next.finance,transportPasses:next.finance.transportPasses+2}}
    next=post(next,week,0,'club-support',`${club.name}: partial travel support`)
  }
  return next
}

export function consumeTransportPass(world:YouthWorld):YouthWorld{
  if(world.finance.transportPasses<=0)return world
  return {...world,finance:{...world.finance,transportPasses:world.finance.transportPasses-1}}
}

export function consumeRecoveryCredit(world:YouthWorld):YouthWorld{
  if(world.finance.recoveryCredits<=0)return world
  return {...world,finance:{...world.finance,recoveryCredits:world.finance.recoveryCredits-1}}
}

export function financeSummary(world:YouthWorld){
  const recent=world.finance.transactions.slice(-8)
  return {
    balance:world.finance.balance,
    monthlyAllowance:world.finance.familyAllowancePerMonth,
    totalIncome:world.finance.totalIncome,
    totalSpent:world.finance.totalSpent,
    transportPasses:world.finance.transportPasses,
    recoveryCredits:world.finance.recoveryCredits,
    recent,
  }
}
