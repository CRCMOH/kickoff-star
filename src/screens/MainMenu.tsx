import { useEffect, useState } from 'react'
import { listSaves } from '../engine/save'

interface MainMenuProps {
  onNewCareer: () => void
  onContinue: () => void
  onLoadCareer: () => void
}

const MENU_ITEMS = (hasSave: boolean) => [
  { icon: '★', label: 'New Career', sub: 'Start your journey', action: 'new' as const },
  { icon: '↻', label: 'Continue', sub: 'Continue your saved career', action: 'continue' as const, disabled: !hasSave },
  { icon: '⛁', label: 'Load Career', sub: 'Load a previously saved career', action: 'load' as const, disabled: !hasSave },
  { icon: '⚙', label: 'Settings', sub: 'Game settings and preferences', action: 'settings' as const },
  { icon: '◈', label: 'Credits', sub: 'Meet the team', action: 'credits' as const },
]

export default function MainMenu({ onNewCareer, onContinue, onLoadCareer }: MainMenuProps) {
  const [hasSave, setHasSave] = useState(false)

  useEffect(() => {
    listSaves().then((saves) => setHasSave(saves.some((s) => s)))
  }, [])

  const handleClick = (action: string) => {
    if (action === 'new') onNewCareer()
    if (action === 'continue') onContinue()
    if (action === 'load') onLoadCareer()
  }

  return (
    <div className="relative min-h-screen w-full bg-ks-black">
      {/* P46 — the old hero.png/logo.png here were leftover stock placeholders
          from before the game was renamed to Kickoff Star — they still had
          "FOOTBALL STAR" branding baked into their actual pixels, visible on
          the real live menu. No image-generation available to redraw them
          properly, so replaced with real text in the same gold/black brand
          already proven on the itch.io cover art, which also kills the
          hardcoded absolute '/assets/...' path (a real itch.io bug of its
          own — those paths aren't touched by Vite's base config since
          they're raw runtime strings, not assets Vite's bundler processes).
          The CSS atmosphere layer below was already good — it's the actual
          background now, not a fallback for a missing photo. */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 40% 60% at 70% 20%, rgba(212,175,55,0.12), transparent 60%),
          radial-gradient(ellipse 50% 40% at 75% 90%, rgba(120,140,180,0.08), transparent 55%),
          linear-gradient(105deg, #050504 0%, #0a0a09 40%, #0d0d0b 70%, #050504 100%)
        `,
      }} />
      {/* perspective floor lines for tunnel depth */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: 'repeating-linear-gradient(100deg, transparent 0 60px, rgba(255,255,255,0.5) 60px 61px)',
      }} />
      {/* left-to-transparent scrim so text is readable */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 35%, rgba(0,0,0,0.25) 65%, transparent 100%)',
      }} />
      {/* vignette */}
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 200px 60px rgba(0,0,0,0.8)' }} />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col justify-between px-6 md:px-16 py-10 max-w-2xl">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-ks-muted uppercase mb-5">the journey starts here</div>
          <div style={{ filter: 'drop-shadow(0 0 30px rgba(212,175,55,0.3))' }} className="mb-5">
            <div className="font-display font-black text-5xl md:text-6xl tracking-wide leading-none text-ks-gold">KICKOFF</div>
            <div className="font-display font-black text-5xl md:text-6xl tracking-wide leading-none text-ks-ink">STAR</div>
          </div>
          <div className="text-[11px] text-ks-muted uppercase tracking-[0.15em]">
            from school football to a pro contract
          </div>
        </div>

        <div className="flex flex-col gap-2.5 my-8 max-w-md">
          {MENU_ITEMS(hasSave).map((item) =>
            item.action === 'new' ? (
              <button
                key={item.label}
                onClick={() => handleClick(item.action)}
                className="group text-left rounded-xl px-5 py-3.5 bg-ks-gold text-ks-black flex items-center gap-4 shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] transition-shadow"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="flex flex-col">
                  <span className="font-display tracking-wide text-base leading-tight">{item.label}</span>
                  <span className="text-[11px] opacity-70">{item.sub}</span>
                </span>
              </button>
            ) : (
              <button
                key={item.label}
                onClick={() => handleClick(item.action)}
                disabled={item.disabled}
                className="group text-left rounded-xl px-5 py-3 flex items-center gap-4 text-ks-ink border border-transparent hover:border-ks-border hover:bg-white/[0.03] disabled:opacity-25 disabled:hover:border-transparent disabled:hover:bg-transparent transition-colors"
              >
                <span className="text-ks-muted text-lg w-5 group-hover:text-ks-gold transition-colors">{item.icon}</span>
                <span className="flex flex-col">
                  <span className="font-display tracking-wide text-base leading-tight">{item.label}</span>
                  <span className="text-[11px] text-ks-muted">{item.sub}</span>
                </span>
              </button>
            )
          )}
        </div>

        <div>
          <div className="max-w-xs mb-8">
            <span className="text-ks-gold text-3xl leading-none align-top">&ldquo;</span>
            <span className="text-ks-ink text-base italic leading-snug ml-1">
              Every legend started somewhere.
            </span>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-ks-border/40 max-w-md">
            <div className="flex gap-4 text-ks-muted text-base">
              <span className="hover:text-ks-gold transition-colors cursor-pointer">◔</span>
              <span className="hover:text-ks-gold transition-colors cursor-pointer">◑</span>
              <span className="hover:text-ks-gold transition-colors cursor-pointer">✦</span>
              <span className="hover:text-ks-gold transition-colors cursor-pointer">▶</span>
            </div>
            <span className="text-ks-muted text-[10px] tracking-wider">v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
