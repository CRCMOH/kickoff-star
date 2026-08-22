import type { Player } from '../../types/player'
import { computeCurrentAbility, toOvr } from '../../engine/rating'
import { trustLabel, trustEmoji, generateNotebookEntry, notebookTone } from '../../engine/coachTrust'
import { Panel, Bar, TickBar, VerticalBarChart, RadarChart, OvrRing, StatRow, EmptyNote, Section, Icon } from '../../components/ui'
import iconShape from '../../assets/icons/shape.png'
import iconScouts from '../../assets/icons/scouts.png'
import iconMedical from '../../assets/icons/medical.png'
import iconGlory from '../../assets/icons/glory.png'
import iconCoachNotebook from '../../assets/icons/coach_notebook.png'
import { decideSelection } from '../../engine/selection'
import AchievementList from '../../components/AchievementList'
import GloryCabinet from '../../components/GloryCabinet'
import Avatar from '../../components/Avatar'
import { getNation } from '../../engine/nations'
import { getArchetype } from '../../engine/archetypes'
import ScoutsTab from './ScoutsTab'

// P27 restructure (Joel: 'one long ass scroll'): identity header + attributes
// stay always-visible; everything else collapses behind section buttons.
// P54 — Section itself moved to components/ui.tsx so HomeTab can share it.

const GROUPS: { title: string; attrs: string[] }[] = [
  { title: 'technical', attrs: ['passing', 'shooting', 'dribbling', 'tackling'] },
  { title: 'physical', attrs: ['pace', 'strength', 'stamina', 'agility'] },
  { title: 'mental', attrs: ['vision', 'composure', 'positioning', 'concentration'] },
]

const GK_GROUP: { title: string; attrs: string[] }[] = [
  { title: 'goalkeeping', attrs: ['reflexes', 'handling', 'gkPositioning', 'distribution'] },
]

const ATTR_LABELS: Record<string, string> = { gkPositioning: 'positioning' }

function ratingColor(r: number): string {
  if (r >= 7.5) return 'text-green-500'
  if (r >= 6.5) return 'text-ks-gold'
  if (r >= 5.5) return 'text-ks-ink'
  return 'text-orange-500'
}

export default function PlayerTab({ player, onOpenOffers }: { player: Player; onOpenOffers?: () => void }) {
  const c = player.career
  const values = player.attributes.values as Record<string, number>
  const isGk = player.attributes.kind === 'goalkeeper'
  const groups = isGk ? GK_GROUP : GROUPS
  const ovr = toOvr(computeCurrentAbility(player))
  const ratings = player.matchRatings ?? []
  const recent = ratings.slice(-6)
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
  const notebook = generateNotebookEntry(player, player.coachTrust ?? 0)
  const tone = notebookTone(player.coachTrust ?? 0)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-lg border border-ks-border bg-gradient-to-br from-[#15140f] to-[#0d0d0b] px-3 py-3 flex items-center gap-3 relative overflow-hidden texture-floodlight">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 80% at 15% 20%, rgba(212,175,55,0.10), transparent 60%)' }} />
        <Avatar id={player.avatarId ?? 0} size={58} className="relative z-10 shrink-0" />
        <div className="flex-1 min-w-0 relative z-10">
          <div className="font-display tracking-wide text-ks-ink text-base leading-tight truncate">
            {getNation(player.nationality).flag} {player.name}
          </div>
          <div className="text-[10px] text-ks-muted mb-1">
            {player.position} &middot; age {player.careerClock.ageYears} &middot; {player.heightCm}cm &middot; {player.preferredFoot} foot
          </div>
          {getArchetype(player.archetype) && (
            <div className="text-[9px] text-ks-gold uppercase tracking-widest mb-1.5">{getArchetype(player.archetype)!.label}</div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-ks-muted uppercase tracking-wider">potential</span>
            <TickBar value={player.potential} />
            <span className="font-display text-green-500 text-xs">{player.potential}</span>
          </div>
        </div>
        <OvrRing value={ovr} size="lg" />
      </div>

      {/* P50 — the coach's verdict used to only ever surface as a one-time
          weekly note that scrolled away. Now it's always visible: where you
          actually stand, and how long until it can change — the real
          substance behind the "sticky" selection system. */}
      {player.squadRole && player.squadRole !== 'released' && (() => {
        const verdict = decideSelection(player, player.squad)
        const SETTLE_WEEKS = 3
        const weeksSinceSet = (player.totalWeeksElapsed ?? 0) - (player.squadRoleSetWeek ?? 0)
        const weeksLeft = Math.max(0, SETTLE_WEEKS - weeksSinceSet)
        const roleLabel = player.squadRole === 'starting-xi' ? 'Starting XI' : player.squadRole === 'bench' ? 'Bench' : 'Reserves'
        return (
          <Panel title="🎽 squad status">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] text-ks-ink font-display tracking-wide">{roleLabel}</span>
              <span className="text-[11px] text-ks-muted">{verdict.pecking} of {verdict.competing} for your position</span>
            </div>
            <p className="text-[11px] text-ks-muted leading-relaxed">
              {weeksLeft > 0
                ? `The coach won't reconsider the side for ${weeksLeft} more week${weeksLeft === 1 ? '' : 's'}.`
                : verdict.changed
                ? `Your recent form is enough to change this — expect a decision soon.`
                : `You've settled into this role. Keep performing to move up.`}
            </p>
          </Panel>
        )
      })()}

      {/* P60 — reference: a radar/hexagon chart showing the player's
          attribute "shape" at a glance, alongside (not replacing) the bars. */}
      <Panel title={<span className="flex items-center gap-1"><Icon src={iconShape} />shape</span>}>
        <RadarChart
          points={groups.flatMap((g) => g.attrs.slice(0, isGk ? 4 : 2)).map((attr) => ({
            label: ATTR_LABELS[attr] ?? attr,
            value: values[attr] ?? 0,
          }))}
        />
      </Panel>

      {groups.map((group) =>
        group.title === 'physical' || group.title === 'mental' ? null : (
          <Panel key={group.title} title={group.title}>
            <div className="flex flex-col gap-1.5">
              {group.attrs.map((attr) => (
                <div key={attr} className="flex items-center gap-2">
                  <span className="text-[10px] text-ks-muted capitalize w-20 truncate">{ATTR_LABELS[attr] ?? attr}</span>
                  <Bar value={values[attr] ?? 0} />
                  <span className="text-[10px] text-ks-ink w-4 text-right">{Math.round(values[attr] ?? 0)}</span>
                </div>
              ))}
            </div>
          </Panel>
        )
      )}
      {!isGk && (
        <div className="flex gap-2.5">
          {groups.filter((g) => g.title === 'physical' || g.title === 'mental').map((group) => (
            <div key={group.title} className="flex-1 rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-3">
              <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-1">{group.title}</div>
              <VerticalBarChart attrs={group.attrs} values={values} labels={ATTR_LABELS} />
            </div>
          ))}
        </div>
      )}

      <Section title="📈 form & season" defaultOpen>
        {recent.length === 0 ? (
          <EmptyNote>No matches played yet. Your recent ratings will show here.</EmptyNote>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-2.5">
              {recent.map((r, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-md border border-ks-border bg-[#161613] py-1.5 text-center"
                >
                  <span className={`font-display text-xs ${ratingColor(r)}`}>{r.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <StatRow label="matches played" value={ratings.length} />
              <StatRow label="average rating" value={avg ? avg.toFixed(2) : '—'} />
              <StatRow label="season goals" value={player.seasonGoals ?? 0} />
              <StatRow label="season assists" value={player.seasonAssists ?? 0} />
            </div>
          </>
        )}
      </Section>

      <Section title={<span className="flex items-center gap-1"><Icon src={iconScouts} />scouts & interest</span>}>
        <ScoutsTab player={player} onOpenOffers={onOpenOffers ?? (() => {})} />
      </Section>

      <Section title="🏅 career record">
        <div className="flex flex-col gap-1.5">
          <StatRow label="appearances" value={c?.appearances ?? 0} />
          <StatRow label="goals" value={c?.goals ?? 0} />
          <StatRow label="assists" value={c?.assists ?? 0} />
          <StatRow label="wins" value={c?.wins ?? 0} />
          <StatRow label="clean sheets" value={c?.cleanSheets ?? 0} />
          <StatRow label="best rating" value={c?.bestRating ? c.bestRating.toFixed(1) : '—'} />
        </div>
        {/* P63 — "how many of my goals came in the league vs a cup run vs
            for my country." */}
        {player.careerByCompetition && (
          <div className="mt-3 pt-3 border-t border-ks-border/50">
            <div className="font-display tracking-widest text-[9px] text-ks-muted uppercase mb-2">by competition</div>
            <div className="flex flex-col gap-1.5">
              {([
                ['league', 'league'],
                ['cup', 'cups'],
                ['international', 'international'],
              ] as const).map(([key, label]) => {
                const b = player.careerByCompetition![key]
                if (b.appearances === 0) return null
                return (
                  <div key={key} className="flex items-center justify-between text-[11px]">
                    <span className="text-ks-muted capitalize">{label}</span>
                    <span className="text-ks-ink">{b.appearances} apps · {b.goals}G {b.assists}A</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      <Section title={<span className="flex items-center gap-1"><Icon src={iconGlory} />glory</span>}>
        <GloryCabinet player={player} />
      </Section>

      <Section title="🎖️ trophy cabinet & achievements">
        <AchievementList player={player} />
      </Section>

      <Section title={<span className="flex items-center gap-1"><Icon src={iconCoachNotebook} />coach's notebook</span>}>
        <div className="flex items-center gap-3 mb-2.5">
          <Bar value={(player.coachTrust ?? 0) + 10} max={20} />
          <span className="text-[11px] text-ks-ink w-20 text-right">{trustEmoji(player.coachTrust ?? 0)} {trustLabel(player.coachTrust ?? 0)}</span>
        </div>
        <div className="flex flex-col gap-2">
          {notebook.strengths.map((s, i) => (
            <div key={`s${i}`} className="flex gap-2 text-[11px] leading-relaxed">
              <span className="text-green-500 shrink-0">+</span>
              <span className="text-ks-ink">{s}</span>
            </div>
          ))}
          {notebook.weaknesses.map((w, i) => (
            <div key={`w${i}`} className="flex gap-2 text-[11px] leading-relaxed">
              <span className="text-orange-500 shrink-0">−</span>
              <span className="text-ks-ink">{w}</span>
            </div>
          ))}
          <div className={`text-[11px] leading-relaxed pt-2 border-t border-ks-border/40 ${
            tone === 'cold' ? 'text-orange-400' : tone === 'warm' ? 'text-green-400' : 'text-ks-muted'
          }`}>
            {notebook.recommendation}
          </div>
        </div>
      </Section>

      {player.injury && (
        <Panel title={<span className="flex items-center gap-1"><Icon src={iconMedical} />medical</span>}>
          <div className="flex flex-col gap-1.5">
            <StatRow label="status" value={<span className="text-orange-500 capitalize">{player.injury.severity}</span>} />
            <StatRow label="weeks out" value={player.injury.weeksRemaining} />
          </div>
          <p className="text-[11px] text-ks-muted leading-relaxed mt-2">{player.injury.description}</p>
        </Panel>
      )}
    </div>
  )
}
