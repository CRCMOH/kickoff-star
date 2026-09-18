import type { Position } from '../types/attributes'
import type {
  AcademyClub, SundayLeagueClub, YouthCalendarBlock, YouthCompetition, YouthNpcPlayer,
  YouthPathwayState, YouthSchool, YouthSchoolSquads, YouthScoutingProfile, YouthWorld, YouthFinanceState,
} from '../types/youthWorld'

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seeded(seed: string) {
  let x = hashSeed(seed) || 1
  return () => {
    x += 0x6D2B79F5
    let t = x
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DISTRICTS = [
  { id: 'north', name: 'North District' },
  { id: 'central', name: 'Central District' },
  { id: 'south', name: 'South District' },
  { id: 'west', name: 'West District' },
]

const SCHOOL_PREFIX = ['Westview', 'Greenwood', 'Riverside', 'Kingsway', 'Northridge', 'Parkside', 'Hillcrest', 'Lakeside', 'St Andrews', 'Central', 'Oakridge', 'Morningside', 'Fairmont', 'Newlands', 'Rocklands', 'Silverstream']
const SCHOOL_SUFFIX = ['High', 'Secondary', 'College', 'Academy']
const FIRST = ['Liam','Musa','Teboho','Jayden','Aiden','Kabelo','Ethan','Siyanda','Noah','Lethabo','Reece','Kamo','Luke','Thabo','Daniel','Aphiwe','Neo','Marcus','Kofi','Sam']
const LAST = ['Mokoena','Jacobs','Smith','Maseko','Dlamini','Adams','Nkosi','Williams','Mahlangu','Brown','Ndlovu','Mthembu','Peters','Molefe','Naidoo','Clarke','Mensah','Daniels','Khumalo','Botha']
const POSITIONS: Position[] = ['GK','CB','CB','FB','FB','CM','CM','WM','WG','WG','ST']

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)) }
function pick<T>(r: () => number, xs: T[]): T { return xs[Math.floor(r() * xs.length)] }

function makeNpc(r: () => number, school: YouthSchool, tier: YouthNpcPlayer['squadTier'], i: number): YouthNpcPlayer {
  const tierAdj = tier === 'first-team' ? 3 : tier === 'reserve' ? -2 : -7
  const overall = clamp(Math.round(school.footballRating + tierAdj + (r() - .5) * 16), 38, 82)
  return {
    id: `${school.id}-${tier}-${i}`,
    name: `${pick(r, FIRST)} ${pick(r, LAST)}`,
    age: tier === 'development' ? (r() < .7 ? 13 : 14) : (r() < .55 ? 14 : 15),
    position: POSITIONS[i % POSITIONS.length],
    overall,
    potentialBand: r() > .96 ? 'elite' : r() > .78 ? 'high' : r() < .14 ? 'low' : 'normal',
    form: Math.round((5.8 + r() * 1.5) * 10) / 10,
    energy: Math.round(78 + r() * 22),
    squadTier: tier,
  }
}

function makeSquads(r: () => number, school: YouthSchool): YouthSchoolSquads {
  return {
    firstTeam: Array.from({ length: 20 }, (_, i) => makeNpc(r, school, 'first-team', i)),
    reserve: Array.from({ length: 18 }, (_, i) => makeNpc(r, school, 'reserve', i)),
    development: Array.from({ length: 14 }, (_, i) => makeNpc(r, school, 'development', i)),
  }
}

function schoolIdentity(index: number) {
  if (index === 0) return { id: 'westview', name: 'Westview High' }
  if (index === 1) return { id: 'greenwood', name: 'Greenwood High' }
  if (index === 2) return { id: 'riverside', name: 'Riverside High' }
  const prefix = SCHOOL_PREFIX[index % SCHOOL_PREFIX.length]
  const suffix = SCHOOL_SUFFIX[Math.floor(index / SCHOOL_PREFIX.length) % SCHOOL_SUFFIX.length]
  return { id: `${prefix}-${suffix}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: `${prefix} ${suffix}` }
}

function generateSchools(r: () => number): YouthSchool[] {
  const schools = Array.from({ length: 32 }, (_, i) => {
    const identity = schoolIdentity(i)
    const district = DISTRICTS[i % DISTRICTS.length]
    const prestigeBase = i === 0 ? 82 : i === 1 ? 67 : i === 2 ? 49 : 45 + Math.round(r() * 38)
    const rating = clamp(Math.round(prestigeBase * .62 + 22 + (r() - .5) * 10), 48, 82)
    const school: YouthSchool = {
      ...identity,
      districtId: district.id,
      colours: i % 3 === 0 ? ['#d4af37','#111111'] : i % 3 === 1 ? ['#ffffff','#17355c'] : ['#be2332','#ffffff'],
      prestige: prestigeBase,
      footballRating: rating,
      coaching: clamp(rating + Math.round((r() - .5) * 12), 42, 88),
      facilities: clamp(prestigeBase + Math.round((r() - .5) * 16), 35, 92),
      youthDevelopment: clamp(rating + Math.round((r() - .5) * 14), 40, 90),
      scoutExposure: clamp(Math.round((.55 + prestigeBase / 100) * 100) / 100, .65, 1.45),
      style: pick(r, ['possession','direct','counter','pressing','balanced'] as const),
      rivalId: null,
      intakeStrength: clamp(Math.round(rating + (r() - .5) * 14), 40, 88),
    }
    return school
  })
  for (let i = 0; i < schools.length; i += 2) {
    if (schools[i + 1]) {
      schools[i].rivalId = schools[i + 1].id
      schools[i + 1].rivalId = schools[i].id
    }
  }
  return schools
}

function generateAcademyClubs(r: () => number): AcademyClub[] {
  const roots = ['North City','Metro Athletic','United Academy','Sporting Institute','Central FC','Coastal Academy','Highveld United','Capital City','Township Stars','Lakeside FC','Royal Youth','Pioneer Academy']
  const positions: Position[] = ['GK','CB','FB','CM','WM','WG','ST']
  return roots.map((name, i) => {
    const positionNeeds: Partial<Record<Position, number>> = {}
    for (const p of positions) positionNeeds[p] = Math.round(35 + r() * 60)
    return {
      id: `academy-${i+1}`,
      name,
      region: DISTRICTS[i % DISTRICTS.length].name,
      prestige: Math.round(55 + r() * 40),
      coaching: Math.round(60 + r() * 35),
      facilities: Math.round(58 + r() * 38),
      positionNeeds,
    }
  })
}

function initialFinances(seed:string): YouthFinanceState {
  const r=seeded(seed+'|finance')
  const familySupportLevel = r() < .2 ? 'limited' : r() > .86 ? 'strong' : 'normal'
  const balance = familySupportLevel === 'limited' ? 18 : familySupportLevel === 'strong' ? 42 : 28
  return {
    balance,
    familySupportLevel,
    transportPass:false,
    bootsCondition:82,
    weeklyPersonalBudget:familySupportLevel === 'limited' ? 5 : familySupportLevel === 'strong' ? 10 : 7,
    totalEarned:balance,
    totalSpent:0,
    transactions:[{
      id:'opening-balance',week:1,amount:balance,category:'allowance',
      description:'Starting pocket money / family support.',
    }],
  }
}

function initialScouting(academies: AcademyClub[]): YouthScoutingProfile {
  const academyInterest: YouthScoutingProfile['academyInterest'] = {}
  for (const club of academies) {
    academyInterest[club.id] = {
      clubId: club.id, awareness: 0, interest: 0, lastSeenWeek: null,
      matchesSeen: 0, status: 'unknown',
    }
  }
  return {
    localVisibility: 0,
    schoolReputation: 0,
    grassrootsReputation: 0,
    regionalReputation: 0,
    academyExposure: 0,
    academyInterest,
    knownScoutVisits: [],
  }
}

function generateSundayClubs(r: () => number): SundayLeagueClub[] {
  const roots = ['City Stars','Young Lions','Athletic Juniors','United Youth','Community FC','Dynamos','Rovers','Sporting','Warriors','Future Stars','Township United','Olympians']
  return Array.from({ length: 16 }, (_, i) => ({
    id: `sunday-${i + 1}`,
    name: `${DISTRICTS[i % 4].name.replace(' District','')} ${roots[i % roots.length]}`,
    districtId: DISTRICTS[i % 4].id,
    strength: Math.round(48 + r() * 27),
    coaching: Math.round(45 + r() * 35),
    exposure: Math.round((.55 + r() * .8) * 100) / 100,
    pathwayFocus: pick(r, ['minutes','development','results'] as const),
    transportSupport: pick(r, ['none','partial','partial','full'] as const),
  }))
}

export const YOUTH_COMPETITIONS: YouthCompetition[] = [
  { id:'preseason-friendlies', name:'School Preseason', kind:'friendly', prestige:1, monthStart:2, monthEnd:2, matchDay:'thursday', eligibleSquads:['first-team','reserve'], format:{type:'friendlies',targetMatches:3} },
  { id:'inter-schools', name:'Inter-Schools League', kind:'school-league', prestige:2, monthStart:3, monthEnd:3, matchDay:'thursday', eligibleSquads:['first-team'], format:{type:'league',teams:6,rounds:5} },
  { id:'reserve-league', name:'Inter-Schools Reserve League', kind:'reserve-league', prestige:1, monthStart:3, monthEnd:9, matchDay:'thursday', eligibleSquads:['reserve'], format:{type:'league',teams:8,rounds:7} },
  { id:'regional-schools', name:'Regional Schools Championship', kind:'school-cup', prestige:4, monthStart:4, monthEnd:5, matchDay:'thursday', eligibleSquads:['first-team'], format:{type:'groups-knockout',teams:24,groups:4,groupSize:6,qualifyPerGroup:2} },
  { id:'minor-school-cups', name:'School Invitationals', kind:'minor-school-cup', prestige:2, monthStart:6, monthEnd:9, matchDay:'thursday', eligibleSquads:['first-team','reserve'], format:{type:'knockout',teams:8} },
  { id:'sunday-league', name:'Sunday Youth League', kind:'sunday-league', prestige:2, monthStart:3, monthEnd:10, matchDay:'sunday', eligibleSquads:['first-team','reserve','development','cut'], format:{type:'league',teams:12,rounds:11} },
  { id:'regional-selection', name:'Regional Selection Camp', kind:'regional-selection', prestige:5, monthStart:6, monthEnd:6, matchDay:'mixed', eligibleSquads:['first-team','reserve'], format:{type:'selection',longlist:60,camp:35,finalSquad:23} },
  { id:'national-schools', name:'National Youth Championship', kind:'national-championship', prestige:7, monthStart:7, monthEnd:7, matchDay:'mixed', eligibleSquads:['first-team','reserve'], format:{type:'groups-knockout',teams:8,groups:2,groupSize:4,qualifyPerGroup:2} },
  { id:'youth-showcase', name:'Youth Showcase', kind:'showcase', prestige:6, monthStart:10, monthEnd:10, matchDay:'saturday', eligibleSquads:['first-team','reserve','development','cut'], format:{type:'showcase',matches:2} },
  { id:'academy-window', name:'Academy Trial Window', kind:'academy-trial', prestige:8, monthStart:11, monthEnd:11, matchDay:'mixed', eligibleSquads:['first-team','reserve','development','cut'], format:{type:'trial',sessions:3} },
]

export const YOUTH_CALENDAR: YouthCalendarBlock[] = [
  { id:'jan-trials', weeks:[1,3], month:1, title:'School Trials', primary:'training', sundayLeagueAvailable:false, notes:'Three-week opening selection process.' },
  { id:'feb-preseason', weeks:[4,7], month:2, title:'Preseason', primary:'friendly', schoolMatchDay:'thursday', sundayLeagueAvailable:false, notes:'Friendlies establish the school pecking order.' },
  { id:'mar-inter-schools', weeks:[8,12], month:3, title:'Inter-Schools League', primary:'school-league', schoolMatchDay:'thursday', sundayLeagueAvailable:true, notes:'Five local competitive school fixtures.' },
  { id:'apr-regional-groups', weeks:[13,17], month:4, title:'Regional Group Stage', primary:'school-cup', schoolMatchDay:'thursday', sundayLeagueAvailable:true, notes:'Five group matches; top two advance.' },
  { id:'may-regional-knockouts', weeks:[18,20], month:5, title:'Regional Knockouts', primary:'school-cup', schoolMatchDay:'thursday', sundayLeagueAvailable:true, notes:'Quarter-final, semi-final, final.' },
  { id:'jun-selection', weeks:[21,24], month:6, title:'Regional Selection + School Football', primary:'regional-selection', schoolMatchDay:'thursday', sundayLeagueAvailable:true, notes:'Minor school fixtures continue around representative selection.' },
  { id:'jul-national', weeks:[25,29], month:7, title:'National Championship', primary:'national-championship', sundayLeagueAvailable:true, notes:'Representative football overrides conflicting club/school fixtures.' },
  { id:'aug-school', weeks:[30,33], month:8, title:'School Football', primary:'friendly', schoolMatchDay:'thursday', sundayLeagueAvailable:true, notes:'Friendlies, derbies and smaller fixtures.' },
  { id:'sep-invitational', weeks:[34,37], month:9, title:'Schools Invitational', primary:'minor-school-cup', schoolMatchDay:'thursday', sundayLeagueAvailable:true, notes:'Prestigious but not a progression requirement.' },
  { id:'oct-showcase', weeks:[38,41], month:10, title:'Showcase Month', primary:'showcase', sundayLeagueAvailable:true, notes:'Sunday League finale and invitation-only showcase.' },
  { id:'nov-academy', weeks:[42,45], month:11, title:'Academy Trial Window', primary:'academy-trial', sundayLeagueAvailable:false, notes:'Academies invite monitored prospects to assessments.' },
  { id:'dec-offseason', weeks:[46,48], month:12, title:'Off-season', primary:'off-season', sundayLeagueAvailable:false, notes:'Recovery, season review and development choices.' },
]

export function initialPathway(): YouthPathwayState {
  return {
    route:'school', schoolTier:'development', firstTeamRole:null, schoolTierSinceWeek:0,
    sundayClubId:null, representative:'none', academyStatus:'none',
    exposure:{school:0,grassroots:0,regional:0,academy:0},
    selectionScore:0, pendingSundayApproaches:[], history:[],
  }
}

export function createYouthWorld(seed: string, selectedSchoolId: string | null = null, seasonYear = 1): YouthWorld {
  const r = seeded(seed)
  const schools = generateSchools(r)
  const schoolSquads: Record<string, YouthSchoolSquads> = {}
  for (const school of schools) schoolSquads[school.id] = makeSquads(r, school)
  const academyClubs = generateAcademyClubs(r)
  return {
    version:1, seed, seasonYear, currentWeek:1, selectedSchoolId,
    districts:DISTRICTS, schools, schoolSquads,
    sundayClubs:generateSundayClubs(r),
    academyClubs,
    scouting:initialScouting(academyClubs),
    competitionWorld:{ interSchools:null,reserveLeague:null,regionalSchools:null,minorSchoolCup:null,sundayLeague:null,nationalChampionship:null },
    finances:initialFinances(seed),
    competitions:YOUTH_COMPETITIONS,
    calendar:YOUTH_CALENDAR,
    pathway:initialPathway(),
  }
}

export function schoolById(world: YouthWorld, id: string | null) {
  return id ? world.schools.find(s => s.id === id) : undefined
}

export function calendarBlockForWeek(world: YouthWorld, week: number) {
  return world.calendar.find(b => week >= b.weeks[0] && week <= b.weeks[1])
}
