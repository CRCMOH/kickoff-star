import { useEffect, useState } from 'react'
import type { Player } from '../types/player'
import type { Team } from '../engine/teams'
import { executionSpecFor } from '../engine/execution'
import ShootingMinigame from '../components/ShootingMinigame'
import { TeamCrest } from '../components/ui'
import { sfx } from '../engine/audio'
import { haptics } from '../engine/haptics'

// P67 — the last real piece of the minigame build: shootouts previously
// resolved via a single hidden probability roll with zero visual
// representation at all (confirmed by reading the real code before this
// existed). Now a genuine sequence: alternating kicks, the player's own
// attempts are real ShootingMinigame rounds (their actual composure/
// shooting attributes matter, same fairness rule as everywhere else),
// every other kick auto-resolves at a realistic ~76% conversion rate
// (real average professional penalty conversion) rather than being
// interactively simulated for 9 players who aren't the one you're playing.
// Standard best-of-5 first, sudden death after if still level — the
// player takes their side's opening kick and every sudden-death kick,
// a reasonable "they trust you with the big ones" framing rather than
// tracking which of 10 anonymous numbered slots is supposedly you.

const REAL_CONVERSION_RATE = 0.76

interface Kick {
  side: 'player' | 'opponent'
  isPlayerKick: boolean
  scored: boolean | null // null = not yet taken
}

function buildInitialKicks(): Kick[] {
  const kicks: Kick[] = []
  for (let round = 0; round < 5; round++) {
    kicks.push({ side: 'player', isPlayerKick: round === 0, scored: null })
    kicks.push({ side: 'opponent', isPlayerKick: false, scored: null })
  }
  return kicks
}

export default function ShootoutScreen({ player, playerTeam, opponent, playerIsHome, onComplete }: {
  player: Player
  playerTeam: Team
  opponent: Team
  playerIsHome: boolean
  onComplete: (playerWon: boolean) => void
}) {
  const [kicks, setKicks] = useState<Kick[]>(buildInitialKicks)
  const [suddenDeathRound, setSuddenDeathRound] = useState(0)
  const [resolving, setResolving] = useState(false)

  const taken = kicks.filter((k) => k.scored !== null)
  const playerScore = taken.filter((k) => k.side === 'player' && k.scored).length
  const opponentScore = taken.filter((k) => k.side === 'opponent' && k.scored).length
  const playerTaken = taken.filter((k) => k.side === 'player').length
  const opponentTaken = taken.filter((k) => k.side === 'opponent').length

  const playerRemaining = 5 - playerTaken
  const opponentRemaining = 5 - opponentTaken
  const decided = playerScore > opponentScore + opponentRemaining || opponentScore > playerScore + playerRemaining

  const nextKick = !decided ? kicks.find((k) => k.scored === null) : null
  const inSuddenDeath = !nextKick && playerScore === opponentScore

  const resolveKick = (kickIndex: number, scored: boolean) => {
    setKicks((prev) => prev.map((k, i) => (i === kickIndex ? { ...k, scored } : k)))
    if (scored) { sfx.perfect(); haptics.success() } else { sfx.miss(); haptics.fail() }
  }

  const autoResolveNext = () => {
    if (!nextKick || resolving) return
    setResolving(true)
    window.setTimeout(() => {
      const scored = Math.random() < REAL_CONVERSION_RATE
      resolveKick(kicks.indexOf(nextKick), scored)
      setResolving(false)
    }, 900)
  }

  const resolveSuddenDeath = (side: 'player' | 'opponent', scored: boolean) => {
    setKicks((prev) => [...prev, { side, isPlayerKick: side === 'player', scored }])
    if (scored) { sfx.perfect(); haptics.success() } else { sfx.miss(); haptics.fail() }
  }

  const suddenDeathKicks = kicks.slice(10)
  const sdThisRound = suddenDeathKicks.slice(suddenDeathRound * 2)
  const sdPlayerKick = sdThisRound.find((k) => k.side === 'player')
  const sdOpponentKick = sdThisRound.find((k) => k.side === 'opponent')

  useEffect(() => {
    if (!inSuddenDeath && nextKick && !nextKick.isPlayerKick && !resolving) autoResolveNext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSuddenDeath, nextKick?.side, nextKick?.isPlayerKick])

  useEffect(() => {
    if (inSuddenDeath && sdPlayerKick && !sdOpponentKick && !resolving) {
      setResolving(true)
      const t = window.setTimeout(() => {
        resolveSuddenDeath('opponent', Math.random() < REAL_CONVERSION_RATE)
        setResolving(false)
      }, 900)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSuddenDeath, sdPlayerKick?.scored, sdOpponentKick])

  useEffect(() => {
    if (inSuddenDeath && sdPlayerKick && sdOpponentKick && sdPlayerKick.scored !== null && sdOpponentKick.scored !== null) {
      if (sdPlayerKick.scored !== sdOpponentKick.scored) {
        const t = window.setTimeout(() => onComplete(sdPlayerKick.scored === true), 900)
        return () => window.clearTimeout(t)
      } else {
        const t = window.setTimeout(() => setSuddenDeathRound((r) => r + 1), 900)
        return () => window.clearTimeout(t)
      }
    }
    if (decided) {
      const t = window.setTimeout(() => onComplete(playerScore > opponentScore), 900)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSuddenDeath, decided, sdPlayerKick?.scored, sdOpponentKick?.scored, playerScore, opponentScore])

  const homeTeam = playerIsHome ? playerTeam : opponent
  const awayTeam = playerIsHome ? opponent : playerTeam

  return (
    <div className="min-h-screen bg-ks-black flex flex-col px-5 py-8">
      <div className="max-w-md mx-auto w-full flex flex-col gap-6">
        <div className="text-center">
          <div className="font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase mb-2">penalty shootout</div>
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <TeamCrest primary={homeTeam.primaryColor} secondary={homeTeam.secondaryColor} short={homeTeam.short} />
              <span className="text-[10px] text-ks-muted">{homeTeam.short}</span>
            </div>
            <span className="font-display text-3xl text-ks-ink">
              {playerIsHome ? playerScore : opponentScore} — {playerIsHome ? opponentScore : playerScore}
            </span>
            <div className="flex flex-col items-center gap-1">
              <TeamCrest primary={awayTeam.primaryColor} secondary={awayTeam.secondaryColor} short={awayTeam.short} />
              <span className="text-[10px] text-ks-muted">{awayTeam.short}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-1.5">
          {kicks.slice(0, 10).map((k, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full ${
              k.scored === null ? 'bg-ks-border' : k.scored ? 'bg-green-500' : 'bg-red-500'
            } ${k.side === 'opponent' ? 'opacity-60' : ''}`} />
          ))}
        </div>

        {inSuddenDeath ? (
          <div className="text-center font-display text-xs tracking-widest text-ks-gold uppercase">sudden death</div>
        ) : null}

        {inSuddenDeath ? (
          !sdPlayerKick ? (
            <ShootingMinigame
              spec={executionSpecFor(player, 0.6, 100)}
              label="sudden death — your kick"
              onResolve={(grade) => resolveSuddenDeath('player', grade === 'perfect' || grade === 'good')}
            />
          ) : !sdOpponentKick ? (
            <div className="text-center text-ks-muted text-sm">their turn…</div>
          ) : (
            <div className="text-center text-ks-muted text-sm">still level, again…</div>
          )
        ) : nextKick?.isPlayerKick ? (
          <ShootingMinigame
            spec={executionSpecFor(player, 0.6, 100)}
            label="your penalty"
            onResolve={(grade) => resolveKick(kicks.indexOf(nextKick), grade === 'perfect' || grade === 'good')}
          />
        ) : nextKick ? (
          <div className="text-center text-ks-muted text-sm">their turn…</div>
        ) : null}

        {!nextKick && !inSuddenDeath && !decided && (
          <div className="text-center text-ks-muted text-sm">deciding…</div>
        )}
      </div>
    </div>
  )
}
