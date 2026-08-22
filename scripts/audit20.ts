// AUDIT 20 (P67) — real minigame coverage. The 6 new match minigames
// (shooting/passing/dribble/tackle/keeper/cross-header) are only as real as
// the content that actually routes into them. This reads the real source
// directly (matchDecisions.ts, matchScenarios.ts, MatchScreen.tsx) rather
// than a hand-maintained mirror list, so it can't quietly drift out of sync
// with what the game actually contains.
import { readFileSync } from 'fs'

let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

console.log('\n[A] every new minigame component genuinely exists')
{
  const files = ['ShootingMinigame', 'PassingMinigame', 'DribbleMinigame', 'TackleMinigame', 'KeeperMinigame', 'CrossHeaderMinigame']
  for (const f of files) {
    check(readFileSync(`src/components/${f}.tsx`, 'utf-8').includes('export default function'), `${f}.tsx exists and exports a real component`)
  }
}

console.log('\n[B] MatchScreen actually routes to all 6, not just shooting')
{
  const src = readFileSync('src/screens/MatchScreen.tsx', 'utf-8')
  for (const name of ['ShootingMinigame', 'PassingMinigame', 'DribbleMinigame', 'TackleMinigame', 'KeeperMinigame', 'CrossHeaderMinigame']) {
    check(src.includes(`return ${name}`), `resolveExecutionComponent can return ${name}`)
  }
  check(src.includes("situation.includes('penalty')"), 'penalty moments are detected by situation text, not just an option\'s own keyAttributes')
  check(src.includes("situation.includes('free kick')"), 'free-kick moments are detected the same way')
}

console.log('\n[C] real content exists tagging at least one option per attribute-based minigame')
{
  const decisions = readFileSync('src/engine/matchDecisions.ts', 'utf-8')
  const scenarios = readFileSync('src/engine/matchScenarios.ts', 'utf-8')
  // P67 — real correction: matchDecisions.ts writes keyAttributes as a
  // labeled object-literal field ("keyAttributes: [...]"), but
  // matchScenarios.ts's opt() helper takes it as a bare positional
  // argument with no "keyAttributes:" label anywhere near it — confirmed
  // by reading opt()'s real signature. An earlier version of this check
  // only matched the labeled style and silently undercounted real
  // scenario coverage by roughly an order of magnitude (reported single
  // digits when the real count was in the dozens). Checking for the
  // attribute name in single-quotes anywhere in the file catches both
  // styles — the only literal strings that could collide are statTag's
  // own values ('tackle','interception','header','keyPass','save'), which
  // are distinct words from every attribute name checked here.
  for (const attr of ['shooting', 'tackling', 'dribbling', 'passing']) {
    const count = ((decisions + scenarios).match(new RegExp(`'${attr}'`, 'g')) ?? []).length
    check(count > 0, `at least one real option tags '${attr}' as a key attribute (found ${count} across single-shot + scenario content)`)
  }
}

console.log('\n[D] real penalty and free-kick content genuinely exists')
{
  const scenarios = readFileSync('src/engine/matchScenarios.ts', 'utf-8')
  check(scenarios.includes('moment-penalty-cool') && scenarios.includes('moment-penalty-pressure'), 'real penalty scenarios exist')
  check(scenarios.includes('gk-penalty'), 'a real goalkeeper-facing penalty scenario exists')
  check(scenarios.includes('moment-free-kick-edge') && scenarios.includes('moment-free-kick-wide'), 'both a central and a wide free-kick scenario exist')
}

console.log('\n[E] real tier-based parameterization (not just fixed geometry)')
{
  const matchScreen = readFileSync('src/screens/MatchScreen.tsx', 'utf-8')
  check(matchScreen.includes('tier={moment.tier}'), 'the real moment tier is threaded through to the execution component, not defaulted silently')

  // Two real directions exist, both principled: constants describing the
  // ATTACKING execution's difficulty increase with tier (a half-chance is
  // genuinely harder to convert than a clear one). Constants describing
  // how much room the DEFENDING side has decrease with tier (less room,
  // a harder save, as the attacker's chance improves from half to clear) —
  // tier always describes the attacking chance quality regardless of
  // which side is actually executing the minigame.
  const increasing = [['DribbleMinigame', 'DEFENDER_COUNT'], ['PassingMinigame', 'DEFENDER_COUNT'], ['ShootingMinigame', 'KEEPER_POSITION']] as const
  const decreasing = [['TackleMinigame', 'START_GAP'], ['KeeperMinigame', 'SHOT_PLACEMENT'], ['CrossHeaderMinigame', 'DEFENDER_GAP']] as const

  for (const [file, constName] of increasing) {
    const src = readFileSync(`src/components/${file}.tsx`, 'utf-8')
    const m = src.match(new RegExp(`${constName}[^{]*\\{\\s*clear:\\s*([\\d.]+),\\s*good:\\s*([\\d.]+),\\s*half:\\s*([\\d.]+)`))
    check(!!m, `${file} has a real ${constName} table keyed by all 3 tiers`)
    if (m) {
      const [clear, good, half] = [Number(m[1]), Number(m[2]), Number(m[3])]
      check(clear < good && good < half, `${file}'s ${constName} genuinely increases with attacking difficulty (clear ${clear} < good ${good} < half ${half})`)
    }
  }
  for (const [file, constName] of decreasing) {
    const src = readFileSync(`src/components/${file}.tsx`, 'utf-8')
    const m = src.match(new RegExp(`${constName}[^{]*\\{\\s*clear:\\s*([\\d.]+),\\s*good:\\s*([\\d.]+),\\s*half:\\s*([\\d.]+)`))
    check(!!m, `${file} has a real ${constName} table keyed by all 3 tiers`)
    if (m) {
      const [clear, good, half] = [Number(m[1]), Number(m[2]), Number(m[3])]
      check(clear > good && good > half, `${file}'s ${constName} genuinely decreases as the attacking chance improves (clear ${clear} > good ${good} > half ${half}) — less room for the defending side`)
    }
  }
}

console.log('\n[F] the interactive shootout is genuinely wired, not just present')
{
  const shootoutSrc = readFileSync('src/screens/ShootoutScreen.tsx', 'utf-8')
  check(shootoutSrc.includes('export default function ShootoutScreen'), 'ShootoutScreen.tsx exists and exports a real component')
  check(shootoutSrc.includes('ShootingMinigame'), 'the player\'s own kicks use the real ShootingMinigame, not a placeholder')

  const careerSrc = readFileSync('src/screens/Career.tsx', 'utf-8')
  check(careerSrc.includes("kind: 'shootout'"), 'Career.tsx has a real shootout mode in its state machine')
  check(!careerSrc.includes('0.5 + ((player.attributes.values as Record<string, number>).composure'), 'the old single hidden-roll formula is genuinely gone, not left dead alongside the real one')
  check(careerSrc.includes('<ShootoutScreen'), 'Career.tsx actually renders ShootoutScreen, not just imports it unused')
}

console.log('\n[G] persistent multi-team promotion/relegation is genuinely real, not the old player-only version')
{
  const leagueSrc = readFileSync('src/engine/league.ts', 'utf-8')
  const academySrc = readFileSync('src/engine/academy.ts', 'utf-8')
  check(leagueSrc.includes('div1Survivors') && leagueSrc.includes('div2Survivors') && leagueSrc.includes('div3Survivors'), 'league promotion/relegation tracks real survivors for all 3 divisions, not just the player')
  check(!leagueSrc.includes('playerStandingPos'), 'the old player-only positional check is genuinely gone from league.ts')
  check(academySrc.includes('tier1Survivors') && academySrc.includes('tier2Survivors'), 'academy promotion tracks real survivors for both tiers')
  check(academySrc.includes('tier1Relegated'), 'academy now has a real relegation rule — the old version had promotion only')
}

console.log('\n[H] every training drill category has real variety, not one drill repeated')
{
  const drillsSrc = readFileSync('src/engine/drills.ts', 'utf-8')
  const trainingSrc = readFileSync('src/engine/training.ts', 'utf-8')
  check(!trainingSrc.includes('drills.push(pool[i % pool.length])'), 'the real bug is gone — drills are no longer picked sequentially by index (was: identical fixed sequence every session, forever)')
  check(trainingSrc.includes('shuffled[i % shuffled.length]'), 'the pool is genuinely shuffled before drills are picked')

  const categories = ['finishing', "'passing-vision'", 'dribbling', "'defending-physical'", 'fitness', 'tactical', "'gk-shot-stopping'", "'gk-positioning'", "'gk-distribution'", "'gk-reactions'"]
  const matches = [...drillsSrc.matchAll(/^  ('?[\w-]+'?): \[/gm)]
  for (const cat of categories) {
    const idx = matches.findIndex((m) => m[1] === cat)
    check(idx !== -1, `${cat} exists as a real category in DRILL_POOLS`)
    if (idx !== -1) {
      const start = matches[idx].index! + matches[idx][0].length
      const end = idx + 1 < matches.length ? matches[idx + 1].index! : drillsSrc.length
      const count = (drillsSrc.slice(start, end).match(/\n\s+title:/g) ?? []).length
      check(count >= 3, `${cat} has at least 3 real drills (found ${count}) — a session (3-5 drills) can genuinely avoid repeating`)
    }
  }
}

console.log('\n[I] real overall routing coverage — most moments actually reach one of the 6 minigames, not just isolated categories')
{
  const decisions = readFileSync('src/engine/matchDecisions.ts', 'utf-8')
  const scenarios = readFileSync('src/engine/matchScenarios.ts', 'utf-8')
  const combined = decisions + scenarios
  const attrNames = 'passing|shooting|dribbling|tackling|pace|strength|stamina|agility|vision|composure|positioning|concentration|reflexes|handling|gkPositioning|distribution'
  const arrayRe = new RegExp(`\\[('(?:${attrNames})'(?:,\\s*'(?:${attrNames})')*)\\]`, 'g')
  const arrays = [...combined.matchAll(arrayRe)].map((m) => new Set(m[1].match(/'(\w+)'/g)!.map((s) => s.slice(1, -1))))
  const routes = (attrs: Set<string>) =>
    ['reflexes', 'gkPositioning', 'handling', 'distribution'].some((a) => attrs.has(a)) ||
    attrs.has('tackling') || attrs.has('dribbling') || attrs.has('shooting') ||
    (attrs.has('positioning') && ['concentration', 'strength', 'pace'].some((a) => attrs.has(a))) ||
    attrs.has('passing') || attrs.has('vision')
  const routedCount = arrays.filter(routes).length
  const pct = Math.round((routedCount / arrays.length) * 100)
  // P70 — real regression bar: Joel reported still seeing the old generic
  // bar constantly; measuring found only 41% real coverage before this
  // fix. Locking in a floor well above that so this can't silently drift
  // back down as new content gets added without matching routing.
  check(arrays.length > 150, `found a real, substantial number of tagged options to check (${arrays.length})`)
  check(pct >= 80, `at least 80% of all real options route to one of the 6 minigames (currently ${pct}%, was 41% before this fix)`)
}

console.log(fails === 0 ? '\n✅ AUDIT 20 PASSED' : `\n❌ AUDIT 20: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
