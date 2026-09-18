import type { Position } from './attributes'

export type SchoolSquadTier = 'first-team' | 'reserve' | 'development' | 'cut'
export type FirstTeamRole = 'starter' | 'rotation' | 'bench'
export type RepresentativeLevel = 'none' | 'regional-longlist' | 'regional-squad' | 'national-longlist' | 'national-squad'
export type YouthRoute = 'school' | 'school-and-sunday' | 'sunday-only' | 'academy'

export interface YouthSchool {
  id: string
  name: string
  districtId: string
  colours: [string, string]
  prestige: number
  footballRating: number
  coaching: number
  facilities: number
  youthDevelopment: number
  scoutExposure: number
  style: 'possession' | 'direct' | 'counter' | 'pressing' | 'balanced'
  rivalId: string | null
  intakeStrength: number
}

export interface YouthNpcPlayer {
  id: string
  name: string
  age: number
  position: Position
  overall: number
  potentialBand: 'low' | 'normal' | 'high' | 'elite'
  form: number
  energy: number
  squadTier: Exclude<SchoolSquadTier, 'cut'>
}

export interface YouthSchoolSquads {
  firstTeam: YouthNpcPlayer[]
  reserve: YouthNpcPlayer[]
  development: YouthNpcPlayer[]
}

export interface SundayLeagueClub {
  id: string
  name: string
  districtId: string
  strength: number
  coaching: number
  exposure: number
  pathwayFocus: 'minutes' | 'development' | 'results'
  transportSupport: 'none' | 'partial' | 'full'
}

export type CompetitionKind =
  | 'friendly'
  | 'school-league'
  | 'school-cup'
  | 'reserve-league'
  | 'minor-school-cup'
  | 'sunday-league'
  | 'sunday-cup'
  | 'regional-selection'
  | 'national-championship'
  | 'showcase'
  | 'academy-trial'

export interface YouthCompetition {
  id: string
  name: string
  kind: CompetitionKind
  prestige: number
  monthStart: number
  monthEnd: number
  matchDay: 'thursday' | 'saturday' | 'sunday' | 'mixed'
  eligibleSquads: SchoolSquadTier[]
  format:
    | { type: 'friendlies'; targetMatches: number }
    | { type: 'league'; teams: number; rounds: number }
    | { type: 'groups-knockout'; teams: number; groups: number; groupSize: number; qualifyPerGroup: number }
    | { type: 'knockout'; teams: number }
    | { type: 'selection'; longlist: number; camp: number; finalSquad: number }
    | { type: 'showcase'; matches: number }
    | { type: 'trial'; sessions: number }
}

export interface YouthCalendarBlock {
  id: string
  weeks: [number, number]
  month: number
  title: string
  primary: CompetitionKind | 'training' | 'off-season'
  schoolMatchDay?: 'thursday' | 'saturday'
  sundayLeagueAvailable: boolean
  notes: string
}

export interface ExposureState {
  school: number
  grassroots: number
  regional: number
  academy: number
}

export interface SundayApproach {
  id: string
  clubId: string
  kind: 'training-invite' | 'trial-invite' | 'squad-offer' | 'tournament-invite'
  week: number
  expiresWeek: number
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  reason: string
}

export interface PathwayHistoryEntry {
  week: number
  type: 'trial' | 'promotion' | 'demotion' | 'cut' | 'sunday-approach' | 'representative' | 'academy'
  title: string
  detail: string
}

export interface YouthPathwayState {
  route: YouthRoute
  schoolTier: SchoolSquadTier
  firstTeamRole: FirstTeamRole | null
  schoolTierSinceWeek: number
  sundayClubId: string | null
  representative: RepresentativeLevel
  academyStatus: 'none' | 'monitored' | 'trial-invited' | 'trialling' | 'academy'
  exposure: ExposureState
  selectionScore: number
  pendingSundayApproaches: SundayApproach[]
  history: PathwayHistoryEntry[]
}

export interface YouthWorld {
  version: 1
  seed: string
  seasonYear: number
  currentWeek: number
  selectedSchoolId: string | null
  districts: { id: string; name: string }[]
  schools: YouthSchool[]
  schoolSquads: Record<string, YouthSchoolSquads>
  sundayClubs: SundayLeagueClub[]
  competitions: YouthCompetition[]
  calendar: YouthCalendarBlock[]
  pathway: YouthPathwayState
}
