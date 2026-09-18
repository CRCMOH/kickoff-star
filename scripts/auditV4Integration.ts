import { readFileSync } from 'fs'
import { competitionDefinition, initCompetitionCareer, recordCompetitionMatch } from '../src/engine/competitionCareer'
import { formatMoney } from '../src/engine/economy'
import { addStoryMoment, createStoryMoment } from '../src/engine/presentation'
import { initYouthFinance, postTransaction } from '../src/engine/youthFinances'
import { emptyMatchStats } from '../src/engine/matchStats'
import { calculatePlayerRating } from '../src/engine/ratingSystemV32'

let failures = 0
const check = (condition: boolean, message: string) => {
  if (condition) console.log('  ✓', message)
  else { failures += 1; console.error('  ✗', message) }
}

console.log('\n[A] V4 competition and finance truth survives the V3.2 integration')
let career = initCompetitionCareer()
career = recordCompetitionMatch(career, { competitionId: 'schoolCup', season: 2027, started: true, minutes: 90, rating: 8.4, goals: 2, assists: 1, cleanSheet: false, playerOfMatch: true })
check(career.current.schoolCup.goals === 2 && career.current.schoolCup.averageRating === 8.4, 'competition-specific stats remain exact')
check(competitionDefinition('academyLeague').prestige > competitionDefinition('sundayLeague').prestige, 'academy and Sunday league prestige remain distinct')
let finances = initYouthFinance('grassroots-season')
finances = postTransaction(finances, 'grassroots-season', { week: 1, amount: 10, category: 'allowance', description: 'Allowance', coveredBy: 'family' })
check(finances.currency === 'GBP' && finances.transactions.length === 1 && formatMoney(10) === '£10', 'GBP ledger and visible pound formatting agree')

console.log('\n[B] V4 story moments remain durable and deduplicated')
const reveal = createStoryMoment({ kind: 'qualification', eyebrow: 'School Cup', title: 'QUALIFIED', body: 'Into the next round.', week: 10, season: 2027 })
const inbox = addStoryMoment(addStoryMoment([], reveal), createStoryMoment({ kind: 'qualification', eyebrow: 'School Cup', title: 'QUALIFIED', body: 'Duplicate.', week: 10, season: 2027 }))
check(inbox.length === 1 && !inbox[0].read, 'one real event produces one persistent unread reveal')

console.log('\n[C] the V3.2 match rating is transparent and reproducible')
const stats = emptyMatchStats()
Object.assign(stats, { goals: 1, assists: 1, shots: 3, shotsOnTarget: 2, keyPasses: 3, passesAttempted: 32, passesCompleted: 27 })
const rating = calculatePlayerRating({ position: 'CM', stats, decisionQuality: .82, executionQuality: .78, ratedMoments: 5, minutes: 90 })
const reconstructed = rating.base + rating.decisions + rating.execution + rating.attacking + rating.defending + rating.background + rating.cleanSheet + rating.exceptional + rating.discipline
check(Math.abs(Number(reconstructed.toFixed(1)) - rating.total) < .01, 'displayed rating rows reconstruct the final rating')
check(rating.attacking > 0 && rating.decisions > 0 && rating.execution > 0, 'goals, decisions, and execution contribute independently')

console.log('\n[D] the unified player-facing routes are wired')
const weekly = readFileSync('src/screens/WeeklyHub.tsx', 'utf8')
const home = readFileSync('src/screens/tabs/HomeTab.tsx', 'utf8')
const league = readFileSync('src/screens/tabs/LeagueTab.tsx', 'utf8')
const summary = readFileSync('src/screens/MatchSummary.tsx', 'utf8')
const match = readFileSync('src/engine/match.ts', 'utf8')
const store = readFileSync('src/store/careerStore.ts', 'utf8')
check(weekly.includes('InboxScreen') && weekly.includes('CaptaincyStoryCard') && home.includes('Career inbox'), 'V4 inbox coexists with V3.2 captaincy presentation')
check(league.includes('CompetitionHub'), 'competition hub is reachable from the live career')
check(summary.includes('how your rating was earned') && summary.includes('ratingBreakdown.base'), 'post-match screen exposes baseline and exact rating contributions')
check(match.includes('decisionQualityTotal: carded.decisionQualityTotal + decisionQuality'), 'multi-step scenarios enter the rating ledger')
for (const kind of ['selection', 'squad', 'qualification', 'elimination', 'champion', 'invitation', 'promotion', 'relegation']) {
  check(store.includes(`kind: '${kind}'`), `${kind} reveal is driven by career state`)
}

console.log(failures ? `\n❌ V4 INTEGRATION AUDIT: ${failures} FAILURE(S)` : '\n✅ V4 INTEGRATION AUDIT PASSED')
process.exit(failures ? 1 : 0)
