import { useState, useRef, useEffect } from 'react'
import type { Player } from '../types/player'
import type { Team } from '../engine/teams'
import type { MatchState, KeyMoment, ChanceTier } from '../engine/match'
import { initMatch, advanceToKeyMoment, resolvePlayerMoment, resolveScenarioBeat, resolveInjuryDecision } from '../engine/match'
import { momentToDecision, miniGameKindForMoment, inferStatTag, type MatchDecisionBundle } from '../engine/matchDecisions'
import { TeamCrest } from '../components/ui'
import FormationPitch from '../components/FormationPitch'
import {
  executionSpecFor, adjustChance, autoResolveGrade, GRADE_LABEL, GRADE_COLOR,
  type ExecutionGrade, type ExecutionSpec,
} from '../engine/execution'
import TimingBar from '../components/TimingBar'
import ShootingMinigame from '../components/ShootingMinigame'
import PassingMinigame from '../components/PassingMinigame'
import DribbleMinigame from '../components/DribbleMinigame'
import TackleMinigame from '../components/TackleMinigame'
import KeeperMinigame from '../components/KeeperMinigame'
import CrossHeaderMinigame from '../components/CrossHeaderMinigame'

type ExecutionComponentProps = { spec: ExecutionSpec; label: string; onResolve: (grade: ExecutionGrade, position: number) => void; tier?: ChanceTier }
function resolveExecutionComponent(bundle: MatchDecisionBundle, optIndex: number): React.ComponentType<ExecutionComponentProps> {
  const attrs = bundle.keyAttributes[optIndex] ?? []
  const label = bundle.decision.options[optIndex]?.label.toLowerCase() ?? ''
  const situation = bundle.decision.situation?.toLowerCase() ?? ''
  const isGkContext = bundle.decision.context === 'gk'

  if (isGkContext && situation.includes('penalty')) return KeeperMinigame
  if (situation.includes('penalty') || situation.includes('free kick') || situation.includes('free-kick')) {
    return situation.includes('wide') || situation.includes('flank') ? CrossHeaderMinigame : ShootingMinigame
  }
  if (label.includes('cross') || label.includes('header') || label.includes('whip')) return CrossHeaderMinigame
  if (attrs.includes('reflexes') || attrs.includes('gkPositioning') || attrs.includes('handling') || attrs.includes('distribution')) return KeeperMinigame
  if (attrs.includes('tackling')) return TackleMinigame
  if (attrs.includes('dribbling')) return DribbleMinigame
  if (attrs.includes('shooting')) return ShootingMinigame
  if (attrs.includes('positioning') && (attrs.includes('concentration') || attrs.includes('strength') || attrs.includes('pace'))) return TackleMinigame
  if (attrs.includes('passing') || attrs.includes('vision')) return PassingMinigame
  return TimingBar
}
import TrainingMiniGame from '../components/TrainingMiniGame'
import { gradeFromRatio } from '../engine/xp'
import GoalCelebration, { type CelebrationKind } from '../components/GoalCelebration'
import HalfTimeBreak from '../components/HalfTimeBreak'
import { rand } from '../engine/rng'
import { sfx, isMuted, toggleMuted } from '../engine/audio'
import { syncMusicMute } from '../engine/music'
import { archetypeMomentBonus } from '../engine/archetypes'

interface MatchScreenProps {
  player: Player
  playerTeam: Team
  opponent: Team
  playerIsHome: boolean
  autoResolve: boolean
  onToggleAutoResolve: () => void
  onComplete: (result: { rating: number; goals: number; assists: number; won: boolean; drew: boolean; finalMatchStamina: number; injury: { severity: string; weeksOut: number; description: string } | null; wasSubbed: boolean; redCarded: boolean; playerScore: number; opponentScore: number; squad?: import('../engine/squad').SquadPlayer[]; matchStats: { tackle: number; interception: number; header: number; keyPass: number; save: number } }) => void
}

const SPEEDS = [1, 2, 3] as const
const BASE_TICK_MS = 450

export default function MatchScreen({ player, playerTeam, opponent, playerIsHome, autoResolve, onToggleAutoResolve, onComplete }: MatchScreenProps) {
  const [state, setState] = useState<MatchState>(() => initMatch(player, playerTeam, opponent, playerIsHome, player.squad))
  const [moment, setMoment] = useState<KeyMoment | null>(null)
  const [bundle, setBundle] = useState<MatchDecisionBundle | null>(null)
  const [revealed, setRevealed] = useState<{ text: string; success: boolean; grade: ExecutionGrade | null } | null>(null)
  const [executing, setExecuting] = useState<{ optIndex: number } | null>(null)
  const [muted, setMutedUi] = useState(isMuted())
  const [speed, setSpeed] = useState<1 | 2 | 3>(1)
  const [displayMinute, setDisplayMinute] = useState(0)
  const [celebration, setCelebration] = useState<{ kind: CelebrationKind; minute: number } | null>(null)
  const [halfTimeShown, setHalfTimeShown] = useState(false)
  const halfTimeSeen = useRef(false)
  const priorPlayerGoals = useRef(0)
  const priorPlayerAssists = useRef(0)
  const goalsShown = useRef(0)
  const displayScoreRef = useRef({ home: 0, away: 0 })
  const matchStatsRef = useRef({ tackle: 0, interception: 0, header: 0, keyPass: 0, save: 0 })
  const [displayScore, setDisplayScore] = useState({ home: 0, away: 0 })
  const feedRef = useRef<HTMLDivElement>(null)

  const stateRef = useRef(state)
  stateRef.current = state

  const runSim = () => {
    const result = advanceToKeyMoment(stateRef.current, player)
    stateRef.current = result.state
    setState(result.state)
    if (result.keyMoment) {
      setMoment(result.keyMoment)
      setBundle(momentToDecision(player, result.keyMoment, `${result.state.minute}' · ${result.state.homeTeam.short} ${displayScore.home}-${displayScore.away} ${result.state.awayTeam.short}`))
    }
  }

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    sfx.whistle()
    runSim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleCount = state.events.filter((e) => e.minute <= displayMinute).length
  const visibleEvents = state.events.slice(0, visibleCount)

  useEffect(() => {
    if (halfTimeSeen.current) return
    if (visibleEvents.some((e) => e.kind === 'halftime')) {
      halfTimeSeen.current = true
      setHalfTimeShown(true)
    }
  }, [visibleEvents])
  const caughtUp = displayMinute >= state.minute
  const momentStillValid = moment !== null && !state.substituted && !state.injury && state.onPitch && !state.finished
  const showMoment = momentStillValid && bundle !== null && caughtUp
  useEffect(() => {
    if (moment !== null && !momentStillValid) { setMoment(null); setBundle(null) }
  }, [moment, momentStillValid])
  const matchOver = state.finished && caughtUp && !moment && !revealed

  useEffect(() => {
    const paused = showMoment || revealed !== null || matchOver || celebration !== null || halfTimeShown
    if (paused) return
    if (caughtUp && !state.finished && !moment) {
      runSim()
      return
    }
    if (caughtUp) return
    const t = window.setInterval(() => {
      setDisplayMinute((m) => Math.min(m + 1, state.minute))
    }, BASE_TICK_MS / speed)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caughtUp, showMoment, revealed, matchOver, celebration, halfTimeShown, speed, state.minute, state.finished, moment])

  const revealedGoalEvents = visibleEvents.filter((e) => e.kind === 'goal')
  const revealedGoals = revealedGoalEvents.length
  useEffect(() => {
    if (revealedGoals <= goalsShown.current) return
    const newGoals = revealedGoalEvents.slice(goalsShown.current)
    let home = displayScoreRef.current.home
    let away = displayScoreRef.current.away
    let lastKind: CelebrationKind = 'concede'
    for (const ev of newGoals) {
      const homeMentioned = ev.text.includes(state.homeTeam.short)
      const awayMentioned = ev.text.includes(state.awayTeam.short)
      const homeScored = homeMentioned && !awayMentioned ? true
        : awayMentioned && !homeMentioned ? false
        : home < state.homeScore
      if (homeScored) home++
      else away++
      const playerSideScored = playerIsHome ? homeScored : !homeScored
      ;(playerSideScored ? sfx.goal : sfx.concede)()
      lastKind = state.playerGoals > priorPlayerGoals.current
        ? 'player-goal'
        : state.playerAssists > priorPlayerAssists.current
        ? 'player-assist'
        : playerSideScored ? 'team-goal' : 'concede'
    }
    priorPlayerGoals.current = state.playerGoals
    priorPlayerAssists.current = state.playerAssists
    goalsShown.current = revealedGoals
    displayScoreRef.current = { home, away }
    setDisplayScore({ home, away })
    setCelebration({ kind: lastKind, minute: state.minute })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedGoals, state.homeScore, state.awayScore, state.playerGoals, state.playerAssists, state.minute, playerIsHome])

  const ftPlayed = useRef(false)
  useEffect(() => {
    if (matchOver && !ftPlayed.current) { ftPlayed.current = true; sfx.fullTime() }
  }, [matchOver])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [visibleCount])

  const handleChoose = (optIndex: number) => {
    if (!moment || !bundle) return
    if (moment.isInjuryDecision) {
      const next = resolveInjuryDecision(state, optIndex === 0, player)
      stateRef.current = next
      setState(next)
      setDisplayMinute(next.minute)
      const lastEvent = next.events[next.events.length - 1]
      setRevealed({ text: lastEvent?.text ?? '', success: !next.injury, grade: null })
      setMoment(null)
      setBundle(null)
      setExecuting(null)
      return
    }
    if (autoResolve) {
      settle(optIndex, autoResolveGrade(player, state.matchStamina))
      return
    }
    setExecuting({ optIndex })
  }

  const settle = (optIndex: number, grade: ExecutionGrade) => {
    if (!moment || !bundle) return
    const option = bundle.decision.options[optIndex]
    const chosenReward = bundle.rewards[optIndex]

    // V3.1 fairness fix: decision quality is no longer the authored reward tier.
    // Reward describes ambition/upside; quality describes how sensible the read was
    // for THIS player in THIS moment. Rating the two as the same thing punished safe,
    // intelligent football and taught players that the game had a hidden "correct"
    // button. Compare the option's real attribute-driven chance with the strongest
    // available option instead. No raw percentage is shown to the player.
    const bestOptionChance = Math.max(...bundle.decision.options.map((o) => o.successChance))
    const decisionQuality = bestOptionChance > 0 ? option.successChance / bestOptionChance : 0.5
    const outcomeQuality = bundle.maxReward > 0 ? chosenReward / bundle.maxReward : 0.5

    const archBonus = archetypeMomentBonus(player.archetype, !moment.isDefensive, moment.isDefensive, option.successChance < 0.5)
    const finalChance = Math.min(0.97, adjustChance(option.successChance, grade) + archBonus)
    const success = rand() < finalChance

    const next = moment.scenarioId
      ? resolveScenarioBeat(state, moment, optIndex, outcomeQuality, success, decisionQuality, 1, grade)
      : resolvePlayerMoment(state, moment, outcomeQuality, success, decisionQuality, 1, player.position === 'GK', grade)

    const tag = inferStatTag(option.label, moment.isDefensive, moment.isDistribution, player.position === 'GK', success)
    if (tag) matchStatsRef.current[tag] += 1

    stateRef.current = next
    setState(next)
    setDisplayMinute(next.minute)
    const lastEvent = next.events[next.events.length - 1]
    setRevealed({ text: lastEvent?.text ?? '', success, grade })
    setMoment(null)
    setBundle(null)
    setExecuting(null)
  }

  const continueAfterReveal = () => {
    setRevealed(null)
    if (!state.finished) runSim()
  }

  const skipAhead = () => setDisplayMinute(state.minute)
  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])
  const clockLabel = displayMinute > 90 ? `90+${displayMinute - 90}'` : `${displayMinute}'`

  return (
    <div className="relative h-[100dvh] w-full bg-ks-black flex flex-col overflow-hidden">
      {celebration && (
        <GoalCelebration
          kind={celebration.kind}
          scorerName={celebration.kind === 'player-goal' || celebration.kind === 'player-assist' ? player.name : undefined}
          homeShort={state.homeTeam.short}
          awayShort={state.awayTeam.short}
          homeScore={state.homeScore}
          awayScore={state.awayScore}
          minute={celebration.minute}
          avatarId={celebration.kind === 'player-goal' || celebration.kind === 'player-assist' ? player.avatarId : undefined}
          onDone={() => setCelebration(null)}
        />
      )}
      {halfTimeShown && (
        <HalfTimeBreak
          homeShort={state.homeTeam.short}
          awayShort={state.awayTeam.short}
          homeScore={displayScore.home}
          awayScore={displayScore.away}
          playerRating={state.playerRating}
          coachTrust={player.coachTrust}
          onContinue={() => setHalfTimeShown(false)}
        />
      )}
      {showMoment && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] pointer-events-none transition-opacity duration-200" />
      )}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#0a0f0a 0%,#07110a 40%,#050504 100%)' }} />
      <svg className="absolute inset-x-0 top-0 w-full opacity-[0.14]" viewBox="0 0 400 260" preserveAspectRatio="xMidYMin slice" aria-hidden>
        <rect x="20" y="10" width="360" height="500" fill="none" stroke="#7bd88a" strokeWidth="2" />
        <line x1="20" y1="260" x2="380" y2="260" stroke="#7bd88a" strokeWidth="2" />
        <circle cx="200" cy="260" r="50" fill="none" stroke="#7bd88a" strokeWidth="2" />
        <rect x="110" y="10" width="180" height="70" fill="none" stroke="#7bd88a" strokeWidth="2" />
        <rect x="155" y="10" width="90" height="28" fill="none" stroke="#7bd88a" strokeWidth="2" />
        {Array.from({ length: 6 }).map((_, i) => (
          <rect key={i} x="20" y={10 + i * 42} width="360" height="21" fill="#ffffff" opacity="0.05" />
        ))}
      </svg>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 55% at 50% 0%, transparent 30%, rgba(5,5,4,0.92) 78%)' }} />

      <div className="relative z-10 px-5 pt-5 max-w-md mx-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={cycleSpeed}
            className="text-[10px] font-display tracking-widest uppercase text-ks-gold border border-ks-gold/40 rounded-md px-2.5 py-1 bg-ks-gold/5"
            aria-label="commentary speed"
          >
            {speed}x speed
          </button>
          <div className="font-display tracking-widest text-ks-ink text-lg tabular-nums bg-[#0f0f0dcc] border border-ks-border rounded-lg px-3 py-0.5">
            {clockLabel}
          </div>
          <button
            onClick={() => { const m = toggleMuted(); setMutedUi(m); syncMusicMute() }}
            className="text-[10px] font-display tracking-widest uppercase text-ks-muted border border-ks-border rounded-md px-2 py-1"
            aria-label={muted ? 'unmute sound' : 'mute sound'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className={`flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 ${playerIsHome ? 'bg-ks-gold' : 'bg-[#1c1c18]'}`}>
            <TeamCrest primary={state.homeTeam.primaryColor} secondary={state.homeTeam.secondaryColor} short={state.homeTeam.short} size="sm" />
            <span className={`font-display tracking-wide text-xs ${playerIsHome ? 'text-ks-black' : 'text-ks-ink'}`}>{state.homeTeam.short}</span>
          </div>
          <span key={`${displayScore.home}-${displayScore.away}`} className="font-display tracking-widest text-ks-gold text-3xl animate-[scorepop_0.4s_ease-out] shrink-0">
            {displayScore.home}–{displayScore.away}
          </span>
          <div className={`flex items-center gap-1.5 rounded-full pl-2.5 pr-1 py-1 flex-row-reverse ${!playerIsHome ? 'bg-ks-gold' : 'bg-[#1c1c18]'}`}>
            <TeamCrest primary={state.awayTeam.primaryColor} secondary={state.awayTeam.secondaryColor} short={state.awayTeam.short} size="sm" />
            <span className={`font-display tracking-wide text-xs ${!playerIsHome ? 'text-ks-black' : 'text-ks-ink'}`}>{state.awayTeam.short}</span>
          </div>
        </div>
        <div className="h-1 rounded-full bg-[#2a2a27] overflow-hidden mb-3 relative">
          <div className="absolute inset-y-0 left-1/2 w-px bg-ks-border" />
          <div
            className="h-full bg-ks-gold rounded-full transition-all"
            style={{
              width: `${Math.abs(state.momentum) * 5}%`,
              marginLeft: state.momentum >= 0 ? '50%' : `${50 - Math.abs(state.momentum) * 5}%`,
            }}
          />
        </div>
      </div>

      <div className="relative z-10 px-5 max-w-md mx-auto w-full mb-2">
        <FormationPitch
          momentum={state.momentum}
          homeColor={state.homeTeam.primaryColor}
          awayColor={state.awayTeam.primaryColor}
          playerIsHome={playerIsHome}
        />
      </div>

      <div ref={feedRef} className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 max-w-md mx-auto w-full" style={{ maxHeight: '30vh' }}>
        <div className="flex flex-col gap-2 pb-4">
          {visibleEvents.map((e, i) => {
            const isLast = i === visibleEvents.length - 1
            const size = e.kind === 'goal' ? 'text-base text-ks-ink font-medium' : e.kind === 'fulltime' || e.kind === 'halftime' ? 'text-sm text-ks-gold' : isLast ? 'text-sm text-ks-ink' : 'text-xs text-ks-muted'
            const fromEnd = visibleEvents.length - 1 - i
            const opacity = e.kind === 'goal' || e.kind === 'halftime' || e.kind === 'fulltime' ? 1 : Math.max(0.35, 1 - fromEnd * 0.12)
            return (
              <p key={i} className={`${size} leading-snug ${isLast ? 'animate-[feedin_0.3s_ease-out]' : ''}`} style={{ opacity }}>
                <span className="text-ks-muted tabular-nums">{e.minute}'</span> · {e.text}
              </p>
            )
          })}
          {!caughtUp && !showMoment && (
            <p className="text-[11px] text-ks-muted/60 animate-pulse">▪▪▪</p>
          )}
        </div>
      </div>

      {(showMoment || revealed) && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center p-5"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(212,175,55,0.08), transparent 65%), #050504' }}
        >
          <div className="max-w-md w-full max-h-[85vh] overflow-y-auto">
            {showMoment && executing && bundle && moment ? (
              <div className="flex flex-col gap-2.5">
                <div className="rounded-xl border border-ks-gold/40 bg-ks-gold/5 px-4 py-3 mb-1">
                  <p className="text-ks-ink text-sm leading-relaxed">{moment.situation}</p>
                </div>
                {miniGameKindForMoment(moment) ? (
                  <TrainingMiniGame
                    kind={miniGameKindForMoment(moment)!}
                    label={bundle.decision.options[executing.optIndex].label}
                    ceiling={bundle.ceilings[executing.optIndex]}
                    onComplete={(quality) => settle(executing.optIndex, gradeFromRatio(quality))}
                  />
                ) : (() => {
                  const ExecutionComponent = resolveExecutionComponent(bundle, executing.optIndex)
                  return (
                    <ExecutionComponent
                      spec={executionSpecFor(player, bundle.ceilings[executing.optIndex], state.matchStamina)}
                      label={bundle.decision.options[executing.optIndex].label}
                      onResolve={(grade) => settle(executing.optIndex, grade)}
                      tier={moment.tier}
                    />
                  )
                })()}
              </div>
            ) : showMoment && bundle && moment ? (
              <div className="flex flex-col gap-2.5">
                <div className="font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase text-center animate-pulse">
                  ⏸ your moment — clock stopped
                </div>
                <div className="rounded-xl border border-ks-gold/40 bg-ks-gold/5 px-4 py-3 mb-1 shadow-[0_0_30px_rgba(212,175,55,0.12)]">
                  <p className="text-ks-ink text-sm leading-relaxed">{moment.situation}</p>
                </div>
                {bundle.decision.options.map((opt, i) => (
                  <button key={opt.id} onClick={() => handleChoose(i)}
                    className="text-left rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 hover:border-ks-gold hover:bg-ks-gold/5 transition-colors">
                    <div className="font-display tracking-wide text-ks-gold text-sm uppercase">{opt.label}</div>
                    {opt.hint && <div className="text-[11px] text-ks-muted mt-0.5">{opt.hint}</div>}
                  </button>
                ))}
                <button
                  onClick={onToggleAutoResolve}
                  className="text-center text-[10px] text-ks-muted underline underline-offset-2 pt-1"
                >
                  {autoResolve ? 'auto-resolve is ON — play moments yourself' : 'auto-resolve these moments instead'}
                </button>
              </div>
            ) : revealed ? (
              <div className="flex flex-col gap-3">
                <div className={`rounded-xl border px-4 py-3 ${revealed.success ? 'border-green-500/50 bg-green-500/5' : 'border-orange-500/40 bg-orange-500/5'}`}>
                  {revealed.grade && (
                    <div className={`font-display tracking-widest text-[10px] uppercase mb-1.5 ${GRADE_COLOR[revealed.grade]}`}>
                      {GRADE_LABEL[revealed.grade]}
                    </div>
                  )}
                  <p className="text-ks-ink text-sm leading-relaxed">{revealed.text}</p>
                  {!revealed.success && (revealed.grade === 'perfect' || revealed.grade === 'good') && (
                    <p className="text-ks-muted text-[11px] mt-2 pt-2 border-t border-white/5">
                      Good process — the situation just didn't fall your way. Your decision and execution still matter to your rating.
                    </p>
                  )}
                </div>
                <button onClick={continueAfterReveal} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3 text-sm">
                  {state.finished ? 'full time →' : 'play on →'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="relative z-10 px-5 pb-8 max-w-md mx-auto w-full" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}>
        {matchOver ? (
          <button
            onClick={() => {
              const won = state.playerIsHome ? state.homeScore > state.awayScore : state.awayScore > state.homeScore
              const drew = state.homeScore === state.awayScore
              const playerScore = state.playerIsHome ? state.homeScore : state.awayScore
              const opponentScore = state.playerIsHome ? state.awayScore : state.homeScore
              onComplete({
                rating: Math.round(state.playerRating * 10) / 10, goals: state.playerGoals, assists: state.playerAssists,
                won, drew, finalMatchStamina: state.matchStamina, injury: state.injury, wasSubbed: state.substituted, redCarded: state.redCarded,
                playerScore, opponentScore, squad: state.squad, matchStats: matchStatsRef.current,
              })
            }}
            className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]"
          >
            match summary →
          </button>
        ) : !showMoment && !revealed ? (
          <button onClick={skipAhead} className="w-full text-center text-[11px] text-ks-muted border border-ks-border rounded-xl py-2.5">
            skip ahead ⏩
          </button>
        ) : null}
      </div>
    </div>
  )
}
