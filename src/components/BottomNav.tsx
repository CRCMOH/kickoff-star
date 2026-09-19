// Phase 10: the bottom nav became real (was six static divs with no routing).
// Phase 29: restyled for game feel. A 7th tab had pushed it onto two rows and
// it read as a settings menu rather than a game HUD — now six tabs on one row,
// with the active tab lifting on a gold pill, an animated indicator bar, and
// chunkier icons.

import { NAV_ITEMS, type HubTab } from './navItems'

export default function BottomNav({ active, onSelect, badges }: {
  active: HubTab
  onSelect: (tab: HubTab) => void
  badges?: Partial<Record<HubTab, number>>
}) {
  // 'scouts' and 'table' are routable destinations that live inside another
  // tab's screen — light up the tab that actually renders them.
  const activeTab: HubTab = active === 'scouts' ? 'player' : active === 'table' ? 'fixtures' : active

  return (
    <div
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto w-full z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* fade so content scrolls out under the bar rather than hitting a hard edge */}
      <div className="h-4 bg-gradient-to-t from-[#0a0a09] to-transparent pointer-events-none" />
      <div className="border-t border-ks-border/80 bg-[#0c0c0a]/95 backdrop-blur-sm px-1.5 pt-1.5 pb-1.5">
        <div className="grid grid-cols-6 gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.tab === activeTab
            const badge = badges?.[item.tab] ?? 0
            return (
              <button
                key={item.tab}
                onClick={() => onSelect(item.tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 pt-1.5 pb-1 rounded-xl transition-all duration-200 active:scale-90 ${
                  isActive
                    ? 'text-ks-gold bg-gradient-to-b from-ks-gold/20 to-ks-gold/5 -translate-y-0.5 shadow-[0_-2px_14px_rgba(212,175,55,0.18)]'
                    : 'text-ks-muted/70 hover:text-ks-muted'
                }`}
              >
                <span
                  key={isActive ? 'on' : 'off'}
                  className={`text-base leading-none ${isActive ? 'animate-[tabpop_0.25s_ease-out] drop-shadow-[0_0_6px_rgba(212,175,55,0.5)]' : ''}`}
                >
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={{
home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
player:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
people:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 7M19 14q3 1 3 7',
club:'M12 2 3 6v6q0 7 9 10 9-3 9-10V6zM8 11h8M12 7v10',
fixtures:'M7 3h10v7a5 5 0 0 1-10 0zM7 5H3v3q0 4 4 4M17 5h4v3q0 4-4 4M12 15v5M8 21h8',
shop:'M3 7h18l-2 14H5zM8 7V5a4 4 0 0 1 8 0v2',
table:'',scouts:''
}[item.tab]}/></svg>
                </span>
                <span className={`text-[8px] tracking-wide ${isActive ? 'font-display' : ''}`}>{item.label}</span>

                {/* active indicator */}
                <span
                  className={`absolute -bottom-0.5 h-0.5 rounded-full bg-ks-gold transition-all duration-200 ${
                    isActive ? 'w-5 opacity-100' : 'w-0 opacity-0'
                  }`}
                />

                {badge > 0 && (
                  <span className="absolute top-0.5 right-1.5 min-w-3.5 h-3.5 px-1 rounded-full bg-red-500 text-white text-[7px] font-display flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
