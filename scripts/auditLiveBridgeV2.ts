import { resolveLegacyDriveShot, scoreSnapshot, type ResolvedDriveShot } from '../src/engine/matchResolutionV2'
import type { Team } from '../src/engine/teams'

type Tier = 'half' | 'good' | 'clear'

function team(name: string, attack: number, midfield: number, defense: number): Team {
  return { id: name, name, short: name.slice(0, 3).toUpperCase(), ratings: { attack, midfield, defense } } as Team
}

function seeded(seed: number) {
  let x = seed >>> 0
  return () => {
    x = (1664525 * x + 1013904223) >>> 0
    return x / 0x100000000
  }
}

const home = team('Home', 55, 55, 55)
const away = team('Away', 52, 52, 52)
const rng = seeded(32026)

let goals = 0
let onTarget = 0
let impossibleGoalOffTarget = 0
let total = 0
const byTier: Record<Tier, { goals: number; attempts: number }> = {
  half: { goals: 0, attempts: 0 },
  good: { goals: 0, attempts: 0 },
  clear: { goals: 0, attempts: 0 },
}

for (const tier of ['half', 'good', 'clear'] as Tier[]) {
  for (let i = 0; i < 50_000; i++) {
    const minute = 1 + (i % 90)
    const result: ResolvedDriveShot = resolveLegacyDriveShot(
      home,
      away,
      scoreSnapshot(0, 0, minute, true),
      true,
      tier,
      rng(),
      rng(),
    )
    total++
    byTier[tier].attempts++
    if (result.goal) {
      goals++
      byTier[tier].goals++
      if (!result.onTarget) impossibleGoalOffTarget++
    }
    if (result.onTarget) onTarget++
  }
}

const halfRate = byTier.half.goals / byTier.half.attempts
const goodRate = byTier.good.goals / byTier.good.attempts
const clearRate = byTier.clear.goals / byTier.clear.attempts
const overallSot = onTarget / total

console.log(`V3.2 live bridge: ${total.toLocaleString()} attempts`)
console.log(`goal rates half/good/clear ${(halfRate * 100).toFixed(1)} / ${(goodRate * 100).toFixed(1)} / ${(clearRate * 100).toFixed(1)}%`)
console.log(`overall SOT ${(overallSot * 100).toFixed(1)}% | goals ${goals} | goal-off-target ${impossibleGoalOffTarget}`)

const failures: string[] = []
if (impossibleGoalOffTarget !== 0) failures.push('A goal was recorded off target')
if (!(halfRate < goodRate && goodRate < clearRate)) failures.push('Chance tiers are not ordered by scoring probability')
if (halfRate < 0.04 || halfRate > 0.15) failures.push('Half-chance goal rate outside sanity band')
if (goodRate < 0.12 || goodRate > 0.32) failures.push('Good-chance goal rate outside sanity band')
if (clearRate < 0.25 || clearRate > 0.55) failures.push('Clear-chance goal rate outside sanity band')
if (overallSot < 0.28 || overallSot > 0.65) failures.push('Overall shots-on-target rate outside sanity band')

if (failures.length) {
  console.error('\nLIVE BRIDGE AUDIT FAILED')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nV3.2 LIVE BRIDGE AUDIT PASSED')
