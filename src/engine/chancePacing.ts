// ============================================================================
// PHASE 31 — CHANCE PACING
//
// Player report: "I only get one chance and that's always at the 90+ minute."
// Measured and confirmed exactly: a starter averaged 1.85 key moments a match
// with 53% of them at 88'+; a substitute averaged 1.05 with 71% at 88'+. In
// other words most players were getting ZERO organic involvement and only the
// emergency guarantee firing in stoppage time.
//
// Two causes, both mathematical:
//
//  1. Clear chances are rare. Per drive: 82% stall, 7% reach the final third,
//     11% become clear chances. Over ~26 drives that is ~2.8 clear chances for
//     BOTH teams — about 1.4 for the player's side. Even at 100% involvement
//     the player could not be given more than ~1.4 moments, so the engine was
//     mathematically incapable of delivering a normal match.
//
//  2. The anti-starvation floor counted DRIVES SINCE INVOLVED, but that counter
//     only incremented on clear chances the player didn't receive. With ~1.4
//     such chances a match it almost never reached its threshold of 4, so the
//     floor never fired and the only backstop left was the stoppage-time
//     guarantee.
//
// This module replaces that with an explicit pacing target. Every player has a
// number of moments they SHOULD get per 90 based on position and ability; the
// engine tracks how far behind that pace they are in MINUTES and escalates
// accordingly — first by routing more chances to them, then by promoting
// half-chances into real moments. The result is involvement spread across the
// match instead of dumped at the death.
// ============================================================================
import type { Player } from '../types/player'

/**
 * Target key moments per 90 minutes on the pitch.
 *
 * Deliberately position-shaped: a striker lives on chances, a centre-back's
 * moments are defensive interventions and are rarer but heavier, a keeper
 * gets a handful of real saves. These are the numbers that decide how the
 * match FEELS, so they're stated in one place rather than emerging from
 * probability soup.
 */
export function targetMomentsPer90(player: Player): number {
  switch (player.position) {
    case 'ST': return 5.0
    case 'WG': return 4.6
    case 'CM': return 4.4
    case 'WM': return 4.4
    case 'FB': return 3.8
    case 'CB': return 3.6
    case 'GK': return 3.4
    default: return 4.2
  }
}

/**
 * Ability nudges the target: better players see more of the ball. Kept
 * deliberately narrow (±15%) so a weak player still gets a playable match —
 * being poor should mean you do less WITH your chances, not that you sit
 * watching. That distinction is what makes a bad run feel like a slump rather
 * than a broken game.
 */
export function targetMomentsFor(player: Player, currentAbility: number, minutesOnPitch: number): number {
  const per90 = targetMomentsPer90(player) * (0.85 + (currentAbility / 20) * 0.3)
  return Math.max(1, (per90 * minutesOnPitch) / 90)
}

export interface PacingState {
  /** Match minute of the player's last key moment (or their entry minute). */
  lastMomentMinute: number
  /** How many moments they've had so far. */
  momentsSoFar: number
}

/**
 * How far behind pace the player is, as a ratio.
 *   < 1  → on or ahead of schedule
 *   1-2  → drifting; the engine starts favouring them
 *   > 2  → starved; half-chances get promoted to real moments
 */
export function pacingPressure(
  player: Player, currentAbility: number, minute: number, entryMinute: number, fullTime: number, pacing: PacingState,
): number {
  const minutesAvailable = Math.max(1, fullTime - entryMinute)
  const target = targetMomentsFor(player, currentAbility, minutesAvailable)
  // Expected gap between moments, in minutes — capped, because a substitute
  // with 25 minutes to make an impression cannot be made to wait 17 minutes
  // for their first touch. Measured: without this cap, bench players still had
  // 76% of their moments in stoppage time because pressure only crossed the
  // promotion threshold after the 90.
  const expectedGap = Math.min(9, minutesAvailable / target)
  const sinceLast = minute - pacing.lastMomentMinute
  return sinceLast / expectedGap
}

/**
 * The involvement chance for a drive, given pacing pressure. Below pace the
 * player's chance of being the one who gets it rises steeply, which is what
 * spreads moments through the match rather than clustering them.
 */
export function pacedInvolvement(base: number, pressure: number): number {
  if (pressure <= 0.6) return base * 0.75 // just had one — let the game breathe
  if (pressure <= 1) return base
  // behind pace: escalate hard, capped so it never becomes a certainty
  return Math.min(0.96, base * (1 + (pressure - 1) * 1.6))
}

/**
 * Should a half-chance (a final-third move that would normally fizzle) be
 * promoted into a real player moment? This is the mechanism that guarantees
 * involvement WITHOUT waiting for stoppage time: when a player has gone far
 * too long without the ball, the next promising move finds them.
 */
export function shouldPromoteHalfChance(pressure: number): boolean {
  return pressure >= 1.8
}

/**
 * A hard floor, expressed in minutes rather than drives. If this many minutes
 * pass with no involvement at all, the next drive of ANY kind becomes a moment.
 * This is the backstop the old drive-counter was supposed to be.
 */
export function starvationMinutes(player: Player, currentAbility: number, minutesOnPitch: number): number {
  const target = targetMomentsFor(player, currentAbility, minutesOnPitch)
  const expectedGap = minutesOnPitch / target
  return Math.max(12, expectedGap * 2.2)
}


/**
 * THE FLOOR (P31b).
 *
 * Measured across team-strength mismatches, involvement collapsed from 6.8
 * moments a match in a strong side to 2.2 in a weak one — because a weak team
 * rarely works the ball into a clear chance, so there was simply nothing to
 * route to the player. That punishes a player twice for their team being bad:
 * they lose the games AND they barely touch the ball.
 *
 * Your team's quality should decide how often your moments are GOOD ones, not
 * whether you get any. So past this point the next drive of any kind — a loose
 * ball, an aerial duel, a chase-back — becomes a moment regardless of whether
 * the move went anywhere.
 */
export function isStarved(minute: number, pacing: PacingState, entryMinute: number, fullTime: number, player: Player, currentAbility: number): boolean {
  const minutesOnPitch = Math.max(1, fullTime - entryMinute)
  const limit = starvationMinutes(player, currentAbility, minutesOnPitch)
  return minute - pacing.lastMomentMinute >= limit
}
