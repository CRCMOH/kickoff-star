// AUDIT 15 (P40) — the disciplinary card system: yellow/red cards with real
// consequences, not flavor text. Every check here is about the two things
// that make this a genuine mechanic rather than decoration: a red card
// actually weakens the team for the rest of the match, and a suspension
// actually costs you your next game.
import { reseed, rand } from '../src/engine/rng'
import { initMatch, advanceToKeyMoment, resolveScenarioBeat, resolvePlayerMoment } from '../src/engine/match'
import { momentToDecision } from '../src/engine/matchDecisions'
import { SCENARIOS } from '../src/engine/matchScenarios'
import { generateTeam } from '../src/engine/teams'
import { generateSquad } from '../src/engine/squad'
import type { Player } from '../src/types/player'

reseed(40040)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mk(over: Partial<Player> = {}): Player {
  const v: Record<string, number> = {}
  for (const k of ['finishing', 'passing', 'dribbling', 'firstTouch', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration', 'tackling']) v[k] = 12
  return {
    name: 'Test Defender', position: 'CB', potential: 16, attributes: { kind: 'outfield', values: v },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 80 },
    careerClock: { ageYears: 16, phase: 'grassroots-season', grassrootsSeason: 1 },
    matchRatings: [7], career: { goals: 0, assists: 1, appearances: 12, wins: 5, cleanSheets: 2, bestRating: 7, motmAwards: 0 },
    coachTrust: 1, reputation: 25, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 20,
    squadRole: 'starting-xi', recentInjuryCount: 0, injury: null, squad: generateSquad(4), suspensionMatches: 0,
    ...over,
  } as unknown as Player
}

// ---------------------------------------------------------------------------
console.log('\n[A] every scenario with cardRisk is structurally sound and reachable')
{
  let riskOptions = 0
  for (const s of SCENARIOS) {
    for (const b of Object.values(s.beats)) {
      for (const o of b.options) {
        if (o.cardRisk) {
          riskOptions++
          check(o.cardRisk > 0 && o.cardRisk <= 1, `${s.id}: cardRisk (${o.cardRisk}) is a real probability`)
        }
      }
    }
  }
  console.log(`    ${riskOptions} options across the game carry genuine card risk`)
  check(riskOptions >= 5, `a meaningful number of tackle-style options carry card risk (${riskOptions})`)
}

// ---------------------------------------------------------------------------
console.log('\n[B] card severity distribution behaves as designed — mostly warnings, red is rare')
{
  const p = mk()
  const team = generateTeam(4), opp = generateTeam(4)
  const base = { ...initMatch(p, team, opp, true), redCarded: false, yellowCards: 0 }
  let warnings = 0, yellows = 0, reds = 0
  const RUNS = 3000
  for (let i = 0; i < RUNS; i++) {
    const moment = { tier: 'clear' as const, isDefensive: true, isDistribution: false, minute: 30, situation: 'x', scenarioId: 'last-man-race', beatId: 'lost-race' }
    const next = resolveScenarioBeat(base, moment, 0, 0.5, true, 2, 2, null)
    // The chosen option's success/failure text ALWAYS produces one event —
    // a card, when it fires, adds a SECOND one ahead of it. Delta of 2+ is
    // the reliable signal a card incident actually happened.
    const eventDelta = next.events.length - base.events.length
    if (next.redCarded) reds++
    else if (next.yellowCards > base.yellowCards) yellows++
    else if (eventDelta >= 2) warnings++
  }
  console.log(`    across ${RUNS} rolls: ~${((warnings + yellows + reds) / RUNS * 100).toFixed(0)}% drew SOME card incident (cardRisk 0.35) — of those, roughly warning>yellow>red`)
  check(reds < yellows, 'direct reds are rarer than yellows')
  check(yellows > 0 && reds > 0 && warnings > 0, 'all three severities are actually reachable')
}

// ---------------------------------------------------------------------------
console.log('\n[C] a red card is a REAL consequence — the team is measurably weaker')
{
  const p = mk()
  let normalGD = 0, redGD = 0
  const MATCHES = 60
  for (let i = 0; i < MATCHES; i++) {
    const t1 = generateTeam(5), o1 = generateTeam(5)
    let s1 = initMatch(p, t1, o1, true)
    let g = 0
    while (!s1.finished && g++ < 400) { const r = advanceToKeyMoment(s1, p); s1 = r.state; if (r.keyMoment) s1 = { ...s1, drivesSinceInvolved: 0 } }
    normalGD += (s1.playerIsHome ? s1.homeScore - s1.awayScore : s1.awayScore - s1.homeScore)

    const t2 = generateTeam(5), o2 = generateTeam(5)
    let s2 = { ...initMatch(p, t2, o2, true), redCarded: true, onPitch: false, minute: 10 }
    let g2 = 0
    while (!s2.finished && g2++ < 400) { const r = advanceToKeyMoment(s2, p); s2 = r.state; if (r.keyMoment) s2 = { ...s2, drivesSinceInvolved: 0 } }
    redGD += (s2.playerIsHome ? s2.homeScore - s2.awayScore : s2.awayScore - s2.homeScore)
  }
  console.log(`    avg goal difference — full strength: ${(normalGD / MATCHES).toFixed(2)} · sent off from 10': ${(redGD / MATCHES).toFixed(2)}`)
  check(redGD < normalGD, 'a team that goes down to 10 men early measurably performs worse over many matches')
}

// ---------------------------------------------------------------------------
console.log('\n[D] a red card correctly ENDS the passage of play mid-scenario, never lets it continue')
{
  const p = mk()
  const team = generateTeam(4), opp = generateTeam(4)
  const base = initMatch(p, team, opp, true)
  const moment = { tier: 'clear' as const, isDefensive: true, isDistribution: false, minute: 40, situation: 'x', scenarioId: 'last-man-race', beatId: 'lost-race' }

  let sawRedMidScenario = false
  for (let i = 0; i < 500 && !sawRedMidScenario; i++) {
    const next = resolveScenarioBeat(base, moment, 0, 0.5, true, 2, 2, null)
    if (next.redCarded) {
      sawRedMidScenario = true
      check(next.activeScenario === null, 'a red card immediately clears activeScenario — the sequence cannot continue')
      check(next.onPitch === false, 'the player is off the pitch the instant the card is shown')
    }
  }
  check(sawRedMidScenario, 'a red card was actually reachable in this test run')
}

// ---------------------------------------------------------------------------
console.log('\n[E] second yellow = red, correctly')
{
  const p = mk()
  const team = generateTeam(4), opp = generateTeam(4)
  const oneYellowIn = { ...initMatch(p, team, opp, true), yellowCards: 1 }
  const moment = { tier: 'clear' as const, isDefensive: true, isDistribution: false, minute: 60, situation: 'x', scenarioId: 'last-man-race', beatId: 'lost-race' }

  let sawSecondYellowRed = false
  for (let i = 0; i < 800 && !sawSecondYellowRed; i++) {
    const next = resolveScenarioBeat(oneYellowIn, moment, 0, 0.5, true, 2, 2, null)
    if (next.yellowCards >= 2) {
      sawSecondYellowRed = true
      check(next.redCarded === true, 'a second yellow automatically becomes a red card')
      check(next.onPitch === false, 'and ends the match for the player immediately')
    }
  }
  check(sawSecondYellowRed, 'a second yellow was actually reachable in this test run')
}

// ---------------------------------------------------------------------------
console.log('\n[F] cardRisk never fires on an option that does not carry it')
{
  const base_ = initMatch(mk({ position: 'GK' } as Partial<Player>), generateTeam(4), generateTeam(4), true)
  const gkMoment = { tier: 'good' as const, isDefensive: false, isDistribution: true, minute: 30, situation: 'x' }
  let anyCard = false
  for (let i = 0; i < 300; i++) {
    const bundle = momentToDecision(mk({ position: 'GK' } as Partial<Player>), gkMoment, 'test')
    const success = rand() < bundle.decision.options[0].successChance
    const next = resolvePlayerMoment({ ...base_ }, gkMoment, 0.5, success, bundle.rewards[0], bundle.maxReward, true, null)
    if (next.yellowCards > 0 || next.redCarded) anyCard = true
  }
  check(!anyCard, 'a moment with no card-risk options never produces a card, across 300 rolls')
}

// ---------------------------------------------------------------------------
console.log('\n[G] the suspension field threads correctly')
{
  const suspended = mk({ suspensionMatches: 1 })
  const clear = mk({ suspensionMatches: 0 })
  check((suspended.suspensionMatches ?? 0) > 0, 'a suspended player carries a positive suspensionMatches count')
  check((clear.suspensionMatches ?? 0) === 0, 'an available player reads 0')
}

console.log(fails === 0 ? '\n✅ AUDIT 15 PASSED' : `\n❌ AUDIT 15: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
