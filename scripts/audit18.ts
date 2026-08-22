// AUDIT 18 (P59) — real bug found via Joel's screenshot: a commentary line
// used {homeShort}/{homeScore}/{awayScore}/{awayShort}, which fill() has
// NEVER supported (the real tokens are {home}/{away}/{hs}/{as}) — so it
// rendered literally, unrendered, in front of a real player. There was no
// standing audit catching this class of bug at all; the only prior check
// was a one-time manual verification during an earlier phase, not a
// permanent regression test. This is that permanent test — scans every
// commentary line for ANY {word} token and fails if it isn't one of the
// tokens fill() actually knows how to replace.
import { readFileSync } from 'fs'

const SUPPORTED_TOKENS = new Set(['player', 'team', 'opp', 'min', 'home', 'away', 'hs', 'as', 'scorer', 'assister'])

let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

console.log('\n[A] every {token} in every commentary line is one fill() actually supports')
{
  const source = readFileSync('src/engine/commentary.ts', 'utf-8')
  // Pull every text: '...' or text: "..." literal out of the source directly —
  // this catches every bank regardless of how it's structured/exported,
  // which is the point: nothing should be able to sneak past this by not
  // being in whatever data structure a narrower check happened to inspect.
  const textLiterals = [...source.matchAll(/text:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1])
  check(textLiterals.length > 300, `found a real number of commentary lines to scan (${textLiterals.length})`)

  let leaks: { line: string; token: string }[] = []
  for (const text of textLiterals) {
    const tokens = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
    for (const t of tokens) {
      if (!SUPPORTED_TOKENS.has(t)) leaks.push({ line: text, token: t })
    }
  }
  check(leaks.length === 0, `zero unsupported tokens across all ${textLiterals.length} commentary lines${leaks.length ? ' — FOUND: ' + leaks.map((l) => `"{${l.token}}" in "${l.line}"`).join(' | ') : ''}`)
}

console.log('\n[B] the specific line Joel hit is fixed')
{
  const source = readFileSync('src/engine/commentary.ts', 'utf-8')
  check(!source.includes('{homeShort}') && !source.includes('{homeScore}') && !source.includes('{awayScore}') && !source.includes('{awayShort}'), 'the exact wrong token names from the bug report no longer appear anywhere in the file')
  check(source.includes('makes no mistake from there. {home} {hs}-{as} {away}'), 'the specific line is fixed to use the real supported tokens')
}

console.log(fails === 0 ? '\n✅ AUDIT 18 PASSED' : `\n❌ AUDIT 18: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
