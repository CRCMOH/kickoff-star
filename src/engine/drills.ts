import type { TrainingSessionType } from '../types/training'
import type { OutfieldAttribute, GoalkeeperAttribute } from '../types/attributes'

type AnyAttribute = OutfieldAttribute | GoalkeeperAttribute

// A drill template: authored text + options whose odds come from attributes procedurally.
// baseCeiling = the best achievable success rate for this option at ideal attributes.
// keyAttributes = which attributes drive this option's probability.
// risk tier is implied by baseCeiling (lower ceiling = riskier, higher reward).
export interface DrillOptionTemplate {
  label: string
  hint: string
  baseCeiling: number // 0-1
  keyAttributes: AnyAttribute[]
  reward: number // growth contribution weight if this is the "correct"/high-value pick
  successText: string
  failText: string
}

export interface DrillTemplate {
  title: string
  situation: string
  options: DrillOptionTemplate[]
}

// Multiple authored drills per session type; the engine pulls a sequence from these.
export const DRILL_POOLS: Record<TrainingSessionType, DrillTemplate[]> = {
  finishing: [
    {
      title: 'First Touch & Finish',
      situation: 'The coach drives a ball hard into your feet, back to goal, a defender tight behind you.',
      options: [
        { label: 'turn and shoot', hint: 'high risk, high reward', baseCeiling: 0.55, keyAttributes: ['shooting', 'agility'], reward: 3,
          successText: 'You spin off the defender and rifle it home. Coach claps once — high praise from him.', failText: 'The turn is too slow and the defender nicks it away.' },
        { label: 'cushion and lay off', hint: 'steadier', baseCeiling: 0.8, keyAttributes: ['composure', 'passing'], reward: 2,
          successText: 'Perfect cushioned touch, simple lay-off. Clean rep.', failText: 'Your touch bounces off you and the drill breaks down.' },
        { label: 'shield and wait', hint: 'safe', baseCeiling: 0.92, keyAttributes: ['strength'], reward: 1,
          successText: 'You hold the defender off and keep it. Solid, if unspectacular.', failText: 'You get muscled off the ball.' },
      ],
    },
    {
      title: 'One-on-One',
      situation: 'You are through on the keeper in the finishing drill. He rushes off his line to close the angle.',
      options: [
        { label: 'chip the keeper', hint: 'audacious', baseCeiling: 0.45, keyAttributes: ['composure', 'shooting'], reward: 3,
          successText: 'You dink it over him — it drops under the bar. Beautiful.', failText: 'The chip is weak and he catches it easily.' },
        { label: 'low across goal', hint: 'reliable', baseCeiling: 0.78, keyAttributes: ['shooting', 'composure'], reward: 2,
          successText: 'Low and hard across him into the far corner. Textbook.', failText: 'You scuff it and he blocks with his legs.' },
        { label: 'round him', hint: 'needs quick feet', baseCeiling: 0.62, keyAttributes: ['dribbling', 'agility'], reward: 2,
          successText: 'You knock it past and roll it in. Confident.', failText: 'You take too long and he smothers it.' },
      ],
    },
    {
      title: 'First-Time Volley',
      situation: 'A teammate whips in a cross from the byline. It arrives waist-high, fast, no time to take a touch.',
      options: [
        { label: 'strike it clean', hint: 'high risk', baseCeiling: 0.48, keyAttributes: ['shooting', 'agility'], reward: 3,
          successText: 'Sweet contact, it flies into the top corner. The coach actually applauds.', failText: 'You catch it heavy and it balloons over the bar.' },
        { label: 'cushion and side-foot', hint: 'controlled', baseCeiling: 0.75, keyAttributes: ['composure', 'shooting'], reward: 2,
          successText: 'A perfect first touch sets it up, then you side-foot it home.', failText: 'The touch runs away from you and the chance is gone.' },
        { label: 'stab it goalward', hint: 'safe contact', baseCeiling: 0.88, keyAttributes: ['positioning'], reward: 1,
          successText: 'Not pretty, but you get enough on it to test the keeper.', failText: 'You mistime it completely and it skews wide.' },
      ],
    },
  ],
  'passing-vision': [
    {
      title: 'Split the Lines',
      situation: 'In the passing drill, two defenders screen the gap. A runner darts between them for a split second.',
      options: [
        { label: 'thread it through', hint: 'high risk', baseCeiling: 0.5, keyAttributes: ['vision', 'passing'], reward: 3,
          successText: 'You slide it through the eye of the needle. The coach stops the session to point it out.', failText: 'The pass is a fraction heavy and gets cut out.' },
        { label: 'play it wide', hint: 'safer switch', baseCeiling: 0.85, keyAttributes: ['passing'], reward: 2,
          successText: 'You switch it out to space cleanly.', failText: 'The switch drifts out of play.' },
        { label: 'recycle back', hint: 'keep possession', baseCeiling: 0.93, keyAttributes: ['composure'], reward: 1,
          successText: 'Simple ball back, keep the move alive.', failText: 'The backpass is underhit.' },
      ],
    },
    {
      title: 'Switch the Play',
      situation: 'Possession drill, ball stuck on the left. Space has opened up on the far side, but it means a 40-yard pass across the pitch.',
      options: [
        { label: 'hit the long diagonal', hint: 'ambitious', baseCeiling: 0.48, keyAttributes: ['vision', 'passing'], reward: 3,
          successText: 'It drops right into stride on the far side. A genuine ping. Coach loves it.', failText: 'You put too much on it and it runs out of play.' },
        { label: 'work it through midfield', hint: 'patient', baseCeiling: 0.82, keyAttributes: ['passing', 'composure'], reward: 2,
          successText: 'A few short passes and the ball gets across cleanly.', failText: 'A pass in the buildup gets intercepted.' },
        { label: 'hold shape, reset', hint: 'safe', baseCeiling: 0.92, keyAttributes: ['composure'], reward: 1,
          successText: 'You keep it simple and let the shape reset.', failText: 'You dwell and get closed down.' },
      ],
    },
    {
      title: 'Tight Rondo',
      situation: 'A crowded possession square, defenders closing from every side. The ball arrives to you with barely a yard of space.',
      options: [
        { label: 'one-touch it on', hint: 'instant, risky', baseCeiling: 0.52, keyAttributes: ['vision', 'passing'], reward: 3,
          successText: 'Bang, gone before the press arrives. Gorgeous one-touch play.', failText: 'The touch is a fraction off and it\'s intercepted.' },
        { label: 'take a touch, find the pass', hint: 'measured', baseCeiling: 0.78, keyAttributes: ['passing', 'agility'], reward: 2,
          successText: 'A quick touch buys just enough room to find the pass.', failText: 'The extra touch lets the press swarm you.' },
        { label: 'shield it, recycle', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['strength', 'composure'], reward: 1,
          successText: 'You protect the ball and get it back to the base of the square.', failText: 'You get muscled off it under the pressure.' },
      ],
    },
  ],
  dribbling: [
    {
      title: 'Beat Your Man',
      situation: 'The coach sets you one-v-one against the quickest defender in the group in a tight channel.',
      options: [
        { label: 'stepover and go', hint: 'flashy', baseCeiling: 0.5, keyAttributes: ['dribbling', 'agility'], reward: 3,
          successText: 'Stepover, burst of pace, gone. The group ooohs.', failText: 'He reads it and jockeys you into the cone.' },
        { label: 'knock and run', hint: 'pace-reliant', baseCeiling: 0.7, keyAttributes: ['pace', 'agility'], reward: 2,
          successText: 'You push it past and beat him for pace.', failText: 'He gets across and shepherds it out.' },
        { label: 'shield and pass', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['strength', 'passing'], reward: 1,
          successText: 'You protect it and lay it off. No risk taken.', failText: 'He pokes it away as you turn.' },
      ],
    },
    {
      title: 'Running at the Block',
      situation: 'Four defenders sit deep and compact for the drill. You have the ball at your feet with space to run into first.',
      options: [
        { label: 'drive straight at them', hint: 'direct, risky', baseCeiling: 0.46, keyAttributes: ['dribbling', 'pace'], reward: 3,
          successText: 'You carry it right at the block and burst through a gap that wasn\'t really there. Bold.', failText: 'You run into a wall of bodies and lose it.' },
        { label: 'shift the angle, probe', hint: 'patient', baseCeiling: 0.76, keyAttributes: ['dribbling', 'vision'], reward: 2,
          successText: 'You shift the ball side to side and find a seam to slide through.', failText: 'The block holds its shape and you\'re forced backward.' },
        { label: 'slow it down, recycle', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['composure'], reward: 1,
          successText: 'You keep it simple and reset the attack.', failText: 'You dwell too long and get closed down.' },
      ],
    },
    {
      title: 'Close Control Squeeze',
      situation: 'A shrinking grid drill — the space keeps getting smaller and two defenders are closing from either side.',
      options: [
        { label: 'nutmeg through the gap', hint: 'high risk', baseCeiling: 0.42, keyAttributes: ['dribbling', 'agility'], reward: 3,
          successText: 'Through the legs and gone — the group loses it. Pure showboat, pure quality.', failText: 'He closes his legs and it cannons off him.' },
        { label: 'quick turn away', hint: 'controlled', baseCeiling: 0.74, keyAttributes: ['agility', 'dribbling'], reward: 2,
          successText: 'A sharp turn spins you clear of both defenders.', failText: 'You turn into traffic and lose the ball.' },
        { label: 'hold it up', hint: 'safe', baseCeiling: 0.88, keyAttributes: ['strength'], reward: 1,
          successText: 'You shield it against the squeeze until the whistle.', failText: 'You get bundled off it in the crush.' },
      ],
    },
  ],
  'defending-physical': [
    {
      title: 'Last-Ditch',
      situation: 'The striker breaks through in the defending drill. You are the last man, backpedalling.',
      options: [
        { label: 'dive in', hint: 'high risk', baseCeiling: 0.45, keyAttributes: ['tackling', 'agility'], reward: 3,
          successText: 'Perfectly timed slide — all ball. The coach nods approvingly.', failText: 'You commit early and he skips past you.' },
        { label: 'jockey and delay', hint: 'disciplined', baseCeiling: 0.82, keyAttributes: ['positioning', 'concentration'], reward: 2,
          successText: 'You stay on your feet, delay, and cover arrives.', failText: 'You backpedal too far and give up the shot.' },
        { label: 'shepherd wide', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['positioning', 'pace'], reward: 1,
          successText: 'You force him onto his weak side and out of danger.', failText: 'He cuts back inside you.' },
      ],
    },
    {
      title: 'Aerial Duel',
      situation: 'A long ball is launched into the channel. You and the striker are shoulder to shoulder, both eyeing the header.',
      options: [
        { label: 'attack it aggressively', hint: 'committed', baseCeiling: 0.5, keyAttributes: ['strength', 'positioning'], reward: 3,
          successText: 'You out-jump him clean and power the header away. Dominant.', failText: 'You mistime the jump and he wins it easily.' },
        { label: 'block his run first', hint: 'disciplined', baseCeiling: 0.8, keyAttributes: ['positioning', 'strength'], reward: 2,
          successText: 'You use your body to disrupt his run, then deal with the header.', failText: 'He shrugs you off and gets the run on you.' },
        { label: 'concede the flick, react', hint: 'reactive', baseCeiling: 0.88, keyAttributes: ['concentration', 'agility'], reward: 1,
          successText: 'He wins the header but you\'re already set for the knockdown.', failText: 'The flick-on catches you flat-footed.' },
      ],
    },
    {
      title: 'Hold Your Shape',
      situation: 'A winger drives at you in space during the defending drill, ball at his feet, plenty of room to work with.',
      options: [
        { label: 'engage early, win it', hint: 'high risk', baseCeiling: 0.44, keyAttributes: ['tackling', 'positioning'], reward: 3,
          successText: 'You time the tackle perfectly and come away with it clean.', failText: 'You dive in too soon and he skips by.' },
        { label: 'stand off, show him wide', hint: 'controlled', baseCeiling: 0.8, keyAttributes: ['positioning', 'concentration'], reward: 2,
          successText: 'You give ground smartly, funnel him away from goal, then win it back.', failText: 'You give too much ground and he cuts inside.' },
        { label: 'stay patient, wait for support', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['concentration'], reward: 1,
          successText: 'You hold him up until a teammate arrives to double up.', failText: 'You back off too far and he has a free shot.' },
      ],
    },
  ],
  fitness: [
    {
      title: 'Final Rep',
      situation: 'Last set of shuttle sprints. Your legs are burning and the coach is watching who pushes through.',
      options: [
        { label: 'empty the tank', hint: 'max effort', baseCeiling: 0.7, keyAttributes: ['stamina', 'strength'], reward: 3,
          successText: 'You leave nothing out there. The coach clocks your effort.', failText: 'You blow up halfway and jog the last rep.' },
        { label: 'steady pace', hint: 'controlled', baseCeiling: 0.9, keyAttributes: ['stamina'], reward: 2,
          successText: 'You pace it well and finish strong.', failText: 'You fade at the end.' },
        { label: 'coast it', hint: 'protect energy', baseCeiling: 0.95, keyAttributes: ['pace'], reward: 1,
          successText: 'You do enough. Legs saved for matchday.', failText: 'The coach notices you cruising.' },
      ],
    },
    {
      title: 'Interval Recovery',
      situation: 'Between sprint sets, the coach gives a short window to recover before the whistle goes again.',
      options: [
        { label: 'active recovery, keep moving', hint: 'disciplined', baseCeiling: 0.68, keyAttributes: ['stamina', 'concentration'], reward: 3,
          successText: 'You keep the legs ticking over and come out of the break sharp.', failText: 'You cramp up mid-set from the effort.' },
        { label: 'walk it off', hint: 'balanced', baseCeiling: 0.88, keyAttributes: ['stamina'], reward: 2,
          successText: 'A sensible recovery, ready for the next rep.', failText: 'You\'re still breathing hard when the whistle goes.' },
        { label: 'take the full rest', hint: 'safe', baseCeiling: 0.93, keyAttributes: ['concentration'], reward: 1,
          successText: 'Fully recovered, but the coach notes you took it easy.', failText: 'Even the full rest wasn\'t quite enough.' },
      ],
    },
    {
      title: 'Small-Sided Grind',
      situation: 'A high-intensity small-sided game, minute 18 of 20. Everyone is exhausted and the coach wants a winner scored.',
      options: [
        { label: 'sprint every ball', hint: 'max effort', baseCeiling: 0.65, keyAttributes: ['stamina', 'strength'], reward: 3,
          successText: 'You keep chasing lost causes and it pays off — a real statement of fitness.', failText: 'Your legs give out and you\'re a passenger for the last few minutes.' },
        { label: 'pick your moments', hint: 'smart effort', baseCeiling: 0.85, keyAttributes: ['stamina', 'positioning'], reward: 2,
          successText: 'You manage your energy well and still make the key contribution.', failText: 'You misjudge when to go and arrive a step too late.' },
        { label: 'conserve for the whistle', hint: 'safe', baseCeiling: 0.92, keyAttributes: ['pace'], reward: 1,
          successText: 'You see it out sensibly, nothing left in the tank wasted.', failText: 'You conserve so much the coach questions your effort.' },
      ],
    },
  ],
  tactical: [
    {
      title: 'Read the Shape',
      situation: 'A tactical walkthrough. The coach freezes play and asks where you should be as the ball switches sides.',
      options: [
        { label: 'aggressive jump', hint: 'proactive', baseCeiling: 0.55, keyAttributes: ['positioning', 'concentration'], reward: 3,
          successText: 'You read the trigger early and step up perfectly. Coach: "Exactly that."', failText: 'You jump too early and leave a gap.' },
        { label: 'hold the line', hint: 'disciplined', baseCeiling: 0.85, keyAttributes: ['positioning'], reward: 2,
          successText: 'You hold your position and stay compact.', failText: 'You drift and the line breaks.' },
        { label: 'drop and cover', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['concentration'], reward: 1,
          successText: 'You drop in and screen the space. Sensible.', failText: 'You drop too deep and invite pressure.' },
      ],
    },
    {
      title: 'Press or Hold',
      situation: 'The coach walks through pressing triggers. The opposition centre-back takes a heavy touch — do you go?',
      options: [
        { label: 'press immediately', hint: 'proactive, risky', baseCeiling: 0.5, keyAttributes: ['positioning', 'pace'], reward: 3,
          successText: 'You close him down the instant the touch is heavy and win the ball high. "That\'s the trigger," the coach says.', failText: 'You press but he shifts it away and you\'re out of position.' },
        { label: 'press as a unit', hint: 'coordinated', baseCeiling: 0.8, keyAttributes: ['positioning', 'concentration'], reward: 2,
          successText: 'You trigger the press together with the front line — clean and organized.', failText: 'The timing is off between you and a teammate, leaving a gap.' },
        { label: 'hold shape, wait', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['concentration'], reward: 1,
          successText: 'You stay disciplined and let the shape do the work instead.', failText: 'You hesitate and the moment to press passes anyway.' },
      ],
    },
    {
      title: 'Set-Piece Assignment',
      situation: 'A corner routine walkthrough. The coach asks you to pick up a specific runner making a near-post dart.',
      options: [
        { label: 'mark tight, go with him', hint: 'committed', baseCeiling: 0.52, keyAttributes: ['positioning', 'concentration'], reward: 3,
          successText: 'You track him step for step and win the contest clean. Textbook marking.', failText: 'He loses you at the near post and gets a free header.' },
        { label: 'zonal, cover the space', hint: 'disciplined', baseCeiling: 0.82, keyAttributes: ['positioning'], reward: 2,
          successText: 'You hold your zone and deal with whoever arrives in it.', failText: 'Your zone gets overloaded and you\'re caught ball-watching.' },
        { label: 'stay deep, sweep up', hint: 'safe', baseCeiling: 0.88, keyAttributes: ['concentration', 'positioning'], reward: 1,
          successText: 'You sit off and mop up anything that gets flicked on.', failText: 'You sit too deep and the first contact is never challenged.' },
      ],
    },
  ],
  'gk-shot-stopping': [
    {
      title: 'Point Blank',
      situation: 'A striker unloads a driven shot from the edge of the box, low to your right.',
      options: [
        { label: 'catch it', hint: 'high reward, risky', baseCeiling: 0.5, keyAttributes: ['handling', 'reflexes'], reward: 3,
          successText: 'You get both hands strong behind it and hold on. No rebound.', failText: 'It squirms through your gloves.' },
        { label: 'parry wide', hint: 'safe hands', baseCeiling: 0.82, keyAttributes: ['reflexes'], reward: 2,
          successText: 'You push it firmly around the post.', failText: 'You parry it straight back into danger.' },
        { label: 'block with body', hint: 'last resort', baseCeiling: 0.88, keyAttributes: ['gkPositioning'], reward: 1,
          successText: 'You spread yourself and block it with your chest.', failText: 'It beats you at your near post.' },
      ],
    },
    {
      title: 'Rushing Out',
      situation: 'A through-ball splits your defense. The striker is through, one-on-one, bearing down fast.',
      options: [
        { label: 'race off your line', hint: 'high risk', baseCeiling: 0.46, keyAttributes: ['gkPositioning', 'reflexes'], reward: 3,
          successText: 'You get there first and smother it at his feet. Brave and perfectly timed.', failText: 'You commit too early and he rounds you.' },
        { label: 'narrow the angle, stay tall', hint: 'controlled', baseCeiling: 0.78, keyAttributes: ['gkPositioning'], reward: 2,
          successText: 'You close the angle down and force a difficult finish he can\'t convert.', failText: 'You misjudge the angle and leave him a clear sight of goal.' },
        { label: 'hold your ground', hint: 'safe', baseCeiling: 0.85, keyAttributes: ['reflexes', 'gkPositioning'], reward: 1,
          successText: 'You stay big and set, ready to react to whatever he does.', failText: 'You freeze and he picks his spot.' },
      ],
    },
    {
      title: 'Deflection Scramble',
      situation: 'A shot takes a wicked deflection off a defender, changing direction right in front of you.',
      options: [
        { label: 'react instantly, full stretch', hint: 'elite reflex', baseCeiling: 0.44, keyAttributes: ['reflexes', 'agility'], reward: 3,
          successText: 'An incredible reaction save, somehow you get a hand to it. World-class instinct.', failText: 'The deflection wrong-foots you completely.' },
        { label: 'stay square, adjust late', hint: 'balanced', baseCeiling: 0.76, keyAttributes: ['reflexes', 'gkPositioning'], reward: 2,
          successText: 'You stay balanced enough to adjust and make the save.', failText: 'You\'re already committed the wrong way and can\'t recover.' },
        { label: 'get any part of you behind it', hint: 'safe', baseCeiling: 0.86, keyAttributes: ['gkPositioning'], reward: 1,
          successText: 'Not elegant, but you block it and live to fight on.', failText: 'You can\'t get anything on it in time.' },
      ],
    },
  ],
  'gk-positioning': [
    {
      title: 'Command the Box',
      situation: 'An inswinging cross hangs in the six-yard box with bodies everywhere.',
      options: [
        { label: 'come and claim', hint: 'brave', baseCeiling: 0.5, keyAttributes: ['handling', 'gkPositioning'], reward: 3,
          successText: 'You come through the crowd and pluck it clean. Total authority.', failText: 'You get caught in no-man\'s-land and flap at it.' },
        { label: 'punch clear', hint: 'safe distance', baseCeiling: 0.8, keyAttributes: ['gkPositioning'], reward: 2,
          successText: 'You punch it strong and far. Danger cleared.', failText: 'You mistime the punch and it loops up.' },
        { label: 'stay and set', hint: 'react to shot', baseCeiling: 0.85, keyAttributes: ['reflexes'], reward: 1,
          successText: 'You stay set and are ready for the header. Solid.', failText: 'The header beats you before you\'re set.' },
      ],
    },
    {
      title: 'Sweeper Read',
      situation: 'A ball is played over the top of your defensive line. You have to decide right now whether to come off your line.',
      options: [
        { label: 'race out and clear', hint: 'high risk', baseCeiling: 0.46, keyAttributes: ['gkPositioning', 'reflexes'], reward: 3,
          successText: 'You get there first, well outside the box, and clear the danger. Genuine sweeper-keeper stuff.', failText: 'You misjudge the run and the striker gets there before you.' },
        { label: 'stay on the edge, ready', hint: 'controlled', baseCeiling: 0.78, keyAttributes: ['gkPositioning', 'concentration'], reward: 2,
          successText: 'You hold a smart position and deal with it as it arrives.', failText: 'You\'re stuck between committing and staying, and it costs you.' },
        { label: 'trust your defender', hint: 'safe', baseCeiling: 0.88, keyAttributes: ['concentration'], reward: 1,
          successText: 'You hold your line and let the covering defender deal with it.', failText: 'Your defender doesn\'t get there and you\'re exposed anyway.' },
      ],
    },
    {
      title: 'Set the Line',
      situation: 'Before a corner is taken, you have a moment to organize your defense and set the offside trap.',
      options: [
        { label: 'push the line up aggressively', hint: 'proactive', baseCeiling: 0.5, keyAttributes: ['gkPositioning', 'concentration'], reward: 3,
          successText: 'You organize it perfectly — the trap springs and the flag goes up. Real command.', failText: 'The trigger is mistimed and someone gets in behind.' },
        { label: 'set a solid, deeper line', hint: 'disciplined', baseCeiling: 0.82, keyAttributes: ['gkPositioning'], reward: 2,
          successText: 'A well-organized, deeper set-up nullifies most of the danger.', failText: 'The line is a fraction disorganized and a gap opens.' },
        { label: 'leave it to the defenders', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['concentration'], reward: 1,
          successText: 'You let the back line handle it themselves — fine, if unremarkable.', failText: 'Without your organizing voice, the marking gets confused.' },
      ],
    },
  ],
  'gk-distribution': [
    {
      title: 'Start the Attack',
      situation: 'You gather the ball. A full-back is free short; a striker is making a run long.',
      options: [
        { label: 'long to the striker', hint: 'ambitious', baseCeiling: 0.55, keyAttributes: ['distribution'], reward: 3,
          successText: 'You pick him out over the top. Instant counter.', failText: 'The throw is short and intercepted.' },
        { label: 'roll to full-back', hint: 'reliable', baseCeiling: 0.9, keyAttributes: ['distribution'], reward: 2,
          successText: 'Crisp roll into his stride. Keep possession.', failText: 'The roll is behind him and he loses it.' },
        { label: 'hold it', hint: 'reset', baseCeiling: 0.95, keyAttributes: ['gkPositioning'], reward: 1,
          successText: 'You hold, take a breath, restart calmly.', failText: 'You dwell too long and get closed down.' },
      ],
    },
    {
      title: 'Goal Kick Under Pressure',
      situation: 'The opposition presses high even on your goal kicks, cutting off the easy short options.',
      options: [
        { label: 'go long over the press', hint: 'high risk', baseCeiling: 0.5, keyAttributes: ['distribution'], reward: 3,
          successText: 'You clear the press completely and find a teammate in space. Beats the whole plan.', failText: 'The kick is mishit and gives the ball straight back under pressure.' },
        { label: 'find the switch out wide', hint: 'measured', baseCeiling: 0.78, keyAttributes: ['distribution', 'vision'], reward: 2,
          successText: 'You find the one gap the press left open, out on the flank.', failText: 'The pass out wide is cut off before it arrives.' },
        { label: 'play safe and short', hint: 'safe', baseCeiling: 0.86, keyAttributes: ['distribution', 'gkPositioning'], reward: 1,
          successText: 'A simple short pass, no real progress but no risk either.', failText: 'Even the short option gets pressed into a mistake.' },
      ],
    },
    {
      title: 'Quick Throw',
      situation: 'You\'ve just made a save. The opposition is still disorganized from the attack — there\'s a real chance to counter fast.',
      options: [
        { label: 'launch it immediately', hint: 'high risk, high reward', baseCeiling: 0.48, keyAttributes: ['distribution', 'concentration'], reward: 3,
          successText: 'A lightning-quick throw catches them completely flat-footed. Textbook transition.', failText: 'You rush it and the throw goes straight to an opponent.' },
        { label: 'take a second, pick the pass', hint: 'controlled', baseCeiling: 0.8, keyAttributes: ['distribution'], reward: 2,
          successText: 'A composed beat to assess, then a smart throw into space.', failText: 'The extra moment lets them get back into shape.' },
        { label: 'slow the game down', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['gkPositioning'], reward: 1,
          successText: 'You let the moment pass and reset with your team organized.', failText: 'You slow it down so much the coach questions the decision.' },
      ],
    },
  ],
  'gk-reactions': [
    {
      title: 'Rapid Fire',
      situation: 'The coach fires shots at you in quick succession from close range. Reset fast.',
      options: [
        { label: 'explode across', hint: 'max reflex', baseCeiling: 0.6, keyAttributes: ['reflexes', 'agility'], reward: 3,
          successText: 'You fly across and get a strong hand to it. Elite reaction.', failText: 'You\'re a split second late and it beats you.' },
        { label: 'stay compact', hint: 'controlled', baseCeiling: 0.85, keyAttributes: ['reflexes'], reward: 2,
          successText: 'You stay big and block it with your frame.', failText: 'It finds the gap under your arm.' },
        { label: 'set feet first', hint: 'safe', baseCeiling: 0.9, keyAttributes: ['gkPositioning'], reward: 1,
          successText: 'Feet set, easy take. No fuss.', failText: 'You\'re still moving as it arrives.' },
      ],
    },
    {
      title: 'Second Save',
      situation: 'Your first save parries straight back out. The striker is already onto the loose ball for a second attempt.',
      options: [
        { label: 'scramble back up instantly', hint: 'max reflex', baseCeiling: 0.42, keyAttributes: ['reflexes', 'agility'], reward: 3,
          successText: 'You\'re somehow already back on your feet and make an incredible second save. Pure will.', failText: 'You\'re still on the ground when the second shot comes in.' },
        { label: 'smother it on the ground', hint: 'controlled', baseCeiling: 0.74, keyAttributes: ['reflexes', 'gkPositioning'], reward: 2,
          successText: 'You get low and wrap it up before he can strike again.', failText: 'The ball squirms just out of your reach.' },
        { label: 'concede ground, cover the near post', hint: 'safe', baseCeiling: 0.86, keyAttributes: ['gkPositioning'], reward: 1,
          successText: 'You cover the most likely angle and it\'s enough.', failText: 'He goes the other way and you\'re not there.' },
      ],
    },
    {
      title: 'Reaction Save',
      situation: 'A shot is deflected off a teammate at the last second, completely changing its path toward goal.',
      options: [
        { label: 'react on pure instinct', hint: 'elite reflex', baseCeiling: 0.4, keyAttributes: ['reflexes'], reward: 3,
          successText: 'Somehow, impossibly, you get there. A genuine world-class reaction save.', failText: 'There was simply no time to react to the change of direction.' },
        { label: 'stay balanced, adjust', hint: 'controlled', baseCeiling: 0.72, keyAttributes: ['reflexes', 'agility'], reward: 2,
          successText: 'Because you hadn\'t fully committed yet, you\'re able to adjust and save it.', failText: 'You\'re already moving the wrong way and can\'t recover.' },
        { label: 'brace and hope', hint: 'safe', baseCeiling: 0.82, keyAttributes: ['gkPositioning'], reward: 1,
          successText: 'You get something, anything, in the way and it\'s enough.', failText: 'You brace but it finds the only gap.' },
      ],
    },
  ],
}
