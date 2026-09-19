import { useState } from 'react'
import type { Division, LeagueWorld } from '../../engine/league'
import type { AcademyWorld } from '../../engine/academy'
import type { CupWorlds } from '../../engine/save'
import type { YouthWorld } from '../../types/youthWorld'
import FixturesTab from './FixturesTab'
import TableTab from './TableTab'
import YouthLeagueTab from './YouthLeagueTab'

export default function LeagueTab({ division, playerTeamId, cups, world, isAcademy, youthWorld, initialView }: {
  division: Division
  playerTeamId: string
  cups?: CupWorlds
  world: LeagueWorld | AcademyWorld
  isAcademy: boolean
  youthWorld?: YouthWorld | null
  initialView?: 'fixtures' | 'table'
}) {
  const [view,setView]=useState<'fixtures'|'table'>(initialView??'fixtures')
  if(!isAcademy&&youthWorld&&(youthWorld.pathway.route==='school'||youthWorld.pathway.route==='grassroots')){
    return <YouthLeagueTab youthWorld={youthWorld} initialView={view}/>
  }
  return <div className="flex flex-col gap-2.5">
    <div className="flex gap-1.5 p-1 rounded-xl bg-[#0f0f0d] border border-ks-border">
      {(['fixtures','table'] as const).map(v=><button key={v} onClick={()=>setView(v)} className={`flex-1 rounded-lg py-2 font-display tracking-widest text-[10px] uppercase transition-all ${view===v?'bg-ks-gold text-ks-black shadow-[0_2px_10px_rgba(212,175,55,0.3)]':'text-ks-muted'}`}>{v}</button>)}
    </div>
    {view==='fixtures'?<FixturesTab division={division} playerTeamId={playerTeamId} cups={cups}/>:<TableTab world={world} playerTeamId={playerTeamId} isAcademy={isAcademy}/>}
  </div>
}
