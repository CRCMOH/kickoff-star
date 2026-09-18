import type { Player } from '../types/player'
import type {
  FirstTeamRole, PathwayHistoryEntry, SchoolSquadTier, SundayApproach,
  YouthPathwayState, YouthWorld,
} from '../types/youthWorld'
import { schoolById } from './youthWorld'

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export interface TrialOutcome {
  tier: SchoolSquadTier
  role: FirstTeamRole | null
  adjustedPerformance: number
  explanation: string
}

/**
 * Opening trials have five meaningful outcomes rather than pass/fail.
 * School strength moves the bar slightly, but never far enough to create a
 * mathematically impossible route. A cut player still has community routes.
 */
export function resolveOpeningTrial(world: YouthWorld, rawPerformance: number): TrialOutcome {
  const school = schoolById(world, world.selectedSchoolId)
  const difficulty = school ? 0.94 + ((school.footballRating - 48) / 34) * 0.12 : 1
  const p = clamp(rawPerformance / difficulty, 0, 1)
  if (p >= .60) return { tier:'first-team', role:'starter', adjustedPerformance:p, explanation:'You made the first XI.' }
  if (p >= .48) return { tier:'first-team', role:'rotation', adjustedPerformance:p, explanation:'You made the first-team squad as a rotation player.' }
  if (p >= .38) return { tier:'first-team', role:'bench', adjustedPerformance:p, explanation:'You made the first-team bench.' }
  if (p >= .22) return { tier:'reserve', role:null, adjustedPerformance:p, explanation:'You made the reserve team and can earn a call-up.' }
  if (p >= .11) return { tier:'development', role:null, adjustedPerformance:p, explanation:'You enter the development group with a six-week review.' }
  return { tier:'cut', role:null, adjustedPerformance:p, explanation:'You were cut from school football, but community routes remain open.' }
}

function mapLegacyRole(tier: SchoolSquadTier, role: FirstTeamRole | null): Player['squadRole'] {
  if (tier === 'first-team') return role === 'starter' ? 'starting-xi' : 'bench'
  if (tier === 'reserve' || tier === 'development') return 'reserves'
  return 'released'
}

export function applyTrialOutcome(world: YouthWorld, rawPerformance: number, week = 3): {
  world: YouthWorld
  legacySquadRole: Player['squadRole']
  outcome: TrialOutcome
} {
  const outcome = resolveOpeningTrial(world, rawPerformance)
  const history: PathwayHistoryEntry = {
    week, type: outcome.tier === 'cut' ? 'cut' : 'trial',
    title: outcome.tier === 'cut' ? 'Released after school trials' : 'School trials completed',
    detail: outcome.explanation,
  }
  const pathway: YouthPathwayState = {
    ...world.pathway,
    route: outcome.tier === 'cut' ? 'sunday-only' : 'school',
    schoolTier: outcome.tier,
    firstTeamRole: outcome.role,
    schoolTierSinceWeek: week,
    selectionScore: Math.round(outcome.adjustedPerformance * 100),
    exposure: {
      ...world.pathway.exposure,
      school: Math.round(outcome.adjustedPerformance * 8),
    },
    history: [...world.pathway.history, history],
  }
  return {
    world: { ...world, currentWeek: Math.max(world.currentWeek, week), pathway },
    legacySquadRole: mapLegacyRole(outcome.tier, outcome.role),
    outcome,
  }
}

export interface SchoolReviewInput {
  week: number
  recentForm: number // 0..10 match rating
  coachTrust: number // -10..10
  energy: number // 0..100
  trainingForm: number // -3..3
  abilityEdge: number // -20..20 vs positional competition
}

/**
 * Weekly/scheduled squad review. Movement is sticky: at least three weeks in
 * a tier before normal promotion/demotion, except a first-team fitness drop
 * can still move starter -> bench without deleting the player from the squad.
 */
export function reviewSchoolPath(world: YouthWorld, input: SchoolReviewInput): YouthWorld {
  const path = world.pathway
  if (path.schoolTier === 'cut') return world
  const form = clamp((input.recentForm - 5) / 4, 0, 1)
  const trust = clamp((input.coachTrust + 10) / 20, 0, 1)
  const fitness = clamp(input.energy / 100, 0, 1)
  const training = clamp((input.trainingForm + 3) / 6, 0, 1)
  const ability = clamp((input.abilityEdge + 20) / 40, 0, 1)
  const score = Math.round((form * .34 + trust * .26 + fitness * .14 + training * .14 + ability * .12) * 100)
  const settled = input.week - path.schoolTierSinceWeek >= 3

  let tier = path.schoolTier
  let role = path.firstTeamRole
  let type: PathwayHistoryEntry['type'] | null = null
  let title = ''
  let detail = ''

  if (tier === 'development' && settled && score >= 52) {
    tier = 'reserve'; role = null; type = 'promotion'; title = 'Promoted to reserves'; detail = 'Your development work earned competitive reserve football.'
  } else if (tier === 'reserve' && settled && score >= 66) {
    tier = 'first-team'; role = 'bench'; type = 'promotion'; title = 'First-team call-up'; detail = 'You have earned a place in the first-team matchday squad.'
  } else if (tier === 'first-team') {
    if (role === 'bench' && settled && score >= 72) {
      role = 'rotation'; type = 'promotion'; title = 'Rotation role earned'; detail = 'The coach now trusts you for regular first-team minutes.'
    } else if (role === 'rotation' && settled && score >= 82) {
      role = 'starter'; type = 'promotion'; title = 'Starting place earned'; detail = 'You have forced your way into the starting XI.'
    } else if (role === 'starter' && score < 48) {
      role = 'bench'; type = 'demotion'; title = 'Moved to the bench'; detail = input.energy < 40 ? 'Fatigue has cost you your starting place.' : 'Recent form has opened the door for a teammate.'
    } else if (role !== 'starter' && settled && score < 34) {
      tier = 'reserve'; role = null; type = 'demotion'; title = 'Moved to reserves'; detail = 'You need matches and form before returning to the first team.'
    }
  }

  if (!type) return { ...world, pathway: { ...path, selectionScore: score } }
  return {
    ...world,
    pathway: {
      ...path, schoolTier:tier, firstTeamRole:role, schoolTierSinceWeek:input.week, selectionScore:score,
      history:[...path.history,{ week:input.week, type, title, detail }],
    },
  }
}

export interface PerformanceEvidence {
  week: number
  competition: 'friendly' | 'school' | 'regional' | 'sunday' | 'representative' | 'showcase'
  rating: number
  minutes: number
  goalContributions?: number
  defensiveImpact?: number
  cleanSheet?: boolean
  scoutsPresent?: boolean
}

export function recordYouthPerformance(world: YouthWorld, e: PerformanceEvidence): YouthWorld {
  const quality = clamp((e.rating - 5.5) / 3.5, 0, 1)
  const minutes = clamp(e.minutes / 90, 0, 1)
  const impact = clamp((e.goalContributions ?? 0) * .16 + (e.defensiveImpact ?? 0) * .025 + (e.cleanSheet ? .08 : 0), 0, .35)
  const value = clamp((quality * .78 + impact) * minutes, 0, 1.2)
  const scout = e.scoutsPresent ? 1.35 : 1
  const ex = { ...world.pathway.exposure }

  if (e.competition === 'school' || e.competition === 'friendly') ex.school = clamp(ex.school + value * (e.competition === 'friendly' ? 2 : 4) * scout, 0, 100)
  if (e.competition === 'regional') {
    ex.school = clamp(ex.school + value * 3, 0, 100)
    ex.regional = clamp(ex.regional + value * 7 * scout, 0, 100)
    ex.academy = clamp(ex.academy + value * 3 * scout, 0, 100)
  }
  if (e.competition === 'sunday') {
    ex.grassroots = clamp(ex.grassroots + value * 5 * scout, 0, 100)
    ex.academy = clamp(ex.academy + value * 2.4 * scout, 0, 100)
  }
  if (e.competition === 'representative') {
    ex.regional = clamp(ex.regional + value * 5, 0, 100)
    ex.academy = clamp(ex.academy + value * 5 * scout, 0, 100)
  }
  if (e.competition === 'showcase') ex.academy = clamp(ex.academy + value * 9 * scout, 0, 100)

  let academyStatus = world.pathway.academyStatus
  if (academyStatus === 'none' && ex.academy >= 18) academyStatus = 'monitored'
  if (academyStatus === 'monitored' && ex.academy >= 42) academyStatus = 'trial-invited'

  return { ...world, currentWeek:Math.max(world.currentWeek,e.week), pathway:{...world.pathway, exposure:ex, academyStatus} }
}

function deterministicRoll(world: YouthWorld, salt: string): number {
  let h = 0
  const s = world.seed + '|' + salt
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0
  return ((h >>> 0) % 10000) / 10000
}

/**
 * Sunday clubs only approach a player when there is a believable discovery
 * route. Being cut lowers the exposure threshold because open community
 * sessions actively look for unattached players; school players are usually
 * discovered through performances.
 */
export function generateSundayApproaches(world: YouthWorld, week: number): YouthWorld {
  if (week < 7 || week > 41 || world.pathway.sundayClubId) return world
  const path = world.pathway
  const visible = path.exposure.school + path.exposure.regional * .7 + path.exposure.grassroots
  const threshold = path.schoolTier === 'cut' ? 3 : path.schoolTier === 'development' ? 7 : path.schoolTier === 'reserve' ? 10 : 14
  if (visible < threshold) return world

  const existing = new Set(path.pendingSundayApproaches.map(a => a.clubId))
  const candidates = world.sundayClubs
    .filter(c => !existing.has(c.id))
    .map(c => ({ club:c, score:c.exposure * 30 + c.coaching * .2 + deterministicRoll(world,`${week}-${c.id}`) * 25 }))
    .sort((a,b) => b.score-a.score)
    .slice(0, path.schoolTier === 'cut' ? 2 : 1)

  const approaches: SundayApproach[] = candidates.map(({club}, i) => {
    const strong = visible >= threshold + 18
    const kind: SundayApproach['kind'] =
      strong && i === 0 ? 'squad-offer' :
      path.schoolTier === 'cut' ? 'trial-invite' :
      visible >= threshold + 8 ? 'trial-invite' : 'training-invite'
    return {
      id:`${club.id}-w${week}`, clubId:club.id, kind, week, expiresWeek:week + 2, status:'pending',
      reason: path.schoolTier === 'cut'
        ? 'The club heard you were available and wants to assess you.'
        : 'A local coach has been following your school performances.',
    }
  })
  if (!approaches.length) return world
  return {
    ...world,
    pathway:{
      ...path,
      pendingSundayApproaches:[...path.pendingSundayApproaches,...approaches],
      history:[...path.history,...approaches.map(a => ({week,type:'sunday-approach' as const,title:'Sunday League approach',detail:a.reason}))],
    },
  }
}

export function respondToSundayApproach(world: YouthWorld, approachId: string, accept: boolean): YouthWorld {
  const hit = world.pathway.pendingSundayApproaches.find(a => a.id === approachId)
  if (!hit || hit.status !== 'pending') return world
  const offers = world.pathway.pendingSundayApproaches.map(a => a.id === approachId ? {...a,status:accept?'accepted':'declined' as const} : a)
  const club = world.sundayClubs.find(c => c.id === hit.clubId)
  return {
    ...world,
    pathway:{
      ...world.pathway,
      route: accept ? (world.pathway.schoolTier === 'cut' ? 'sunday-only' : 'school-and-sunday') : world.pathway.route,
      sundayClubId: accept ? hit.clubId : world.pathway.sundayClubId,
      pendingSundayApproaches:offers,
      history:[...world.pathway.history,{week:world.currentWeek,type:'sunday-approach',title:accept?'Sunday League route accepted':'Sunday League approach declined',detail:club ? `${club.name}: ${hit.kind}` : hit.kind}],
    },
  }
}

export interface RepresentativeSelectionInput {
  week: number
  regionalMatches: number
  averageRating: number
  minutes: number
  positionRankPercentile: number // 0 worst .. 1 best among position
}

export function evaluateRegionalSelection(world: YouthWorld, input: RepresentativeSelectionInput): YouthWorld {
  const exposure = clamp(world.pathway.exposure.regional / 100, 0, 1)
  const form = clamp((input.averageRating - 5.5) / 3.5, 0, 1)
  const sample = clamp(input.regionalMatches / 5, 0, 1) * clamp(input.minutes / 350, 0, 1)
  const score = form * .46 + input.positionRankPercentile * .28 + exposure * .16 + sample * .10
  const representative =
    score >= .72 ? 'regional-squad' :
    score >= .53 ? 'regional-longlist' :
    world.pathway.representative
  if (representative === world.pathway.representative) return world
  return {
    ...world,
    pathway:{
      ...world.pathway,
      representative,
      history:[...world.pathway.history,{week:input.week,type:'representative',title:representative === 'regional-squad' ? 'Selected for the Regional XI' : 'Named on the regional longlist',detail:'Selection was based on tournament form, positional competition and observed exposure.'}],
    },
  }
}

export function pathwayOptions(world: YouthWorld): string[] {
  const p = world.pathway
  const routes: string[] = []
  if (p.schoolTier === 'first-team') routes.push('Compete for school honours and representative selection')
  if (p.schoolTier === 'reserve') routes.push('Earn a first-team call-up through reserve football')
  if (p.schoolTier === 'development') routes.push('Develop toward the reserve-team review')
  if (p.schoolTier === 'cut') routes.push('Train independently and pursue open community/Sunday League routes')
  if (!p.sundayClubId) routes.push('Build local exposure for Sunday League approaches')
  if (p.sundayClubId) routes.push('Play Sunday League alongside eligible school football')
  if (p.representative !== 'regional-squad' && p.schoolTier !== 'cut') routes.push('Build regional performances for representative selection')
  if (p.academyStatus !== 'academy') routes.push('Build academy exposure toward a trial invitation')
  return routes
}
