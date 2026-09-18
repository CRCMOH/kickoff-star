// AUDIT 22 — V4 Layers 7 + 8: player-facing world UI and truthful story presentation.
import { readFileSync } from 'fs'
import { addStoryMoment, createStoryMoment, storyTone } from '../src/engine/presentation'
import { competitionDefinition } from '../src/engine/competitionCareer'
import { formatMoney } from '../src/engine/economy'

let fails = 0
const check = (condition: boolean, message: string) => {
  if (condition) console.log('  ✓', message)
  else { fails++; console.error('  ✗', message) }
}

console.log('\n[A] story moments are durable, ordered and deduplicated')
{
  const reveal = createStoryMoment({ kind: 'qualification', eyebrow: 'School Cup', title: 'QUALIFIED', body: 'Into the knockouts.', week: 18, season: 2027 })
  let inbox = addStoryMoment([], reveal)
  inbox = addStoryMoment(inbox, createStoryMoment({ kind: 'qualification', eyebrow: 'School Cup', title: 'QUALIFIED', body: 'Duplicate event.', week: 18, season: 2027 }))
  check(inbox.length === 1, 'the same reveal cannot be queued twice in one week')
  check(!inbox[0].read && inbox[0].season === 2027, 'new story beats persist unread with season context')
  check(storyTone('champion') === 'gold' && storyTone('elimination') === 'bad', 'presentation tone follows the real outcome')
}

console.log('\n[B] Layer 7 destinations exist in the live hub')
{
  const league = readFileSync('src/screens/tabs/LeagueTab.tsx', 'utf-8')
  const home = readFileSync('src/screens/tabs/HomeTab.tsx', 'utf-8')
  const club = readFileSync('src/screens/tabs/ClubTab.tsx', 'utf-8')
  const player = readFileSync('src/screens/tabs/PlayerTab.tsx', 'utf-8')
  const weekly = readFileSync('src/screens/WeeklyHub.tsx', 'utf-8')
  check(league.includes("['hub', 'fixtures', 'table']") && league.includes('CompetitionHub'), 'League exposes competition hub, fixtures and table')
  check(home.includes('Career inbox') && weekly.includes('InboxScreen'), 'Home exposes a persistent career inbox')
  check(home.includes('week overview'), 'weekly calendar remains visible on Home')
  check(club.includes('player.squad') && club.includes('🎽 squad'), 'Club exposes the real generated squad')
  check(player.includes('career pathway') && player.includes('Professional'), 'Player exposes the Grassroots → Academy → Pro pathway')
}

console.log('\n[C] Layer 8 is triggered by simulation truth')
{
  const store = readFileSync('src/store/careerStore.ts', 'utf-8')
  for (const kind of ['selection', 'squad', 'qualification', 'elimination', 'champion', 'invitation', 'promotion', 'relegation']) {
    check(store.includes(`kind: '${kind}'`), `${kind} has a real store trigger`)
  }
  check(store.includes('cupWorld.stage') && store.includes('next.playerEliminated'), 'cup reveals compare real before/after competition state')
  check(store.includes('newOffer') && store.includes('scoutingOut.offers'), 'invitation reveal comes from a generated offer')
}

console.log('\n[D] academy and grassroots stages remain distinct')
{
  check(competitionDefinition('academyLeague').prestige > competitionDefinition('sundayLeague').prestige, 'academy league carries more prestige than Sunday League')
  check(formatMoney(35) === '£35', 'currency is back to pounds sterling')
}

console.log(fails === 0 ? '\n✅ AUDIT 22 PASSED' : `\n❌ AUDIT 22: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
