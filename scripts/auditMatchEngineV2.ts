import { simulateMatchV2 } from '../src/engine/matchSimulationV2'
import type { Team } from '../src/engine/teams'

function team(name: string, attack: number, midfield: number, defense: number): Team {
  return {
    id: name,
    name,
    short: name.slice(0, 3).toUpperCase(),
    ratings: { attack, midfield, defense },
    prestige: 5,
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    notablePlayers: [],
  }
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

interface AuditResult {
  label: string
  matches: number
  homeGoals: number
  awayGoals: number
  draws: number
  homeWins: number
  awayWins: number
  fiveGoalMargins: number
  sevenPlusTeamGoals: number
  tenPlusTeamGoals: number
  maxScore: string
  maxTotal: number
}

function run(label: string, home: Team, away: Team, matches = 25000): AuditResult {
  const rng = seeded(20260917 + label.length)
  const result: AuditResult = {
    label, matches, homeGoals: 0, awayGoals: 0, draws: 0, homeWins: 0, awayWins: 0,
    fiveGoalMargins: 0, sevenPlusTeamGoals: 0, tenPlusTeamGoals: 0, maxScore: '0-0', maxTotal: 0,
  }
  for (let i = 0; i < matches; i++) {
    const m = simulateMatchV2(home, away, rng)
    result.homeGoals += m.homeGoals
    result.awayGoals += m.awayGoals
    if (m.homeGoals === m.awayGoals) result.draws++
    else if (m.homeGoals > m.awayGoals) result.homeWins++
    else result.awayWins++
    if (Math.abs(m.homeGoals - m.awayGoals) >= 5) result.fiveGoalMargins++
    if (Math.max(m.homeGoals, m.awayGoals) >= 7) result.sevenPlusTeamGoals++
    if (Math.max(m.homeGoals, m.awayGoals) >= 10) result.tenPlusTeamGoals++
    if (m.homeGoals + m.awayGoals > result.maxTotal) {
      result.maxTotal = m.homeGoals + m.awayGoals
      result.maxScore = `${m.homeGoals}-${m.awayGoals}`
    }
  }
  return result
}

const cases = [
  run('equal 52 v 52', team('Home52', 52, 52, 52), team('Away52', 52, 52, 52)),
  run('+3 OVR 55 v 52', team('Home55', 55, 55, 55), team('Away52b', 52, 52, 52)),
  run('+10 OVR 62 v 52', team('Home62', 62, 62, 62), team('Away52c', 52, 52, 52)),
  run('+20 OVR 70 v 50', team('Home70', 70, 70, 70), team('Away50', 50, 50, 50)),
]

let failed = false
for (const r of cases) {
  const avgH = r.homeGoals / r.matches
  const avgA = r.awayGoals / r.matches
  const blowoutRate = r.fiveGoalMargins / r.matches
  const sevenRate = r.sevenPlusTeamGoals / r.matches
  const tenRate = r.tenPlusTeamGoals / r.matches
  console.log(`\n${r.label}`)
  console.log(`avg goals ${avgH.toFixed(2)}-${avgA.toFixed(2)} | W/D/L ${(r.homeWins/r.matches*100).toFixed(1)} / ${(r.draws/r.matches*100).toFixed(1)} / ${(r.awayWins/r.matches*100).toFixed(1)}%`)
  console.log(`5+ margin ${(blowoutRate*100).toFixed(3)}% | 7+ goals by team ${(sevenRate*100).toFixed(3)}% | 10+ ${(tenRate*100).toFixed(4)}% | max ${r.maxScore}`)

  if (r.label.startsWith('equal') && (avgH + avgA < 1.5 || avgH + avgA > 4.0)) failed = true
  if (r.label.includes('+3') && blowoutRate > 0.01) failed = true
  if ((r.label.startsWith('equal') || r.label.includes('+3')) && tenRate > 0.0002) failed = true
}

if (cases[1].homeWins <= cases[0].homeWins) {
  console.error('FAIL: +3 OVR did not improve win frequency')
  failed = true
}
if (cases[2].homeWins <= cases[1].homeWins || cases[3].homeWins <= cases[2].homeWins) {
  console.error('FAIL: strength advantage is not monotonic')
  failed = true
}

if (failed) {
  console.error('\nV3.2 MATCH REALISM AUDIT FAILED')
  process.exit(1)
}
console.log('\nV3.2 MATCH REALISM AUDIT PASSED')
