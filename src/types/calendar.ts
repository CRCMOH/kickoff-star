export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type CalendarEventType =
  | 'training'
  // P32: a mid-week street kickabout or a coach-run small-sided game
  | 'street'
  | 'match'
  | 'school'
  | 'rest'
  | 'trial-week'
  | 'squad-selection'
  | 'random-event'

export interface CalendarEvent {
  id: string
  day: DayOfWeek
  type: CalendarEventType
  title: string // e.g. "finishing training", "matchday — vs riverside fc"
  resolved: boolean
}

export interface CalendarWeek {
  weekNumber: number
  seasonYear: number
  events: CalendarEvent[]
}

export interface CalendarState {
  currentWeek: CalendarWeek
  history: CalendarWeek[] // rolling window per CareerEvent log discipline
}
