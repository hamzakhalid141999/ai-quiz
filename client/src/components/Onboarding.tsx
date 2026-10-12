import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Check, Gamepad2, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createUser, deleteUser, lookupUsers, renameUser, type User } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  addStoredSessionKey,
  getActiveSessionKey,
  getStoredSessionKeys,
  removeStoredSessionKey,
  setStoredSessionKeys,
} from '@/lib/session-keys'

const USERNAME_MAX_LENGTH = 24

type OnboardingProps = {
  onContinue: (sessionKey: string) => void
}

export function Onboarding({ onContinue }: OnboardingProps) {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[] | null>(() =>
    getStoredSessionKeys().length === 0 ? [] : null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const sessionKeys = getStoredSessionKeys()
    if (sessionKeys.length === 0) return

    let cancelled = false
    lookupUsers(sessionKeys)
      .then((found) => {
        if (cancelled) return
        setStoredSessionKeys(found.map((user) => user.sessionKey))
        setUsers(found)
        const activeKey = getActiveSessionKey()
        const preselected = found.find((user) => user.sessionKey === activeKey) ?? found[0]
        setSelectedKey(preselected?.sessionKey ?? null)
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreate(username: string) {
    const user = await createUser(username)
    addStoredSessionKey(user.sessionKey)
    onContinue(user.sessionKey)
  }

  async function handleDelete() {
    if (!pendingDelete || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteUser(pendingDelete.sessionKey)
      removeStoredSessionKey(pendingDelete.sessionKey)
      const remaining = (users ?? []).filter((user) => user.sessionKey !== pendingDelete.sessionKey)
      setUsers(remaining)
      setSelectedKey((current) =>
        current === pendingDelete.sessionKey ? (remaining[0]?.sessionKey ?? null) : current,
      )
      setPendingDelete(null)
    } catch (deleteFailure) {
      setDeleteError((deleteFailure as Error).message)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleRename(sessionKey: string, username: string) {
    const updated = await renameUser(sessionKey, username)
    setUsers((current) =>
      current?.map((user) => (user.sessionKey === sessionKey ? updated : user)) ?? current,
    )
    setEditingKey(null)
  }

  const hasUsers = users !== null && users.length > 0

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Gamepad2 className="size-8" />
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">AI Quiz</h1>
        <p className="text-balance text-lg text-muted-foreground">
          A quick game about how well you know AI.
        </p>
        <Button
          variant="secondary"
          className="h-12 rounded-full px-5 text-base font-semibold shadow-[0_5px_0_0] shadow-primary/40 active:translate-y-[5px] active:shadow-none"
          onClick={() => navigate('/leaderboard', { state: { from: 'home' } })}
        >
          <Trophy /> Leaderboard
        </Button>
      </header>

      <Card className="w-full rounded-2xl shadow-xl ring-2 px-6 py-8">
        <CardHeader>
          <CardTitle className="text-2xl">{hasUsers ? 'Who’s playing?' : 'What should we call you?'}</CardTitle>
          <CardDescription>
            {hasUsers ? 'Pick your player or add a new one.' : 'No password needed — just a name.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loadError && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-destructive">
              Couldn’t load players: {loadError}
            </p>
          )}

          {users === null && !loadError && (
            <p className="py-4 text-center text-muted-foreground">Loading players…</p>
          )}

          {users !== null && !hasUsers && (
            <UsernameForm submitLabel="Let’s go" onSubmit={handleCreate} autoFocus />
          )}

          {hasUsers && (
            <>
              <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Players">
                {users.map((user) =>
                  editingKey === user.sessionKey ? (
                    <li key={user.sessionKey}>
                      <UsernameForm
                        initialValue={user.username}
                        submitLabel="Save"
                        onSubmit={(username) => handleRename(user.sessionKey, username)}
                        onCancel={() => setEditingKey(null)}
                        autoFocus
                      />
                    </li>
                  ) : (
                    <li key={user.sessionKey} className="flex items-center gap-2">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selectedKey === user.sessionKey}
                        onClick={() => setSelectedKey(user.sessionKey)}
                        className={cn(
                          'flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-medium transition-all',
                          selectedKey === user.sessionKey
                            ? 'border-primary bg-primary/10'
                            : 'border-transparent bg-secondary hover:border-primary/40',
                        )}
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold uppercase text-primary-foreground">
                          {user.username.charAt(0)}
                        </span>
                        <span className="truncate">{user.username}</span>
                        {selectedKey === user.sessionKey && (
                          <Check className="ml-auto size-5 shrink-0 text-primary" />
                        )}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-14 rounded-2xl"
                        aria-label={`Rename ${user.username}`}
                        onClick={() => setEditingKey(user.sessionKey)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-14 rounded-2xl text-destructive"
                        aria-label={`Delete ${user.username}`}
                        onClick={() => {
                          setDeleteError(null)
                          setPendingDelete(user)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ),
                )}
              </ul>

              {isAdding ? (
                <UsernameForm
                  submitLabel="Add"
                  onSubmit={handleCreate}
                  onCancel={() => setIsAdding(false)}
                  autoFocus
                />
              ) : (
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl border-2 border-dashed text-base"
                  onClick={() => setIsAdding(true)}
                >
                  <Plus /> New player
                </Button>
              )}

              <Button
                size="lg"
                className="h-14 rounded-full text-lg font-semibold shadow-lg"
                disabled={!selectedKey}
                onClick={() => selectedKey && onContinue(selectedKey)}
              >
                Continue
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.username}?`}
          description={
            deleteError
              ? `Couldn’t delete this player: ${deleteError}`
              : 'Their profile and quiz progress will be removed. This can’t be undone.'
          }
          confirmLabel="Delete player"
          destructive
          busy={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => {
            if (!isDeleting) setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

type UsernameFormProps = {
  initialValue?: string
  submitLabel: string
  onSubmit: (username: string) => Promise<void>
  onCancel?: () => void
  autoFocus?: boolean
}

function UsernameForm({ initialValue = '', submitLabel, onSubmit, onCancel, autoFocus }: UsernameFormProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const username = value.trim()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!username || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit(username)
    } catch (submitError) {
      setError((submitError as Error).message)
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && onCancel?.()}
          placeholder="Your username"
          aria-label="Username"
          maxLength={USERNAME_MAX_LENGTH}
          autoFocus={autoFocus}
          className="h-14 rounded-2xl border-2 bg-card px-4 text-lg md:text-lg"
        />
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="size-14 shrink-0 rounded-2xl"
            aria-label="Cancel"
            onClick={onCancel}
          >
            <X />
          </Button>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        className="h-12 rounded-full text-base font-semibold"
        disabled={!username || isSubmitting}
      >
        {isSubmitting ? 'Saving…' : submitLabel}
      </Button>
      {error && <p className="px-2 text-sm text-destructive">{error}</p>}
    </form>
  )
}
