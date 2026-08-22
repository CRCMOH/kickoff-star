// AUDIT 17 (P52) — position-weighted reputation. Joel: "a realistic scout"
// doesn't judge a centre-back on goals. This proves the fix actually works:
// a defender who racks up tackles/clean sheets and never scores builds
// REAL reputation, and a striker is still correctly judged on goals.
import { updateReputation, initScoutingState, type MatchPerformanceForReputation } from '../src/engine/scouting'
import { inferStatTag } from '../src/engine/matchDecisions'
import { SCENARIOS, SINGLE_MOMENTS } from '../src/engine/matchScenarios'

let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function repAfter(perf: MatchPerformanceForReputation, matches: number): number {
  let s = initScoutingState()
  for (let i = 0; i < matches; i++) s = updateReputation(s, perf)
  return s.reputation
}

// ---------------------------------------------------------------------------
console.log('\n[A] the actual complaint — a defender who never scores builds real reputation')
{
  const solidDefender: MatchPerformanceForReputation = {
    rating: 7.2, position: 'CB', goals: 0, assists: 0,
    tackles: 3, interceptions: 2, headers: 1, keyPasses: 0, saves: 0, cleanSheet: true,
  }
  const goallessStriker: MatchPerformanceForReputation = {
    rating: 6.5, position: 'ST', goals: 0, assists: 0,
    tackles: 0, interceptions: 0, headers: 0, keyPasses: 0, saves: 0, cleanSheet: false,
  }
  const defenderRep = repAfter(solidDefender, 20)
  const strikerRep = repAfter(goallessStriker, 20)
  console.log(`    after 20 matches — solid defensive display, no goals: ${defenderRep.toFixed(1)} rep | goalless striker: ${strikerRep.toFixed(1)} rep`)
  check(defenderRep > strikerRep, 'a defender doing their actual job well builds MORE reputation than a striker contributing nothing, even though neither scored')
  check(defenderRep > 5, 'the defender genuinely accumulates real reputation over a run of good performances, not a token amount')
}

// ---------------------------------------------------------------------------
console.log('\n[B] goals are still correctly the main signal for a striker')
{
  const scoringStriker: MatchPerformanceForReputation = {
    rating: 7.5, position: 'ST', goals: 1, assists: 0,
    tackles: 0, interceptions: 0, headers: 0, keyPasses: 0, saves: 0, cleanSheet: false,
  }
  const quietStriker: MatchPerformanceForReputation = {
    rating: 6.8, position: 'ST', goals: 0, assists: 0,
    tackles: 0, interceptions: 0, headers: 0, keyPasses: 0, saves: 0, cleanSheet: false,
  }
  check(repAfter(scoringStriker, 10) > repAfter(quietStriker, 10), 'a scoring striker still builds reputation faster than a quiet one — goals were never wrong for THIS position')
}

// ---------------------------------------------------------------------------
console.log('\n[C] goals are a bonus for a defender, not the main thing — matches the explicit design ask')
{
  const defenderWhoAlsoScores: MatchPerformanceForReputation = {
    rating: 7.2, position: 'CB', goals: 1, assists: 0,
    tackles: 3, interceptions: 2, headers: 1, keyPasses: 0, saves: 0, cleanSheet: true,
  }
  const defenderWhoDoesnt: MatchPerformanceForReputation = {
    rating: 7.2, position: 'CB', goals: 0, assists: 0,
    tackles: 3, interceptions: 2, headers: 1, keyPasses: 0, saves: 0, cleanSheet: true,
  }
  const withGoal = repAfter(defenderWhoAlsoScores, 1)
  const withoutGoal = repAfter(defenderWhoDoesnt, 1)
  const bonus = withGoal - withoutGoal
  check(bonus > 0, 'a defender who also scores gets a real bonus on top')
  check(bonus < withoutGoal, "the goal bonus is smaller than what the defending itself already earned — goals are a BONUS for this position, not the main driver")
}

// ---------------------------------------------------------------------------
console.log('\n[D] a keeper is judged on saves and clean sheets, not goals (which are ~never theirs)')
{
  const busyKeeper: MatchPerformanceForReputation = {
    rating: 7.0, position: 'GK', goals: 0, assists: 0,
    tackles: 0, interceptions: 0, headers: 0, keyPasses: 0, saves: 4, cleanSheet: true,
  }
  const idleKeeper: MatchPerformanceForReputation = {
    rating: 6.5, position: 'GK', goals: 0, assists: 0,
    tackles: 0, interceptions: 0, headers: 0, keyPasses: 0, saves: 0, cleanSheet: false,
  }
  check(repAfter(busyKeeper, 10) > repAfter(idleKeeper, 10), 'a keeper who makes real saves and keeps a clean sheet builds more reputation than one with a quiet, uneventful game')
}

// ---------------------------------------------------------------------------
console.log('\n[E] a midfielder is judged on key passes as well as end product')
{
  const creativeMid: MatchPerformanceForReputation = {
    rating: 7.0, position: 'CM', goals: 0, assists: 0,
    tackles: 0, interceptions: 0, headers: 0, keyPasses: 3, saves: 0, cleanSheet: false,
  }
  const passiveMid: MatchPerformanceForReputation = {
    rating: 6.5, position: 'CM', goals: 0, assists: 0,
    tackles: 0, interceptions: 0, headers: 0, keyPasses: 0, saves: 0, cleanSheet: false,
  }
  check(repAfter(creativeMid, 10) > repAfter(passiveMid, 10), 'a midfielder creating real chances builds more reputation than one who does nothing, even with no goals or assists to show for it')
}

// ---------------------------------------------------------------------------
console.log('\n[F] inferStatTag — proven against every real option in the actual game, not a hypothetical')
{
  let tackle = 0, interception = 0, header = 0, keyPass = 0, save = 0
  for (const s of [...SCENARIOS, ...SINGLE_MOMENTS]) {
    const isGK = s.category === 'gk-defend' || s.category === 'gk-distribution'
    const isDef = s.category === 'defend' || s.category === 'gk-defend'
    const isDist = s.category === 'gk-distribution'
    for (const b of Object.values(s.beats)) {
      for (const o of b.options) {
        const tag = inferStatTag(o.label, isDef, isDist, isGK, true)
        if (tag === 'tackle') tackle++
        else if (tag === 'interception') interception++
        else if (tag === 'header') header++
        else if (tag === 'keyPass') keyPass++
        else if (tag === 'save') save++
      }
    }
  }
  console.log(`    real content tagged — tackle:${tackle} interception:${interception} header:${header} keyPass:${keyPass} save:${save}`)
  check(tackle > 0 && interception > 0 && header > 0 && save > 0 && keyPass > 0, 'every stat category is actually reachable through real, already-authored content — not a feature with nothing behind it')
  check(save > 20, `a meaningful share of GK content produces saves (${save}) — goalkeepers have a real stat to build reputation from`)

  // Never tag a failed outcome, and never tag distribution (tracked separately).
  check(inferStatTag('slide tackle', true, false, false, false) === null, 'a FAILED action is never tagged — only successes count toward a real stat')
  check(inferStatTag('roll it out short', false, true, true, true) === null, 'GK distribution success is never double-counted as a defensive/attacking stat')
}

console.log(fails === 0 ? '\n✅ AUDIT 17 PASSED' : `\n❌ AUDIT 17: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
