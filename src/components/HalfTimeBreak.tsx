// P47 — Joel: "there needs to be a pause at half time, then you get coach
// advice, then press continue for the second half." Half-time used to be a
// single feed line at the same visual weight as everything else — the match
// just kept ticking through it. This is a genuine break: the clock stops,
// you see where things stand, the coach reacts to how YOU are actually
// playing (not generic flavor — driven by your real mid-match rating and
// your real relationship with him), then you choose to go again.

interface HalfTimeBreakProps {
  homeShort: string
  awayShort: string
  homeScore: number
  awayScore: number
  playerRating: number
  coachTrust: number
  onContinue: () => void
}

function coachReaction(rating: number, coachTrust: number): { line: string; tone: 'good' | 'neutral' | 'hard' } {
  const warm = coachTrust > 3
  const cold = coachTrust < -3
  if (rating >= 7.3) {
    return { tone: 'good', line: warm ? "\"That's exactly what I want to see. Keep going.\"" : "\"Good half. Don't get complacent.\"" }
  }
  if (rating <= 5.6) {
    return { tone: 'hard', line: cold ? "\"I don't know what that was. Sort it out, second half.\"" : "\"Not good enough. I know you can do better than that.\"" }
  }
  return { tone: 'neutral', line: warm ? "\"Solid enough. A bit more from you and we're laughing.\"" : "\"It's even. Give me more in the second half.\"" }
}

export default function HalfTimeBreak({ homeShort, awayShort, homeScore, awayScore, playerRating, coachTrust, onContinue }: HalfTimeBreakProps) {
  const reaction = coachReaction(playerRating, coachTrust)
  const toneColor = reaction.tone === 'good' ? 'text-green-500' : reaction.tone === 'hard' ? 'text-red-400' : 'text-ks-gold'

  return (
    <div className="fixed inset-0 z-[70] bg-ks-black flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(212,175,55,0.08), transparent 60%)' }} />
      <div className="relative z-10 max-w-md w-full text-center">
        <div className="font-display tracking-[0.3em] text-[11px] text-ks-muted uppercase mb-3">half time</div>

        <div className="flex items-center justify-center gap-4 mb-8">
          <span className="font-display text-ks-ink text-lg tracking-wide">{homeShort}</span>
          <span className="font-display text-4xl tracking-widest text-ks-gold">{homeScore}–{awayScore}</span>
          <span className="font-display text-ks-ink text-lg tracking-wide">{awayShort}</span>
        </div>

        <div className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-5 mb-8 text-left">
          <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-2">the coach</div>
          <p className={`text-sm leading-relaxed italic ${toneColor}`}>{reaction.line}</p>
          <div className="text-[11px] text-ks-muted mt-3 pt-3 border-t border-ks-border/50">your rating so far: <span className="text-ks-ink font-display">{playerRating.toFixed(1)}</span></div>
        </div>

        <button onClick={onContinue} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]">
          begin second half →
        </button>
      </div>
    </div>
  )
}
