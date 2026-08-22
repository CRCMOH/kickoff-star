// ============================================================================
// PHASE 45 — CONTENT-CREATION DEBUG OVERRIDE
//
// Joel's ask: how do you actually FILM one specific branching scenario for a
// TikTok clip, when the game picks one at random among ~13 eligible per
// category and tier (~3% chance per attacking chance for any single one)?
// Grinding matches hoping for the right roll is a bad way to make content.
//
// This lets you force a specific scenario or single moment by its id via a
// URL query param — completely invisible to a normal player (nobody stumbles
// onto `?debugScenario=halfway-carry` by accident), doesn't touch balance for
// anyone who doesn't set it, and doesn't require a debug menu shipped in the
// UI. Read once per page load, so a fresh reload with a different id lines up
// a different clip.
// ============================================================================

let cachedOverride: string | null | undefined

/**
 * The forced scenario/moment id, if the page was loaded with
 * `?debugScenario=<id>` in the URL. `undefined` on first call triggers a
 * read of the actual URL; cached after that so it's stable for the rest of
 * the session (checking location.search on every single moment would be
 * wasteful and, more importantly, would let it silently change mid-match if
 * something ever rewrote the URL).
 */
export function debugScenarioOverride(): string | null {
  if (cachedOverride !== undefined) return cachedOverride
  try {
    const params = new URLSearchParams(window.location.search)
    cachedOverride = params.get('debugScenario')
  } catch {
    // SSR/non-browser context (e.g. a test harness) — never active there.
    cachedOverride = null
  }
  return cachedOverride
}

/** Test-only: reset the cache so a test can simulate a fresh page load with a different override. */
export function _resetDebugScenarioCacheForTests(): void {
  cachedOverride = undefined
}
