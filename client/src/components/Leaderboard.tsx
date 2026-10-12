import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowLeft, Crown, Medal, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getLeaderboard, type Leaderboard, type LeaderboardEntry } from '@/lib/api'
import { getActiveSessionKey } from '@/lib/session-keys'
import { cn } from '@/lib/utils'

const placeStyle = {
  1: {
    label: '1st',
    pedestal: 'h-28 bg-amber-300 text-amber-950',
    row: 'bg-amber-200/80 ring-amber-400',
    Icon: Crown,
  },
  2: {
    label: '2nd',
    pedestal: 'h-20 bg-slate-200 text-slate-800',
    row: 'bg-slate-200/80 ring-slate-400',
    Icon: Medal,
  },
  3: {
    label: '3rd',
    pedestal: 'h-16 bg-orange-300 text-orange-950',
    row: 'bg-orange-200/80 ring-orange-400',
    Icon: Medal,
  },
} as const

export function LeaderboardScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [board, setBoard] = useState<Leaderboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cameFromProfile = (location.state as { from?: string } | null)?.from === 'profile'

  useEffect(() => {
    let cancelled = false
    getLeaderboard(getActiveSessionKey() ?? undefined)
      .then((next) => {
        if (!cancelled) setBoard(next)
      })
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ranked = board?.entries.filter((entry) => entry.rank !== null) ?? []
  const atPlace = (place: 1 | 2 | 3) => ranked.filter((entry) => entry.rank === place)

  return (
    <div className="flex w-full flex-col gap-6">
      <Button
        variant="ghost"
        className="self-start rounded-full"
        onClick={() => navigate(cameFromProfile ? '/profile' : '/')}
      >
        <ArrowLeft /> {cameFromProfile ? 'Back to profile' : 'Back'}
      </Button>

      <header className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-amber-300 text-amber-950 shadow-[0_6px_0_0] shadow-amber-600/50">
          <Trophy className="size-8" />
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Leaderboard</h1>
        <p className="max-w-sm text-balance text-muted-foreground">
          {board
            ? `${board.pointsPerCorrect} points for every right answer, plus ${board.pointsPerQuiz} for each quiz you finish.`
            : 'Points come from quizzes you finish and how many answers you get right.'}
        </p>
      </header>

      {error && (
        <Card className="w-full rounded-2xl px-6 py-8 shadow-xl ring-2">
          <CardContent className="py-4 text-center text-destructive">Couldn’t load the board: {error}</CardContent>
        </Card>
      )}

      {!board && !error && <p className="text-center text-muted-foreground">Loading the board…</p>}

      {board && ranked.length === 0 && (
        <Card className="w-full rounded-2xl px-6 py-8 text-center shadow-xl ring-2">
          <CardContent className="py-6 text-muted-foreground">
            Nobody has finished a quiz yet. Submit one to take the first place.
          </CardContent>
        </Card>
      )}

      {board && ranked.length > 0 && (
        <>
          <div className="grid grid-cols-3 items-end gap-2">
            {([2, 1, 3] as const).map((place) => (
              <Podium key={place} place={place} entries={atPlace(place)} />
            ))}
          </div>

          <ol className="flex flex-col gap-2">
            {board.entries.map((entry, index) => (
              <li key={`${entry.rank ?? 'new'}-${index}`}>
                <Row entry={entry} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

function Podium({ place, entries }: { place: 1 | 2 | 3; entries: LeaderboardEntry[] }) {
  const style = placeStyle[place]
  const shown = entries.slice(0, 2)
  const extra = entries.length - shown.length
  return (
    <div className="flex flex-col items-center gap-2">
      {shown.length > 0 ? (
        <div className="flex max-w-full flex-col items-center gap-1 text-center">
          {shown.map((entry, index) => (
            <span key={index} className="max-w-full truncate text-sm font-semibold">
              {entry.username}
              {entry.you ? ' (you)' : ''}
            </span>
          ))}
          {extra > 0 && <span className="text-xs text-muted-foreground">+{extra} more</span>}
          <span className="text-xs tabular-nums text-muted-foreground">{shown[0].points} pts</span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Open</span>
      )}
      <div
        className={cn(
          'flex w-full items-start justify-center rounded-t-2xl pt-3 text-lg font-semibold shadow-[0_6px_0_0] shadow-foreground/15',
          style.pedestal,
        )}
      >
        {style.label}
      </div>
    </div>
  )
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const place = entry.rank === 1 || entry.rank === 2 || entry.rank === 3 ? placeStyle[entry.rank] : null
  const Icon = place?.Icon

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3 py-3 ring-2 ring-transparent',
        place ? place.row : 'bg-card shadow-md ring-foreground/10',
        entry.you && 'ring-primary',
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background/80 text-base font-semibold tabular-nums">
        {Icon ? <Icon className="size-5" /> : (entry.rank ?? '–')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-semibold">{entry.username}</span>
          {entry.you && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
              You
            </span>
          )}
        </span>
        <span className="block text-xs text-muted-foreground">
          {entry.rank === null
            ? 'No finished quizzes yet'
            : `${entry.quizzesPlayed} finished · ${entry.accuracy}% accuracy`}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-xl font-semibold tabular-nums">{entry.points}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">points</span>
      </span>
    </div>
  )
}
