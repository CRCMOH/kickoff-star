// AUDIT 12 (P36) — Glory: the trophy cabinet's award logic.
//
// The one thing that would make this feature worthless is if awards were too
// easy — a Golden Boot every season devalues the cabinet the same way P16
// found ten achievement ceremonies in one match devalued each of them. Every
// check here is about the bar being real, and about counts accumulating
// correctly rather than resetting or double-firing.
import {
  computeSeasonAwards, computeClubAwards, addGlory, totalGlory,
  PERSONAL_GLORY_LABEL, CLUB_GLORY_LABEL, NATIONAL_GLORY_LABEL,
} from '../src/engine/glory'
import type { SeasonReview } from '../src/engine/seasonReview'
import type { SyntheticScorer } from '../src/engine/headlines'
import type { Player } from '../src/types/player'

let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mkReview(over: Partial<SeasonReview> = {}): SeasonReview {
  return {
    seasonNumber: 1, clubName: 'Test FC', competitionLabel: 'Division 1',
    finishPosition: 5, teamsInDivision: 12, promoted: false, relegated: false,
    appearances: 20, goals: 5, assists: 4, averageRating: 6.5, bestRating: 8,
    cupResults: [], verdict: 'A season.', grade: 'C',
    ...over,
  }
}
function mkRival(goals: number): SyntheticScorer {
  return { name: 'Rival Striker', club: 'Rival FC', goals }
}
function mkPlayer(over: Partial<Player> = {}): Player {
  return { name: 'Test', position: 'ST', ...over } as unknown as Player
}

// ---------------------------------------------------------------------------
console.log('\n[A] awards have real bars — an ordinary season wins nothing')
{
  const ordinary = mkReview() // 20 apps, 5 goals, 4 assists, 6.5 avg, grade C, mid-table
  const won = computeSeasonAwards(ordinary, mkRival(20))
  console.log(`    ordinary season (grade C, 6.5 avg, mid-table): won ${won.length ? won.join(', ') : 'nothing'}`)
  check(won.length === 0, 'a perfectly average mid-table season wins zero personal awards')
  check(computeClubAwards(ordinary).length === 0, 'and zero club awards — finishing 5th of 12 is not silverware')
}

// ---------------------------------------------------------------------------
console.log('\n[B] Best XI requires a genuinely strong, substantial season')
{
  const strong = mkReview({ appearances: 20, averageRating: 7.5 })
  check(computeSeasonAwards(strong, mkRival(20)).includes('bestXI'), 'a strong full season earns Best XI')

  const goodButShort = mkReview({ appearances: 8, averageRating: 8.5 })
  check(!computeSeasonAwards(goodButShort, mkRival(20)).includes('bestXI'), 'a brilliant but tiny sample (8 apps) does not — not enough football to judge')

  const longButMediocre = mkReview({ appearances: 25, averageRating: 6.5 })
  check(!computeSeasonAwards(longButMediocre, mkRival(20)).includes('bestXI'), 'a full season of merely-okay form does not qualify either — needs both')
}

// ---------------------------------------------------------------------------
console.log('\n[C] Golden Boot is measured against the tracked rival, not a fixed number')
{
  const scorer = mkReview({ goals: 15 })
  check(computeSeasonAwards(scorer, mkRival(14)).includes('goldenBoot'), 'outscoring the rival by the season end wins it')
  check(!computeSeasonAwards(scorer, mkRival(15)).includes('goldenBoot'), 'a tie does not — the rival has to actually be beaten')
  check(!computeSeasonAwards(scorer, mkRival(20)).includes('goldenBoot'), 'trailing the rival never wins it')
  check(!computeSeasonAwards(scorer, undefined).includes('goldenBoot'), 'no rival on record (should not happen, but defensively) never crashes or auto-wins')
}

// ---------------------------------------------------------------------------
console.log('\n[D] Top Assister needs a real creative season, not a good game or two')
{
  const creator = mkReview({ assists: 12, appearances: 20 })
  check(computeSeasonAwards(creator, mkRival(99)).includes('topAssister'), '12 assists across a full season wins it')
  const fewGames = mkReview({ assists: 12, appearances: 6 })
  check(!computeSeasonAwards(fewGames, mkRival(99)).includes('topAssister'), 'the same tally in only 6 games does not — too small a sample')
  const modest = mkReview({ assists: 6, appearances: 20 })
  check(!computeSeasonAwards(modest, mkRival(99)).includes('topAssister'), '6 assists across a full season is a decent year, not a league-leading one')
}

// ---------------------------------------------------------------------------
console.log('\n[E] League MVP requires BOTH individual quality and team success')
{
  const soloStar = mkReview({ grade: 'A', finishPosition: 6, promoted: false, cupResults: [] })
  check(!computeSeasonAwards(soloStar, mkRival(99)).includes('leagueMVP'), 'a grade-A individual season on a mid-table team does not win MVP alone')

  const titleWinner = mkReview({ grade: 'A', finishPosition: 1 })
  check(computeSeasonAwards(titleWinner, mkRival(99)).includes('leagueMVP'), 'grade A + winning the league does win it')

  const promotedStar = mkReview({ grade: 'A', finishPosition: 3, promoted: true })
  check(computeSeasonAwards(promotedStar, mkRival(99)).includes('leagueMVP'), 'grade A + promotion also qualifies')

  const cupWinner = mkReview({ grade: 'A', finishPosition: 8, cupResults: [{ label: 'Cup', outcome: 'WINNERS' }] })
  check(computeSeasonAwards(cupWinner, mkRival(99)).includes('leagueMVP'), 'grade A + a cup win also qualifies, even mid-table in the league')

  const goodTeamAvgPlayer = mkReview({ grade: 'C', finishPosition: 1 })
  check(!computeSeasonAwards(goodTeamAvgPlayer, mkRival(99)).includes('leagueMVP'), 'winning the league on a grade-C individual season does NOT win MVP — the team cannot carry a passenger to it')
}

// ---------------------------------------------------------------------------
console.log('\n[F] club glory reads off real team results')
{
  check(computeClubAwards(mkReview({ finishPosition: 1 })).includes('leagueTitle'), 'finishing 1st wins the league title')
  check(!computeClubAwards(mkReview({ finishPosition: 2 })).includes('leagueTitle'), 'finishing 2nd does not — runner-up is not a title')
  check(computeClubAwards(mkReview({ cupResults: [{ label: 'Cup', outcome: 'WINNERS' }] })).includes('cupWinner'), 'winning a cup registers')
  check(!computeClubAwards(mkReview({ cupResults: [{ label: 'Cup', outcome: 'knocked out' }] })).includes('cupWinner'), 'being knocked out of a cup does not')
  const both = computeClubAwards(mkReview({ finishPosition: 1, cupResults: [{ label: 'Cup', outcome: 'WINNERS' }] }))
  check(both.includes('leagueTitle') && both.includes('cupWinner'), 'a double (league + cup) in the same season registers both')
}

// ---------------------------------------------------------------------------
console.log('\n[G] counts accumulate correctly across a career, never reset by a quiet season')
{
  let personal = mkPlayer().personalGlory
  personal = addGlory(personal, ['bestXI'])
  personal = addGlory(personal, ['bestXI', 'goldenBoot'])
  personal = addGlory(personal, [])
  check(personal.bestXI === 2, `bestXI accumulates across seasons (got ${personal.bestXI})`)
  check(personal.goldenBoot === 1, `goldenBoot counted once (got ${personal.goldenBoot})`)
  check(personal.leagueMVP === undefined, 'never-won awards stay absent, not zeroed noise')

  const p = mkPlayer({ personalGlory: { bestXI: 3 }, clubGlory: { leagueTitle: 1 }, nationalGlory: { internationalTrophy: 2 } })
  check(totalGlory(p) === 6, `totalGlory sums across all three groups (got ${totalGlory(p)})`)
  check(totalGlory(mkPlayer()) === 0, 'an empty cabinet totals zero, not NaN or a crash')
}

// ---------------------------------------------------------------------------
console.log('\n[H] labels exist for every key the engine can produce — no ??? in the UI')
{
  const allPersonal: (keyof typeof PERSONAL_GLORY_LABEL)[] = ['leagueMVP', 'bestXI', 'goldenBoot', 'topAssister']
  for (const k of allPersonal) check(typeof PERSONAL_GLORY_LABEL[k] === 'string' && PERSONAL_GLORY_LABEL[k].length > 0, `personal label exists for ${k}`)
  const allClub: (keyof typeof CLUB_GLORY_LABEL)[] = ['leagueTitle', 'cupWinner']
  for (const k of allClub) check(typeof CLUB_GLORY_LABEL[k] === 'string', `club label exists for ${k}`)
  check(typeof NATIONAL_GLORY_LABEL.internationalTrophy === 'string', 'national label exists')
}

// ---------------------------------------------------------------------------
console.log('\n[I] MVP specifically stays rare even across a stacked career')
{
  // Best XI / Golden Boot are individual honours — a genuinely elite player
  // SHOULD win those most years, that's correct. MVP is the one with a team-
  // success gate, so it's the one that should stay rare even for a star.
  let mvpCount = 0
  const SEASONS = 6
  for (let s = 0; s < SEASONS; s++) {
    const review = mkReview({
      appearances: 22, averageRating: 7.4, goals: 14 + s, assists: 6, grade: 'A',
      // team only wins the league every 3rd season, mid-table otherwise —
      // the individual form is elite and constant, team success is not
      finishPosition: s % 3 === 0 ? 1 : 4, promoted: false,
    })
    if (computeSeasonAwards(review, mkRival(13)).includes('leagueMVP')) mvpCount++
  }
  console.log(`    an elite player with intermittent team success won MVP in ${mvpCount}/${SEASONS} seasons`)
  check(mvpCount < SEASONS, `MVP does not fire every season just from individual form (${mvpCount}/${SEASONS})`)
  check(mvpCount === 2, `MVP fires exactly in the seasons the team actually won something (got ${mvpCount}, expected 2 — seasons 0 and 3)`)
}

console.log(fails === 0 ? '\n✅ AUDIT 12 PASSED' : `\n❌ AUDIT 12: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
