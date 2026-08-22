import { rand } from './rng'
// ============================================================================
// PHASE 12 — COMMENTARY ENGINE
//
// Before this, every line in the match feed was a hardcoded string literal sitting
// inline in match.ts: 'You take a knock but play on.', 'GOAL! You find the net!',
// and so on. One line per situation, forever, with no player name, no scoreline
// awareness, and no sense of when in the match it happened. That's why matches read
// like a log file instead of a broadcast.
//
// This module changes NONE of the simulation. Same rolls, same odds, same outcomes.
// It only changes how those outcomes are narrated:
//   - many variants per situation, so you don't see the same sentence twice
//   - context injection (player surname, club shorts, minute, scoreline)
//   - guard conditions, so a 90th-minute winner narrates bigger than a 12th-minute tap-in
//   - per-match no-repeat memory
// ============================================================================

export type CommentaryKind =
  | 'kickoff' | 'halftime' | 'fulltime'
  | 'goal-player' | 'goal-teammate' | 'goal-opponent'
  | 'assist' | 'chance-missed'
  | 'save-made' | 'defended' | 'beaten'
  | 'knock' | 'injury' | 'sub-fatigue' | 'sub-rating' | 'sub-tactical'
  | 'ambient' | 'near-miss' | 'chance-wasted-teammate' | 'chance-survived'
  // P37: goalkeeper DISTRIBUTION decisions — separate from a save/beaten,
  // this is the keeper choosing how to start play, not stop it.
  | 'distribution-good' | 'distribution-poor'
  // P38: the injury decision — playing through a knock, or asking off.
  | 'injury-played-through' | 'injury-asked-off'
  // P40: disciplinary — a warning, a booking, or a sending off.
  | 'card-warning' | 'card-yellow' | 'card-second-yellow' | 'card-red'
  // P31: the match is now narrated for a player who ISN'T on the pitch
  | 'bench' | 'sidelined'

export interface CommentaryContext {
  /** Player's surname — commentators use surnames, not full names. */
  player: string
  /** Player's club, 3-letter short code. */
  team: string
  /** Opponent club, 3-letter short code. */
  opp: string
  minute: number
  homeShort: string
  awayShort: string
  homeScore: number
  awayScore: number
  /** Goal difference from the player's perspective (+ = winning). */
  diff: number
  /** Phase 22a: named teammate credited with a goal/assist this event, if known. */
  scorer?: string
  assister?: string
  /** Momentum from the player's perspective, -10..+10. */
  momentum: number
}

interface Template {
  text: string
  /** Relative pick weight. Default 1. */
  weight?: number
  /** Only eligible when this returns true — this is how stakes-tiering works. */
  when?: (c: CommentaryContext) => boolean
}

// --- guards, so the writing can react to the state of the game ---
const late = (c: CommentaryContext) => c.minute >= 75
const veryLate = (c: CommentaryContext) => c.minute >= 85
const early = (c: CommentaryContext) => c.minute <= 20
const levelGame = (c: CommentaryContext) => c.diff === 0
const trailing = (c: CommentaryContext) => c.diff < 0
const leading = (c: CommentaryContext) => c.diff > 0
/** A goal that turns a draw or a deficit into a lead in the closing stages. */
const winnerMoment = (c: CommentaryContext) => c.minute >= 80 && c.diff <= 0

const BANKS: Record<CommentaryKind, Template[]> = {
  kickoff: [
    { text: 'We\'re under way at last. {home} against {away}.' },
    { text: 'Kick-off. {team} get us going.' },
    { text: 'And we\'re off. Everything to play for.' },
    { text: 'The referee\'s whistle goes. Here we go.' },
  ],

  halftime: [
    { text: 'Half-time. {home} {hs} - {as} {away}.' },
    { text: 'That\'s the half. {home} {hs}, {away} {as} — plenty still to sort out.' },
    { text: 'The whistle goes for half-time: {home} {hs} - {as} {away}.' },
    { text: 'Forty-five gone. {home} {hs} - {as} {away}, and {player} heads down the tunnel.' },
  ],

  fulltime: [
    { text: 'Full-time. {home} {hs} - {as} {away}.' },
    { text: 'That\'s it. It finishes {home} {hs} - {as} {away}.' },
    { text: 'The final whistle. {home} {hs} - {as} {away}.' },
  ],

  // --- the player scores ---
  'goal-player': [
    { text: 'GOAL! {player} buries it! {team} are level — what a time to score!', when: (c) => c.minute >= 80 && c.diff === 0, weight: 4 },
    { text: 'IT\'S THERE! {player}! Deep into the match and he may just have won it!', when: winnerMoment, weight: 4 },
    { text: 'OH, {player}! With the clock running down — the away end is going wild!', when: veryLate, weight: 3 },
    { text: 'GOAL! {player} finds the corner and this place erupts!', when: late, weight: 2 },
    { text: 'GOAL! {player} gets there first and steers it home. {home} {hs} - {as} {away}.' },
    { text: '{player} takes it early — and it flies in! Beautiful strike.' },
    { text: 'He\'s done it! {player} makes no mistake from close range.' },
    { text: 'GOAL! Clinical from {player}. The keeper had no chance.' },
    { text: '{player} opens his shoulders and lashes it past the keeper. Some finish.' },
    { text: 'It\'s in! {player} keeps his head when it mattered.' },
    { text: 'An early one! {player} strikes inside the opening exchanges.', when: early, weight: 2 },
    { text: 'GOAL! {player} gets on the scoresheet and {team} lead.', when: (c) => c.diff === 1 },
    { text: 'GOAL! {player} finds the net and the celebrations begin!' },
    { text: '{player} strikes it sweetly and there is no way back for the keeper.' },
    { text: 'What a finish from {player}! Clinical, ruthless, perfect.' },
    { text: '{player} makes no mistake from there. {home} {hs}-{as} {away}.' },
    { text: 'Composure personified — {player} slots it home.' },
    { text: '{player} does not even break stride. In off the post!' },
    { text: 'Bedlam! {player} has scored and the whole place erupts.' },
    { text: 'That is why {player} plays there. Beautifully taken.' },
    { text: 'The keeper has no chance. {player} finds the corner unerringly.' },
    { text: '{player} has been waiting for that one all game, and there it is.' },
  ],

  assist: [
    { text: '{player} squares it and it\'s tapped in! A lovely, unselfish ball.' },
    { text: 'Brilliant vision from {player} — the pass is perfect and it\'s finished off!' },
    { text: '{player} slides it through and a teammate does the rest. Assist for him.' },
    { text: 'It\'s all {player}\'s work — he picks out the run and {team} score!' },
    { text: '{player} draws the defender and lays it off. Tap-in. Terrific play.' },
    { text: 'What a time for a moment of quality from {player} — he sets one up!', when: late, weight: 2 },
    { text: '{player} picks out the perfect pass and it is finished with ease.' },
    { text: 'A wonderful assist from {player} — that is a real eye for a pass.' },
    { text: '{player} does the hard part, and the finish takes care of itself.' },
    { text: 'Selfless from {player}, squaring it when the shot was on.' },
    { text: 'The vision from {player} to spot that is exceptional.' },
    { text: '{player} threads the needle and it is duly converted.' },
  ],

  'chance-missed': [
    { text: 'Ohh! {player} can\'t sort his feet out and the chance is gone.' },
    { text: '{player} snatches at it and drags it wide. He knows it, too.' },
    { text: 'It doesn\'t come off for {player}. Head in hands.' },
    { text: '{player} goes for it — and it\'s blocked. Frustrating.' },
    { text: 'A half-second too slow from {player} and the defender gets across.' },
    { text: 'That\'s a big miss. {player} will feel that one — the clock is not his friend.', when: late, weight: 2 },
    { text: 'The keeper is out quickly and smothers it at {player}\'s feet.' },
    { text: '{player} cannot believe it. That should have been a goal.' },
    { text: 'Snatched at it, and the chance goes begging.' },
    { text: '{player} drags it well wide of the target.' },
    { text: 'The head goes down. {player} knows that was there to be taken.' },
    { text: 'Straight down the keeper\'s throat. Nothing on it at all.' },
    { text: '{player} takes too long over the decision and the chance is gone.' },
    { text: 'Agonisingly close, but {player} cannot force it home.' },
    { text: 'A rare miss from {player}. That one will bother them.' },
    { text: 'Off target by the smallest of margins.' },
    { text: '{player} rushes it and the effort flies harmlessly past the post.' },
    { text: 'The connection is never right, and it comes to nothing.' },
    { text: 'A groan around the ground as {player} fails to convert.' },
  ],

  // --- goalkeeper / defensive moments ---
  'save-made': [
    { text: 'SAVED! {player} stands tall and denies them. Enormous moment.' },
    { text: 'What a stop from {player}! He gets a strong hand to it.' },
    { text: '{player} reads it all the way and smothers the shot. Composed.' },
    { text: 'He\'s kept it out! {player} throws himself across and turns it away.' },
    { text: 'HUGE save from {player}! That could be the moment that keeps {team} in this.', when: late, weight: 3 },
    { text: '{player} produces a magnificent save to deny the danger!' },
    { text: 'What a stop! {player} somehow gets across in time.' },
    { text: '{player} reads it all the way and gathers safely.' },
    { text: 'Full stretch from {player} and the ball is turned behind!' },
    { text: 'A textbook save — {player} makes it look routine.' },
    { text: 'Fingertips from {player} and it goes over the bar!' },
    { text: '{player} stands up tall and the shot cannons off them.' },
    { text: 'Reflexes like a cat — {player} keeps it out.' },
    { text: 'The whole ground applauds that save from {player}.' },
    { text: '{player} smothers it at the striker\'s feet before he can react.' },
  ],

  defended: [
    { text: 'Superb defending from {player}! He gets there just in time.' },
    { text: '{player} reads the danger and steps in. Textbook.' },
    { text: 'Last-ditch from {player}! He throws his body in the way.' },
    { text: '{player} shepherds him away from goal and wins it back. Clever.' },
    { text: 'Brilliant recovery from {player} — the danger is snuffed out.', when: late, weight: 2 },
    { text: '{player} throws a body on the line to block it!' },
    { text: 'A brilliant, timely challenge from {player} snuffs it out.' },
    { text: '{player} reads the danger perfectly and clears it.' },
    { text: 'Superb defending under real pressure from {player}.' },
    { text: '{player} gets there first and the danger passes.' },
    { text: 'A crucial interception from {player} at just the right moment.' },
    { text: '{player} wins the physical battle and clears the danger.' },
    { text: 'Cool head from {player} in a difficult moment.' },
  ],

  beaten: [
    { text: '{opp} score — {player} is beaten. There was little he could do.' },
    { text: 'It\'s past him. {player} gets a touch but not enough. {home} {hs} - {as} {away}.' },
    { text: '{opp} find a way through and {player} is left grounded.' },
    { text: 'They\'ve got it. {player} was exposed there and he knows it.' },
    { text: 'A killer goal at a terrible time — {player} beaten late on.', when: late, weight: 2 },
    { text: '{player} is beaten all ends up and the striker finishes with ease.' },
    { text: 'No answer from {player} there. Well taken by the opposition.' },
    { text: 'The gap opens up and {player} cannot close it in time.' },
    { text: '{player} is turned inside out and the shot finds the net.' },
    { text: 'A tough afternoon continues for {player}.' },
    { text: '{player} gets caught ball-watching and it costs the team.' },
    { text: 'That is a moment {player} will want to forget quickly.' },
    { text: 'Bettered in the duel, and {opp} make it count.' },
  ],

  // --- goals not involving the player ---
  // Phase 22a: named variants fire whenever the squad layer identifies a
  // scorer (weighted heavily so a real name shows up most of the time); the
  // original generic lines stay as a fallback whenever it doesn't.
  'goal-teammate': [
    { text: 'GOAL! {scorer} finishes it off for {team}!', when: (c) => !!c.scorer, weight: 4 },
    { text: '{scorer} gets on the scoresheet — {team} in front!', when: (c) => !!c.scorer && c.diff === 1, weight: 3 },
    { text: '{scorer} with the finish, {assister} with the assist — {team} score!', when: (c) => !!c.scorer && !!c.assister, weight: 3 },
    { text: 'They\'ve equalised! {scorer} levels it for {team}.', when: (c) => !!c.scorer && levelGame(c), weight: 3 },
    { text: 'GOAL! {scorer} right at the death for {team}!', when: (c) => !!c.scorer && veryLate(c), weight: 4 },
    { text: 'GOAL! {team} are in front through a teammate — {player} celebrates from distance.', when: (c) => !c.scorer && c.diff === 1 },
    { text: 'It\'s in! A teammate finishes it off for {team}.', when: (c) => !c.scorer },
    { text: '{team} score! Nothing to do with {player}, but he\'ll take it.', when: (c) => !c.scorer },
    { text: 'Goal for {team} — the move is finished off in style.', when: (c) => !c.scorer },
    { text: 'They\'ve equalised! {team} are level again.', when: (c) => !c.scorer && levelGame(c), weight: 2 },
    { text: 'GOAL for {team}! Right at the death!', when: (c) => !c.scorer && veryLate(c), weight: 3 },
    { text: '{scorer} finishes it off well for {team}.' },
    { text: 'A well-worked goal, finished by {scorer}.' },
    { text: '{scorer} is in the right place at the right time.' },
    { text: 'The move breaks down beautifully for {scorer} to tap home.' },
    { text: '{scorer} celebrates in front of the away end.' },
    { text: 'That is {scorer}\'s job done — clinically taken.' },
    { text: 'A moment of quality from {scorer} settles it.' },
    { text: '{scorer} wheels away in celebration after a fine finish.' },
  ],

  'goal-opponent': [
    { text: '{opp} score. {team} switched off at the worst moment.' },
    { text: 'That\'s a goal for {opp}. {home} {hs} - {as} {away}.' },
    { text: '{opp} find the net — {team} couldn\'t clear their lines.' },
    { text: 'It\'s in for {opp}. A real blow.' },
    { text: '{opp} level it up. All to do again.', when: levelGame, weight: 2 },
    { text: 'Disaster. {opp} score with the clock running down.', when: veryLate, weight: 3 },
    { text: 'It is not the news {team} wanted to hear.' },
    { text: '{opp} find a way through and the away fans go wild.' },
    { text: 'A sucker punch for {team} against the run of play.' },
    { text: 'The defence will want to know how that happened.' },
    { text: '{opp} make the most of the space they were given.' },
    { text: 'Silence descends. {opp} have found the net.' },
  ],

  // --- fitness and fortune ---
  knock: [
    { text: '{player} takes a knock but waves the physio away. He plays on.' },
    { text: 'A heavy challenge on {player} — he\'s up, and he carries on.' },
    { text: '{player} is down briefly. He shakes it off.' },
    { text: 'That\'s a hefty one on {player}. He\'ll feel it in the morning.' },
    { text: '{player} takes a whack but is straight back up.' },
    { text: 'A painful-looking collision, but {player} shrugs it off.' },
    { text: 'The physio does not even need to come on for that one.' },
    { text: '{player} takes one for the team and plays on regardless.' },
    { text: 'A wince, a shake of the leg, and {player} carries on.' },
  ],

  injury: [
    { text: '{player} pulls up and goes down. This doesn\'t look good.' },
    { text: 'Trouble for {player} — he signals to the bench straight away.' },
    { text: '{player} is hurt. The physio is on and he can\'t continue.' },
    { text: 'The physio is sprinting on. This does not look good for {player}.' },
    { text: 'A real concern for {team} as {player} goes down.' },
    { text: 'The game is stopped as {player} receives treatment.' },
    { text: 'A hush falls over the ground as {player} stays down.' },
  ],

  'sub-fatigue': [
    { text: 'The legs have gone. {player} is taken off for fresh energy.' },
    { text: '{player}\'s number goes up — he\'s run himself into the ground.' },
    { text: 'That\'s {player} done for the day. Nothing left in the tank.' },
    { text: '{player} has given everything and the legs have gone.' },
    { text: 'A tired-looking {player} is withdrawn for fresh legs.' },
    { text: 'The coach can see {player} is running on empty.' },
  ],

  'sub-rating': [
    { text: 'It hasn\'t been {player}\'s afternoon. The coach has seen enough.' },
    { text: '{player} is withdrawn. A day to forget for him.' },
    { text: 'The coach makes a change — {player} makes way. Harsh, but hard to argue.' },
    { text: 'A quiet afternoon ends early for {player}.' },
    { text: 'Not {player}\'s day, and the coach makes the change.' },
    { text: '{player} trudges off, clearly frustrated with himself.' },
  ],

  'sub-tactical': [
    { text: 'A tactical change — {player} is sacrificed as {team} chase the game.' },
    { text: '{player} comes off as the coach rolls the dice.' },
    { text: 'The coach is going for it, and {player} is the one to make way.' },
    { text: 'A change of shape sees {player} make way.' },
    { text: 'Nothing personal — just a tactical reshuffle for {player}.' },
    { text: 'The coach freshens things up, and {player} is the one to go.' },
  ],

  // --- rhythm and texture (previously the feed was silent between chances) ---
  ambient: [
    { text: '{team} keep the ball, probing for an opening.' },
    { text: 'A scrappy spell, neither side able to settle.' },
    { text: '{opp} press high and force it long.' },
    { text: 'It\'s stretched now, end to end.' },
    // P42 — offside/throw-in flavor, as agreed: commentary texture only, not
    // a simulated positional rule (the drive-based engine doesn't track
    // pitch position granularly enough to justify a full offside check).
    { text: 'The flag goes up — offside, and the move breaks down.' },
    { text: 'Caught in an offside trap. {opp}\'s line steps up perfectly.' },
    { text: 'A hopeful ball played too early — offside before it even arrives.' },
    { text: 'The linesman\'s flag cuts the attack dead.' },
    { text: 'The ball goes out for a throw-in, deep in {opp}\'s half.' },
    { text: 'A long throw is launched into the box, causing a brief scramble.' },
    { text: 'A quick throw-in catches {opp} still switching off.' },
    { text: 'The ball trickles out for a throw. Nothing threatening in it.' },
    { text: 'A well-drilled throw-in routine, but it comes to nothing.' },
    { text: '{team} slow it down and take a breath.' },
    { text: 'A booking for a cynical challenge in midfield.' },
    { text: '{opp} work it wide but the cross is cut out.' },
    { text: '{player} drops deep looking for a touch.' },
    { text: 'The tempo drops. Both sides look leggy.', when: late },
    { text: 'Every loose ball is a battle now.', when: late },
    { text: '{team} are throwing bodies forward.', when: (c) => late(c) && trailing(c), weight: 2 },
    { text: '{team} are content to see this out.', when: (c) => late(c) && leading(c), weight: 2 },
    { text: 'Both sides feeling their way into this one.', when: early },
    { text: '{opp} have the better of the early exchanges.', when: (c) => early(c) && c.momentum < 0 },
    { text: '{team} have started brightly here.', when: (c) => early(c) && c.momentum > 0 },

    // --- P31 expansion. The ambient bank had 15 lines carrying an entire
    // 90 minutes, so a single match could exhaust it and the feed read as
    // repetitive filler. Now ~55, sliced by game state so what you hear
    // actually reflects what's happening. ---
    { text: 'The referee has a word with the {opp} captain.' },
    { text: '{team} switch it to the far side, looking for space.' },
    { text: 'A heavy touch lets {opp} clear their lines.' },
    { text: 'Corner to {team}. Everyone up.' },
    { text: 'It comes to nothing, and {opp} break.' },
    { text: 'A free kick in a dangerous area — and it hits the wall.' },
    { text: 'The keeper takes an age over the goal kick.' },
    { text: '{opp} have three men committed forward here.' },
    { text: 'Good pressure from {team}, forcing a hurried clearance.' },
    { text: 'Two players go down and the physio is on.' },
    { text: 'The touchline is animated. Instructions being barked.' },
    { text: 'A long throw into the box causes chaos before it is hacked away.' },
    { text: 'Neat football from {team} in midfield without ever threatening.' },
    { text: 'That is a foul, and a lecture from the referee.' },
    { text: '{opp} sit deep and dare {team} to break them down.' },
    { text: 'A sloppy pass and the crowd let him know about it.' },
    { text: 'The wind is making this awkward for both sides.' },
    { text: 'Nothing between these two at the moment.' },
    { text: 'A rash tackle earns a talking to.' },
    { text: '{team} win a throw deep in the corner and take their time.' },
    { text: 'The ball spends a while in the air. Not much football being played.' },
    { text: 'A shout for handball, waved away.' },
    { text: 'Frustration creeping into {opp} now.' },
    { text: 'The bench is up, shouting about the shape.' },
    { text: 'A quick one-two almost opens the door.' },
    { text: 'Offside. The flag goes up and the move is over.' },
    { text: '{player} points to where he wants it.' },
    { text: 'A cross sails over everyone and out for a goal kick.' },
    { text: '{team} have settled into a rhythm now.' },
    { text: 'Both benches are getting restless.', when: late },
    { text: 'Cramp for a {opp} man. Everybody is out on their feet.', when: late },
    { text: 'The board goes up: added time.', when: veryLate },
    { text: 'Anything could happen here.', when: (c) => veryLate(c) && levelGame(c), weight: 2 },
    { text: '{team} are going long now, throwing everything at it.', when: (c) => veryLate(c) && trailing(c), weight: 2 },
    { text: '{opp} are taking an eternity over every restart.', when: (c) => veryLate(c) && trailing(c) },
    { text: 'Every clearance is met with a roar.', when: (c) => late(c) && leading(c) },
    { text: 'The manager is on the touchline demanding they hold their shape.', when: (c) => late(c) && leading(c) },
    { text: 'Nervy stuff. Nobody wants to be the one to make the mistake.', when: (c) => late(c) && levelGame(c) },
    { text: 'Bodies on the line for {team}.', when: (c) => late(c) && leading(c) },
    { text: 'This is end-to-end now and the shape has gone completely.', when: late },
    { text: 'Early exchanges are cagey.', when: early },
    { text: 'The first real tackle of the game sets the tone.', when: early },
    { text: '{team} are having to be patient.', when: (c) => early(c) && levelGame(c) },
    { text: 'Plenty of energy, not much quality yet.', when: early },
    { text: '{opp} look the sharper of the two so far.', when: (c) => early(c) && c.momentum < -1 },
    { text: '{team} are all over them in these opening minutes.', when: (c) => early(c) && c.momentum > 1 },
    { text: 'The momentum is with {team} and you can feel it.', when: (c) => c.momentum > 3 },
    { text: '{opp} have taken a grip on this.', when: (c) => c.momentum < -3 },
    { text: '{team} cannot get out of their own half.', when: (c) => c.momentum < -4 },
    { text: 'Wave after wave from {team}.', when: (c) => c.momentum > 4 },
    { text: 'A goal now would settle this.', when: (c) => late(c) && levelGame(c) },
    { text: 'It has been a long afternoon for {team}.', when: (c) => c.diff <= -2 },
    { text: 'Damage limitation for {team} at this stage.', when: (c) => c.diff <= -3 && late(c) },
    { text: '{team} can play with real freedom now.', when: (c) => c.diff >= 2 },
    { text: 'The crowd are enjoying this.', when: (c) => c.diff >= 2 && late(c) },
    { text: 'The referee plays advantage and the game flows on.' },
    { text: '{team} are trying to find a rhythm without much success.' },
    { text: 'A heavy tackle goes unpunished. Feelings are running high.' },
    { text: 'The ball pings around the middle of the park.' },
    { text: 'Some good interplay from {team}, but nothing comes of it.' },
    { text: 'An awkward bounce catches everyone out.' },
    { text: '{opp} regroup and reset their shape.' },
    { text: 'A drinks break, and both sides take the chance to talk tactics.' },
    { text: 'The linesman flags, but it is waved away by the referee.' },
    { text: 'A niggly period of the game — lots of fouls, little football.' },
    { text: '{team} probe patiently, looking for a way through.' },
    { text: 'A misplaced pass and the crowd groan in unison.' },
    { text: 'A tactical switch from the touchline as the shape changes.' },
    { text: 'The ball goes out of play for a throw, nothing threatening.' },
    { text: 'A stray elbow goes unnoticed by the officials.' },
    { text: '{opp} try to slow the game down at every opportunity.' },
    { text: 'A well-timed block stops a promising move in its tracks.' },
    { text: 'Neither side is willing to take a risk at the moment.' },
    { text: 'The temperature of the game is rising slightly.' },
    { text: 'A slick one-two, but the final pass lets {team} down.' },
    { text: 'The crowd urge {team} forward.', when: (c) => c.momentum > 2 },
    { text: '{opp} look content to sit in and absorb pressure.', when: (c) => c.momentum > 2 },
    { text: 'It has gone quiet in the away end.', when: (c) => c.momentum > 3 },
    { text: 'A whistle of frustration rings around the ground.', when: (c) => c.momentum < -2 },
    { text: '{team} cannot get out of their own half at the moment.', when: (c) => c.momentum < -3 },
  ],

  // P37: the keeper choosing how to start play — success/failure narrated as
  // a PASS, never a shot. Distinct from save-made/beaten, which are about
  // stopping the opponent, not building your own attack.
  'distribution-good': [
    { text: '{player} picks out the run perfectly. Play continues at pace.' },
    { text: 'A quick, low throw catches {opp} still turning. Good thinking.' },
    { text: '{player} switches it long and finds the man. Precision stuff.' },
    { text: 'Rolled out calmly under no pressure at all. Simple, effective.' },
    { text: '{player} spots the gap and threads it first time. Lovely pass.' },
  ],
  'distribution-poor': [
    { text: 'Straight to an {opp} shirt. {player} will want that one back.' },
    { text: 'Underhit, and {opp} pounce on the loose ball.' },
    { text: 'A heavy touch gives it away cheaply.' },
    { text: 'Panicked under pressure and the ball goes straight out.' },
    { text: '{player} slices the clearance and {opp} are straight back on the attack.' },
  ],

  'injury-played-through': [
    { text: '{player} shakes it off and gets back into the game.' },
    { text: 'A quick stretch and a nod to the physio — {player} is good to continue.' },
    { text: 'Gritted teeth, but {player} plays on.' },
    { text: 'The physio gives the all clear. {player} carries on.' },
  ],
  'injury-asked-off': [
    { text: '{player} makes the sensible call and signals to the bench.' },
    { text: 'No point risking it — {player} asks to come off.' },
    { text: '{player} knows their body. The physio waves for a change.' },
    { text: 'A mature decision under the circumstances. {player} comes off.' },
  ],

  'card-warning': [
    { text: 'The referee has a word. Nothing more this time, but {player} is on notice.' },
    { text: 'A stern talking-to from the official. No card, but a clear warning.' },
    { text: 'The referee lets it go with a warning. {player} needs to be careful now.' },
    { text: 'Play continues, but the referee makes a mental note of that one.' },
  ],
  'card-yellow': [
    { text: 'Yellow card. The referee reaches for his pocket and books {player}.' },
    { text: 'That\'s a caution for {player} — into the book he goes.' },
    { text: 'The referee has no hesitation. Yellow card shown to {player}.' },
    { text: 'A booking for {player}. One more like that and it\'s trouble.' },
  ],
  'card-second-yellow': [
    { text: 'Second yellow! That\'s it — {player} is off, and {team} are down to ten men.' },
    { text: 'Disaster. A second caution means {player} has to go, and {team} are a man light.' },
    { text: 'The referee shows a second yellow. {player} trudges off in disbelief.' },
  ],
  'card-red': [
    { text: 'RED CARD! {player} is sent off and {team} must play the rest of the match with ten men.' },
    { text: 'Straight red! No argument from the referee. A costly moment for {team}.' },
    { text: 'The referee brandishes red. {player} is off, and it changes the whole match.' },
    { text: 'That is a serious moment — {player} is dismissed, and {team} face the rest of this a man down.' },
  ],

  // P31: what you see and hear when you are NOT on the pitch. Previously a
  // substitute watched sixty minutes of complete silence, which is exactly
  // why the match "only came alive" on coming on.
  bench: [
    { text: 'You watch from the bench, boots already on.' },
    { text: 'The coach glances down the bench. Not yet.' },
    { text: 'You go through your stretches behind the dugout.' },
    { text: 'From here you can see the space nobody else is using.' },
    { text: 'A roar from the crowd. You crane your neck to see it.' },
    { text: 'The fourth official checks the numbers on the board. Not yours.' },
    { text: 'You are told to go and warm up.', when: (c) => c.minute >= 35 },
    { text: 'You jog the touchline, keeping one eye on the game.', when: (c) => c.minute >= 40 },
    { text: 'The coach calls your name. Get ready.', when: (c) => c.minute >= 50, weight: 2 },
    { text: 'You are itching to get on now.', when: (c) => c.minute >= 55 },
    { text: 'Boots retied. Shin pads straightened. Waiting.', when: (c) => c.minute >= 45 },
    { text: 'It is getting away from them and you are still sitting here.', when: (c) => trailing(c) && c.minute >= 50, weight: 2 },
    { text: 'They need something. You think you could give it to them.', when: (c) => trailing(c) && late(c), weight: 2 },
    { text: 'Comfortable enough. You might not be needed today.', when: (c) => c.diff >= 2 && late(c) },
    { text: 'The bench is quiet. Nobody wants to be the one not used.', when: late },
  ],

  sidelined: [
    { text: 'You watch the rest of it from the touchline, tracksuit on.' },
    { text: 'It is a strange feeling, watching them play without you.' },
    { text: 'You shout an instruction that nobody hears.' },
    { text: 'The physio sits beside you and says nothing useful.' },
    { text: 'Every tackle makes you wince from here.' },
    { text: 'You can see it so clearly from the side. Too late now.' },
    { text: 'A teammate looks over. You give him a nod.' },
    { text: 'The crowd noise washes over you.' },
    { text: 'You would give anything to be out there for this.', when: (c) => late(c) && levelGame(c), weight: 2 },
    { text: 'Nothing you can do but watch it play out.', when: late },
  ],

  'near-miss': [
    // P31: this bank had 6 lines but fires on every final-third move that
    // fizzles — one of the most frequent events in a match. Expanded to 22.
    { text: 'A ball over the top, and the striker cannot quite reach it.' },
    { text: 'Worked well down the right, but the cross is behind everyone.' },
    { text: 'A shot from distance, and it is never troubling the keeper.' },
    { text: 'Almost picked out at the back post. Inches away.' },
    { text: 'The pass is read and intercepted at the last moment.' },
    { text: 'Into the box, and it is scrambled clear.' },
    { text: 'A chance to shoot and he takes one touch too many.' },
    { text: 'Blocked. Brave defending from {opp}.' },
    { text: 'The flag goes up — offside, and the moment is gone.' },
    { text: 'Curled just past the far post. A yard away from something special.' },
    { text: 'Headed over from a good position.' },
    { text: 'A slip at the crucial moment and the chance evaporates.' },
    { text: 'Cut out by the last man. Fine defending.' },
    { text: 'Dragged wide with the goal opening up.' },
    { text: 'A heavy first touch and the keeper smothers it.' },
    { text: '{team} build patiently and then rush the final ball.' },
    { text: 'A hopeful appeal for a penalty. Nothing given.' },
    { text: 'The rebound falls to nobody in a {team} shirt.', when: (c) => c.momentum > 0 },
    { text: '{team} pour forward but there is nobody in the middle.', when: (c) => late(c) && trailing(c) },
    { text: 'The keeper claims it comfortably.' },
    { text: 'A big chance goes begging.', when: (c) => late(c) && levelGame(c) },
    { text: 'Into the final third — but the final ball is overhit.' },
    { text: '{team} work an opening and it fizzles out.' },
    { text: 'Half a chance, and it comes to nothing.' },
    { text: 'A promising move breaks down at the last.' },
    { text: 'Deflected behind. Corner to {team}.' },
    { text: 'The shot is charged down. Nothing doing.' },
    { text: 'So close! Inches away from an opener.' },
    { text: 'A deflection takes it just wide of the post.' },
    { text: 'The rebound falls invitingly, but nobody can react in time.' },
    { text: 'It clips the outside of the post and away for a goal kick.' },
    { text: 'That flew narrowly over the bar. So close to a spectacular goal.' },
    { text: 'A goal-line scramble ends with the ball hacked away.' },
    { text: 'The whole stadium rises, but it does not go in.' },
    { text: 'A fine save tips it agonisingly onto the crossbar.' },
    { text: 'A last touch diverts it just wide.' },
    { text: 'The bar denies what looked a certain goal.' },
  ],

  'chance-wasted-teammate': [
    { text: 'Big chance for {team} — and it\'s put wide! {player} can\'t believe it.' },
    { text: 'That should have been a goal. {team} waste a golden opening.' },
    { text: 'The keeper saves well and {team} are denied.' },
    { text: 'Over the bar! {team} will rue that one.' },
    { text: 'A gilt-edged chance goes begging for {team}.' },
    { text: 'That is one {team} will look back on with real regret.' },
    { text: 'The chance is there, but the finish lets the move down.' },
    { text: 'Wasteful in front of goal from {team} there.' },
    { text: 'A promising position, ultimately squandered.' },
  ],

  'chance-survived': [
    { text: '{opp} carve them open — but the finish is poor. Let off.' },
    { text: 'Off the woodwork! {team} survive.' },
    { text: 'The keeper saves brilliantly to keep {opp} out.' },
    { text: 'That was close. {opp} should have scored.' },
    { text: 'Wide! {team} escape one there.' },
    { text: '{team} survive a real scare there.' },
    { text: 'That could easily have gone the other way.' },
    { text: 'A let-off, and {team} will be relieved to hear the whistle.' },
    { text: 'Living dangerously, but {team} get away with it.' },
    { text: 'A collective sigh of relief around the ground.' },
  ],
}

// --- rendering ---

export function fill(text: string, c: CommentaryContext): string {
  return text
    .replace(/\{player\}/g, c.player)
    .replace(/\{team\}/g, c.team)
    .replace(/\{opp\}/g, c.opp)
    .replace(/\{min\}/g, String(c.minute))
    .replace(/\{home\}/g, c.homeShort)
    .replace(/\{away\}/g, c.awayShort)
    .replace(/\{hs\}/g, String(c.homeScore))
    .replace(/\{as\}/g, String(c.awayScore))
    // Phase 22a: named teammate goalscorer/assister, when the squad layer
    // supplied one. Templates using these are guarded to only fire when
    // ctx.scorer is actually set (see the goal-teammate bank).
    .replace(/\{scorer\}/g, c.scorer ?? 'a teammate')
    .replace(/\{assister\}/g, c.assister ?? 'a teammate')
}

/**
 * Per-match commentator. Holds the recently-used lines so a single match never
 * repeats itself, which is the difference between "varied" and "obviously random".
 */
export interface Commentator {
  line: (kind: CommentaryKind, ctx: CommentaryContext) => string
}

const MEMORY_DEPTH = 4

export function createCommentator(): Commentator {
  const recent = new Map<CommentaryKind, string[]>()

  return {
    line(kind, ctx) {
      const bank = BANKS[kind]
      if (!bank || bank.length === 0) return ''

      // eligible by guard
      let pool = bank.filter((t) => !t.when || t.when(ctx))
      // fall back to unguarded lines if the guards excluded everything
      if (pool.length === 0) pool = bank.filter((t) => !t.when)
      if (pool.length === 0) pool = bank

      // Avoid recent repeats. The memory window must be smaller than the eligible pool,
      // otherwise a small bank (or a narrow guard) exhausts it, the filter empties, and we
      // fall back to the full pool — which lets the SAME line appear twice in a row. Audit
      // caught exactly that: 24 back-to-back repeats across the thin banks.
      const seen = recent.get(kind) ?? []
      const window = Math.max(1, Math.min(MEMORY_DEPTH, pool.length - 1))
      const blocked = seen.slice(-window)
      const fresh = pool.filter((t) => !blocked.includes(t.text))
      const candidates = fresh.length > 0 ? fresh : pool

      const total = candidates.reduce((sum, t) => sum + (t.weight ?? 1), 0)
      let r = rand() * total
      let chosen = candidates[candidates.length - 1]
      for (const t of candidates) {
        r -= t.weight ?? 1
        if (r <= 0) { chosen = t; break }
      }

      recent.set(kind, [...seen, chosen.text].slice(-MEMORY_DEPTH))
      return fill(chosen.text, ctx)
    },
  }
}

/** Commentators use surnames. "Kian Mbeki" -> "Mbeki". */
export function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? 'He')
}

/** Exposed for the audit harness — lets tests walk every template. */
export function allTemplates(): { kind: CommentaryKind; text: string }[] {
  return (Object.keys(BANKS) as CommentaryKind[]).flatMap((kind) =>
    BANKS[kind].map((t) => ({ kind, text: t.text }))
  )
}
