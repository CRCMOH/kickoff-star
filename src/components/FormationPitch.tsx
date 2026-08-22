// P60 — Joel: make the match screen look like the reference — dots on a
// pitch, shifting toward whichever end is "attacking." Explicitly NOT tied
// to literal per-player tracking — the match engine doesn't simulate exact
// positions, and shouldn't need to just for this. This reads the real
// `momentum` value the engine already tracks (-10 opponent .. +10 player
// team) and uses it purely as an ambient "who's on top right now" signal —
// the whole formation drifts toward the attacking third as momentum swings,
// individual dots keep a fixed relative shape (a simple back-4/mid-3/front-3
// block) rather than simulating real movement.

const FORMATION_SHAPE = [
  // GK
  [{ x: 50, y: 6 }],
  // back 4
  [{ x: 18, y: 20 }, { x: 38, y: 18 }, { x: 62, y: 18 }, { x: 82, y: 20 }],
  // mid 3
  [{ x: 28, y: 36 }, { x: 50, y: 34 }, { x: 72, y: 36 }],
  // front 3
  [{ x: 25, y: 50 }, { x: 50, y: 52 }, { x: 75, y: 50 }],
]
const FLAT_SHAPE = FORMATION_SHAPE.flat()

export default function FormationPitch({ momentum, homeColor, awayColor, playerIsHome }: {
  momentum: number
  homeColor: string
  awayColor: string
  playerIsHome: boolean
}) {
  // P63 — real bug report: "the dots never move." The wiring to the real
  // momentum value was already correct — the problem was the shift itself
  // being too subtle to register (max ±14% of pitch height) combined with
  // a full 1s transition, so it read as static even when it was technically
  // updating. Widened the range and added a slow continuous idle drift via
  // CSS animation so the pitch never looks frozen even during a genuinely
  // flat, neutral stretch of the match — momentum swings layer on top of
  // that baseline motion rather than being the only thing moving at all.
  const playerShift = Math.max(-26, Math.min(26, momentum * 2.6))
  const homeShift = playerIsHome ? playerShift : -playerShift
  const awayShift = playerIsHome ? -playerShift : playerShift

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-ks-border" style={{ aspectRatio: '3/2', background: 'linear-gradient(180deg,#0f2818,#0a1f11)' }}>
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 66" preserveAspectRatio="none">
        <rect x="1" y="1" width="98" height="64" fill="none" stroke="#fff" strokeWidth="0.4" />
        <line x1="1" y1="33" x2="99" y2="33" stroke="#fff" strokeWidth="0.4" />
        <circle cx="50" cy="33" r="8" fill="none" stroke="#fff" strokeWidth="0.4" />
      </svg>
      {/* away team — mirrored to attack downward, retreats toward y=66 */}
      {FLAT_SHAPE.map((p, i) => (
        <div
          key={`away-${i}`}
          className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 transition-[top] duration-700 ease-out"
          style={{
            left: `${p.x}%`, top: `${66 - p.y + awayShift}%`, background: awayColor, boxShadow: '0 0 4px rgba(0,0,0,0.6)',
            animation: `pitchDrift ${3.5 + (i % 4) * 0.6}s ease-in-out ${(i % 5) * 0.3}s infinite`,
          }}
        />
      ))}
      {/* home team — attacks upward toward y=0 */}
      {FLAT_SHAPE.map((p, i) => (
        <div
          key={`home-${i}`}
          className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 transition-[top] duration-700 ease-out"
          style={{
            left: `${p.x}%`, top: `${p.y + homeShift}%`, background: homeColor, boxShadow: '0 0 4px rgba(0,0,0,0.6)',
            animation: `pitchDrift ${3.5 + (i % 4) * 0.6}s ease-in-out ${(i % 3) * 0.4}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
