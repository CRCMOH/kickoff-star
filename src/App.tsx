import { useEffect, useState } from 'react'
import SplashScreen from './screens/SplashScreen'
import MainMenu from './screens/MainMenu'
import PlayerCreation from './screens/PlayerCreation'
import StoryIntro from './screens/StoryIntro'
import SchoolSelection from './screens/SchoolSelection'
import TrialsScreen from './screens/TrialsScreen'
import Career from './screens/Career'
import SettingsScreen from './screens/SettingsScreen'
import CreditsScreen from './screens/CreditsScreen'
import HelpScreen from './screens/HelpScreen'
import { useCareerStore } from './store/careerStore'
import type { School } from './engine/schools'
import type { SquadRole } from './engine/trials'

type Screen = 'splash' | 'menu' | 'create' | 'story' | 'school' | 'trials' | 'career' | 'settings' | 'credits' | 'help'

const isScreen = (value: unknown): value is Screen =>
  typeof value === 'string' && ['splash', 'menu', 'create', 'story', 'school', 'trials', 'career', 'settings', 'credits', 'help'].includes(value)

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [chosenSchool, setChosenSchool] = useState<School | null>(null)
  const player = useCareerStore((s) => s.player)
  const loadFromSlot = useCareerStore((s) => s.loadFromSlot)
  const setSchool = useCareerStore((s) => s.setSchool)
  const completeTrials = useCareerStore((s) => s.completeTrials)

  useEffect(() => {
    window.history.replaceState({ screen: 'splash' }, '')
    const onPopState = (event: PopStateEvent) => {
      const next = event.state?.screen
      setScreen(isScreen(next) ? next : 'menu')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (next: Screen) => {
    window.history.pushState({ screen: next }, '')
    setScreen(next)
  }

  const replace = (next: Screen) => {
    window.history.replaceState({ screen: next }, '')
    setScreen(next)
  }

  const goBackToMenu = () => {
    if (window.history.length > 1) window.history.back()
    else replace('menu')
  }

  const handleContinue = async () => {
    await loadFromSlot(0)
    const p = useCareerStore.getState().player
    if (p && p.trialWeekCompleted < 3) {
      setChosenSchool(null)
      navigate('school')
    } else {
      navigate('career')
    }
  }

  const handleSchoolChosen = (school: School) => {
    setChosenSchool(school)
    setSchool(school.id)
    replace('trials')
  }

  const handleTrialsComplete = (role: SquadRole, performance: number) => {
    if (role === 'released') {
      setChosenSchool(null)
      replace('school')
      return
    }
    completeTrials(role, performance)
    replace('career')
  }

  if (screen === 'splash') return <SplashScreen onDone={() => replace('menu')} />
  if (screen === 'menu') {
    return (
      <MainMenu
        onNewCareer={() => navigate('create')}
        onContinue={handleContinue}
        onLoadCareer={handleContinue}
        onOpenSettings={() => navigate('settings')}
        onOpenCredits={() => navigate('credits')}
        onOpenHelp={() => navigate('help')}
      />
    )
  }
  if (screen === 'settings') return <SettingsScreen onBack={goBackToMenu} />
  if (screen === 'credits') return <CreditsScreen onBack={goBackToMenu} />
  if (screen === 'help') return <HelpScreen onBack={goBackToMenu} />
  if (screen === 'create') {
    return <PlayerCreation onComplete={() => replace('story')} onBack={goBackToMenu} />
  }
  if (screen === 'story') {
    return <StoryIntro onComplete={() => replace('school')} />
  }
  if (screen === 'school') {
    return <SchoolSelection onChoose={handleSchoolChosen} />
  }
  if (screen === 'trials' && player && chosenSchool) {
    return <TrialsScreen player={player} school={chosenSchool} onComplete={handleTrialsComplete} />
  }
  return <Career onExitToMenu={() => replace('menu')} />
}
