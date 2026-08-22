import { Component, type ReactNode } from 'react'

// Audit fix: a single render crash used to leave a silent black screen — on a
// phone, with a live save, that's indistinguishable from a bricked game. The
// boundary shows a recoverable error card instead. Saves live in IndexedDB
// and every action autosaves, so a reload never loses meaningful progress.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[kickoff-star] render crash:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-ks-black flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="font-display tracking-widest text-[11px] text-ks-muted uppercase mb-3">something went wrong</div>
          <p className="text-sm text-ks-ink mb-2">The game hit an unexpected error.</p>
          <p className="text-xs text-ks-muted mb-6">Your career is safe — progress autosaves after every action.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-ks-gold text-ks-black font-display tracking-widest rounded-xl px-8 py-3 text-sm uppercase"
          >
            reload game
          </button>
        </div>
      </div>
    )
  }
}
