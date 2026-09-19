import type { Player } from '../../types/player'
import type { CalendarState } from '../../types/calendar'
import type { YouthWorld } from '../../types/youthWorld'
import type { InternationalWorld } from '../../engine/international'
import { getNation } from '../../engine/nations'
import { internationalCalendarV5 } from '../../engine/youthInternationalV5'
import { Panel } from '../../components/ui'

function Badge({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-ks-border/70 bg-black/25 px-3 py-2"><div className="text-[8px] uppercase tracking-[.18em] text-ks-muted">{label}</div><div className="font-display text-[12px] text-ks-ink mt-1">{value}</div></div>}
export default function WorldTab({player,calendar,youthWorld,international}:{player:Player;calendar:CalendarState;youthWorld:YouthWorld|null;international:InternationalWorld|null}){
 const nation=getNation(player.nationality),pathway=youthWorld?.pathway
 const nextIntl=internationalCalendarV5().find(x=>x.week>=calendar.currentWeek.weekNumber)
 const school=youthWorld?.schools.find(s=>s.id===youthWorld.selectedSchoolId)
 const sunday=youthWorld?.sundayClubs.find(c=>c.id===pathway?.sundayClubId)
 const intlStage=international?.stage??'not called up',history=[...(pathway?.history??[])].slice(-5).reverse()
 return <div className="flex flex-col gap-2.5">
  <section className="career-hero"><div className="career-hero-glow"/><div className="career-hero-top"><span>YOUTH WORLD</span><b>{nation.flag} {nation.short}</b></div><h2 className="font-display text-xl text-ks-ink mt-2">YOUR PATHWAY</h2><p className="text-[10px] text-ks-muted mt-1">School → representative football → academy → professional contract.</p></section>
  <div className="grid grid-cols-2 gap-2"><Badge label="Route" value={pathway?.route??player.careerClock.phase}/><Badge label="School squad" value={pathway?.schoolTier??'—'}/><Badge label="Representative" value={pathway?.representative?.replaceAll('-',' ')??'none'}/><Badge label="Academy" value={pathway?.academyStatus?.replaceAll('-',' ')??'none'}/></div>
  <Panel title="season calendar"><div className="flex flex-col gap-2">
   <div className="text-[10px] text-ks-ink">Week {calendar.currentWeek.weekNumber} · {school?.name??'School pathway'}{sunday?' + '+sunday.name:''}</div>
   {nextIntl&&<div className="rounded-lg border border-ks-gold/30 p-2"><div className="text-[9px] text-ks-gold uppercase tracking-wider">next international window</div><div className="text-[11px] text-ks-ink mt-1">Week {nextIntl.week} · {nextIntl.label}</div></div>}
   <div className="grid grid-cols-4 gap-1">{[8,16,24,32,37,40,43].map(w=><div key={w} className={'text-center rounded-md border py-1.5 text-[9px] '+(calendar.currentWeek.weekNumber===w?'border-ks-gold text-ks-gold':'border-ks-border text-ks-muted')}>W{w}</div>)}</div>
  </div></Panel>
  <Panel title={nation.flag+' international pathway'}><div className="flex flex-col gap-2"><div className="flex justify-between text-[10px]"><span className="text-ks-muted">Status</span><b className="text-ks-ink uppercase">{intlStage.replaceAll('-',' ')}</b></div><p className="text-[10px] leading-relaxed text-ks-muted">Four qualifier windows run in weeks 8, 16, 24 and 32. Top two advance to an eight-nation finals bracket: quarter-final W37, semi-final W40, final W43. Club football continues around international duty.</p></div></Panel>
  <Panel title="exposure"><div className="grid grid-cols-2 gap-2"><Badge label="School" value={String(pathway?.exposure.school??0)}/><Badge label="Grassroots" value={String(pathway?.exposure.grassroots??0)}/><Badge label="Regional" value={String(pathway?.exposure.regional??0)}/><Badge label="Academy" value={String(pathway?.exposure.academy??0)}/></div></Panel>
  <Panel title="football inbox">{history.length?history.map(h=><div key={String(h.week)+h.title} className="border-b border-ks-border/50 py-2 last:border-0"><div className="flex justify-between gap-2"><b className="text-[10px] text-ks-ink">{h.title}</b><span className="text-[8px] text-ks-muted">W{h.week}</span></div><p className="text-[9px] text-ks-muted mt-1">{h.detail}</p></div>):<p className="text-[10px] text-ks-muted">Selectors, scouts and academy pathway updates will appear here.</p>}</Panel>
 </div>
}
