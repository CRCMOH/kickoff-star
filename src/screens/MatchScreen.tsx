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

// P67 — every situational minigame shares the exact same contract, so
// picking between them is one function, not a chain of near-duplicate JSX
// blocks. Priority matters: defensive/dribble/shoot checks come before the
// passing fallback since a shooting or tackling option will often ALSO
// carry 'positioning'-style overlap. Cross-and-header is the one honest
// exception — there's no dedicated crossing/heading attribute in the
// locked 12-attribute spec, so it falls back to checking the option's own
// label text for "cross"/"header" wording rather than pretending a real
// attribute signal exists for it.
type ExecutionComponentProps = { spec: ExecutionSpec; label: string; onResolve: (grade: ExecutionGrade, position: number) => void; tier?: ChanceTier }
function resolveExecutionComponent(bundle: MatchDecisionBundle, optIndex: number): React.ComponentType<ExecutionComponentProps> {
  const attrs = bundle.keyAttributes[optIndex] ?? []
  const label = bundle.decision.options[optIndex]?.label.toLowerCase() ?? ''
  const situation = bundle.decision.situation?.toLowerCase() ?? ''
  const isGkContext = bundle.decision.context === 'gk'

  // P70 — Joel: "there's still the press-the-block minigames." Quantified
  // it precisely rather than guess: counted every real option's
  // keyAttributes across both content files — only 41% were actually
  // routing to one of the 6 new minigames, 59% (138 of 233) fell through
  // to the plain old bar. Root cause was twofold: (1) GK content
  // (reflexes/gkPositioning/handling/distribution) required `isGkContext`
  // on top of the attribute match, but that flag apparently isn't
  // reliably set for chained scenario content the way it is for the flat
  // single-shot pool — this alone blocked ~44 real GK options. (2) real
  // defensive situations tagged with positioning+concentration or
  // positioning+strength (aerial duels, jockeying, tracking back) were
  // never routed anywhere just because they didn't happen to also
  // self-tag 'tackling' — these accounted for the single largest chunk
  // (49 of the 138 unrouted options).
  if (isGkContext && situation.includes('penalty')) return KeeperMinigame
  if (situation.includes('penalty') || situation.includes('free kick') || situation.includes('free-kick')) {
    return situation.includes('wide') || situation.includes('flank') ? CrossHeaderMinigame : ShootingMinigame
  }
  if (label.includes('cross') || label.includes('header') || label.includes('whip')) return CrossHeaderMinigame
  // GK attributes are an unambiguous signal on their own — dropped the
  // isGkContext requirement, since a keeper-specific attribute genuinely
  // never appears on a non-GK option regardless of what the context field
  // happens to be set to.
  if (attrs.includes('reflexes') || attrs.includes('gkPositioning') || attrs.includes('handling') || attrs.includes('distribution')) return KeeperMinigame
  if (attrs.includes('tackling')) return TackleMinigame
  if (attrs.includes('dribbling')) return DribbleMinigame
  if (attrs.includes('shooting')) return ShootingMinigame
  // Real defensive situations that never self-tagged 'tackling' — an
  // aerial duel, jockeying a winger, tracking a run — but are
  // unmistakably defensive by their attribute combination.
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

// P27 — THE REAL-TIME MATCH (Joel: "it shouldn't feel like a sim"). The clock
// runs 0' -> 90'+ continuously, commentary streams in as its minute arrives,
// and the clock STOPS when a key moment routes to you. Speed control (1x/2x/3x)
// changes how fast match-minutes pass. The simulation underneath is untouched —
// same engine, same math, same audited balance — only the way time is
// PRESENTED changed: events are revealed when the live clock reaches them
// instead of being dumped a chunk at a time behind a "play on" button.

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
const BASE_TICK_MS = 450 // one match-minute at 1x

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
  // P63 — real bug: goals shown so far tracked against totalGoals (every
  // goal in the WHOLE simulation so far, often ahead of the reveal) instead
  // of against what had actually been shown before. A 3-goal spell that
  // simulated faster than it revealed meant nothing updated until all 3
  // were finally caught up, then the scoreboard jumped straight to the
  // final score with only one celebration for the last goal — exactly the
  // "0-0 to 4-0 in a blink, only one goal announcement all game" report.
  const goalsShown = useRef(0)
  const displayScoreRef = useRef({ home: 0, away: 0 })
  const matchStatsRef = useRef({ tackle: 0, interception: 0, header: 0, keyPass: 0, save: 0 })
  // score shown on the board — snaps forward only when a goal's commentary
  // has actually been revealed, so the scoreboard can't spoil the feed
  const [displayScore, setDisplayScore] = useState({ home: 0, away: 0 })
  const feedRef = useRef<HTMLDivElement>(null)

  // Audit fix (P28b): this previously ran advanceToKeyMoment INSIDE a setState
  // updater. State updaters must be pure — React StrictMode deliberately
  // double-invokes them, which meant the sim advanced twice and consumed the
  // seeded RNG stream twice per call, throwing away one result. The sim is now
  // driven from a ref holding the authoritative state, so it advances exactly
  // once per call no matter how often React re-renders or re-invokes.
  const stateRef = useRef(state)
  stateRef.current = state

  const runSim = () => {
    const result = advanceToKeyMoment(stateRef.current, player)
    stateRef.current = result.state
    setState(result.state)
    if (result.keyMoment) {
      setMoment(result.keyMoment)
      // P53 — same spoiler class as the HalfTimeBreak fix: advanceToKeyMoment
      // can auto-resolve several background drives (and their goals) before
      // surfacing the next moment that actually needs the player, all of
      // which update the raw score immediately — while the commentary feed
      // reveals progressively on its own timer and may not have shown those
      // goals yet. Using displayScore here means the meta label only ever
      // shows what the player has actually seen happen.
      setBundle(momentToDecision(player, result.keyMoment, `${result.state.minute}' · ${result.state.homeTeam.short} ${displayScore.home}-${displayScore.away} ${result.state.awayTeam.short}`))
    }
  }

  // kick off (StrictMode-safe)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    sfx.whistle()
    runSim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // How much of the feed the live clock has reached
  const visibleCount = state.events.filter((e) => e.minute <= displayMinute).length
  const visibleEvents = state.events.slice(0, visibleCount)

  // P47 — half-time is now a genuine break, not a feed line the clock just
  // rolls through. Fires once, the moment the halftime marker is actually
  // revealed in the feed (not just simulated ahead of the visible clock).
  useEffect(() => {
    if (halfTimeSeen.current) return
    if (visibleEvents.some((e) => e.kind === 'halftime')) {
      halfTimeSeen.current = true
      setHalfTimeShown(true)
    }
  }, [visibleEvents])
  const caughtUp = displayMinute >= state.minute
  // P31b DEFENSIVE GUARD. A player reported scoring a goal AFTER being
  // substituted off — the feed showed the sub at 72', full time at 93', and
  // then a key moment resolving into a goal. I could not reproduce it at
  // engine level (the guarantee correctly checks !substituted), so rather than
  // leave a race I cannot see, a pending moment is now DISCARDED outright if
  // the player is no longer on the pitch or the match is over. There is no
  // sequencing of events that can produce that goal now.
  const momentStillValid = moment !== null && !state.substituted && !state.injury && state.onPitch && !state.finished
  const showMoment = momentStillValid && bundle !== null && caughtUp
  useEffect(() => {
    if (moment !== null && !momentStillValid) { setMoment(null); setBundle(null) }
  }, [moment, momentStillValid])
  const matchOver = state.finished && caughtUp && !moment && !revealed

  // ---- THE CLOCK. Ticks while there's ground to cover and no interaction pending.
  useEffect(() => {
    const paused = showMoment || revealed !== null || matchOver || celebration !== null || halfTimeShown
    if (paused) return
    if (caughtUp && !state.finished && !moment) {
      // clock reached the sim frontier with nothing pending — extend the sim
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

  // Scoreboard + goal audio: react to REVEALED goals, incrementally — one
  // celebration and one score-tick per goal as it's actually shown, not
  // only once the whole simulated backlog has caught up.
  const revealedGoalEvents = visibleEvents.filter((e) => e.kind === 'goal')
  const revealedGoals = revealedGoalEvents.length
  useEffect(() => {
    if (revealedGoals <= goalsShown.current) return
    // Process every goal newly revealed since the last check, in order —
    // usually exactly one, but a batch of auto-resolved background drives
    // (e.g. several opponent goals while the player's on the bench with no
    // moment to interrupt) can genuinely reveal more than one at once.
    const newGoals = revealedGoalEvents.slice(goalsShown.current)
    let home = displayScoreRef.current.home
    let away = displayScoreRef.current.away
    let lastKind: CelebrationKind = 'concede'
    for (const ev of newGoals) {
      // The commentary text names the scoring team's own short code
      // ("GOAL! Okafor finishes it off for GRE!") — read it directly rather
      // than assume, since there's no separate structured "who scored"
      // field on the event.
      const homeMentioned = ev.text.includes(state.homeTeam.short)
      const awayMentioned = ev.text.includes(state.awayTeam.short)
      const homeScored = homeMentioned && !awayMentioned ? true
        : awayMentioned && !homeMentioned ? false
        // Ambiguous (both/neither mentioned) — fall back to whichever side
        // hasn't yet reached its known final tally for this match.
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

  // full-time whistle when the clock actually gets there
  const ftPlayed = useRef(false)
  useEffect(() => {
    if (matchOver && !ftPlayed.current) { ftPlayed.current = true; sfx.fullTime() }
  }, [matchOver])

  // auto-scroll feed as commentary streams in
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [visibleCount])

  const handleChoose = (optIndex: number) => {
    if (!moment || !bundle) return
    // P38: an injury decision isn't a skill check — there's no timing-bar
    // execution that makes sense for "do I ask to come off". It resolves the
    // instant you tap, deterministically, based on which option you picked.
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
    const quality = chosenReward / bundle.maxReward
    const archBonus = archetypeMomentBonus(player.archetype, !moment.isDefensive, moment.isDefensive, option.successChance < 0.5)
    const finalChance = Math.min(0.97, adjustChance(option.successChance, grade) + archBonus)
    const success = rand() < finalChance

    // P38: a scenario beat resolves through resolveScenarioBeat instead —
    // same success roll, same execution grade, but it may CONTINUE the
    // passage of play (activeScenario stays set) rather than ending it. The
    // reveal card and "play on" flow below are unchanged either way; runSim()
    // already knows how to resume a live scenario via the engine-level guard.
    const next = moment.scenarioId
      ? resolveScenarioBeat(state, moment, optIndex, quality, success, chosenReward, bundle.maxReward, grade)
      : resolvePlayerMoment(state, moment, quality, success, chosenReward, bundle.maxReward, player.position === 'GK', grade)

    // P52 — a real scout doesn't judge a defender on goals. Track what
    // actually happened, not just goals/assists/rating, so reputation can
    // be built the same way a real scout would judge each position.
    const tag = inferStatTag(option.label, moment.isDefensive, moment.isDistribution, player.position === 'GK', success)
    if (tag) matchStatsRef.current[tag] += 1

    stateRef.current = next
    setState(next)
    setDisplayMinute(next.minute) // the moment resolves live — no replay lag
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
      {/* P53 — Joel/reviewer feedback: as commentary streamed in, the WHOLE
          PAGE grew taller and the player had to scroll to reach their own
          decision — on mobile that means scrolling to find the button that
          just appeared under a moment that needs you right now. Root cause:
          this container used min-h-screen (grows past the viewport, page
          scrolls) instead of being locked to the actual viewport height with
          ONE genuine internal scroll region. Now: outer frame locked to
          100dvh, the commentary feed below is the only thing that scrolls
          (it already had overflow-y-auto), and the header above / decision
          panel below stay exactly where the thumb expects them — not via
          position:fixed, just by being ordinary flex siblings of a
          height-locked column, which is the simpler and more robust way to
          get the same "always-visible top/bottom zone" result. */}
      {celebration && (
        <GoalCelebration
          kind={celebration.kind}
          // P57 — real, confirmed bug: this used to pass the player's own
          // name/avatar unconditionally, even for a TEAMMATE's goal
          // (kind='team-goal'), because GoalCelebration's own isGood check
          // (kind !== 'concede') is true for team-goal too. Result: your own
          // face and name flashed up under "GOAL!" when someone else
          // scored — exactly what looked like scoring while benched. No
          // reliable structured "who scored" field exists (only prose
          // commentary text, too fragile to parse), so the honest fix is to
          // simply not claim an identity that isn't genuinely the player's.
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
          // P53 — real, confirmed bug (both an external playtest report AND
          // Joel's own match: halftime showed 2-1, but the second goal
          // wasn't actually conceded/narrated until a few minutes into the
          // second half). Root cause: this read state.homeScore/awayScore —
          // the RAW simulation score — while the real scoreboard a few
          // lines below correctly uses the reveal-gated displayScore. The
          // engine can compute several minutes ahead of what's actually
          // been revealed in the commentary feed, so the raw score can
          // already include a goal the player hasn't been shown yet. This
          // is exactly that spoiler, now fixed to match what the player has
          // actually SEEN happen, not what the simulation has quietly
          // already decided.
          homeScore={displayScore.home}
          awayScore={displayScore.away}
          playerRating={state.playerRating}
          coachTrust={player.coachTrust}
          onContinue={() => setHalfTimeShown(false)}
        />
      )}
      {/* P47 — Joel: match moments need to visually INTERRUPT, not sit quietly
          at the bottom of a scrolling feed. This dims and blurs everything
          behind the moment/decision card so there's no ambiguity that this
          is the thing that needs your attention right now. */}
      {showMoment && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] pointer-events-none transition-opacity duration-200" />
      )}
      {/* pitch backdrop — the game-feel layer */}
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

      {/* scoreboard */}
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
          {/* P58 — reference video: solid pill-shaped team chips (crest +
              name on a bright rounded background) instead of plain text —
              reads faster at a glance, higher contrast against the pitch
              backdrop. Score stays the centered focal point. */}
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
        {/* momentum bar */}
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

      {/* P60 — the formation pitch is now the primary visual, matching the
          reference. Deliberately NOT literal per-player tracking — the
          engine only tracks momentum, not real positions, and shouldn't
          need to just for this. The whole shape drifts toward the
          attacking third as momentum swings; that's the entire signal. */}
      <div className="relative z-10 px-5 max-w-md mx-auto w-full mb-2">
        <FormationPitch
          momentum={state.momentum}
          homeColor={state.homeTeam.primaryColor}
          awayColor={state.awayTeam.primaryColor}
          playerIsHome={playerIsHome}
        />
      </div>

      {/* live commentary ticker — now a compact scrolling strip under the
          pitch view, not the primary visual it used to be */}
      <div ref={feedRef} className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 max-w-md mx-auto w-full" style={{ maxHeight: '30vh' }}>
        <div className="flex flex-col gap-2 pb-4">
          {visibleEvents.map((e, i) => {
            const isLast = i === visibleEvents.length - 1
            const size = e.kind === 'goal' ? 'text-base text-ks-ink font-medium' : e.kind === 'fulltime' || e.kind === 'halftime' ? 'text-sm text-ks-gold' : isLast ? 'text-sm text-ks-ink' : 'text-xs text-ks-muted'
            // P53 — reviewer: "stacking 30+ lines of commentary creates
            // visual noise." Fading progressively (not hard-hiding, so
            // scrollback still reads fine) keeps attention on what just
            // happened without losing the match's history entirely.
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

      {/* P54 — Joel: match moments should appear centered, not bottom-docked.
          The bottom-dock placement was itself a deliberate earlier fix (an
          external reviewer specifically asked for thumb-reach), so this
          isn't undoing that by accident — it's a real, considered choice for
          the moment sequence specifically. The plain "match summary" button
          below (not really "a moment," just a continue action) stays
          bottom-docked. */}
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
                      Good process — the situation just didn't fall your way. That still counts toward your development.
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

      {/* plain match-over continue — not a "moment," stays bottom-docked */}
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
