// P54 — Joel: "add like 3 social media thingys, people's opinion on the
// game." Not literal social media (nothing here claims to be Twitter/X),
// but the same idea — quick reaction lines that make the post-match screen
// feel like the match actually MEANT something to people watching, not just
// a private stat sheet. Three reactions, three genuinely different angles,
// so they don't just repeat each other:
//   1. PERFORMANCE — how the player personally did (rating-driven)
//   2. RESULT — how the team did (win/draw/loss-driven)
//   3. MOMENTUM — the longer arc (driven by the real fan-standing delta
//      ImpactReveal already computes, not a 4th made-up number)

interface ReactionInput {
  playerName: string
  rating: number
  goals: number
  assists: number
  won: boolean
  drew: boolean
  fansDelta: number
}

interface Reaction {
  handle: string
  text: string
}

function performanceReaction(r: ReactionInput): Reaction {
  const { playerName: n, rating, goals, assists } = r
  if (rating >= 8.3) {
    if (goals >= 2) return { handle: '@matchdaywatch', text: `${n} on another level today. That performance was something else.` }
    return { handle: '@matchdaywatch', text: `${n} was head and shoulders above everyone else out there.` }
  }
  if (rating >= 7) {
    if (goals > 0 && assists > 0) return { handle: '@grassroots_scout', text: `Goal AND an assist from ${n}. Genuinely involved in everything good today.` }
    if (goals > 0) return { handle: '@grassroots_scout', text: `${n} showed up when it mattered. Clean finish.` }
    return { handle: '@grassroots_scout', text: `Solid, dependable game from ${n} — the kind that doesn't always get noticed.` }
  }
  if (rating >= 5.5) return { handle: '@localfootyfan', text: `${n} had a quiet one today. Not much to shout about either way.` }
  return { handle: '@localfootyfan', text: `Rough afternoon for ${n}. Everyone has one of those.` }
}

function resultReaction(r: ReactionInput): Reaction {
  if (r.won) return { handle: '@clubultras', text: `Three points! That's exactly the response we needed.` }
  if (r.drew) return { handle: '@clubultras', text: `A point's a point. Take it and move on to next week.` }
  return { handle: '@clubultras', text: `Not the result we wanted. Back to work on the training pitch.` }
}

function momentumReaction(r: ReactionInput): Reaction {
  if (r.fansDelta > 1.5) return { handle: '@terrace_talk', text: `Feels like the fans are really starting to warm to ${r.playerName}.` }
  if (r.fansDelta > 0) return { handle: '@terrace_talk', text: `Slowly but surely, ${r.playerName} is winning people over.` }
  if (r.fansDelta < -1) return { handle: '@terrace_talk', text: `Patience wearing a bit thin with ${r.playerName} among some fans.` }
  return { handle: '@terrace_talk', text: `Steady as she goes for ${r.playerName} in the eyes of the fans.` }
}

export default function FanReactions(input: ReactionInput) {
  const reactions = [performanceReaction(input), resultReaction(input), momentumReaction(input)]
  return (
    <div className="flex flex-col gap-2">
      {reactions.map((r, i) => (
        <div key={i} className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3">
          <div className="text-ks-gold text-[11px] font-display tracking-wide mb-1">{r.handle}</div>
          <p className="text-ks-ink text-[13px] leading-relaxed">{r.text}</p>
        </div>
      ))}
    </div>
  )
}
