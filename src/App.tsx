import { useState } from 'react'
import SplashScreen from './screens/SplashScreen'
import MainMenu from './screens/MainMenu'
import PlayerCreation from './screens/PlayerCreation'
import StoryIntro from './screens/StoryIntro'
import SchoolSelection from './screens/SchoolSelection'
import TrialsScreen from './screens/TrialsScreen'
import Career from './screens/Career'
import { useCareerStore } from './store/careerStore'
import type { School } from './engine/schools'
import type { SquadRole } from './engine/trials'

type Screen = 'splash' | 'menu' | 'create' | 'story' | 'school' | 'trials' | 'career'

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [chosenSchool, setChosenSchool] = useState<School | null>(null)
  const player = useCareerStore((s) => s.player)
  const loadFromSlot = useCareerStore((s) => s.loadFromSlot)
  const setSchool = useCareerStore((s) => s.setSchool)
  const completeTrials = useCareerStore((s) => s.completeTrials)

  const handleContinue = async () => {
    await loadFromSlot(0)
    // resume at the right place: if trials not done, send to school/trials; else career
    const p = useCareerStore.getState().player
    if (p && p.trialWeekCompleted < 3) {
      // Trials are a single-sitting arc; if it was left incomplete, restart cleanly
      // from school selection rather than resuming a half-finished, unsaved trial state.
      setChosenSchool(null)
      setScreen('school')
    } else {
      setScreen('career')
    }
  }

  const handleSchoolChosen = (school: School) => {
    setChosenSchool(school)
    setSchool(school.id)
    setScreen('trials')
  }

  const handleTrialsComplete = (role: SquadRole, performance: number) => {
    if (role === 'released') {
      // didn't make the cut — try a different school rather than dead-ending
      setChosenSchool(null)
      setScreen('school')
      return
    }
    completeTrials(role, performance)
    setScreen('career')
  }

  if (screen === 'splash') return <SplashScreen onDone={() => setScreen('menu')} />
  if (screen === 'menu') {
    return <MainMenu onNewCareer={() => setScreen('create')} onContinue={handleContinue} onLoadCareer={handleContinue} />
  }
  if (screen === 'create') {
    return <PlayerCreation onComplete={() => setScreen('story')} onBack={() => setScreen('menu')} />
  }
  if (screen === 'story') {
    return <StoryIntro onComplete={() => setScreen('school')} />
  }
  if (screen === 'school') {
    return <SchoolSelection onChoose={handleSchoolChosen} />
  }
  if (screen === 'trials' && player && chosenSchool) {
    return <TrialsScreen player={player} school={chosenSchool} onComplete={handleTrialsComplete} />
  }
  return <Career onExitToMenu={() => setScreen('menu')} />
}
