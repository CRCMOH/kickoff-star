import { rand } from './rng'
import type { Player } from '../types/player'
import type { Decision, DecisionOption } from '../types/decision'

// ============================================================================
// PHASE 15 — EVENT DENSITY & THE LIFE LAYER
//
// What was here before: engine/events.ts held placeholder "DUMMY content packs".
// Training, matches and rest days have since been given real screens, which left
// exactly ONE event still running through that file — the school day. So the same
// hardcoded decision ("First day at your new school...") fired every Friday for
// all 34 weeks of a season. Week 30 still greeted you as a new arrival.
//
// This replaces it with a weighted pool that reads the player's actual situation.
// Events are GATED on state — a media event can't fire before anyone knows who you
// are, a coach falling-out can't fire while he trusts you — so what happens to you
// feels caused rather than sprinkled on.
// ============================================================================

// BALANCE CONSTRAINT (found by simulation, do not ignore when adding events):
// roughly 49 life events fire in a 34-week season. confidence, coachTrust and
// reputation are all CLAMPED, so even small consistently-positive deltas saturate
// them and silently switch off the systems they feed. The first draft of this pool
// pushed confidence to +9.2 and coachTrust to +9.5 under EVERY strategy — including
// picking at random — and handed out +38 reputation without playing a match, which
// would have wrecked the scouting economy.
// On reputation specifically, measured against the real scouting numbers:
// updateReputation() grants AT MOST 1.6 per match (rating >=8 plus a goal or assist)
// and a season contains 9 fixtures — so a PERFECT season of football is worth about
// 14.4 reputation. The first draft of this pool handed out 18.7 for bold off-pitch
// choices, meaning the life layer out-earned a flawless season on the pitch and
// inverted the whole premise of the scouting system.
// Rules of thumb: only rare, gated, genuinely significant events grant reputation,
// at +1 (or +2 for the academy guest session); confidence <= 2; coachTrust <= 1;
// and a good share of outcomes should cost something.
function id() { return crypto.randomUUID() }

export type LifeCategory = 'teammate' | 'coach' | 'media' | 'school' | 'opportunity' | 'setback'

export interface LifeContext {
  player: Player
  week: number
  isAcademy: boolean
  /** Rolling average of recent match ratings, or null before any matches. */
  form: number | null
}

export interface LifeEvent {
  key: string
  category: LifeCategory
  weight: number
  /** Gate: only eligible when the player's situation actually warrants it. */
  when?: (c: LifeContext) => boolean
  build: (c: LifeContext) => Decision
}

const opt = (
  label: string, hint: string, successChance: number,
  onSuccess: DecisionOption['onSuccess'], onFailure?: DecisionOption['onFailure'],
): DecisionOption => ({ id: id(), label, hint, successChance, onSuccess, onFailure })

const decision = (situation: string, meta: string, options: DecisionOption[]): Decision =>
  ({ id: id(), context: 'event', situation, meta, options })

// --- gates ---
const lowConfidence = (c: LifeContext) => c.player.confidence.value <= -2
const highConfidence = (c: LifeContext) => c.player.confidence.value >= 4
const trusted = (c: LifeContext) => (c.player.coachTrust ?? 0) >= 3
const distrusted = (c: LifeContext) => (c.player.coachTrust ?? 0) <= -2
const known = (c: LifeContext) => (c.player.reputation ?? 0) >= 25
const watched = (c: LifeContext) => (c.player.scoutWatchers ?? []).length > 0
const tired = (c: LifeContext) => c.player.fitness.stamina <= 45
const settled = (c: LifeContext) => c.week >= 6
const benched = (c: LifeContext) => c.player.squadRole === 'reserves' || c.player.squadRole === 'bench'
const inForm = (c: LifeContext) => c.form !== null && c.form >= 7.0
const outOfForm = (c: LifeContext) => c.form !== null && c.form <= 6.0

export const LIFE_EVENTS: LifeEvent[] = [
  // --- school & life ---
  {
    key: 'school-arrival', category: 'school', weight: 3,
    when: (c) => c.week <= 3,
    build: () => decision(
      'First week at your new school. A group invites you out after class, but there\'s an extra session on tonight.',
      'school',
      [
        opt('go to the session', 'sharper, but tiring', 1,
          { confidence: 1, energy: -10, coachTrust: 1, narrative: 'You put the work in. The coach clocks who turned up.' }),
        opt('go with them', 'rest and friendships', 1,
          { confidence: 1, energy: 5, narrative: 'You make some friends and feel human again.' }),
      ],
    ),
  },
  {
    key: 'school-exams', category: 'school', weight: 2,
    when: settled,
    build: () => decision(
      'Exams are next week and you\'re behind. Your parents are clear that football does not come first this month.',
      'school',
      [
        opt('study properly', 'they get off your back', 1,
          { confidence: 1, energy: -6, narrative: 'You knuckle down. Not football, but it buys you peace.' }),
        opt('do the bare minimum', 'keep the legs fresh', 0.55,
          { confidence: 1, energy: 4, narrative: 'You scrape through and nobody says a word.' },
          { confidence: -2, energy: -4, narrative: 'It goes badly. There\'s a row at home about priorities.' }),
      ],
    ),
  },
  {
    key: 'school-job', category: 'school', weight: 2,
    when: (c) => settled(c) && !c.isAcademy,
    build: () => decision(
      'A weekend shift comes up at the shop. The money would cover your own boots for once.',
      'life',
      [
        opt('take the shifts', 'independence, tired legs', 1,
          { confidence: 1, energy: -12, narrative: 'You earn your own way. Your legs pay for it.' }),
        opt('turn it down', 'football first', 1,
          { confidence: 0, energy: 3, narrative: 'Football first. You\'ll find the money elsewhere.' }),
      ],
    ),
  },

  // --- teammates ---
  {
    key: 'teammate-struggling', category: 'teammate', weight: 3,
    when: settled,
    build: () => decision(
      'One of the lads has lost his place and is talking about packing it in. He asks if you\'ll stay behind and work with him.',
      'teammates',
      [
        opt('stay and help', 'costs you, means something', 1,
          { confidence: 1, energy: -8, coachTrust: 1, narrative: 'You stay. He\'s better for it, and the group notices.' }),
        opt('leave him to it', 'look after yourself', 1,
          { confidence: 0, energy: 0, narrative: 'You head off. It\'s not your problem to carry.' }),
      ],
    ),
  },
  {
    key: 'teammate-rivalry', category: 'teammate', weight: 3,
    when: benched,
    build: () => decision(
      'The lad ahead of you in the pecking order makes a comment about your finishing. The changing room goes quiet.',
      'teammates',
      [
        opt('answer him back', 'risky, respect on the line', 0.5,
          { confidence: 1, narrative: 'You give as good as you get. The room laughs — with you.' },
          { confidence: -2, coachTrust: -1, narrative: 'It comes out wrong and it lingers all week.' }),
        opt('say nothing', 'let it go', 1,
          { confidence: -1, narrative: 'You let it go. It sits with you longer than you\'d like.' }),
        opt('answer him on the pitch', 'quiet confidence', 1,
          { confidence: 1, energy: -5, coachTrust: 1, narrative: 'You say nothing and train like a man possessed.' }),
      ],
    ),
  },
  {
    key: 'teammate-night-out', category: 'teammate', weight: 2,
    when: (c) => settled(c) && highConfidence(c),
    build: () => decision(
      'The squad is going out to celebrate. It\'s the night before a session, and everyone is going.',
      'teammates',
      [
        opt('go out', 'belonging, heavy legs', 1,
          { confidence: 2, energy: -14, narrative: 'You feel part of it properly for the first time. You also feel it in the morning.' }),
        opt('head home early', 'the professional call', 1,
          { confidence: 0, energy: 2, coachTrust: 1, narrative: 'You show your face and leave early. The right call, if a dull one.' }),
      ],
    ),
  },

  // --- coach ---
  {
    key: 'coach-extra-work', category: 'coach', weight: 3,
    when: trusted,
    build: () => decision(
      'The coach pulls you aside. He\'s offering to work with you one-to-one before sessions — his own time, not yours to waste.',
      'coach',
      [
        opt('take him up on it', 'real gains, real cost', 1,
          { confidence: 1, energy: -12, coachTrust: 1, narrative: 'You put the hours in with him. He starts talking about you differently.' }),
        opt('politely decline', 'protect your legs', 1,
          { confidence: 0, coachTrust: -1, narrative: 'You pass. He doesn\'t push it, but he doesn\'t offer again soon.' }),
      ],
    ),
  },
  {
    key: 'coach-dressing-down', category: 'coach', weight: 3,
    when: (c) => distrusted(c) || outOfForm(c),
    build: () => decision(
      'The coach stops the session to make an example of you in front of everyone.',
      'coach',
      [
        opt('take it on the chin', 'humility', 1,
          { confidence: -1, coachTrust: 1, narrative: 'You take it without a word and get on with it. He notices that too.' }),
        opt('defend yourself', 'risky', 0.4,
          { confidence: 2, coachTrust: 1, narrative: 'You stand your ground and he respects it.' },
          { confidence: -2, coachTrust: -2, narrative: 'It escalates. You train with the reserves on Thursday.' }),
      ],
    ),
  },
  {
    key: 'coach-position-talk', category: 'coach', weight: 2,
    when: (c) => settled(c) && benched(c),
    build: (c) => decision(
      `The coach asks whether you'd consider playing somewhere other than ${c.player.position} to get minutes.`,
      'coach',
      [
        opt('say you\'ll play anywhere', 'minutes over pride', 1,
          { confidence: 0, coachTrust: 1, narrative: 'You tell him you just want to play. He likes that answer.' }),
        opt('hold your position', 'conviction', 1,
          { confidence: 1, coachTrust: -1, narrative: 'You tell him where you belong. He respects the certainty, not the stubbornness.' }),
      ],
    ),
  },

  // --- media & attention ---
  {
    key: 'media-local-paper', category: 'media', weight: 2,
    when: (c) => known(c) && inForm(c),
    build: () => decision(
      'The local paper wants a few words about your season. It\'s small, but it\'s the first time anyone\'s asked.',
      'media',
      [
        opt('talk yourself up', 'attention cuts both ways', 0.6,
          { confidence: 2, reputation: 1, narrative: 'It runs well. People start saying your name.' },
          { confidence: -1, coachTrust: -1, narrative: 'It reads arrogant in print. The coach mentions it.' }),
        opt('credit the team', 'safe and sound', 1,
          { confidence: 1, coachTrust: 1, narrative: 'You say the right things. Nobody can fault you for it.' }),
      ],
    ),
  },
  {
    key: 'media-school-notice', category: 'media', weight: 2,
    when: known,
    build: () => decision(
      'Your name goes up on the school notice board. By lunchtime everyone has seen it.',
      'attention',
      [
        opt('enjoy it', 'ride the wave', 1,
          { confidence: 2, narrative: 'You let yourself enjoy it. It\'s been a long road to a piece of paper on a wall.' }),
        opt('keep your head down', 'stay level', 1,
          { confidence: 1, coachTrust: 1, narrative: 'You don\'t mention it once. Somehow that gets noticed more.' }),
      ],
    ),
  },

  // --- opportunity ---
  {
    key: 'opportunity-scout-watching', category: 'opportunity', weight: 2,
    when: watched,
    build: (c) => decision(
      `Word goes round that a scout from ${(c.player.scoutWatchers ?? [])[0]?.clubName ?? 'a club'} is at the next session.`,
      'opportunity',
      [
        opt('try to impress', 'go looking for it', 0.5,
          { confidence: 2, reputation: 1, energy: -8, narrative: 'You force the issue and pull off something special. He writes it down.' },
          { confidence: -2, reputation: -1, energy: -8, narrative: 'You overplay it and look desperate. Not the impression you wanted.' }),
        opt('play your normal game', 'trust your level', 1,
          { confidence: 1, energy: -4, narrative: 'You do exactly what you always do. It\'s enough to be worth another look.' }),
      ],
    ),
  },
  {
    key: 'opportunity-guest-session', category: 'opportunity', weight: 1,
    when: (c) => known(c) && !c.isAcademy,
    build: () => decision(
      'An academy side invites you to train with them for a day. It\'s a level above anything you\'ve played.',
      'opportunity',
      [
        opt('go', 'exposure, out of your depth', 0.55,
          { confidence: 2, reputation: 1, energy: -14, narrative: 'You hold your own. You come back knowing the gap is smaller than you feared.' },
          { confidence: -3, reputation: 1, energy: -14, narrative: 'They are quicker than you at everything. You come home quiet.' }),
        opt('stay where you\'re comfortable', 'no risk taken', 1,
          { confidence: 0, narrative: 'You stay put. Nothing is lost, and nothing is gained.' }),
      ],
    ),
  },

  // --- setbacks ---
  {
    key: 'setback-doubt', category: 'setback', weight: 3,
    when: (c) => lowConfidence(c) && settled(c),
    build: () => decision(
      'You lie awake going over the same mistakes. For the first time you wonder whether you\'re actually good enough.',
      'life',
      [
        opt('talk to someone about it', 'lighter for saying it', 1,
          { confidence: 2, narrative: 'You say it out loud to someone who listens. It doesn\'t fix it, but it shrinks it.' }),
        opt('bury it and train', 'the old way', 0.5,
          { confidence: 1, energy: -10, coachTrust: 1, narrative: 'You take it out on the training ground and come out the other side.' },
          { confidence: -2, energy: -10, narrative: 'You just end up tired as well as flat.' }),
      ],
    ),
  },
  {
    key: 'setback-burnout', category: 'setback', weight: 3,
    when: tired,
    build: () => decision(
      'You\'re running on empty and everyone can see it. Your body is asking for a week you don\'t think you can spare.',
      'life',
      [
        opt('take the week easy', 'the sensible call', 1,
          { confidence: 0, energy: 18, coachTrust: -1, narrative: 'You ease off. The legs come back; the coach notices the absence.' }),
        opt('push through it', 'stubborn', 0.45,
          { confidence: 1, energy: -6, coachTrust: 1, narrative: 'You drag yourself through and earn a nod for it.' },
          { confidence: -2, energy: -12, narrative: 'You push through and it costs you. Everything hurts.' }),
      ],
    ),
  },
  {
    key: 'setback-family', category: 'setback', weight: 2,
    when: settled,
    build: () => decision(
      'Things are difficult at home this week. Football is the last thing anyone wants to talk about.',
      'life',
      [
        opt('be there for them', 'football can wait', 1,
          { confidence: 1, energy: -5, narrative: 'You put your family first. It\'s not a hard choice, in the end.' }),
        opt('use football as an escape', 'somewhere to put it', 1,
          { confidence: -1, energy: -8, coachTrust: 1, narrative: 'You throw yourself into training. It helps, right up until you go home.' }),
      ],
    ),
  },// --- P27 pool expansion (Joel: "how much events are in the game?" —
  // answer was 16, now 25). Same P15 balance discipline: frequent events
  // never grant reputation, deltas stay in the audited ±1..2 band. ---
  {
    key: 'school-detention', category: 'school', weight: 2,
    when: settled,
    build: () => decision(
      'You mouthed off in class and got Friday detention — the same afternoon the coach runs set-piece drills.',
      'school',
      [
        opt('serve it, apologise', 'grown-up move', 1,
          { confidence: 1, narrative: 'You take it on the chin. Teachers talk — so do coaches.' }),
        opt('beg the teacher to move it', 'protect the session', 0.5,
          { energy: -4, coachTrust: 1, narrative: 'They relent. You make the session and graft.' },
          { confidence: -1, coachTrust: -1, narrative: 'No luck — and now the coach hears why you missed drills.' }),
      ],
    ),
  },
  {
    key: 'school-crush', category: 'school', weight: 2,
    when: settled,
    build: () => decision(
      'Someone you like invites you to the cinema Saturday morning — hours before kick-off.',
      'school',
      [
        opt('go, watch the time', 'life exists', 0.6,
          { confidence: 2, energy: -4, narrative: 'Great morning. You float into the ground.' },
          { confidence: 1, energy: -8, narrative: 'You lose track of time and jog in flustered.' }),
        opt('rain check', 'matchday is matchday', 1,
          { confidence: -1, energy: 4, narrative: 'They get it. Mostly.' }),
      ],
    ),
  },
  {
    key: 'teammate-boots', category: 'teammate', weight: 2,
    when: settled,
    build: () => decision(
      "A teammate's boots split in the warm-up and he takes your spares without asking.",
      'squad',
      [
        opt('let it slide', 'team first', 1,
          { confidence: 1, narrative: 'He bags an assist in your boots and owes you one.' }),
        opt('call it out', 'boundaries matter', 0.65,
          { confidence: 1, narrative: 'He apologises in front of the lads. Respect earned.' },
          { confidence: -1, narrative: 'It gets awkward. The dressing room picks sides.' }),
      ],
    ),
  },
  {
    key: 'teammate-captain-armband', category: 'teammate', weight: 1,
    when: (c) => trusted(c) && inForm(c),
    build: () => decision(
      'The skipper is away next week. The coach looks around the room and asks who wants the armband.',
      'squad',
      [
        opt('put your hand up', 'lead from the front', 0.7,
          { confidence: 2, coachTrust: 1, narrative: 'You wear it like it belongs to you.' },
          { confidence: -2, narrative: 'The occasion swallows you a little. Lesson learned.' }),
        opt('let a senior lad take it', 'know your place', 1,
          { coachTrust: 1, narrative: 'Humble. The coach files that away too.' }),
      ],
    ),
  },
  {
    key: 'coach-video-session', category: 'coach', weight: 2,
    when: outOfForm,
    build: () => decision(
      'The coach pulls you into a one-on-one video session — every misplaced pass from Saturday, frame by frame.',
      'coach',
      [
        opt('take notes, ask questions', 'learn from it', 1,
          { confidence: 1, coachTrust: 1, energy: -4, narrative: 'Painful viewing, but you leave sharper.' }),
        opt('defend your choices', 'back yourself', 0.45,
          { confidence: 2, narrative: 'You talk him through what you saw. He nods slowly.' },
          { confidence: -1, coachTrust: -1, narrative: 'It comes off as excuses. The session ends early.' }),
      ],
    ),
  },
  {
    key: 'media-group-chat', category: 'media', weight: 2,
    when: known,
    build: () => decision(
      "A clip of your goal is doing numbers in the school group chats. Everyone's tagging you.",
      'media',
      [
        opt('stay off it', 'feet on the ground', 1,
          { coachTrust: 1, narrative: 'You let the football talk. The coach notices who stays level.' }),
        opt('enjoy it', 'moments like this are why', 0.7,
          { confidence: 2, narrative: 'You reply to a few. Feels good to be seen.' },
          { confidence: 1, energy: -5, narrative: 'You are up until 1am reading replies.' }),
      ],
    ),
  },
  {
    key: 'opportunity-older-team', category: 'opportunity', weight: 1,
    when: (c) => inForm(c) && !benched(c),
    build: () => decision(
      "The men's Sunday side two pitches over is a player short and their manager points at you.",
      'opportunity',
      [
        opt('play the extra game', 'test yourself vs adults', 0.55,
          { confidence: 2, energy: -14, narrative: 'You more than hold your own against grown men.' },
          { confidence: -1, energy: -14, narrative: 'It is fast and physical and you feel every year of the gap.' }),
        opt('politely decline', 'protect your legs', 1,
          { energy: 2, narrative: 'Your coach nods approvingly at the discipline.' }),
      ],
    ),
  },
  {
    key: 'setback-growth-spurt', category: 'setback', weight: 2,
    when: tired,
    build: () => decision(
      'Your knees ache and your touch feels alien — a growth spurt is rewiring your body mid-season.',
      'setback',
      [
        opt('ease off this week', 'let the body catch up', 1,
          { energy: 8, confidence: -1, narrative: 'Frustrating, but the aches fade.' }),
        opt('push through', 'no excuses', 0.5,
          { confidence: 1, energy: -6, narrative: 'You adapt on the fly. Tougher than you look.' },
          { confidence: -2, energy: -10, narrative: 'Everything feels heavy. Should have listened to your body.' }),
      ],
    ),
  },
  {
    key: 'setback-lost-boots', category: 'setback', weight: 1,
    when: settled,
    build: () => decision(
      'Your bag was on the bus. Your boots were in the bag. The bus is gone.',
      'setback',
      [
        opt('borrow a pair', 'any boots beat no boots', 0.7,
          { narrative: 'Half a size out, but you make do.' },
          { confidence: -1, narrative: 'Blisters by half-time. Miserable.' }),
        opt('break in new ones', 'fresh start', 0.55,
          { confidence: 1, energy: -3, narrative: 'They feel great straight out of the box.' },
          { confidence: -1, energy: -5, narrative: 'Cardboard for a fortnight.' }),
      ],
    ),
  },// --- P28 pool expansion: 25 -> 46. Same P15 discipline (frequent events
  // never grant reputation; gains capped, penalties allowed to bite). These
  // are the NON-relationship events; the relational pool lives in
  // relationshipEvents.ts and is drawn from the same slots. ---
  {
    key: 'squad-team-meeting', category: 'teammate', weight: 3, when: settled,
    build: () => decision('The senior players call a meeting without the coach. Standards have slipped, apparently.', 'squad',
      [
        opt('speak up about what you see', 'have a voice', 0.55,
          { confidence: 2, coachTrust: 1, narrative: 'You say the thing everyone was thinking. The room shifts.' },
          { confidence: -2, narrative: 'It comes out wrong and an older lad talks over you.' }),
        opt('listen and take it in', 'know your place', 1,
          { confidence: 1, narrative: 'You keep quiet and learn what the room actually thinks.' }),
      ]),
  },
  {
    key: 'squad-fitness-test', category: 'coach', weight: 3, when: settled,
    build: () => decision('Bleep test on Tuesday. The coach is writing the numbers on the wall for everyone to see.', 'coach',
      [
        opt('empty the tank', 'top of the board', 0.6,
          { confidence: 2, coachTrust: 1, energy: -16, narrative: 'Your number goes up top. Nobody argues with the wall.' },
          { confidence: -1, energy: -18, narrative: 'You blow up at level nine and finish mid-table.' }),
        opt('pace yourself sensibly', 'save the legs', 1,
          { energy: -7, narrative: 'Respectable. Forgettable. Legs intact for Saturday.' }),
      ]),
  },
  {
    key: 'coach-formation-change', category: 'coach', weight: 3, when: settled,
    build: () => decision('The coach is switching shape and it moves you out of your best position.', 'coach',
      [
        opt('learn the new role properly', 'become versatile', 0.7,
          { coachTrust: 2, confidence: 1, energy: -6, narrative: 'Two weeks in and you look like you have played there for years.' },
          { confidence: -2, energy: -8, narrative: 'You are lost out there. It is not your position and it shows.' }),
        opt('tell him where you play best', 'be honest', 0.5,
          { coachTrust: 1, confidence: 1, narrative: 'He hears you out and moves you back. Respect for knowing yourself.' },
          { coachTrust: -1, confidence: -1, narrative: '"Everyone thinks they know better than the coach."' }),
      ]),
  },
  {
    key: 'coach-late-again', category: 'coach', weight: 2, when: (c) => c.player.fitness.stamina < 55,
    build: () => decision('You slept through your alarm and rolled into training twenty minutes late.', 'coach',
      [
        opt('own it immediately', 'no excuses', 0.8,
          { coachTrust: 1, confidence: -1, narrative: 'He makes you run, but he respects that you did not lie.' },
          { coachTrust: -1, narrative: 'He makes an example of you in front of everyone.' }),
        opt('blame the bus', 'save face', 0.4,
          { narrative: 'It washes. Just about.' },
          { coachTrust: -2, confidence: -1, narrative: 'Someone saw you walking in. Now it is a lie AND a lateness.' }),
      ]),
  },
  {
    key: 'media-first-interview', category: 'media', weight: 2, when: known,
    build: () => decision('A local radio station wants three minutes with you after the match.', 'media',
      [
        opt('credit the team throughout', 'safe and smart', 0.9,
          { reputation: 1, coachTrust: 1, narrative: 'Textbook. The coach hears it in the car and nods.' },
          { narrative: 'You freeze a bit but nobody minds.' }),
        opt('talk about your own ambitions', 'be bold', 0.5,
          { reputation: 1, confidence: 2, narrative: 'Confident, clear, quotable. People share the clip.' },
          { coachTrust: -1, confidence: -1, narrative: '"Bit big for his boots, that one." It gets back to the squad.' }),
      ]),
  },
  {
    key: 'media-highlight-reel', category: 'media', weight: 2, when: (c) => inForm(c) && known(c),
    build: () => decision('Someone has cut a highlight reel of your season and put it online.', 'media',
      [
        opt('share it with scouts', 'use the tool', 0.6,
          { reputation: 1, narrative: 'Two clubs reply. It is a small thing that opens a door.' },
          { narrative: 'No replies. It sits there getting a few hundred views.' }),
        opt('leave it alone', 'let others notice', 1,
          { confidence: 1, narrative: 'It does the rounds on its own. Feels better that way.' }),
      ]),
  },
  {
    key: 'school-careers-day', category: 'school', weight: 2, when: settled,
    build: () => decision('Careers day. You have to write down a realistic backup plan and defend it.', 'school',
      [
        opt('take it seriously', 'have a plan B', 1,
          { confidence: 1, narrative: 'Weirdly steadying. Knowing you would be fine either way frees you up.' }),
        opt('write "professional footballer"', 'all in', 0.5,
          { confidence: 2, narrative: 'The teacher smiles. "Then you had better be good."' },
          { confidence: -2, narrative: 'You get a lecture in front of the class about statistics.' }),
      ]),
  },
  {
    key: 'school-trip-clash', category: 'school', weight: 2, when: settled,
    build: () => decision('The school trip lands on the same week as a cup tie. You cannot do both.', 'school',
      [
        opt('stay for the cup tie', 'football first', 1,
          { coachTrust: 1, confidence: 1, narrative: 'The coach appreciates it more than he lets on.' }),
        opt('go on the trip', 'be fifteen for a week', 1,
          { coachTrust: -1, energy: 8, confidence: 1, narrative: 'Best week of the year. You come back fresh and slightly guilty.' }),
      ]),
  },
  {
    key: 'opportunity-open-trial', category: 'opportunity', weight: 2, when: (c) => !watched(c) && c.week > 10,
    build: () => decision('An open trial day is advertised at a club two towns over. Anyone can turn up.', 'opportunity',
      [
        opt('go and put yourself out there', 'roll the dice', 0.45,
          { reputation: 1, confidence: 2, energy: -12, narrative: 'You do enough to get a name taken down. That is all you wanted.' },
          { confidence: -2, energy: -12, narrative: 'Two hundred kids, forty minutes of football, no chances. Brutal.' }),
        opt('skip it and train at home', 'known quantity', 1,
          { energy: -4, confidence: 1, narrative: 'Solid session on your own. Nothing gained, nothing lost.' }),
      ]),
  },
  {
    key: 'opportunity-charity-match', category: 'opportunity', weight: 2, when: settled,
    build: () => decision('A charity match is being organised and they want you to captain the youth side.', 'opportunity',
      [
        opt('lead the team', 'take the responsibility', 0.75,
          { confidence: 2, reputation: 1, energy: -8, narrative: 'You handle it well. A few people mention it for weeks.' },
          { confidence: -1, energy: -8, narrative: 'It is chaos and you have no answers for it.' }),
        opt('play but not captain', 'no pressure', 1,
          { confidence: 1, energy: -6, narrative: 'Good afternoon. Nice cause. No drama.' }),
      ]),
  },
  {
    key: 'setback-kit-money', category: 'setback', weight: 2, when: settled,
    build: () => decision('Subs are due and money is tight at home this month.', 'setback',
      [
        opt('speak to the coach quietly', 'ask for help', 0.75,
          { coachTrust: 1, narrative: 'He sorts it discreetly and never mentions it again.' },
          { confidence: -1, narrative: 'The conversation is awkward and you wish you had not asked.' }),
        opt('cover it yourself somehow', 'handle it alone', 0.5,
          { confidence: 1, energy: -8, narrative: 'A weekend of odd jobs and it is covered.' },
          { confidence: -2, energy: -6, narrative: 'You come up short and miss a fixture over it.' }),
      ]),
  },
  {
    key: 'setback-bad-referee', category: 'setback', weight: 2, when: (c) => outOfForm(c),
    build: () => decision('A referee decision cost you the game and your temper is up in the changing room.', 'setback',
      [
        opt('let it out with the lads', 'vent', 0.6,
          { confidence: 1, narrative: 'Shared frustration. It bonds the room, oddly.' },
          { coachTrust: -1, narrative: 'It tips into a rant and the coach walks in mid-sentence.' }),
        opt('say nothing and go home', 'swallow it', 1,
          { confidence: -1, narrative: 'You stew on it all night. Nothing is resolved.' }),
      ]),
  },
  {
    key: 'setback-position-lost', category: 'setback', weight: 3, when: (c) => benched(c),
    build: () => decision('You are named on the bench again and nobody has explained why.', 'setback',
      [
        opt('ask the coach directly', 'get an answer', 0.65,
          { coachTrust: 1, confidence: 1, narrative: 'He gives you a clear reason and a route back in.' },
          { coachTrust: -1, confidence: -2, narrative: '"When you are ready, you will play." Useless and infuriating.' }),
        opt('let your training do the talking', 'graft quietly', 0.6,
          { coachTrust: 1, energy: -8, confidence: 1, narrative: 'Two weeks of relentless work and he notices.' },
          { confidence: -2, energy: -8, narrative: 'You work like a dog and nothing changes.' }),
      ]),
  },
  {
    key: 'teammate-pecking-order', category: 'teammate', weight: 3, when: settled,
    build: () => decision('The dressing room has a pecking order and you are being tested by the older lads.', 'squad',
      [
        opt('give it back to them', 'stand tall', 0.55,
          { confidence: 2, narrative: 'They laugh. You are in.' },
          { confidence: -2, narrative: 'You misjudge it badly and the room goes cold.' }),
        opt('take it on the chin', 'earn it slowly', 1,
          { confidence: -1, narrative: 'They ease off eventually. It just takes longer.' }),
      ]),
  },
  {
    key: 'opportunity-video-analysis', category: 'opportunity', weight: 2, when: (c) => c.week > 12,
    build: () => decision('You could spend the evening breaking down footage of your last three games.', 'development',
      [
        opt('do the full analysis', 'study the game', 0.8,
          { confidence: 1, coachTrust: 1, energy: -5, narrative: 'You spot a pattern in your own movement you had never noticed.' },
          { confidence: -1, energy: -6, narrative: 'You watch yourself play badly for two hours and feel worse.' }),
        opt('rest instead', 'recover properly', 1,
          { energy: 8, narrative: 'Early night. You need it more than the footage.' }),
      ]),
  },
  {
    key: 'setback-social-slip', category: 'setback', weight: 2, when: known,
    build: () => decision('Something you posted last year has resurfaced and people are screenshotting it.', 'media',
      [
        opt('apologise publicly and move on', 'face it', 0.75,
          { confidence: 1, narrative: 'Handled well. It dies within days.' },
          { confidence: -2, reputation: -1, narrative: 'The apology becomes the story.' }),
        opt('delete everything and go quiet', 'disappear', 0.6,
          { narrative: 'It fades. People move on to the next thing.' },
          { confidence: -1, narrative: 'Screenshots exist. Deleting made it look worse.' }),
      ]),
  },
  {
    key: 'coach-set-piece-duty', category: 'coach', weight: 2, when: (c) => trusted(c),
    build: () => decision('The coach is deciding who takes free kicks this season and looks at you.', 'coach',
      [
        opt('claim them', 'back yourself', 0.55,
          { confidence: 3, coachTrust: 1, narrative: 'They are yours. Now you have to actually score one.' },
          { confidence: -2, narrative: 'You hit the wall twice in training and he moves on.' }),
        opt('suggest someone better', 'team first', 1,
          { coachTrust: 1, narrative: 'Selfless. He files it away.' }),
      ]),
  },
  {
    key: 'school-sports-award', category: 'school', weight: 1, when: (c) => inForm(c) && c.week > 20,
    build: () => decision('You have been nominated for the school sports award. There is an assembly.', 'school',
      [
        opt('go up and say something', 'own the moment', 0.7,
          { confidence: 3, reputation: 1, narrative: 'Short, humble, well judged. The hall actually cheers.' },
          { confidence: -1, narrative: 'You mumble through it and sit down burning red.' }),
        opt('collect it and sit down', 'keep it simple', 1,
          { confidence: 2, narrative: 'Done. Your parent takes a photo you will keep forever.' }),
      ]),
  },
  {
    key: 'opportunity-futsal', category: 'opportunity', weight: 2, when: settled,
    build: () => decision('A midweek futsal league is starting. Tight spaces, fast decisions, no rest.', 'opportunity',
      [
        opt('sign up', 'sharpen your touch', 0.7,
          { confidence: 2, energy: -12, narrative: 'Your close control is noticeably sharper within a month.' },
          { energy: -14, confidence: -1, narrative: 'It is relentless and you turn up to training flat.' }),
        opt('give it a miss', 'protect the legs', 1,
          { energy: 3, narrative: 'Sensible. Your Saturdays are better for it.' }),
      ]),
  },
  {
    key: 'setback-doubting-it', category: 'setback', weight: 3, when: (c) => lowConfidence(c) && outOfForm(c),
    build: () => decision('For the first time you genuinely wonder whether you are good enough for any of this.', 'setback',
      [
        opt('talk to someone about it', 'do not carry it alone', 0.8,
          { confidence: 2, narrative: 'Saying it out loud shrinks it. It does not disappear, but it shrinks.' },
          { confidence: -1, narrative: 'They mean well and say the wrong thing entirely.' }),
        opt('train until it goes quiet', 'work through it', 0.5,
          { confidence: 1, energy: -14, narrative: 'You bury it under sheer volume of work. It holds, for now.' },
          { confidence: -2, energy: -16, narrative: 'You train yourself into the ground and feel worse.' }),
      ]),
  },
  {
    key: 'teammate-lift-share', category: 'teammate', weight: 2, when: settled,
    build: () => decision('A teammate who lives near you needs a lift share to away games, and it means earlier starts.', 'squad',
      [
        opt('sort it out', 'help him out', 0.85,
          { confidence: 1, energy: -4, narrative: 'He makes every game this season because of you.' },
          { energy: -6, narrative: 'It is a hassle and the timings never quite work.' }),
        opt('say you cannot', 'protect your routine', 1,
          { energy: 2, narrative: 'He finds another way. It is a bit awkward for a fortnight.' }),
      ]),
  },// --- P28b: final wave, added after the six-season variety measurement in
  // scripts/audit4.ts came in just under target. Gated across a spread of
  // states so they open at different points in a career rather than all
  // becoming eligible at once. ---
  {
    key: 'coach-captains-run', category: 'coach', weight: 2, when: (c) => c.week > 8,
    build: () => decision('The coach hands you the warm-up to run on your own on Thursday.', 'coach',
      [
        opt('run it properly', 'take charge', 0.7,
          { coachTrust: 2, confidence: 2, narrative: 'Sharp, organised, nobody messing about. He barely has to speak.' },
          { confidence: -2, narrative: 'It descends into chaos in four minutes and he takes it back.' }),
        opt('keep it simple and short', 'do not overreach', 1,
          { coachTrust: 1, narrative: 'Basic, competent, uneventful. Fine.' }),
      ]),
  },
  {
    key: 'school-teacher-referee', category: 'school', weight: 2, when: settled,
    build: () => decision('A teacher who cannot stand you has been asked to referee the inter-school game.', 'school',
      [
        opt('be impeccable all game', 'give him nothing', 0.75,
          { confidence: 2, narrative: 'Not a word out of place. He has to admit you were the best player.' },
          { confidence: -1, narrative: 'He finds decisions anyway. Some people just decide about you.' }),
        opt('play with an edge', 'do not back down', 0.4,
          { confidence: 2, narrative: 'You are relentless and he cannot touch you for it.' },
          { confidence: -2, coachTrust: -1, narrative: 'Booked twice and a letter home. Predictable, really.' }),
      ]),
  },
  {
    key: 'opportunity-different-position', category: 'opportunity', weight: 2, when: (c) => c.week > 14,
    build: () => decision('The coach is short and asks if you would fill in somewhere completely unfamiliar.', 'opportunity',
      [
        opt('volunteer', 'be useful', 0.6,
          { coachTrust: 2, confidence: 1, energy: -6, narrative: 'You are out of your depth and still make it work. He remembers.' },
          { confidence: -2, energy: -8, narrative: 'Ninety minutes of being lost. Long afternoon.' }),
        opt('stay where you are strongest', 'know yourself', 1,
          { narrative: 'Someone else fills in. Nothing changes.' }),
      ]),
  },
  {
    key: 'setback-long-away-trip', category: 'setback', weight: 2, when: (c) => c.player.fitness.stamina < 65,
    build: () => decision('A four-hour coach trip on the day of the game, and you slept badly.', 'setback',
      [
        opt('sleep the whole way', 'steal what rest you can', 0.75,
          { energy: 8, narrative: 'You wake up twenty minutes out feeling almost human.' },
          { energy: -3, narrative: 'You cannot drop off. Four hours of staring out the window.' }),
        opt('go through your prep', 'stay switched on', 0.6,
          { confidence: 2, energy: -4, narrative: 'You arrive mentally ready even if the legs are not.' },
          { confidence: -1, energy: -6, narrative: 'You overthink the whole game before it starts.' }),
      ]),
  },
  {
    key: 'teammate-new-arrival-help', category: 'teammate', weight: 2, when: settled,
    build: () => decision('A lad who barely speaks the language has joined and is sitting on his own.', 'squad',
      [
        opt('go and sit with him', 'make the effort', 0.9,
          { confidence: 2, coachTrust: 1, narrative: 'You find a way to communicate. He never forgets who did that first.' },
          { narrative: 'It is awkward, but he appreciates that you tried.' }),
        opt('leave him to settle in', 'give him space', 1,
          { narrative: 'He sits alone for another three weeks.' }),
      ]),
  },
  {
    key: 'media-club-social', category: 'media', weight: 2, when: (c) => known(c) && c.week > 12,
    build: () => decision('The club wants to feature you on their social accounts. They send a list of questions.', 'media',
      [
        opt('give thoughtful answers', 'take it seriously', 0.8,
          { reputation: 1, narrative: 'It reads well. A couple of people outside the club share it.' },
          { narrative: 'It gets edited down to nothing. Such is media.' }),
        opt('keep it short and dry', 'reveal nothing', 1,
          { narrative: 'Minimal effort, minimal impact. Job done.' }),
      ]),
  },
  {
    key: 'opportunity-coaching-badge', category: 'opportunity', weight: 1, when: (c) => c.week > 25,
    build: () => decision('There is a youth coaching course running for free over the holidays.', 'opportunity',
      [
        opt('take the course', 'understand the game deeper', 0.8,
          { confidence: 2, coachTrust: 1, energy: -8, narrative: 'You start seeing the game the way coaches do. It shows on Saturday.' },
          { energy: -10, narrative: 'Mostly paperwork and cones. Some of it sticks.' }),
        opt('use the break to rest', 'recover', 1,
          { energy: 12, narrative: 'Proper rest. You come back into the new block flying.' }),
      ]),
  },
  {
    key: 'setback-confidence-crisis-penalty', category: 'setback', weight: 2, when: (c) => lowConfidence(c),
    build: () => decision('A penalty is awarded and nobody is picking the ball up. Everyone looks around.', 'setback',
      [
        opt('take it', 'face the fear', 0.5,
          { confidence: 3, coachTrust: 1, narrative: 'You bury it. Something unlocks in that moment.' },
          { confidence: -3, narrative: 'Saved. The walk back to the halfway line takes a year.' }),
        opt('let someone else', 'not today', 1,
          { confidence: -1, narrative: 'Someone else scores it. You are relieved and then annoyed at your relief.' }),
      ]),
  },
  {
    key: 'coach-honest-review', category: 'coach', weight: 3, when: (c) => c.week > 20,
    build: () => decision('End-of-block reviews. The coach has written a page about you and asks you to read it in front of him.', 'coach',
      [
        opt('read it honestly and respond', 'engage with it', 0.75,
          { coachTrust: 2, confidence: 1, narrative: 'A real conversation, the first you have had with him.' },
          { confidence: -2, narrative: 'Harsher than you expected and you have no answer for any of it.' }),
        opt('agree with everything', 'get it over with', 1,
          { coachTrust: -1, narrative: 'He can tell you have not taken a word of it in.' }),
      ]),
  },
  {
    key: 'school-mock-results', category: 'school', weight: 2, when: (c) => c.week > 18,
    build: () => decision('Mock results are back and they are worse than you told your family they would be.', 'school',
      [
        opt('tell them straight away', 'get ahead of it', 0.7,
          { confidence: 1, narrative: 'They are disappointed but the honesty defuses most of it.' },
          { confidence: -2, energy: -6, narrative: 'It goes badly. Football gets threatened again.' }),
        opt('say nothing and fix it quietly', 'sort it yourself', 0.5,
          { confidence: 2, energy: -10, narrative: 'You claw it back before anyone finds out. Exhausting, but yours.' },
          { confidence: -2, energy: -8, narrative: 'They find out anyway, and now you hid it too.' }),
      ]),
  },
  {
    key: 'teammate-tactics-disagreement', category: 'teammate', weight: 2, when: (c) => c.week > 10,
    build: () => decision('Half the squad thinks the game plan is wrong and they want you to raise it.', 'squad',
      [
        opt('raise it with the coach', 'be the voice', 0.5,
          { confidence: 2, coachTrust: 1, narrative: 'He listens, adjusts one thing, and you win. Credit goes round.' },
          { coachTrust: -2, confidence: -1, narrative: '"Since when do you pick the team?" It does not go well.' }),
        opt('tell them to raise it themselves', 'not your fight', 1,
          { confidence: -1, narrative: 'Nobody does. Everyone moans about it for a fortnight instead.' }),
      ]),
  },
  {
    key: 'opportunity-mascot-day', category: 'opportunity', weight: 1, when: settled,
    build: () => decision('A local primary school wants a player to come and talk to the kids about sport.', 'opportunity',
      [
        opt('go and do it properly', 'give something back', 0.85,
          { confidence: 2, reputation: 1, energy: -5, narrative: 'Forty kids hanging on your every word. Strangely grounding.' },
          { energy: -5, narrative: 'Chaos. Fun chaos, but chaos.' }),
        opt('pass on it', 'not your thing', 1,
          { narrative: 'Someone else goes. It is fine.' }),
      ]),
  },// --- P29: money events. These are the ones that make the economy a real
  // decision rather than a shop: every payday costs energy, time, or someone's
  // goodwill. `money` deltas are applied by the store alongside the rest. ---
  {
    key: 'money-weekend-shift', category: 'opportunity', weight: 3, when: settled,
    build: () => decision('The corner shop needs someone for a Saturday morning shift. Cash in hand.', 'money',
      [
        opt('take the shift', 'earn it', 0.85,
          { money: 28, energy: -16, narrative: 'Four hours on your feet and £28 in your pocket.' },
          { money: 20, energy: -20, confidence: -1, narrative: 'Long, miserable shift and you are wrecked for training.' }),
        opt('turn it down', 'legs come first', 1,
          { energy: 3, narrative: 'You rest instead. The money would have been nice.' }),
      ]),
  },
  {
    key: 'money-boot-fund', category: 'opportunity', weight: 2, when: (c) => c.week > 6,
    build: () => decision('Your boots are falling apart and there is no money at home for new ones this month.', 'money',
      [
        opt('do odd jobs around the neighbourhood', 'earn the money yourself', 0.8,
          { money: 35, energy: -14, confidence: 1, narrative: 'Two weekends of graft and you buy them yourself. That feels different.' },
          { money: 15, energy: -16, narrative: 'Less work than you hoped. Halfway there.' }),
        opt('play on in the old ones', 'make do', 0.6,
          { narrative: 'They hold together. Just about.' },
          { confidence: -1, energy: -4, narrative: 'They split properly in the second half. Embarrassing.' }),
      ]),
  },
  {
    key: 'money-tournament-prize', category: 'opportunity', weight: 1, when: (c) => inForm(c) && c.week > 15,
    build: () => decision('Your side won a weekend tournament and there is prize money to split.', 'money',
      [
        opt('take your share', 'you earned it', 1,
          { money: 40, confidence: 1, narrative: '£40 each. Best weekend of the season.' }),
        opt('put it all into the team fund', 'for the squad', 0.8,
          { coachTrust: 2, confidence: 1, narrative: 'New training bibs and balls for everyone. The coach notices who suggested it.' },
          { coachTrust: 1, narrative: 'A nice gesture that quietly gets forgotten.' }),
      ]),
  },
  {
    key: 'money-spend-it', category: 'school', weight: 2, when: (c) => (c.player.money ?? 0) >= 40,
    build: () => decision('Everyone is going out this weekend and it will cost you most of what you have saved.', 'money',
      [
        opt('go and enjoy it', 'be fifteen', 0.8,
          { money: -30, confidence: 3, energy: -8, narrative: 'Brilliant night. Skint, happy.' },
          { money: -30, confidence: 1, energy: -12, narrative: 'It was alright. Expensive for alright.' }),
        opt('save it for boots', 'stay disciplined', 1,
          { confidence: -1, narrative: 'You stay in. The savings pot grows.' }),
      ]),
  },
  {
    key: 'money-lend-teammate', category: 'teammate', weight: 2, when: (c) => (c.player.money ?? 0) >= 25,
    build: () => decision('A teammate cannot afford his subs this month and quietly asks you for a loan.', 'money',
      [
        opt('lend it to him', 'help him out', 0.6,
          { money: -20, confidence: 2, narrative: 'He pays you back within a fortnight and never forgets it.' },
          { money: -20, confidence: -1, narrative: 'You do not see that money again. He avoids eye contact for weeks.' }),
        opt('say you cannot', 'protect your savings', 1,
          { confidence: -1, narrative: 'He misses two games over it. You notice.' }),
      ]),
  },
]

/**
 * Pick a life event for this slot.
 *
 * Gating first, then weighted selection, then a no-repeat window so the same event
 * can't stalk the player across consecutive weeks. Falls back to ungated events if
 * the player's state somehow excludes everything.
 */
export function pickLifeEvent(ctx: LifeContext, recentKeys: string[]): { event: LifeEvent; decision: Decision } {
  let pool = LIFE_EVENTS.filter((e) => !e.when || e.when(ctx))
  if (pool.length === 0) pool = LIFE_EVENTS.filter((e) => !e.when)
  if (pool.length === 0) pool = LIFE_EVENTS

  // P28: the no-repeat window was a flat 4, set when this pool held 16 events.
  // At 46 events that let a situation come back around every few weeks and
  // even produced back-to-back repeats (caught by scripts/audit4.ts's
  // six-season variety measurement). Scale it with the eligible pool instead —
  // block roughly two-thirds of what's currently available, capped so a
  // heavily-gated pool can still always find something to fire.
  const window = Math.max(0, Math.min(Math.floor(pool.length * 0.66), pool.length - 1))
  const blocked = recentKeys.slice(-window)
  const fresh = pool.filter((e) => !blocked.includes(e.key))
  const candidates = fresh.length > 0 ? fresh : pool

  const total = candidates.reduce((sum, e) => sum + e.weight, 0)
  let r = rand() * total
  let chosen = candidates[candidates.length - 1]
  for (const e of candidates) {
    r -= e.weight
    if (r <= 0) { chosen = e; break }
  }
  return { event: chosen, decision: chosen.build(ctx) }
}

export function buildLifeContext(player: Player, week: number): LifeContext {
  const ratings = player.matchRatings ?? []
  const recent = ratings.slice(-5)
  return {
    player,
    week,
    isAcademy: player.careerClock.phase === 'academy',
    form: recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : null,
  }
}
