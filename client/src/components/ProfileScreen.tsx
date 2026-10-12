import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Crown, Medal, Target, Trophy, Zap } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getLeaderboard,
  getProfile,
  listQuizzes,
  type Category,
  type LeaderboardEntry,
  type Profile,
  type QuizSummary,
} from '@/lib/api'
import { cn } from '@/lib/utils'

type ProfileScreenProps = {
  sessionKey: string
  refreshKey: number
  onSwitchPlayer: () => void
  onStartQuiz: (quizId: string) => void
}

const podiumStyle = {
  1: {
    title: "You're #1",
    className: 'bg-amber-300 text-amber-950 ring-amber-500',
    Icon: Crown,
  },
  2: {
    title: "You're #2",
    className: 'bg-slate-200 text-slate-800 ring-slate-400',
    Icon: Medal,
  },
  3: {
    title: "You're #3",
    className: 'bg-orange-300 text-orange-950 ring-orange-500',
    Icon: Medal,
  },
} as const

export function ProfileScreen({ sessionKey, refreshKey, onSwitchPlayer, onStartQuiz }: ProfileScreenProps) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [standing, setStanding] = useState<LeaderboardEntry | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingQuiz, setPendingQuiz] = useState<{ categoryName: string; quiz: QuizSummary } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getProfile(sessionKey), listQuizzes(sessionKey), getLeaderboard(sessionKey)])
      .then(([nextProfile, nextCategories, leaderboard]) => {
        if (cancelled) return
        setProfile(nextProfile)
        setCategories(nextCategories)
        setStanding(leaderboard.entries.find((entry) => entry.you) ?? null)
      })
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message)
      })

    return () => {
      cancelled = true
    }
  }, [sessionKey, refreshKey])

  if (error) {
    return (
      <Card className="w-full rounded-2xl px-6 py-8 shadow-xl ring-2">
        <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
          <p className="text-destructive">Couldn’t load this player: {error}</p>
          <Button className="rounded-full" onClick={onSwitchPlayer}>
            Back to players
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!profile) {
    return <p className="text-muted-foreground">Loading player…</p>
  }

  const { progress } = profile
  const rank = standing?.rank
  const podium = rank === 1 || rank === 2 || rank === 3 ? podiumStyle[rank] : null
  const stats = [
    { label: 'Quizzes played', value: progress.quizzesPlayed, icon: Zap },
    { label: 'Best score', value: progress.bestScore, icon: Trophy },
    { label: 'Accuracy', value: `${progress.accuracy}%`, icon: Target },
  ]

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full items-center justify-between gap-2">
        <Button variant="ghost" className="rounded-full" onClick={onSwitchPlayer}>
          <ArrowLeft /> Switch player
        </Button>
        <Button
          variant="secondary"
          className="rounded-full font-semibold shadow-[0_4px_0_0] shadow-primary/30 active:translate-y-1 active:shadow-none"
          onClick={() => navigate('/leaderboard', { state: { from: 'profile' } })}
        >
          <Trophy /> Leaderboard
        </Button>
      </div>

      <header className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-primary text-4xl font-semibold uppercase text-primary-foreground shadow-lg">
          {profile.username.charAt(0)}
        </span>
        <h1 className="max-w-full truncate text-4xl font-semibold tracking-tight sm:text-5xl">
          {profile.username}
        </h1>
        <Badge variant="secondary" className="h-7 rounded-full px-3 text-sm">
          Player since {new Date(`${profile.createdAt}Z`).toLocaleDateString()}
        </Badge>
        {podium && standing && (
          <div className={cn('flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left shadow-xl ring-2', podium.className)}>
            <podium.Icon className="size-10 shrink-0" />
            <div>
              <p className="text-2xl font-semibold">{podium.title}</p>
              <p className="text-sm">
                {standing.points} points · {standing.accuracy}% accuracy
              </p>
            </div>
          </div>
        )}
      </header>

      <Card className="w-full rounded-2xl px-6 py-8 shadow-xl ring-2">
        <CardHeader>
          <CardTitle className="text-2xl">Overall progress</CardTitle>
          <CardDescription>
            {progress.quizzesPlayed === 0
              ? 'No quizzes played yet — your stats show up here.'
              : 'How you’re doing so far.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2">
            {stats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 rounded-2xl bg-secondary px-2 py-4 text-center text-secondary-foreground"
              >
                <Icon className="size-5 text-primary" />
                <span className="text-2xl font-semibold tabular-nums">{value}</span>
                <span className="text-xs">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Accuracy</span>
              <span className="tabular-nums">{progress.accuracy}%</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress.accuracy}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="flex w-full flex-col gap-3">
        <h2 className="text-center text-2xl font-semibold">Pick a category</h2>
        {categories.map((category) => (
          <Card key={category.id} className="w-full rounded-2xl px-6 py-8 shadow-xl ring-2">
            <CardHeader>
              <CardTitle className="text-xl">{category.name}</CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {category.quizzes.map((quiz) => (
                <Button
                  key={quiz.id}
                  variant="secondary"
                  className="h-auto w-full flex-col gap-0.5 rounded-2xl py-3 whitespace-normal text-secondary-foreground"
                  onClick={() => setPendingQuiz({ categoryName: category.name, quiz })}
                >
                  <span className="text-base font-semibold">{quiz.title}</span>
                  <span className="text-xs font-normal">
                    {quiz.status === 'in_progress' && `${quiz.answeredCount}/${quiz.questionCount}`}
                    {quiz.status === 'submitted' && `Done ${quiz.score}/${quiz.questionCount}`}
                    {quiz.status === 'new' && `${quiz.questionCount} questions`}
                  </span>
                  {quiz.status === 'in_progress' && (
                    <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background">
                      <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${(quiz.answeredCount / quiz.questionCount) * 100}%` }}
                      />
                    </span>
                  )}
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>

      {pendingQuiz && (
        <ConfirmDialog
          title={
            pendingQuiz.quiz.status === 'in_progress'
              ? 'Do you want to continue this quiz?'
              : pendingQuiz.quiz.status === 'submitted'
                ? `Start ${pendingQuiz.categoryName} again?`
                : `Start ${pendingQuiz.categoryName}?`
          }
          description={
            pendingQuiz.quiz.status === 'in_progress'
              ? `You’ve answered ${pendingQuiz.quiz.answeredCount} of ${pendingQuiz.quiz.questionCount}. You’ll pick up on the next question you left open.`
              : pendingQuiz.quiz.status === 'submitted'
                ? `Last time you scored ${pendingQuiz.quiz.score} out of ${pendingQuiz.quiz.questionCount}. That score stays on your progress.`
                : `This is ${pendingQuiz.quiz.title}, ${pendingQuiz.quiz.questionCount} questions. You can skip any of them and come back before you submit.`
          }
          confirmLabel={
            pendingQuiz.quiz.status === 'in_progress'
              ? 'Continue'
              : pendingQuiz.quiz.status === 'submitted'
                ? 'Start again'
                : 'Start quiz'
          }
          onConfirm={() => onStartQuiz(pendingQuiz.quiz.id)}
          onCancel={() => setPendingQuiz(null)}
        />
      )}
    </div>
  )
}
