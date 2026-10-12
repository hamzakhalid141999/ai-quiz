import { useEffect, useState } from 'react'
import { Gamepad2, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Score = {
  id: number
  player_name: string
  score: number
  created_at: string
}

type ServerStatus = 'loading' | 'ok' | 'down'

function App() {
  const [status, setStatus] = useState<ServerStatus>('loading')
  const [scores, setScores] = useState<Score[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const healthResponse = await fetch('/api/health')
        if (!healthResponse.ok) throw new Error('health')

        const scoresResponse = await fetch('/api/scores')
        if (!scoresResponse.ok) throw new Error('scores')

        const nextScores = (await scoresResponse.json()) as Score[]
        if (cancelled) return

        setStatus('ok')
        setScores(nextScores)
      } catch {
        if (!cancelled) setStatus('down')
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center gap-8 overflow-x-clip px-5 py-12">
      <section className="flex w-full min-w-0 flex-col items-center gap-4 text-center">
        <Badge
          variant={status === 'down' ? 'destructive' : 'secondary'}
          className="h-7 rounded-full px-3 text-sm"
        >
          {status === 'loading' && 'Connecting…'}
          {status === 'ok' && 'Server ready'}
          {status === 'down' && 'Server offline'}
        </Badge>
        <div className="flex max-w-full flex-wrap items-center justify-center gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Gamepad2 className="size-7" />
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">AI Quiz</h1>
        </div>
        <p className="max-w-full text-balance text-lg text-muted-foreground">
          A quick game about how well you know AI.
        </p>
        <Button
          size="lg"
          className="h-14 rounded-full px-10 text-lg font-semibold shadow-lg"
        >
          Play
        </Button>
      </section>

      <Card className="w-full rounded-4xl shadow-xl ring-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Trophy className="size-5 text-primary" />
            High scores
          </CardTitle>
          <CardDescription>The board fills up once rounds are finished.</CardDescription>
        </CardHeader>
        <CardContent>
          {scores.length === 0 ? (
            <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-secondary-foreground">
              No scores yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {scores.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3"
                >
                  <span className="min-w-0 truncate font-medium">
                    {index + 1}. {entry.player_name}
                  </span>
                  <span className="shrink-0 tabular-nums">{entry.score}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default App
