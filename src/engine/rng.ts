// Single seeded PRNG for every engine roll. Fixes the "56 unseeded
// Math.random sites" audit blocker: all simulation randomness now flows
// through one mulberry32 stream that can be reseeded for reproducible
// sims/tests, while defaulting to a crypto-random seed per session so
// normal play stays unpredictable.

let state = (() => {
  const buf = new Uint32Array(1)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf)
  else buf[0] = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
  return buf[0] >>> 0
})()

/** Reseed the stream — used by sim/audit scripts for reproducible runs. */
export function reseed(seed: number): void {
  state = seed >>> 0
}

/** Drop-in Math.random replacement: uniform float in [0, 1). */
export function rand(): number {
  state = (state + 0x6d2b79f5) >>> 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
