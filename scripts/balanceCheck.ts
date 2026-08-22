// Season-scale saturation check for the P28 expanded pool, using the REAL
// decay functions. This is the test that caught P15's three balance failures.
import { reseed, rand } from '../src/engine/rng'
import { pickLifeEvent, buildLifeContext } from '../src/engine/lifeEvents'
import { pickRelationshipEvent } from '../src/engine/relationshipEvents'
import { initialCast, driftRelationships, relationshipEffects } from '../src/engine/relationships'
import { decayTrust, decayConfidence } from '../src/engine/coachTrust'
import type { Player } from '../src/types/player'
reseed(4242)

type Strategy = 'greedy-trust' | 'greedy-conf' | 'greedy-rep' | 'random'

export function run(strategy: Strategy, seasons: number) {
  let trust = 0, conf = 0, rep = 5
  let rels = initialCast()
  const recent: string[] = []
  let p = {
    name: 'S', position: 'ST', potential: 16, attributes: { kind: 'outfield', values: {} },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 70 },
    careerClock: { ageYears: 15, phase: 'grassroots-season', grassrootsSeason: 1 },
    matchRatings: [7, 7, 7], career: { goals: 5, assists: 3, appearances: 12, wins: 5, cleanSheets: 0, bestRating: 8, motmAwards: 1 },
    coachTrust: 0, reputation: 5, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 0,
    squadRole: 'starting-xi', recentInjuryCount: 0, injury: null, relationships: rels, activeArcs: [], recentArcKeys: [],
  } as unknown as Player

  for (let w = 0; w < seasons * 44; w++) {
    const week = (w % 44) + 1
    // ~1.45 life slots/week
    const slots = rand() < 0.45 ? 2 : 1
    for (let s = 0; s < slots; s++) {
      const relPick = rand() < 0.55 ? pickRelationshipEvent(p, week, recent) : null
      const d = relPick ? relPick.decision : pickLifeEvent(buildLifeContext(p, week), recent).decision
      recent.push(relPick ? `${relPick.event.key}:${relPick.person.id}` : 'gen')
      if (recent.length > 60) recent.shift()
      // choose per strategy
      const score = (o: typeof d.options[0]) => {
        const e = o.onSuccess ?? {}
        if (strategy === 'greedy-trust') return e.coachTrust ?? 0
        if (strategy === 'greedy-conf') return e.confidence ?? 0
        if (strategy === 'greedy-rep') return e.reputation ?? 0
        return rand()
      }
      const chosen = [...d.options].sort((a, b) => score(b) - score(a))[0]
      const success = rand() < chosen.successChance
      const eff = (success ? chosen.onSuccess : chosen.onFailure) ?? {}
      trust = Math.max(-10, Math.min(10, trust + (eff.coachTrust ?? 0)))
      conf = Math.max(-10, Math.min(10, conf + (eff.confidence ?? 0)))
      rep = Math.max(0, Math.min(100, rep + (eff.reputation ?? 0)))
      if (eff.relationshipDelta && relPick) {
        rels = rels.map((r) => r.id === relPick.person.id ? { ...r, bond: Math.max(-100, Math.min(100, r.bond + eff.relationshipDelta!)), weeksSinceContact: 0 } : r)
      }
    }
    // weekly decay + relationship weekly effects, exactly as the store does
    rels = driftRelationships(rels)
    const re = relationshipEffects(rels)
    trust = Math.max(-10, Math.min(10, decayTrust({ value: trust }).value + re.trustDrift))
    conf = Math.max(-10, Math.min(10, decayConfidence(conf, 0) + re.confidenceSupport))
    p = { ...p, coachTrust: trust, confidence: { value: conf, baseline: 0 }, reputation: rep, relationships: rels, totalWeeksElapsed: w } as Player
  }
  return { trust, conf, rep, avgBond: rels.reduce((a, r) => a + r.bond, 0) / rels.length }
}

export function runBalance(seasons: number) {
  const out: Record<string, ReturnType<typeof run>> = {}
  for (const st of ['greedy-trust', 'greedy-conf', 'greedy-rep', 'random'] as Strategy[]) {
    out[st] = run(st, seasons)
  }
  return out
}

// standalone mode: `npx tsx scripts/balanceCheck.ts`
if (process.argv[1]?.includes('balanceCheck')) {
  console.log('strategy        trust   conf    rep    avgBond   (after 6 seasons)')
  for (const [st, r] of Object.entries(runBalance(6))) {
    console.log(`${st.padEnd(15)} ${r.trust.toFixed(2).padStart(6)} ${r.conf.toFixed(2).padStart(6)} ${r.rep.toFixed(1).padStart(6)} ${r.avgBond.toFixed(1).padStart(8)}`)
  }
}
