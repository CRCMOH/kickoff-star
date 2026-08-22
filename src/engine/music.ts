// Background music layer — separate from sfx.ts (which is synthesized).
// Uses a plain HTMLAudioElement so we don't have to decode the mp3 into an
// AudioBuffer or manage a MediaElementSourceNode. Loops continuously,
// respects the existing mute toggle, and exposes play()/pause() so callers
// (Career.tsx) can gate it off during match/training screens.

import { isMuted } from './audio'

const TRACK_URL = './audio/pulse-of-the-pitch.mp3'
const VOLUME = 0.35

let el: HTMLAudioElement | null = null
let wantsToPlay = false

function ensureEl(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!el) {
    el = new Audio(TRACK_URL)
    el.loop = true
    el.volume = isMuted() ? 0 : VOLUME
    el.preload = 'auto'
  }
  return el
}

/** Start (or resume) background music. Safe to call repeatedly. */
export function playMusic(): void {
  wantsToPlay = true
  const a = ensureEl()
  if (!a) return
  a.volume = isMuted() ? 0 : VOLUME
  if (a.paused) {
    // play() can reject if not yet inside a user gesture on some mobile
    // browsers — that's fine, it'll succeed on the next gesture-triggered
    // call since wantsToPlay stays true.
    void a.play().catch(() => { /* will retry on next call */ })
  }
}

/** Pause background music (used during match/training screens). */
export function pauseMusic(): void {
  wantsToPlay = false
  if (el && !el.paused) el.pause()
}

/** Re-apply the current mute state to the music element (call from mute toggle). */
export function syncMusicMute(): void {
  if (!el) return
  el.volume = isMuted() ? 0 : VOLUME
  // If unmuting and playback was desired, make sure it's actually running.
  if (wantsToPlay && el.paused) void el.play().catch(() => { /* ignore */ })
}
