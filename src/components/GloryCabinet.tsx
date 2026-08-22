import { useState } from 'react'
import type { Player } from '../types/player'
import {
  PERSONAL_GLORY_LABEL, CLUB_GLORY_LABEL, NATIONAL_GLORY_LABEL, totalGlory,
  type PersonalGloryKey, type ClubGloryKey, type NationalGloryKey,
} from '../engine/glory'
import { EmptyNote } from './ui'

// P36 — the trophy cabinet from the reference screenshots. Split into three
// groups the same way the reference did (Personal / Club / National), each a
// simple list of what's been won and how many times. Unlike achievements
// (career milestones you tick off once), a Glory entry can repeat — winning
// the league twice shows as x2.

type Tab = 'personal' | 'club' | 'national'

function TrophyRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ks-border bg-[#14140f] px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="text-lg leading-none">🏆</span>
        <span className="text-[11px] text-ks-ink">{label}</span>
      </div>
      <span className="font-display text-ks-gold text-sm">×{count}</span>
    </div>
  )
}

export default function GloryCabinet({ player }: { player: Player }) {
  const [tab, setTab] = useState<Tab>('personal')

  const personal = Object.entries(player.personalGlory ?? {}) as [PersonalGloryKey, number][]
  const club = Object.entries(player.clubGlory ?? {}) as [ClubGloryKey, number][]
  const national = Object.entries(player.nationalGlory ?? {}) as [NationalGloryKey, number][]

  const rows = tab === 'personal' ? personal.map(([k, v]) => ({ label: PERSONAL_GLORY_LABEL[k], count: v }))
    : tab === 'club' ? club.map(([k, v]) => ({ label: CLUB_GLORY_LABEL[k], count: v }))
    : national.map(([k, v]) => ({ label: NATIONAL_GLORY_LABEL[k], count: v }))

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-ks-muted uppercase tracking-wider">career total</span>
        <span className="font-display text-ks-gold text-sm">{totalGlory(player)} trophies</span>
      </div>

      <div className="flex gap-1.5 p-1 rounded-xl bg-[#0f0f0d] border border-ks-border">
        {(['personal', 'club', 'national'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 font-display tracking-widest text-[9px] uppercase transition-all ${
              tab === t ? 'bg-ks-gold text-ks-black' : 'text-ks-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyNote>
          {tab === 'personal' && 'No individual honours yet — a strong, substantial season is how these are earned.'}
          {tab === 'club' && "No team silverware yet — win the league or a cup with your side."}
          {tab === 'national' && "No international silverware — get called up and go all the way."}
        </EmptyNote>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => <TrophyRow key={r.label} label={r.label} count={r.count} />)}
        </div>
      )}
    </div>
  )
}
