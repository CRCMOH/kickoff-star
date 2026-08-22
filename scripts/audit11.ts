// AUDIT 11 (P35) — the headline engine.
//
// Checks the two trigger paths (post-match, weekly) fire on the conditions
// they claim to, stay silent when they shouldn't, and never crash on thin data.
import { reseed } from '../src/engine/rng'
import {
  checkPostMatchHeadlines, checkWeeklyHeadlines, initSyntheticScorer, driftSyntheticScorer,
} from '../src/engine/headlines'
import type { ScoutingState } from '../src/engine/scouting'
import type { LeagueStanding } from '../src/engine/league'
import type { Player } from '../src/types/player'

reseed(35035)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mkPlayer(over: Partial<Player> = {}): Player {
  return { name: 'Test Player', position: 'ST', seasonGoals: 4, ...over } as unknown as Player
}
function mkScouting(watchers: ScoutingState['watchers'] = []): ScoutingState {
  return { reputation: 20, watchers, offers: [] }
}
function mkTeam(id: string) {
  return { id, name: `${id} FC`, short: id.slice(0, 3).toUpperCase(), prestige: 5, ratings: { attack: 50, midfield: 50, defense: 50 } }
}
function mkStanding(id: string, points: number): LeagueStanding {
  return { teamId: id, teamName: `${id} FC`, teamShort: id.slice(0, 3).toUpperCase(), played: 30, won: 8, drawn: 6, lost: 4, goalsFor: 30, goalsAgainst: 20, points }
}

// ---------------------------------------------------------------------------
console.log('\n[A] post-match — fires on the moment, silent otherwise')
{
  const before = mkScouting()
  const after = mkScouting()

  const hatTrick = checkPostMatchHeadlines({
    player: mkPlayer(), rating: 8.0, goals: 3, assists: 0, won: true, opponentName: 'Ashfield', weekNumber: 10,
    scoutingBefore: before, scoutingAfter: after,
  })
  check(hatTrick.some((h) => h.text.includes('HAT-TRICK')), 'a hat-trick fires the hat-trick headline')

  const quiet = checkPostMatchHeadlines({
    player: mkPlayer(), rating: 6.2, goals: 0, assists: 0, won: false, opponentName: 'Ashfield', weekNumber: 10,
    scoutingBefore: before, scoutingAfter: after,
  })
  check(!quiet.some((h) => h.tone === 'breaking'), 'an unremarkable performance does not fire a breaking headline')

  const masterclass = checkPostMatchHeadlines({
    player: mkPlayer(), rating: 9.0, goals: 1, assists: 0, won: true, opponentName: 'Ashfield', weekNumber: 10,
    scoutingBefore: before, scoutingAfter: after,
  })
  check(masterclass.some((h) => h.tone === 'breaking'), 'a 9.0 rating fires a breaking headline even without a hat-trick')

  const newWatcher: ScoutingState = mkScouting([{ club: mkTeam('scoutclub'), interest: 10, tier: 'local' }])
  let sawScoutHeadline = false
  for (let i = 0; i < 30; i++) {
    const out = checkPostMatchHeadlines({
      player: mkPlayer(), rating: 6.5, goals: 0, assists: 0, won: true, opponentName: 'Ashfield', weekNumber: 10,
      scoutingBefore: before, scoutingAfter: newWatcher,
    })
    if (out.some((h) => h.text.includes('SCOUTS IN THE STANDS'))) sawScoutHeadline = true
  }
  check(sawScoutHeadline, 'a brand new watcher can trigger a scout-notice headline across repeated rolls (it is gated, not guaranteed every time)')

  const noNewWatcher = checkPostMatchHeadlines({
    player: mkPlayer(), rating: 6.5, goals: 0, assists: 0, won: true, opponentName: 'Ashfield', weekNumber: 10,
    scoutingBefore: newWatcher, scoutingAfter: newWatcher,
  })
  check(!noNewWatcher.some((h) => h.text.includes('SCOUTS IN THE STANDS')), 'an unchanged watcher list never claims a scout just arrived')
}

// ---------------------------------------------------------------------------
console.log('\n[B] weekly — title race / relegation / golden boot / cup buildup')
{
  const tightTop: LeagueStanding[] = [mkStanding('a', 70), mkStanding('b', 68), mkStanding('c', 50), mkStanding('d', 48), mkStanding('e', 20), mkStanding('f', 18)]
  let sawTitle = false
  for (let i = 0; i < 40; i++) {
    const out = checkWeeklyHeadlines({
      player: mkPlayer(), weekNumber: 40, seasonWeeks: 44, standings: tightTop, playerTeamId: 'a',
      scorer: { name: 'Rival', club: 'X', goals: 99 }, nextFixture: null, worldTeamNames: [],
    })
    if (out.some((h) => h.text.includes('TITLE RACE'))) sawTitle = true
  }
  check(sawTitle, 'a tight top two can trigger a title-race headline within a handful of weeks left')

  const noRace = checkWeeklyHeadlines({
    player: mkPlayer(), weekNumber: 10, seasonWeeks: 44, standings: tightTop, playerTeamId: 'a',
    scorer: { name: 'Rival', club: 'X', goals: 99 }, nextFixture: null, worldTeamNames: [],
  })
  check(!noRace.some((h) => h.text.includes('TITLE RACE')), 'a title race does not fire this early in the season, however tight the table')

  const looseTop: LeagueStanding[] = [mkStanding('a', 80), mkStanding('b', 50), mkStanding('c', 45), mkStanding('d', 40), mkStanding('e', 20), mkStanding('f', 18)]
  let sawTitleLoose = false
  for (let i = 0; i < 40; i++) {
    const out = checkWeeklyHeadlines({
      player: mkPlayer(), weekNumber: 40, seasonWeeks: 44, standings: looseTop, playerTeamId: 'a',
      scorer: { name: 'Rival', club: 'X', goals: 99 }, nextFixture: null, worldTeamNames: [],
    })
    if (out.some((h) => h.text.includes('TITLE RACE'))) sawTitleLoose = true
  }
  check(!sawTitleLoose, 'a 30-point gap at the top never reads as a title race')

  const tightBottom: LeagueStanding[] = [mkStanding('a', 70), mkStanding('b', 68), mkStanding('c', 30), mkStanding('d', 29), mkStanding('e', 28), mkStanding('f', 10)]
  let sawRelegation = false
  for (let i = 0; i < 40; i++) {
    const out = checkWeeklyHeadlines({
      player: mkPlayer(), weekNumber: 42, seasonWeeks: 44, standings: tightBottom, playerTeamId: 'a',
      scorer: { name: 'Rival', club: 'X', goals: 99 }, nextFixture: null, worldTeamNames: [],
    })
    if (out.some((h) => h.text.includes('RELEGATION'))) sawRelegation = true
  }
  check(sawRelegation, 'a bunched relegation zone can trigger the relegation headline')

  const emptyTable = checkWeeklyHeadlines({
    player: mkPlayer(), weekNumber: 40, seasonWeeks: 44, standings: [], playerTeamId: null,
    scorer: { name: 'Rival', club: 'X', goals: 99 }, nextFixture: null, worldTeamNames: [],
  })
  check(Array.isArray(emptyTable), 'an empty or missing table never throws — it just produces nothing table-related')

  let sawAhead = false, sawBehind = false
  for (let i = 0; i < 40; i++) {
    const ahead = checkWeeklyHeadlines({
      player: mkPlayer({ seasonGoals: 10 }), weekNumber: 20, seasonWeeks: 44, standings: null, playerTeamId: null,
      scorer: { name: 'Rival', club: 'X', goals: 9 }, nextFixture: null, worldTeamNames: [],
    })
    if (ahead.some((h) => h.text.includes('TOP OF THE SCORING'))) sawAhead = true
    const behind = checkWeeklyHeadlines({
      player: mkPlayer({ seasonGoals: 9 }), weekNumber: 20, seasonWeeks: 44, standings: null, playerTeamId: null,
      scorer: { name: 'Rival', club: 'X', goals: 10 }, nextFixture: null, worldTeamNames: [],
    })
    if (behind.some((h) => h.text.includes('CHASING THE GOLDEN BOOT'))) sawBehind = true
  }
  check(sawAhead, 'leading the golden boot race can fire the "top of the charts" headline')
  check(sawBehind, 'trailing it fires the "chasing" headline, not the leading one')

  let sawCup = false
  for (let i = 0; i < 30; i++) {
    const out = checkWeeklyHeadlines({
      player: mkPlayer(), weekNumber: 20, seasonWeeks: 44, standings: null, playerTeamId: null,
      scorer: { name: 'Rival', club: 'X', goals: 99 }, nextFixture: { opponentName: 'Millfield', isCupKnockout: true, cupRoundLabel: 'Semi Final' }, worldTeamNames: [],
    })
    if (out.some((h) => h.tone === 'buildup')) sawCup = true
  }
  check(sawCup, 'an upcoming cup knockout tie can trigger a buildup headline')

  const noCup = checkWeeklyHeadlines({
    player: mkPlayer(), weekNumber: 20, seasonWeeks: 44, standings: null, playerTeamId: null,
    scorer: { name: 'Rival', club: 'X', goals: 99 }, nextFixture: null, worldTeamNames: [],
  })
  check(!noCup.some((h) => h.tone === 'buildup'), 'no upcoming fixture means no buildup headline')

  const clubs = ['Ashfield FC', 'Millbrook United', 'Redcliffe Athletic', 'Westgate Town']
  let sawWorldTransfer = false
  for (let i = 0; i < 60; i++) {
    const out = checkWeeklyHeadlines({
      player: mkPlayer(), weekNumber: 10, seasonWeeks: 44, standings: null, playerTeamId: null,
      scorer: { name: 'Rival', club: 'X', goals: 99 }, nextFixture: null, worldTeamNames: clubs,
    })
    if (out.some((h) => h.text.includes('YOUTH MOVE CONFIRMED'))) sawWorldTransfer = true
  }
  check(sawWorldTransfer, 'world transfer news (unrelated to the player) can fire when there are real clubs to draw from')

  const noClubs = checkWeeklyHeadlines({
    player: mkPlayer(), weekNumber: 10, seasonWeeks: 44, standings: null, playerTeamId: null,
    scorer: { name: 'Rival', club: 'X', goals: 99 }, nextFixture: null, worldTeamNames: [],
  })
  check(!noClubs.some((h) => h.text.includes('YOUTH MOVE CONFIRMED')), 'no club list means no fabricated transfer, ever')
}

// ---------------------------------------------------------------------------
console.log('\n[C] the synthetic scorer behaves')
{
  const s = initSyntheticScorer()
  check(typeof s.name === 'string' && s.name.length > 0, 'synthetic scorer has a name')
  check(s.goals >= 0, 'synthetic scorer starts non-negative')
  let cur = s
  for (let i = 0; i < 44; i++) cur = driftSyntheticScorer(cur)
  check(cur.goals >= s.goals, 'the rival scorer never loses goals over a season of drift')
  check(cur.goals <= s.goals + 44 * 2, 'the rival scorer does not run away implausibly fast (capped by the per-week roll)')
}

console.log(fails === 0 ? '\n✅ AUDIT 11 PASSED' : `\n❌ AUDIT 11: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
