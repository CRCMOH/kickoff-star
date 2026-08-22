// Phase 17 — season-wide scheduler. Replaces the old hardcoded MATCH_WEEKS set
// (which only ever had to fit ONE competition's 9 rounds) with a generic
// allocator that can seat several competitions' rounds into the same
// SEASON_WEEKS calendar without two competitions ever landing on the same week.
//
// Each competition is given a priority order (specs array order = priority).
// Higher-priority competitions place their rounds first and "reserve" those
// weeks; lower-priority ones are spread across whatever's left. This means
// the primary league always keeps its even spacing, and cups/friendlies slot
// into the gaps rather than fighting the league for the same weeks.

export interface CompetitionRoundSpec {
  id: string
  rounds: number
}

// Evenly spread `rounds` weeks across 1..seasonWeeks, skipping any week
// already in `reserved`. If there isn't enough room to space them evenly
// while avoiding reserved weeks, it falls back to nearest-available.
function distribute(seasonWeeks: number, rounds: number, reserved: Set<number>): number[] {
  const available: number[] = []
  for (let w = 1; w <= seasonWeeks; w++) if (!reserved.has(w)) available.push(w)

  if (rounds <= 0) return []
  if (rounds >= available.length) return available.slice(0, rounds)

  const picked: number[] = []
  const step = available.length / rounds
  for (let i = 0; i < rounds; i++) {
    const idx = Math.min(available.length - 1, Math.round(i * step))
    picked.push(available[idx])
  }
  // de-dupe in the rare case rounding collided two picks onto the same index,
  // filling forward from the next free slot
  const seen = new Set<number>()
  const result: number[] = []
  let cursor = 0
  for (const w of picked) {
    let candidate = w
    let ai = available.indexOf(candidate)
    while (seen.has(candidate) && ai + 1 < available.length) {
      ai += 1
      candidate = available[ai]
    }
    seen.add(candidate)
    result.push(candidate)
    cursor = ai
  }
  void cursor
  return result.sort((a, b) => a - b)
}

// Returns, per competition id, the sorted list of calendar weeks its rounds
// land on. Weeks never collide across competitions.
export function buildSeasonSchedule(seasonWeeks: number, specs: CompetitionRoundSpec[]): Record<string, number[]> {
  const reserved = new Set<number>()
  const out: Record<string, number[]> = {}
  for (const spec of specs) {
    const weeks = distribute(seasonWeeks, spec.rounds, reserved)
    weeks.forEach((w) => reserved.add(w))
    out[spec.id] = weeks
  }
  return out
}

// Convenience: the union of every competition's match weeks, for calendar
// generation ("is this a matchday at all, regardless of which competition").
export function allMatchWeeks(schedule: Record<string, number[]>): Set<number> {
  const all = new Set<number>()
  for (const weeks of Object.values(schedule)) weeks.forEach((w) => all.add(w))
  return all
}

// Given a completed week, which competition (if any) had a fixture there,
// and what round-within-that-competition it was.
export function competitionRoundForWeek(schedule: Record<string, number[]>, week: number): { competitionId: string; round: number } | null {
  for (const [competitionId, weeks] of Object.entries(schedule)) {
    const idx = weeks.indexOf(week)
    if (idx !== -1) return { competitionId, round: idx + 1 }
  }
  return null
}
