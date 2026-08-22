// ============================================================================
// PHASE 30 — AGENTS
//
// Before you can sign an academy scholarship you need someone representing
// you. Like the onboarding archetype pick, this is a one-time choice between
// three options with genuine trade-offs — and unlike the archetype, it has a
// running COST, because that's what representation actually is.
//
// The three options map onto how this really works at 15/16:
//   - a parent does it for free, out of love, and is completely out of their
//     depth at a negotiating table
//   - a big established agency gets you the best terms and the most interest,
//     and takes a serious cut
//   - a young agent building his own book works cheap and tries hard, but
//     makes mistakes that cost you
//
// Every stat here feeds the negotiation engine directly (see negotiation.ts):
// nothing is flavour text.
// ============================================================================
import type { Player } from '../types/player'

export interface AgentSpec {
  id: string
  name: string
  tagline: string
  /** Percentage of wages taken, 0-15. */
  commission: number
  /**
   * How much they improve the club's offer during talks, 0-1. Feeds directly
   * into the wage/bonus improvement rolled at each negotiation round.
   */
  negotiation: number
  /** Chance a negotiation round goes badly wrong (a blunder). */
  blunderChance: number
  /**
   * Multiplier on how much club patience each push costs. A diplomatic agent
   * can go back to the table more times before the club walks. This is the
   * independent's edge — audit6 [A] found he was mid-table on every dimension
   * and therefore had no reason to exist.
   */
  patienceCare: number
  /** Multiplier on how often clubs come looking for you afterwards. */
  interestMultiplier: number
  /** Weekly bond effect with your parent — going outside the family costs something. */
  parentBondPerWeek: number
  pros: string[]
  cons: string[]
}

export const AGENTS: AgentSpec[] = [
  {
    id: 'parent',
    name: 'Your Parent',
    tagline: "They've driven you to every game since you were six. Why stop now?",
    commission: 0,
    negotiation: 0.15,
    blunderChance: 0.22,
    patienceCare: 1.35,
    interestMultiplier: 0.85,
    parentBondPerWeek: 0.4,
    pros: ['Takes nothing — you keep every penny', 'Absolutely in your corner', 'Brings you closer at home'],
    cons: ['No idea what a good contract looks like', 'Clubs will take advantage', 'Fewer clubs come calling'],
  },
  {
    id: 'agency',
    name: 'Hartwell & Boyd',
    tagline: 'An established agency with real clout. They will not be doing this for free.',
    commission: 12,
    negotiation: 0.95,
    blunderChance: 0.05,
    patienceCare: 1.0,
    interestMultiplier: 1.35,
    parentBondPerWeek: -0.25,
    pros: ['Gets you far better terms', 'Doors open that would stay shut', 'Rarely puts a foot wrong'],
    cons: ['Takes 12% of everything you earn', 'You are one client of many', 'Your parent feels pushed aside'],
  },
  {
    id: 'independent',
    name: 'Dean Marsh',
    tagline: 'Young, hungry, building his book. You would be his best client.',
    commission: 5,
    negotiation: 0.55,
    blunderChance: 0.14,
    patienceCare: 0.62,
    interestMultiplier: 1.1,
    parentBondPerWeek: 0,
    pros: ['Modest 5% cut', 'Diplomatic — clubs stay at the table longer', 'Answers the phone at 11pm'],
    cons: ['Still learning the job', 'Occasionally overplays a hand', 'Limited contacts'],
  },
]

export function getAgent(id: string | null | undefined): AgentSpec | null {
  return AGENTS.find((a) => a.id === id) ?? null
}

/** Wage the player actually banks after their agent's cut. */
export function netWage(grossWage: number, agentId: string | null | undefined): number {
  const agent = getAgent(agentId)
  if (!agent) return grossWage
  return Math.round(grossWage * (1 - agent.commission / 100) * 100) / 100
}

export function commissionOn(grossWage: number, agentId: string | null | undefined): number {
  const agent = getAgent(agentId)
  if (!agent) return 0
  return Math.round(grossWage * (agent.commission / 100) * 100) / 100
}

/** Has the player got representation yet? */
export function hasAgent(player: Player): boolean {
  return !!player.agentId
}
