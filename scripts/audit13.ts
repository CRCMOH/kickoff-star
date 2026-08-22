// AUDIT 13 (P37) — goalkeeper live-match distribution decisions.
//
// Found while building this: a GK on their own team's clear attacking chance
// was routed through buildKeyMoment(..., isDefensive=false, ...) exactly like
// an outfield player, which produced "the ball breaks to you in the box with
// the goal at your mercy" for a GOALKEEPER, and treated a "success" as the
// keeper personally scoring or assisting a goal. Both were nonsensical.
//
// This audit proves: (a) that bug is gone — a GK's own-team attacking moment
// is now a distribution decision, never a shooting one, and never resolves as
// a personal goal/assist; (b) the new distribution mechanic behaves sensibly
// — better distribution attribute wins more often, a bad pass is a real cost
// but rarely a straight goal against, and outfield players are completely
// unaffected by any of this.
import { reseed, rand } from '../src/engine/rng'
import { initMatch, advanceToKeyMoment, resolvePlayerMoment } from '../src/engine/match'
import { momentToDecision } from '../src/engine/matchDecisions'
import { generateTeam } from '../src/engine/teams'
import { generateSquad } from '../src/engine/squad'
import type { Player } from '../src/types/player'

reseed(37037)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mk(pos: string, distribution = 11, over: Partial<Player> = {}): Player {
  const values: Record<string, number> = {}
  for (const k of ['finishing', 'passing', 'dribbling', 'firstTouch', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) values[k] = 11
  for (const k of ['reflexes', 'handling', 'gkPositioning']) values[k] = 11
  values.distribution = distribution
  return {
    name: 'Test Keeper', position: pos, potential: 16,
    attributes: { kind: pos === 'GK' ? 'goalkeeper' : 'outfield', values },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 80 },
    careerClock: { ageYears: 16, phase: 'grassroots-season', grassrootsSeason: 1 },
    matchRatings: [7, 7, 7], career: { goals: 0, assists: 0, appearances: 12, wins: 5, cleanSheets: 2, bestRating: 7, motmAwards: 0 },
    coachTrust: 1, reputation: 25, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 20,
    squadRole: 'starting-xi', recentInjuryCount: 0, injury: null, squad: generateSquad(4),
    ...over,
  } as unknown as Player
}

function playAndCollectMoments(player: Player, runs: number) {
  const collected: import('../src/engine/match').KeyMoment[] = []
  let finalGoalsSum = 0
  for (let i = 0; i < runs; i++) {
    const team = generateTeam(4), opp = generateTeam(4)
    let s = initMatch(player, team, opp, true)
    let guard = 0
    while (!s.finished && guard++ < 400) {
      const r = advanceToKeyMoment(s, player)
      s = r.state
      if (r.keyMoment) {
        collected.push(r.keyMoment)
        s = { ...s, drivesSinceInvolved: 0 }
      }
    }
    finalGoalsSum += s.playerGoals
  }
  return { moments: collected, totalPlayerGoals: finalGoalsSum }
}

// ---------------------------------------------------------------------------
console.log('\n[A] THE BUG — a GK on their own attacking chance never gets a shooting moment')
{
  const gk = mk('GK')
  const { moments, totalPlayerGoals } = playAndCollectMoments(gk, 40)
  const ownAttackMoments = moments.filter((m) => !m.isDefensive)
  console.log(`    ${moments.length} total GK moments across 40 matches, ${ownAttackMoments.length} on own-team attacking chances`)

  check(ownAttackMoments.length > 0, 'a GK does get moments on their own team\'s attacking chances (not silently dropped)')
  check(ownAttackMoments.every((m) => m.isDistribution), 'every one of those is flagged as a DISTRIBUTION moment, never a plain attacking one')
  check(!ownAttackMoments.some((m) => m.situation.includes('goal at your mercy')), 'the old nonsensical "goal at your mercy" text never appears for a keeper')
  check(ownAttackMoments.every((m) => /pass|ball|pressure|space|decision/i.test(m.situation)), 'distribution situations read like a keeper starting play, not shooting')
  check(totalPlayerGoals === 0, `a goalkeeper NEVER personally scores from a distribution moment across 40 matches (got ${totalPlayerGoals} goals)`)
}

// ---------------------------------------------------------------------------
console.log('\n[B] outfield players are completely unaffected')
{
  const striker = mk('ST')
  const { moments } = playAndCollectMoments(striker, 30)
  const ownAttack = moments.filter((m) => !m.isDefensive)
  check(ownAttack.length > 0, 'an outfield player still gets attacking moments')
  check(ownAttack.every((m) => !m.isDistribution), 'none of them are ever flagged as distribution — that flag is GK-only')
  check(ownAttack.some((m) => m.situation.includes('mercy') || m.situation.includes('cross') || m.situation.includes('angle')), 'outfield attacking situations are untouched by the P37 change')
}

// ---------------------------------------------------------------------------
console.log('\n[C] the decision routes to a real distribution pool, not the shooting or attacking pools')
{
  const gk = mk('GK')
  const distMoment = { tier: 'clear' as const, isDefensive: false, isDistribution: true, minute: 40, situation: 'test' }
  const bundle = momentToDecision(gk, distMoment, 'test')
  check(bundle.decision.context === 'gk', 'distribution decisions are tagged as GK context, same UI treatment as saves')
  check(bundle.decision.options.length === 3, 'three real options offered')
  check(bundle.decision.options.every((o) => /pass|throw|roll|ball|wing|back/i.test(o.label)), `options describe passing choices, not shots (got: ${bundle.decision.options.map((o) => o.label).join(', ')})`)
  check(!bundle.decision.options.some((o) => /shot|finish|shoot|header|volley/i.test(o.label)), 'no shooting-flavoured option ever appears in a distribution decision')
}

// ---------------------------------------------------------------------------
console.log('\n[D] better distribution attribute genuinely helps')
{
  const runs = 4000
  const weakGK = mk('GK', 5)
  const strongGK = mk('GK', 18)
  const distMoment = { tier: 'good' as const, isDefensive: false, isDistribution: true, minute: 40, situation: 'test' }

  const successRate = (player: Player) => {
    const bundle = momentToDecision(player, distMoment, 'test')
    let successes = 0
    for (let i = 0; i < runs; i++) {
      const best = bundle.decision.options.reduce((a, b) => (a.successChance > b.successChance ? a : b))
      if (rand() < best.successChance) successes++
    }
    return successes / runs
  }
  const weak = successRate(weakGK)
  const strong = successRate(strongGK)
  console.log(`    best-option success rate — distribution 5: ${(weak * 100).toFixed(0)}% · distribution 18: ${(strong * 100).toFixed(0)}%`)
  check(strong > weak, 'a keeper with elite distribution succeeds more often than one with poor distribution')
  check(strong - weak > 0.1, 'the gap is meaningful, not cosmetic')
}

// ---------------------------------------------------------------------------
console.log('\n[E] resolving the decision behaves correctly — success is a pass, failure is a turnover, rarely a goal')
{
  const gk = mk('GK')
  const team = generateTeam(4), opp = generateTeam(4)
  const base = initMatch(gk, team, opp, true)

  // SUCCESS: never a goal/assist stat change, momentum moves up a little.
  const successState = resolvePlayerMoment(base, { tier: 'good', isDefensive: false, isDistribution: true, minute: 30, situation: 'x' }, 0.8, true, 2, 3, false, null)
  check(successState.playerGoals === 0 && successState.playerAssists === 0, 'a successful distribution never credits a goal or assist')
  check(successState.momentum >= base.momentum, 'a successful distribution nudges momentum up, not down')
  check(successState.events[successState.events.length - 1].text.length > 0, 'a real commentary line is produced')

  // FAILURE: usually just a turnover (score unchanged), occasionally a
  // direct goal against on a 'clear' tier — measure the rate rather than
  // asserting a single roll, since it's probabilistic by design.
  let directGoals = 0
  const FAILS = 2000
  for (let i = 0; i < FAILS; i++) {
    const failState = resolvePlayerMoment(base, { tier: 'clear', isDefensive: false, isDistribution: true, minute: 30, situation: 'x' }, 0.3, false, 1, 3, false, null)
    const concededAGoal = (base.playerIsHome ? failState.awayScore > base.awayScore : failState.homeScore > base.homeScore)
    if (concededAGoal) directGoals++
  }
  const rate = directGoals / FAILS
  console.log(`    a failed 'clear' distribution conceded directly ${(rate * 100).toFixed(1)}% of the time`)
  check(rate > 0.1 && rate < 0.35, `direct concessions from a bad pass are real but not routine (${(rate * 100).toFixed(1)}%, expected ~22%)`)

  // a 'good'/'half' tier failure should NEVER concede directly — only a
  // 'clear' tier (the keeper under real pressure) carries that risk.
  let halfTierGoals = 0
  for (let i = 0; i < 500; i++) {
    const failState = resolvePlayerMoment(base, { tier: 'half', isDefensive: false, isDistribution: true, minute: 30, situation: 'x' }, 0.3, false, 1, 3, false, null)
    const concededAGoal = (base.playerIsHome ? failState.awayScore > base.awayScore : failState.homeScore > base.homeScore)
    if (concededAGoal) halfTierGoals++
  }
  check(halfTierGoals === 0, 'a misplaced pass from a routine (half-tier) situation never directly concedes — only genuine pressure does')
}

console.log(fails === 0 ? '\n✅ AUDIT 13 PASSED' : `\n❌ AUDIT 13: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
