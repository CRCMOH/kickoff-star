interface Props { onBack: () => void }

export default function CreditsScreen({ onBack }: Props) {
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

        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-[0.24em] text-ks-gold">Every legend started somewhere</div>
          <h1 className="text-4xl font-black mt-2">Credits</h1>
          <p className="text-ks-muted mt-2">Kickoff Star is an independent football career simulator built around the journey before the fame.</p>
        </div>

        <section className="mt-8 rounded-2xl border border-ks-border bg-white/[0.025] p-5">
          <div className="text-xs uppercase tracking-widest text-ks-muted">Created by</div>
          <div className="text-2xl font-black mt-2 text-ks-gold">Vraxis</div>
          <p className="text-sm text-ks-muted mt-3 leading-relaxed">Design, development, balancing and the football world of Kickoff Star.</p>
        </section>

        <section className="mt-4 rounded-2xl border border-ks-border bg-white/[0.025] p-5">
          <div className="text-xs uppercase tracking-widest text-ks-muted">Special thanks</div>
          <p className="text-sm mt-3 leading-relaxed">To the players who test early builds, report bugs, question unfair systems and help make every update better.</p>
        </section>

        <div className="mt-8 text-center text-xs text-ks-muted">Kickoff Star · V3.1</div>
      </div>
    </main>
  )
}
