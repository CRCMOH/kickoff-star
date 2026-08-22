import type { Player } from '../types/player'
import {
  ACHIEVEMENTS, TIER_COLOR, CATEGORY_LABEL,
  type AchievementCategory,
} from '../engine/achievements'
import { Panel } from './ui'

// Phase 16: the trophy cabinet. Locked achievements stay visible (so there's
// something to aim at), except hidden ones, which show as ??? until earned.

export default function AchievementList({ player }: { player: Player }) {
  const unlocked = new Set(player.achievements ?? [])
  const categories = [...new Set(ACHIEVEMENTS.map((a) => a.category))] as AchievementCategory[]
  const total = ACHIEVEMENTS.length

  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-3">
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-display tracking-widest text-[10px] text-ks-muted uppercase">unlocked</span>
          <span className="font-display text-ks-gold text-lg">
            {unlocked.size}<span className="text-ks-muted text-xs"> / {total}</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#2a2a27] overflow-hidden">
          <div className="h-full rounded-full bg-ks-gold transition-[width] duration-700"
            style={{ width: `${(unlocked.size / total) * 100}%` }} />
        </div>
      </div>

      {categories.map((cat) => {
        const items = ACHIEVEMENTS.filter((a) => a.category === cat)
        const got = items.filter((a) => unlocked.has(a.key)).length
        return (
          <Panel key={cat} title={`${CATEGORY_LABEL[cat]} — ${got}/${items.length}`}>
            <div className="flex flex-col gap-2">
              {items.map((a) => {
                const has = unlocked.has(a.key)
                const masked = a.hidden && !has
                return (
                  <div key={a.key} className={`flex items-start gap-2.5 ${has ? '' : 'opacity-45'}`}>
                    <span className={`text-sm leading-none mt-0.5 ${has ? TIER_COLOR[a.tier] : 'text-ks-muted'}`}>
                      {has ? '★' : '☆'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] leading-tight ${has ? TIER_COLOR[a.tier] : 'text-ks-ink'}`}>
                        {masked ? '???' : a.title}
                      </div>
                      <div className="text-[10px] text-ks-muted leading-snug">
                        {masked ? 'Hidden achievement' : a.description}
                      </div>
                    </div>
                    <span className="text-[8px] text-ks-muted uppercase tracking-wider mt-1">{a.tier}</span>
                  </div>
                )
              })}
            </div>
          </Panel>
        )
      })}
    </div>
  )
}
