// V3.2 one-shot playable match transplant
import fs from 'node:fs'
const path='src/engine/match.ts'; let s=fs.readFileSync(path,'utf8')
const marker="import { debugScenarioOverride } from './devTools'\n"
const addition="import { resolveLegacyDriveShot, scoreSnapshot } from './matchResolutionV2'\n"
if(!s.includes(addition)) s=s.replace(marker,marker+addition)
const start=s.indexOf('function autoResolveTeammateChance(')
const end=s.indexOf('/**\n * A goal line needs to describe the scoreline AFTER the goal',start)
if(start<0||end<0) throw new Error('auto-resolve block not found')
const replacement=`function autoResolveTeammateChance(s: MatchState, tier: ChanceTier): MatchState {
  const shot = resolveLegacyDriveShot(s.homeTeam, s.awayTeam, scoreSnapshot(s.homeScore, s.awayScore, s.minute, s.playerIsHome), true, tier, rand(), rand())
  if (shot.goal) {
    let squad = s.squad
    let scorer: SquadPlayer | null = null
    let assister: SquadPlayer | null = null
    if (squad) {
      scorer = pickGoalscorer(squad)
      if (scorer) { assister = pickAssister(squad, scorer.id); squad = applyTeammateGoal(squad, scorer.id, assister?.id ?? null) }
    }
    const scoredState = { ...nextScore(s, true), squad }
    const ctx = { ...ctxOf(scoredState), scorer: scorer ? surnameOf(scorer.name) : undefined, assister: assister ? surnameOf(assister.name) : undefined }
    return applyGoal({ ...s, squad }, true, s.commentator.line('goal-teammate', ctx))
  }
  const missed = { ...s, momentum: clamp(s.momentum + 1, -10, 10) }
  return { ...missed, events: [...missed.events, { minute: s.minute, text: s.commentator.line('chance-wasted-teammate', ctxOf(missed)), kind: 'chance' as const }] }
}

function autoResolveOpponentChance(s: MatchState, tier: ChanceTier): MatchState {
  const shot = resolveLegacyDriveShot(s.homeTeam, s.awayTeam, scoreSnapshot(s.homeScore, s.awayScore, s.minute, s.playerIsHome), false, tier, rand(), rand())
  if (shot.goal) return applyGoal(s, false, s.commentator.line('goal-opponent', ctxOf(nextScore(s, false))))
  const survived = { ...s, momentum: clamp(s.momentum - 1, -10, 10) }
  return { ...survived, events: [...survived.events, { minute: s.minute, text: s.commentator.line('chance-survived', ctxOf(survived)), kind: 'chance' as const }] }
}

`
s=s.slice(0,start)+replacement+s.slice(end)
if(s.includes("tierMod = tier === 'clear' ? 0.6")) throw new Error('legacy scoring survived')
fs.writeFileSync(path,s)
