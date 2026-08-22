import { useState } from 'react'
import type { Division } from '../../engine/league'
import { divisionLabel, type LeagueWorld } from '../../engine/league'
import { academyDivisionLabel, type AcademyWorld } from '../../engine/academy'
import StandingsTable from '../../components/StandingsTable'

// P27 (Joel: "i dont see the other 2 divisions"): the table tab now shows the
// WHOLE pyramid — tap between divisions. Your own division opens by default
// and is marked; promotion/relegation zones render in every one, so you can
// see who's coming up beneath you and who you'd face above.
export default function TableTab({ world, playerTeamId, isAcademy }: {
  world: LeagueWorld | AcademyWorld
  playerTeamId: string
  isAcademy: boolean
}) {
  const tiers = Object.keys(world.divisions).map(Number).sort()
  const [tier, setTier] = useState<number>(world.playerDivision)
  const division = (world.divisions as Record<number, Division>)[tier]

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <div className="font-display tracking-widest text-[10px] text-ks-gold uppercase mb-0.5">
          {isAcademy ? 'academy' : 'sunday league'} pyramid
        </div>
        <h1 className="font-display text-ks-ink text-xl tracking-wide">
          {isAcademy ? academyDivisionLabel(tier as 1 | 2) : divisionLabel(tier as 1 | 2 | 3)}
        </h1>
      </div>

      <div className="flex gap-1.5">
        {tiers.map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 rounded-lg border py-2 font-display tracking-widest text-[10px] uppercase transition-all ${
              tier === t ? 'border-ks-gold bg-ks-gold/10 text-ks-gold' : 'border-ks-border bg-[#0f0f0d] text-ks-muted'
            }`}
          >
            {isAcademy ? (t === 1 ? 'U18 PL' : 'PDL') : `Div ${t}`}
            {t === world.playerDivision && <span className="ml-1 text-ks-gold">•</span>}
          </button>
        ))}
      </div>

      <StandingsTable division={division} playerTeamId={tier === world.playerDivision ? playerTeamId : ''} isAcademy={isAcademy} />
      <p className="text-[10px] text-ks-muted leading-relaxed px-1">
        {isAcademy
          ? 'top 3 of the development league earn promotion at the end of the season. no relegation in the academy.'
          : 'top 2 go up, bottom 2 go down — decided on the final matchday of the season.'}
      </p>
    </div>
  )
}
