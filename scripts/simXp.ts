// P49 — measure the XP curve against a full simulated career before it
// touches any real code. Standalone, disposable — not a permanent audit,
// just the tuning pass we agreed to run before building UI/wiring.
import { spendXp, trainingXpForDrill, matchXpEarned, xpCostForLevel } from '../src/engine/xp'
import { toOvr } from '../src/engine/rating'
import type { ExecutionGrade } from '../src/engine/execution'

const OUTFIELD_ATTRS = ['passing', 'shooting', 'dribbling', 'tackling', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']
const SESSION_GROUPS: Record<string, string[]> = {
  finishing: ['shooting', 'composure', 'agility'],
  passing: ['passing', 'vision', 'positioning'],
  physical: ['pace', 'strength', 'stamina'],
  defending: ['tackling', 'positioning', 'concentration'],
  dribbling: ['dribbling', 'agility', 'composure'],
}
const SESSION_TYPES = Object.keys(SESSION_GROUPS)

function avgCA(values: Record<string, number>): number {
  return OUTFIELD_ATTRS.reduce((s, a) => s + values[a], 0) / OUTFIELD_ATTRS.length
}

// realistic-ish execution grade draw, weighted toward competent
function drawGrade(): ExecutionGrade {
  const r = Math.random()
  if (r < 0.12) return 'miss'
  if (r < 0.45) return 'ok'
  if (r < 0.85) return 'good'
  return 'perfect'
}

function runCareer(seasons: { weeks: number; tier: 'grassroots' | 'academy'; label: string }[], startCA: number) {
  const values: Record<string, number> = {}
  for (const a of OUTFIELD_ATTRS) values[a] = startCA
  const CEILING = 20

  console.log(`\n=== starting raw CA ${avgCA(values).toFixed(2)} (OVR ~${toOvr(avgCA(values))}) ===`)

  for (const season of seasons) {
    for (let week = 0; week < season.weeks; week++) {
      // two training sessions/week, session type rotates
      for (let t = 0; t < 2; t++) {
        const sType = SESSION_TYPES[(week * 2 + t) % SESSION_TYPES.length]
        const attrs = SESSION_GROUPS[sType]
        let pool = 0
        for (let d = 0; d < 3; d++) pool += trainingXpForDrill(drawGrade())
        const share = pool / attrs.length
        for (const a of attrs) {
          const r = spendXp(values[a], share, CEILING)
          values[a] = r.newLevel
        }
      }
      // ~90% of weeks have a match
      if (Math.random() < 0.9) {
        const rating = 5.5 + Math.random() * 3 // 5.5-8.5 spread
        const goals = Math.random() < 0.25 ? 1 : 0
        const assists = Math.random() < 0.15 ? 1 : 0
        const pool = matchXpEarned(season.tier, rating, goals, assists)
        const share = pool / OUTFIELD_ATTRS.length
        for (const a of OUTFIELD_ATTRS) {
          const r = spendXp(values[a], share, CEILING)
          values[a] = r.newLevel
        }
      }
    }
    const ca = avgCA(values)
    console.log(`${season.label} (${season.weeks}wk, ${season.tier}) exit — raw CA ${ca.toFixed(2)} · OVR ~${toOvr(ca)} · spread ${OUTFIELD_ATTRS.map((a) => values[a].toFixed(1)).join(',')}`)
  }
  return values
}

console.log('COST CURVE CHECK (XP to go from level N to N+1):')
for (const l of [2, 5, 8, 11, 14, 17, 19]) console.log(`  level ${l} -> ${l + 1}: ${xpCostForLevel(l)} XP`)

runCareer([
  { weeks: 44, tier: 'grassroots', label: 'Grassroots S1' },
  { weeks: 44, tier: 'grassroots', label: 'Grassroots S2' },
  { weeks: 44, tier: 'grassroots', label: 'Grassroots S3' },
  { weeks: 44, tier: 'grassroots', label: 'Grassroots S4' },
  { weeks: 38, tier: 'academy', label: 'Academy S1' },
  { weeks: 38, tier: 'academy', label: 'Academy S2' },
  { weeks: 38, tier: 'academy', label: 'Academy S3' },
], 2)
