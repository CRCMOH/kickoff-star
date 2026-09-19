import { competitionDefinition } from '../../engine/competitionCareer'
import { useState } from 'react'
import type { Division, LeagueWorld } from '../../engine/league'
import type { AcademyWorld } from '../../engine/academy'
import type { CupWorlds } from '../../engine/save'
import FixturesTab from './FixturesTab'
import TableTab from './TableTab'
import CompetitionHub from './CompetitionHub'
import { useCareerStore } from '../../store/careerStore'

// P29: fixtures and the table were separate nav tabs, which pushed the bottom
// bar to seven items and wrapped it onto two rows. They answer the same
// question ("where are we in this competition"), so they're one tab now with a
// segmented control.
export default function LeagueTab({ division, playerTeamId, cups, world, isAcademy, initialView }: {
  division: Division
  playerTeamId: string
  cups?: CupWorlds
  world: LeagueWorld | AcademyWorld
  isAcademy: boolean
  initialView?: 'fixtures' | 'table'
}) {
  const player = useCareerStore((s) => s.player)
  const [view, setView] = useState<'hub' | 'fixtures' | 'table' | 'stats'>(initialView ?? 'hub')

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5 p-1 rounded-xl bg-[#0f0f0d] border border-ks-border">
        {(['hub', 'fixtures', 'table', 'stats'] as const).map((v) => (
          <button
            key={v === 'hub' ? 'Overview' : v === 'table' ? 'Standings' : v === 'stats' ? 'Stats' : 'Fixtures'}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg py-2 font-display tracking-widest text-[10px] uppercase transition-all ${
              view === v ? 'bg-ks-gold text-ks-black shadow-[0_2px_10px_rgba(212,175,55,0.3)]' : 'text-ks-muted'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'stats' ? <section><div className="editorial-heading"><h2>Your competition record</h2></div>
        {Object.values(player?.competitionCareer?.current ?? {}).filter(s=>s.appearances>0).length === 0 && <p className="quiet-note">Play your first competitive match to start your record.</p>}
        {Object.values(player?.competitionCareer?.current ?? {}).filter(s=>s.appearances>0).map(s=><div key={s.competitionId} className="competition-stat-row"><h3>{competitionDefinition(s.competitionId).name}</h3><dl>{[['Apps',s.appearances],['Goals',s.goals],['Assists',s.assists],['Rating',s.averageRating.toFixed(1)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>)}
      </section> : view === 'hub' && player
        ? <CompetitionHub player={player} division={division} playerTeamId={playerTeamId} cups={cups} />
        : view === 'fixtures'
        ? <FixturesTab division={division} playerTeamId={playerTeamId} cups={cups} />
        : <TableTab world={world} playerTeamId={playerTeamId} isAcademy={isAcademy} />}
    </div>
  )
}
