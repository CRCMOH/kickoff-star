import { useEffect, useState } from 'react'

// P47 — Joel: "people need to see the numbers move, not just a green bar."
// A simple count-up from one value to another over a short duration —
// used anywhere a stat changes and the change itself should be felt.
export default function AnimatedNumber({ from, to, duration = 900, decimals = 0 }: {
  from: number
  to: number
  duration?: number
  decimals?: number
}) {
  const [value, setValue] = useState(from)

  useEffect(() => {
    let raf: number
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out cubic — fast start, settles gently rather than ticking linearly
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setValue(to)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, duration])

  return <>{value.toFixed(decimals)}</>
}
