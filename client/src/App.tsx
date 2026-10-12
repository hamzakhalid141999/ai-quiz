import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { Settings } from 'lucide-react'
import { LeaderboardScreen } from '@/components/Leaderboard'
import { Onboarding } from '@/components/Onboarding'
import { ProfileScreen } from '@/components/ProfileScreen'
import { QuizPlay } from '@/components/QuizPlay'
import { SettingsScreen } from '@/components/SettingsScreen'
import { Button } from '@/components/ui/button'
import { getActiveSessionKey, setActiveSessionKey } from '@/lib/session-keys'
import { cn } from '@/lib/utils'

function HomeRoute() {
  const navigate = useNavigate()

  function handleContinue(sessionKey: string) {
    setActiveSessionKey(sessionKey)
    navigate('/profile')
  }

  return <Onboarding onContinue={handleContinue} />
}

function ProfileRoute() {
  const navigate = useNavigate()
  const sessionKey = getActiveSessionKey()
  if (!sessionKey) return <Navigate to="/" replace />

  return (
    <ProfileScreen
      sessionKey={sessionKey}
      refreshKey={0}
      onSwitchPlayer={() => navigate('/')}
      onStartQuiz={(quizId) => navigate(`/profile/quiz/${quizId}`)}
    />
  )
}

function QuizRoute() {
  const navigate = useNavigate()
  const { quizId } = useParams()
  const sessionKey = getActiveSessionKey()
  if (!sessionKey || !quizId) return <Navigate to="/" replace />

  return <QuizPlay sessionKey={sessionKey} quizId={quizId} onExit={() => navigate('/profile')} />
}

function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const onHome = pathname === '/'

  return (
    <div className="relative min-h-svh">
      {onHome && (
        <Button
          variant="secondary"
          className="absolute top-4 right-4 z-20 size-12 rounded-2xl shadow-[0_4px_0_0] shadow-primary/30 active:translate-y-1 active:shadow-none"
          aria-label="Settings"
          onClick={() => navigate('/settings')}
        >
          <Settings />
        </Button>
      )}
      <main
        className={cn(
          'mx-auto flex min-h-svh w-full max-w-xl flex-col items-center gap-8 overflow-x-clip px-5 py-10',
          onHome && 'justify-center',
        )}
      >
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/profile" element={<ProfileRoute />} />
          <Route path="/profile/quiz/:quizId" element={<QuizRoute />} />
          <Route path="/leaderboard" element={<LeaderboardScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
