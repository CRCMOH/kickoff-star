import { rand } from './rng'
// Phase 22b — squad lifecycle. Tier-1 NPCs (own squad) aren't static for the
// whole career: they grow a little each season, occasionally attract a
// transfer and leave, and get replaced so the squad list never quietly goes
// stale. Deliberately lightweight compared to the player's own attribute
// system — these are 15 people the player doesn't directly control.
import { generateSquad, type SquadPlayer } from './squad'

// Called once per season rollover. Small quality drift per player — some grow,
// a few plateau or dip slightly (not everyone on a youth team develops).
export function growSquadForSeason(squad: SquadPlayer[]): SquadPlayer[] {
  return squad.map((p) => {
    const delta = Math.round((rand() - 0.35) * 6) // biased upward, not guaranteed
    return { ...p, quality: clamp(p.quality + delta, 10, 99) }
  })
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export interface DepartureEvent {
  playerId: string
  playerName: string
  reason: 'transfer' | 'graduated' | 'dropped-out'
}

// Called once per season rollover, AFTER growth. Higher-quality players are
// more likely to attract a transfer (the same story the player themself is
// living); a small flat chance of graduating/dropping out covers everyone
// else. Caps departures at 2/season so the squad never gets gutted at once.
export function rollSquadDepartures(squad: SquadPlayer[]): { squad: SquadPlayer[]; departures: DepartureEvent[] } {
  const departures: DepartureEvent[] = []
  let remaining = [...squad]

  for (const p of squad) {
    if (departures.length >= 2) break
    const transferChance = p.quality > 75 ? 0.1 : p.quality > 60 ? 0.05 : 0.02
    const dropoutChance = 0.03
    const roll = rand()
    if (roll < transferChance) {
      departures.push({ playerId: p.id, playerName: p.name, reason: 'transfer' })
    } else if (roll < transferChance + dropoutChance) {
      departures.push({ playerId: p.id, playerName: p.name, reason: rand() < 0.5 ? 'graduated' : 'dropped-out' })
    }
  }

  if (departures.length > 0) {
    const departedIds = new Set(departures.map((d) => d.playerId))
    remaining = remaining.filter((p) => !departedIds.has(p.id))
    // replace 1-for-1 with fresh signings/call-ups at a similar level to what
    // was lost, keeping the squad at a full 15
    const replacementBase = Math.round(remaining.reduce((a, p) => a + p.quality, 0) / Math.max(1, remaining.length) / 8)
    const fresh = generateSquad(Math.max(1, replacementBase)).slice(0, departures.length)
    remaining = [...remaining, ...fresh]
  }

  return { squad: remaining, departures }
}
