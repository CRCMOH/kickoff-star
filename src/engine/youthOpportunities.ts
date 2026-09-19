import type { Player } from '../types/player'
import { initYouthPathway } from './pathway'

export function currentPerformance(player: Player, ids: string[]) {
  const records = Object.values(player.competitionCareer?.current ?? {}).filter(r => ids.includes(r.competitionId))
  const appearances = records.reduce((sum, r) => sum + r.appearances, 0)
  const average = appearances ? records.reduce((sum, r) => sum + r.ratingTotal, 0) / appearances : 0
  return { appearances, average }
}

export function representativeEvidence(player: Player, level: 'regional' | 'national') {
  const record = currentPerformance(player, level === 'regional'
    ? ['schoolLeague', 'schoolReserveLeague', 'schoolCup'] : ['nationalChampionship'])
  const minimum = level === 'regional' ? 10 : 3
  const requiredRating = level === 'regional' ? 6.7 : 7
  const eligible = record.appearances >= minimum && record.average >= requiredRating
    && (level === 'regional' || player.pathway?.regionalSelection === 'selected')
  return { ...record, eligible, reason: eligible ? 'Sustained performances meet the selection standard.'
    : `Requires ${minimum} ${level === 'regional' ? 'school league/cup' : 'National Schools Championship'} appearances averaging ${requiredRating.toFixed(1)}.` }
}

export function updateSundayRecruitment(player: Player, rating: number): Player {
  const pathway = player.pathway ?? initYouthPathway(player)
  if (player.grassrootsPath !== 'school' || pathway.sundayStatus === 'registered') return player
  const record = currentPerformance(player, ['schoolLeague', 'schoolReserveLeague', 'schoolCup'])
  // A match can add at most eight interest points. Goals are already reflected
  // in the position-aware rating, so a hat-trick cannot be counted twice.
  const delta = rating >= 7.5 ? 8 : rating >= 6.8 ? 5 : rating >= 6 ? 1 : -3
  const sundayInterest = Math.max(0, Math.min(100, pathway.sundayInterest + delta))
  const sundayStatus = record.appearances >= 10 && record.average >= 6.8 && sundayInterest >= 70 ? 'squad-offer'
    : record.appearances >= 6 && record.average >= 6.6 && sundayInterest >= 45 ? 'training-invite'
    : record.appearances >= 4 && sundayInterest >= 20 ? 'watched' : 'undiscovered'
  return { ...player, pathway: { ...pathway, sundayInterest, sundayStatus } }
}

export function sundayTransferAssessment(player: Player, week: number, division: number) {
  const record = currentPerformance(player, ['sundayLeague', 'sundayCup'])
  const recent = (player.matchRatings ?? []).slice(-5)
  const form = recent.length === 5 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
  const inWindow = week >= 8 && week <= 16 || week >= 18 && week <= 24 || week >= 40 && week <= 43
  const eligible = inWindow && !player.injury && record.appearances >= 6 && record.average >= 6.8 && form >= 6.8
  const higherDivision = eligible && division > 1 && record.appearances >= 8 && record.average >= 7.1 && form >= 7.1
  return { eligible, higherDivision, targetDivision: higherDivision ? division - 1 : division }
}

export function repairSundayInvitation(player: Player): Player {
  const pathway = player.pathway
  if (!pathway || pathway.sundayStatus === 'registered' || player.grassrootsPath !== 'school') return player
  const record = currentPerformance(player, ['schoolLeague', 'schoolReserveLeague', 'schoolCup'])
  const premature = pathway.sundayStatus === 'squad-offer' && (record.appearances < 10 || record.average < 6.8)
    || pathway.sundayStatus === 'training-invite' && (record.appearances < 6 || record.average < 6.6)
  return premature ? { ...player, pathway: { ...pathway, sundayStatus: record.appearances >= 4 ? 'watched' : 'undiscovered', sundayInterest: Math.min(pathway.sundayInterest, 40) },
    inbox: (player.inbox ?? []).filter(item => item.title !== 'SUNDAY CLUB INVITE') } : player
}
