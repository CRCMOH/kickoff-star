import { useEffect, useState } from 'react'

interface Props { onBack: () => void }

const REDUCED_MOTION_KEY = 'kickoff-star-reduced-motion'

export default function SettingsScreen({ onBack }: Props) {
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem(REDUCED_MOTION_KEY) === '1')

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion)
    localStorage.setItem(REDUCED_MOTION_KEY, reducedMotion ? '1' : '0')
  }, [reducedMotion])

  return (
    <main className="min-h-screen bg-ks-black text-ks-ink px-5 py-6">
      <div className="max-w-xl mx-auto">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to main menu"
          className="min-h-12 min-w-12 px-4 rounded-xl border border-ks-border bg-white/[0.03] text-ks-ink font-semibold active:scale-[0.98]"
        >
          ← Back
        </button>

        <div className="mt-8 mb-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-ks-gold">Kickoff Star</div>
          <h1 className="text-4xl font-black mt-2">Settings</h1>
          <p className="text-ks-muted mt-2">Tune the game for your device and play style.</p>
        </div>

        <section className="rounded-2xl border border-ks-border bg-white/[0.025] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold">Reduced motion</h2>
              <p className="text-sm text-ks-muted mt-1">Minimises menu and match animations. Useful on slower phones or if motion is distracting.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reducedMotion}
              onClick={() => setReducedMotion((v) => !v)}
              className={`min-w-16 min-h-11 rounded-full border px-2 font-bold ${reducedMotion ? 'bg-ks-gold text-ks-black border-ks-gold' : 'border-ks-border text-ks-muted'}`}
            >
              {reducedMotion ? 'ON' : 'OFF'}
            </button>
          </div>
        </section>

        <p className="text-xs text-ks-muted mt-6 leading-relaxed">Your career saves remain stored locally on this device. Settings are also saved locally.</p>
      </div>
    </main>
  )
}
