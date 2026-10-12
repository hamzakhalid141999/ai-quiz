import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, PartyPopper, Sparkles, Trophy } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { startQuiz, submitAnswer, submitQuiz, type Grade, type StartedQuiz } from '@/lib/api'
import { cn } from '@/lib/utils'

const gameKey =
  'h-12 rounded-2xl border-2 border-b-0 text-base font-semibold shadow-[0_5px_0_0] transition-[transform,box-shadow] duration-75 ease-out active:translate-y-[5px] active:shadow-none disabled:translate-y-[5px] disabled:shadow-none'

type SavedAnswer = Grade & { picked: number }

type QuizPlayProps = {
  sessionKey: string
  quizId: string
  onExit: () => void
}

type LeaveRequest = { kind: 'reload' } | { kind: 'traverse'; key: string | null }

export function QuizPlay({ sessionKey, quizId, onExit }: QuizPlayProps) {
  const [quiz, setQuiz] = useState<StartedQuiz | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [saved, setSaved] = useState<Record<string, SavedAnswer>>({})
  const [submittedScore, setSubmittedScore] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reveal, setReveal] = useState<'quiz' | 'out' | 'score'>('quiz')
  const [leaveRequest, setLeaveRequest] = useState<LeaveRequest | null>(null)
  const skipGuard = useRef(false)

  useEffect(() => {
    let cancelled = false
    startQuiz(sessionKey, quizId)
      .then((started) => {
        if (cancelled) return
        const restored: Record<string, SavedAnswer> = {}
        for (const item of started.answers) {
          restored[item.questionId] = {
            questionId: item.questionId,
            correct: item.correct,
            correctChoiceIndex: item.correctChoiceIndex,
            pointsAwarded: item.pointsAwarded,
            score: started.answers.reduce((total, answer) => total + answer.pointsAwarded, 0),
            answeredCount: started.answers.length,
            totalQuestions: started.questionCount,
            finished: false,
            message: item.correct
              ? 'Saved! That’s the right answer — you get 1 point.'
              : 'Saved. That’s not the one — the highlighted choice is right.',
            picked: item.choiceIndex,
          }
        }
        const firstOpen = started.questions.findIndex((question) => !restored[question.id])
        setSaved(restored)
        setIndex(firstOpen === -1 ? Math.max(started.questions.length - 1, 0) : firstOpen)
        setQuiz(started)
      })
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message)
      })
    return () => {
      cancelled = true
    }
  }, [sessionKey, quizId])

  useEffect(() => {
    if (reveal !== 'out') return
    const timeout = window.setTimeout(() => setReveal('score'), 500)
    return () => window.clearTimeout(timeout)
  }, [reveal])

  useEffect(() => {
    if (!quiz || submittedScore !== null) return
    const quizUrl = `${window.location.pathname}${window.location.search}`

    function onNavigate(event: NavigateEvent) {
      if (skipGuard.current) return
      if (event.navigationType !== 'reload' && event.navigationType !== 'traverse') return
      if (!event.cancelable) return
      event.preventDefault()
      setLeaveRequest(
        event.navigationType === 'reload'
          ? { kind: 'reload' }
          : { kind: 'traverse', key: event.destination.key },
      )
    }

    function onKeyDown(event: KeyboardEvent) {
      if (skipGuard.current) return
      const reload = event.key === 'F5' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r')
      if (!reload) return
      event.preventDefault()
      setLeaveRequest({ kind: 'reload' })
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (skipGuard.current) return
      event.preventDefault()
      event.returnValue = ''
    }

    function onPopState(event: PopStateEvent) {
      if (skipGuard.current) return
      event.stopImmediatePropagation()
      window.setTimeout(() => {
        if (!skipGuard.current) window.history.pushState({ aiQuizGuard: true }, '', quizUrl)
      }, 0)
      setLeaveRequest((current) => current ?? { kind: 'traverse', key: null })
    }

    window.navigation.addEventListener('navigate', onNavigate)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('popstate', onPopState, true)
    return () => {
      window.navigation.removeEventListener('navigate', onNavigate)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('popstate', onPopState, true)
    }
  }, [quiz, submittedScore])

  function confirmLeave() {
    const request = leaveRequest
    if (!request) return
    skipGuard.current = true
    if (request.kind === 'reload') {
      window.location.reload()
      return
    }
    if (request.key) {
      void window.navigation.traverseTo(request.key)
      return
    }
    onExit()
  }

  function nextOpenIndex(from: number, questions: StartedQuiz['questions'], answers: Record<string, SavedAnswer>) {
    for (let step = 1; step <= questions.length; step++) {
      const candidate = (from + step) % questions.length
      if (!answers[questions[candidate].id]) return candidate
    }
    return null
  }

  async function choose(choiceIndex: number) {
    if (!quiz || isSubmitting) return
    const question = quiz.questions[index]
    if (saved[question.id]) return

    setIsSubmitting(true)
    setError(null)
    try {
      const grade = await submitAnswer(sessionKey, quiz.attemptId, question.id, choiceIndex)
      setSaved((current) => ({ ...current, [question.id]: { ...grade, picked: choiceIndex } }))
    } catch (submitError) {
      setError((submitError as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function finishQuiz() {
    if (!quiz || isSubmitting || submittedScore !== null) return
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await submitQuiz(sessionKey, quiz.attemptId)
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setSubmittedScore(result.score)
      setReveal(reduceMotion ? 'score' : 'out')
    } catch (submitError) {
      setError((submitError as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (error && !quiz) {
    return (
      <Card className="w-full rounded-4xl shadow-xl ring-2">
        <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
          <p className="text-destructive">{error}</p>
          <Button className="rounded-full" onClick={onExit}>
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!quiz) return <p className="text-muted-foreground">Loading quiz…</p>

  const question = quiz.questions[index]
  const answer = saved[question.id]
  const done = Object.keys(saved).length
  const openCount = quiz.questionCount - done
  const allAnswered = done === quiz.questionCount
  const submitted = submittedScore !== null
  const percent = quiz.questionCount === 0 ? 0 : (done / quiz.questionCount) * 100
  const atFirst = index === 0
  const atLast = index === quiz.questions.length - 1

  return (
    <div className="flex w-full flex-col gap-4">
      {!submitted && (
        <Button variant="ghost" className="self-start rounded-full" onClick={onExit}>
          <ArrowLeft /> Leave quiz
        </Button>
      )}

      {reveal !== 'score' && (
        <div
          className={cn(
            'flex flex-col gap-4 transition-all duration-500 ease-in',
            reveal === 'out' && 'pointer-events-none -translate-y-4 scale-95 opacity-0',
          )}
        >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {quiz.categoryName} · {quiz.title}
          </p>
          <p className="font-semibold tabular-nums">
            {done}/{quiz.questionCount} done
          </p>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={quiz.questionCount}
          aria-label={`${done} of ${quiz.questionCount} questions answered`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Questions">
        {quiz.questions.map((item, itemIndex) => {
          const itemAnswer = saved[item.id]
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              aria-current={itemIndex === index ? 'true' : undefined}
              aria-label={`Question ${itemIndex + 1}${itemAnswer ? ', answered' : ', not answered yet'}`}
              className={cn(
                'grid size-9 place-items-center rounded-full border-2 border-b-0 text-sm font-semibold shadow-[0_3px_0_0] transition-[transform,box-shadow] duration-75 active:translate-y-[3px] active:shadow-none',
                itemIndex === index && 'ring-2 ring-primary ring-offset-2',
                !itemAnswer && 'border-dashed border-primary/50 bg-card text-foreground shadow-primary/40',
                itemAnswer?.correct && 'border-primary bg-primary text-primary-foreground shadow-primary/70',
                itemAnswer && !itemAnswer.correct && 'border-destructive/40 bg-destructive/15 text-destructive shadow-destructive/40',
              )}
              onClick={() => setIndex(itemIndex)}
            >
              {itemIndex + 1}
            </button>
          )
        })}
        {openCount > 0 && (
          <span className="ml-1 text-sm text-muted-foreground">
            {openCount} still open — dashed numbers aren’t answered
          </span>
        )}
      </div>

      <Card className="w-full rounded-4xl shadow-xl ring-2">
        <CardHeader>
          <CardDescription>Question {index + 1}</CardDescription>
          <CardTitle className="text-2xl text-balance">{question.prompt}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {question.choices.map((choice, choiceIndex) => {
            const isCorrect = Boolean(answer) && choiceIndex === answer.correctChoiceIndex
            const isWrongPick = Boolean(answer) && choiceIndex === answer.picked && !isCorrect
            return (
              <Button
                key={`${question.id}-${choiceIndex}`}
                variant="outline"
                disabled={isSubmitting || Boolean(answer)}
                className={cn(
                  gameKey,
                  'h-auto justify-start bg-card px-4 py-3 text-left whitespace-normal text-card-foreground shadow-foreground/25',
                  isCorrect && 'border-primary bg-primary/15 shadow-primary/50',
                  isWrongPick && 'border-destructive bg-destructive/10 shadow-destructive/40',
                )}
                onClick={() => choose(choiceIndex)}
              >
                {choice}
              </Button>
            )
          })}

          {answer && (
            <p className={cn('text-center font-medium', answer.correct ? 'text-primary' : 'text-destructive')}>
              {answer.message}
            </p>
          )}
          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          {!answer && !submitted && (
            <Button
              variant="outline"
              className={cn(gameKey, 'bg-amber-400 text-amber-950 shadow-amber-700')}
              disabled={isSubmitting}
              onClick={() => {
                const next = nextOpenIndex(index, quiz.questions, saved)
                setIndex(next ?? (index + 1) % quiz.questions.length)
              }}
            >
              Skip for now
            </Button>
          )}
        </CardContent>
      </Card>

      {allAnswered && !submitted && (
        <Button
          className={cn(gameKey, 'h-16 w-full text-lg bg-primary text-primary-foreground shadow-primary/70')}
          disabled={isSubmitting}
          onClick={finishQuiz}
        >
          {isSubmitting ? 'Submitting…' : 'Submit quiz'}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button
          className={cn(gameKey, 'bg-sky-500 text-white shadow-sky-800')}
          disabled={atFirst}
          onClick={() => setIndex((current) => current - 1)}
        >
          Previous
        </Button>
        <Button
          className={cn(gameKey, 'bg-emerald-500 text-white shadow-emerald-800')}
          disabled={atLast}
          onClick={() => setIndex((current) => current + 1)}
        >
          Next
        </Button>
      </div>
        </div>
      )}

      {submitted && submittedScore !== null && (
        <div className="flex flex-col gap-4">
          {reveal === 'score' && <ScoreFeedback score={submittedScore} total={quiz.questionCount} />}
          <Button className={cn(gameKey, 'bg-primary text-primary-foreground shadow-primary/70')} onClick={onExit}>
            See your progress
          </Button>
        </div>
      )}

      {leaveRequest && (
        <ConfirmDialog
          title={leaveRequest.kind === 'reload' ? 'Refresh this page?' : 'Leave this quiz?'}
          description="You’re still in this quiz. Answers you’ve already saved will be here when you come back."
          confirmLabel={leaveRequest.kind === 'reload' ? 'Refresh' : 'Leave'}
          onConfirm={confirmLeave}
          onCancel={() => setLeaveRequest(null)}
        />
      )}
    </div>
  )
}

const burstDots = [
  { x: '-4.5rem', y: '-3rem', color: 'bg-amber-400' },
  { x: '4.2rem', y: '-2.6rem', color: 'bg-primary' },
  { x: '-3.6rem', y: '2.4rem', color: 'bg-sky-400' },
  { x: '3.8rem', y: '2.8rem', color: 'bg-emerald-400' },
  { x: '0rem', y: '-4.4rem', color: 'bg-orange-400' },
  { x: '0.2rem', y: '4.2rem', color: 'bg-fuchsia-400' },
]

function scoreTone(score: number, total: number) {
  const ratio = total === 0 ? 0 : score / total
  if (total > 0 && score === total) {
    return {
      title: 'Perfect!',
      line: 'Every answer landed. That’s a flawless round.',
      Icon: PartyPopper,
      ring: 'text-amber-500',
    }
  }
  if (ratio >= 0.7) {
    return {
      title: 'Great round!',
      line: 'That score is worth showing off.',
      Icon: Trophy,
      ring: 'text-emerald-500',
    }
  }
  if (ratio >= 0.4) {
    return {
      title: 'Nice try!',
      line: 'A few more right answers and this one’s yours.',
      Icon: Sparkles,
      ring: 'text-sky-500',
    }
  }
  return {
    title: 'Round saved',
    line: 'You can see the right answers and run it again.',
    Icon: Sparkles,
    ring: 'text-orange-500',
  }
}

function ScoreFeedback({ score, total }: { score: number; total: number }) {
  const shown = useCountUp(score)
  const tone = scoreTone(score, total)
  const ratio = total === 0 ? 0 : shown / total
  const Icon = tone.Icon

  return (
    <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-4 rounded-4xl bg-card px-6 py-10 text-center shadow-xl ring-2 duration-500">
      <div className={cn('relative grid size-44 place-items-center', tone.ring)}>
        {burstDots.map((dot, index) => (
          <span
            key={dot.color + index}
            className={cn('score-burst absolute size-3 rounded-full', dot.color)}
            style={{ ['--burst-x' as string]: dot.x, ['--burst-y' as string]: dot.y, animationDelay: `${index * 40}ms` }}
          />
        ))}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(currentColor ${ratio * 360}deg, var(--muted) 0deg)` }}
          aria-hidden
        />
        <div className="relative flex size-32 flex-col items-center justify-center rounded-full bg-card">
          <Icon className="size-6" />
          <span className="text-5xl leading-none font-semibold tabular-nums">{shown}</span>
          <span className="text-sm text-muted-foreground">out of {total}</span>
        </div>
      </div>
      <h2 className="text-4xl font-semibold" aria-live="polite">
        {tone.title}
      </h2>
      <p className="max-w-xs text-balance text-muted-foreground">{tone.line}</p>
    </div>
  )
}

function useCountUp(target: number) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || target === 0) {
      setValue(target)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 700)
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(eased * target))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return value
}
