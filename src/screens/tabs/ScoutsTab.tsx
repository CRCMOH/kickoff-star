import type { Player } from '../../types/player'
import { reputationLabel } from '../../engine/scouting'
import { Panel, Bar, EmptyNote, Icon } from '../../components/ui'
import iconScouts from '../../assets/icons/scouts.png'

// Tiers come from scouting.ts TIER_PRESTIGE_RANGE: local | regional | national.
const TIER_STYLE: Record<string, string> = {
  local: 'text-ks-muted',
  regional: 'text-ks-gold',
  national: 'text-green-500',
}

const OFFER_THRESHOLD = 78 // matches checkForOffers() in scouting.ts

export default function ScoutsTab({ player, onOpenOffers }: { player: Player; onOpenOffers: () => void }) {
  const watchers = player.scoutWatchers ?? []
  const offers = player.contractOffers ?? []
  const isAcademy = player.careerClock.phase === 'academy'

  return (
    <div className="flex flex-col gap-2.5">
      {offers.length > 0 && (
        <button
          onClick={onOpenOffers}
          className="rounded-lg border border-ks-gold bg-ks-gold/10 px-3 py-2.5 flex items-center justify-between"
        >
          <span className="text-ks-gold text-sm font-display tracking-wide">
            {offers.length} offer{offers.length === 1 ? '' : 's'} on the table
          </span>
          <span className="text-ks-gold text-xs">review →</span>
        </button>
      )}

      <Panel title={<span className="flex items-center gap-1"><Icon src={iconScouts} />reputation</span>}>
        <div className="flex items-center gap-3 mb-2">
          <Bar value={player.reputation ?? 5} max={100} />
          <span className="text-[11px] text-ks-ink w-24 text-right">{reputationLabel(player.reputation ?? 5)}</span>
        </div>
        <EmptyNote>
          Reputation decides which <em>tier</em> of club can notice you — it doesn't guarantee interest.
          Every club forms its own opinion, and most will never scout you at all.
        </EmptyNote>
      </Panel>

      <Panel title={`clubs watching — ${watchers.length}`}>
        {watchers.length === 0 ? (
          <EmptyNote>No clubs watching you yet. Strong match ratings are what gets a scout in the stands.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2.5">
            {watchers.map((w) => (
              <div key={w.clubId ?? w.clubName} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-ks-ink truncate">{w.clubName}</span>
                  <span className={`text-[9px] uppercase tracking-wider ${TIER_STYLE[w.tier] ?? 'text-ks-muted'}`}>
                    {w.tier}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Bar value={w.interest} max={100} />
                  <span className={`text-[9px] w-6 text-right ${w.interest >= OFFER_THRESHOLD ? 'text-green-500' : 'text-ks-muted'}`}>
                    {Math.round(w.interest)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {watchers.length > 0 && (
          <p className="text-[10px] text-ks-muted mt-2.5 pt-2 border-t border-ks-border/40">
            A club makes an offer once its interest reaches {OFFER_THRESHOLD}.
          </p>
        )}
      </Panel>

      <Panel title="➡️ what happens next">
        <EmptyNote>
          {isAcademy
            ? 'You\'re in an academy now — offers from here are genuine professional contracts. Signing one ends your youth career and turns you pro.'
            : 'Offers at this stage are academy invitations, not pro contracts. Taking one moves you into an academy; holding out risks the offer expiring.'}
        </EmptyNote>
      </Panel>
    </div>
  )
}
