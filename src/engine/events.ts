import type { CalendarEvent } from '../types/calendar'
import type { Decision } from '../types/decision'

// Placeholder decision generators per event type. These are DUMMY content packs —
// real match/training/trial content replaces these in later phases. The point of this
// step is the loop + reusable DecisionCard, not final content.

function id() { return crypto.randomUUID() }

export function decisionForEvent(event: CalendarEvent): Decision | null {
  switch (event.type) {
    case 'training':
      return {
        id: id(), context: 'training',
        situation: 'The coach fires a ball into your feet during the finishing drill. A defender is closing you down fast.',
        meta: 'finishing drill',
        options: [
          { id: id(), label: 'first-time shot', hint: 'high risk, high reward', successChance: 0.45,
            onSuccess: { confidence: 2, energy: -8, narrative: 'You lash it first-time into the top corner. The coach nods.' },
            onFailure: { confidence: -1, energy: -8, narrative: 'You snatch at it and drag the shot wide.' } },
          { id: id(), label: 'take a touch', hint: 'steadier, buys a beat', successChance: 0.7,
            onSuccess: { confidence: 1, energy: -6, narrative: 'You control it and slot it home calmly.' },
            onFailure: { confidence: 0, energy: -6, narrative: 'The touch is heavy and the chance is gone.' } },
          { id: id(), label: 'lay it off', hint: 'safe, team play', successChance: 0.85,
            onSuccess: { confidence: 0, energy: -4, narrative: 'You lay it to a teammate — the smart, simple choice.' },
            onFailure: { confidence: 0, energy: -4, narrative: 'The pass is slightly behind your teammate.' } },
        ],
      }
    case 'school':
      return {
        id: id(), context: 'event',
        situation: 'First day at your new school. A group invites you to hang out after class, but there\'s an extra training session on tonight.',
        meta: 'school',
        options: [
          { id: id(), label: 'go to training', hint: 'sharper, but tiring', successChance: 1,
            onSuccess: { confidence: 1, energy: -10, narrative: 'You put in the extra work. It won\'t go unnoticed.' } },
          { id: id(), label: 'hang out', hint: 'rest & friendships', successChance: 1,
            onSuccess: { confidence: 1, energy: 5, narrative: 'You make some new friends and recharge.' } },
        ],
      }
    case 'match':
      return {
        id: id(), context: 'match',
        situation: 'The cross comes in and you\'re arriving at the near post, unmarked. This is your moment.',
        meta: "67' · 1-1",
        options: [
          { id: id(), label: 'volley', hint: 'high risk', successChance: 0.4,
            onSuccess: { confidence: 3, energy: -6, narrative: 'You catch it sweetly — top corner! The crowd erupts!' },
            onFailure: { confidence: -2, energy: -6, narrative: 'You lean back and sky it over the bar.' } },
          { id: id(), label: 'take a touch first', hint: 'steadier', successChance: 0.6,
            onSuccess: { confidence: 2, energy: -6, narrative: 'You control and finish low into the corner. Goal!' },
            onFailure: { confidence: -1, energy: -6, narrative: 'The touch lets the defender recover and block.' } },
          { id: id(), label: 'square it', hint: 'safe, team play', successChance: 0.8,
            onSuccess: { confidence: 1, energy: -4, narrative: 'You square it and your teammate taps in! Assist!' },
            onFailure: { confidence: 0, energy: -4, narrative: 'The pass is cut out by a covering defender.' } },
        ],
      }
    case 'rest':
      return null // handled by resolveCurrentEvent (stamina recovery)
    default:
      return null
  }
}
