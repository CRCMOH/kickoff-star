import type { Player } from '../types/player'

interface ContractOffersProps {
  player: Player
  onRespond: (offerId: string, accept: boolean) => void
  onClose: () => void
}

export default function ContractOffers({ player, onRespond, onClose }: ContractOffersProps) {
  const offers = player.contractOffers ?? []

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 15%, rgba(212,175,55,0.1), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 max-w-md mx-auto w-full">
        <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-2">contract offers</div>
        <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-2">A club wants you.</h1>
        <p className="text-ks-muted text-xs mb-6 leading-relaxed">
          Take it and turn pro now — security, but maybe a lower ceiling. Or hold out and gamble that something better arrives before your window closes. Offers expire if you wait too long.
        </p>

        {offers.length === 0 ? (
          <div className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-8 text-center mb-6">
            <p className="text-ks-muted text-sm">No offers on the table right now. Keep performing — someone's always watching.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {offers.map((offer) => (
              <div key={offer.id} className="rounded-2xl border border-ks-gold/40 bg-ks-gold/5 px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-display tracking-wide text-ks-ink text-lg">{offer.clubName}</div>
                  <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                    offer.kind === 'professional' ? 'text-ks-gold border-ks-gold/50' : 'text-ks-ink border-ks-border'
                  }`}>
                    {offer.kind === 'professional' ? 'pro contract' : offer.kind === 'club' ? `club transfer${offer.divisionTier ? ` · div ${offer.divisionTier}` : ''}` : 'academy invite'}
                  </span>
                </div>
                {(() => {
                  const remaining = Math.max(0, offer.expiresInWeeks - ((player.totalWeeksElapsed ?? 0) - offer.weekOffered))
                  return (
                    <div className="text-[11px] text-ks-muted mb-4">
                      Prestige {offer.prestige}/10 · expires in {remaining} week{remaining === 1 ? '' : 's'}
                    </div>
                  )
                })()}
                <div className="flex gap-2">
                  <button
                    onClick={() => onRespond(offer.id, true)}
                    className="flex-1 bg-ks-gold text-ks-black font-display tracking-wide rounded-lg py-2.5 text-xs"
                  >
                    {offer.kind === 'professional' ? 'sign now' : offer.kind === 'club' ? 'join club' : 'join academy'}
                  </button>
                  <button
                    onClick={() => onRespond(offer.id, false)}
                    className="flex-1 border border-ks-border text-ks-ink font-display tracking-wide rounded-lg py-2.5 text-xs"
                  >
                    hold out
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} className="w-full border border-ks-border text-ks-muted rounded-xl py-3 text-sm">
          back
        </button>
      </div>
    </div>
  )
}
