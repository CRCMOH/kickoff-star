import type { DayOfWeek } from '../types/calendar'
import type { CompetitionKind, SchoolSquadTier, YouthWorld } from '../types/youthWorld'

export type YouthScheduleEventKind =
  | 'school-training'
  | 'personal-training'
  | 'recovery'
  | 'school-match'
  | 'reserve-match'
  | 'development-session'
  | 'sunday-training'
  | 'sunday-match'
  | 'representative-duty'
  | 'showcase'
  | 'academy-trial'
  | 'rest'

export interface YouthScheduleEvent {
  id: string
  day: DayOfWeek
  kind: YouthScheduleEventKind
  title: string
  mandatory: boolean
  competition?: CompetitionKind
  estimatedEnergy: number
  priority: number
  blockedReason?: string
}

export interface YouthWeekSchedule {
  week: number
  blockId: string
  events: YouthScheduleEvent[]
  projectedEnergyDelta: number
  congestion: 'light' | 'normal' | 'heavy' | 'critical'
  warnings: string[]
}

const DAY_INDEX: Record<DayOfWeek, number> = { mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6 }

function event(id: string, day: DayOfWeek, kind: YouthScheduleEventKind, title: string, mandatory: boolean, estimatedEnergy: number, priority: number, competition?: CompetitionKind): YouthScheduleEvent {
  return { id, day, kind, title, mandatory, estimatedEnergy, priority, competition }
}

function tierMatch(world: YouthWorld, week: number): YouthScheduleEvent | null {
  const tier = world.pathway.schoolTier
  const block = world.calendar.find(b => week >= b.weeks[0] && week <= b.weeks[1])
  if (!block) return null

  if (tier === 'first-team') {
    if (block.primary === 'school-league') return event(`school-${week}`,'thu','school-match','Inter-Schools League',true,-22,80,'school-league')
    if (block.primary === 'school-cup') return event(`regional-${week}`,'thu','school-match',week <= 17 ? 'Regional Schools — Group Stage' : 'Regional Schools — Knockout',true,-24,90,'school-cup')
    if (block.primary === 'minor-school-cup') return event(`minor-${week}`,'thu','school-match','School Invitational',true,-21,65,'minor-school-cup')
    if (block.primary === 'friendly') return event(`friendly-${week}`,'thu','school-match','School Friendly',false,-18,45,'friendly')
  }
  if (tier === 'reserve' && week >= 8 && week <= 37) {
    return event(`reserve-${week}`,'thu','reserve-match','Reserve Team Fixture',true,-19,55,'reserve-league')
  }
  if (tier === 'development') {
    return event(`development-${week}`,'thu','development-session','Development Match / Assessment',true,-13,40)
  }
  return null
}

function representativeEvent(world: YouthWorld, week: number): YouthScheduleEvent | null {
  const block = world.calendar.find(b => week >= b.weeks[0] && week <= b.weeks[1])
  if (!block) return null
  const rep = world.pathway.representative
  if (block.primary === 'regional-selection' && (rep === 'regional-longlist' || rep === 'regional-squad')) {
    return event(`rep-${week}`,'thu','representative-duty','Regional Selection Duty',true,-20,100,'regional-selection')
  }
  if (block.primary === 'national-championship' && rep === 'regional-squad') {
    return event(`national-${week}`,'sat','representative-duty','National Youth Championship',true,-25,110,'national-championship')
  }
  return null
}

function specialEvent(world: YouthWorld, week: number): YouthScheduleEvent | null {
  const block = world.calendar.find(b => week >= b.weeks[0] && week <= b.weeks[1])
  if (!block) return null
  if (block.primary === 'showcase' && world.pathway.exposure.academy >= 20) {
    return event(`showcase-${week}`,'sat','showcase','Youth Showcase',true,-22,105,'showcase')
  }
  if (block.primary === 'academy-trial' && world.pathway.academyStatus === 'trial-invited') {
    return event(`academy-${week}`,'sat','academy-trial','Academy Trial Session',true,-18,120,'academy-trial')
  }
  return null
}

function sundayEvent(world: YouthWorld, week: number): YouthScheduleEvent | null {
  if (!world.pathway.sundayClubId) return null
  const block = world.calendar.find(b => week >= b.weeks[0] && week <= b.weeks[1])
  if (!block?.sundayLeagueAvailable) return null
  return event(`sunday-${week}`,'sun','sunday-match','Sunday League Match',true,-22,70,'sunday-league')
}

function resolveConflicts(events: YouthScheduleEvent[]): YouthScheduleEvent[] {
  const sorted = [...events].sort((a,b) => b.priority-a.priority)
  const accepted: YouthScheduleEvent[] = []
  for (const candidate of sorted) {
    const sameDay = accepted.find(e => e.day === candidate.day)
    if (sameDay) {
      accepted.push({ ...candidate, blockedReason:`Unavailable — ${sameDay.title} takes priority.` })
      continue
    }
    const matchLike = ['school-match','reserve-match','sunday-match','representative-duty','showcase','academy-trial'].includes(candidate.kind)
    if (matchLike) {
      const tooClose = accepted.find(e => {
        const otherMatch = ['school-match','reserve-match','sunday-match','representative-duty','showcase','academy-trial'].includes(e.kind)
        return otherMatch && Math.abs(DAY_INDEX[e.day]-DAY_INDEX[candidate.day]) < 2 && !e.blockedReason
      })
      if (tooClose && candidate.priority < tooClose.priority) {
        accepted.push({ ...candidate, blockedReason:`Unavailable — recovery window after ${tooClose.title}.` })
        continue
      }
    }
    accepted.push(candidate)
  }
  return accepted.sort((a,b) => DAY_INDEX[a.day]-DAY_INDEX[b.day])
}

export function buildYouthWeekSchedule(world: YouthWorld, week: number, startingEnergy = 100): YouthWeekSchedule {
  const block = world.calendar.find(b => week >= b.weeks[0] && week <= b.weeks[1])
  if (!block) throw new Error(`No V4 youth calendar block for week ${week}`)

  const events: YouthScheduleEvent[] = [
    event(`recovery-mon-${week}`,'mon','recovery','Recovery / Reset',false,+16,20),
    event(`school-train-${week}`,'tue','school-training','School Training',world.pathway.schoolTier !== 'cut',-10,35),
    event(`personal-${week}`,'wed','personal-training','Personal Development',false,-8,15),
    event(`rest-fri-${week}`,'fri','recovery','Recovery Day',false,+14,20),
  ]
  const school = tierMatch(world,week)
  const rep = representativeEvent(world,week)
  const special = specialEvent(world,week)
  const sunday = sundayEvent(world,week)
  if (school) events.push(school)
  if (rep) events.push(rep)
  if (special) events.push(special)
  if (sunday) {
    events.push(event(`sunday-train-${week}`,'sat','sunday-training','Sunday Club Session',false,-7,18))
    events.push(sunday)
  } else if (!special && !rep) {
    events.push(event(`rest-sat-${week}`,'sat','rest','Rest / Personal Time',false,+10,5))
  }

  const resolved = resolveConflicts(events)
  const active = resolved.filter(e => !e.blockedReason)
  const projectedEnergyDelta = active.reduce((n,e)=>n+e.estimatedEnergy,0)
  const matchCount = active.filter(e => ['school-match','reserve-match','sunday-match','representative-duty','showcase','academy-trial'].includes(e.kind)).length
  const projectedEnd = Math.max(0,Math.min(100,startingEnergy+projectedEnergyDelta))
  const warnings: string[] = []
  if (matchCount >= 2) warnings.push('Two-match week: recovery choices matter.')
  if (projectedEnd < 45) warnings.push('Projected to finish the week tired.')
  if (projectedEnd < 30) warnings.push('High fatigue risk: skip optional work or training.')
  if (resolved.some(e=>e.blockedReason)) warnings.push('A fixture or session has been overridden by higher-priority duty.')

  const congestion = projectedEnd < 25 || matchCount >= 3 ? 'critical' : projectedEnd < 45 || matchCount === 2 ? 'heavy' : active.length >= 6 ? 'normal' : 'light'
  return { week, blockId:block.id, events:resolved, projectedEnergyDelta, congestion, warnings }
}

export interface EnergyPlanResult {
  endEnergy: number
  matchStarts: { eventId: string; energy: number }[]
  overload: boolean
}

export function simulateScheduleEnergy(schedule: YouthWeekSchedule, startEnergy: number): EnergyPlanResult {
  let energy = Math.max(0,Math.min(100,startEnergy))
  const matchStarts: { eventId:string; energy:number }[] = []
  const matchKinds = new Set<YouthScheduleEventKind>(['school-match','reserve-match','sunday-match','representative-duty','showcase','academy-trial'])
  for (const e of schedule.events) {
    if (e.blockedReason) continue
    if (matchKinds.has(e.kind)) matchStarts.push({eventId:e.id,energy})
    energy = Math.max(0,Math.min(100,energy+e.estimatedEnergy))
  }
  return { endEnergy:energy, matchStarts, overload:matchStarts.some(m=>m.energy<40) }
}
