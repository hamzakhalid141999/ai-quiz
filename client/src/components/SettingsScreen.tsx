import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Check, Library, Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  createQuestionSet,
  deleteQuestionSet,
  getQuestionSets,
  updateQuestionSet,
  type QuestionSet,
  type QuestionSetInput,
  type SettingsLibrary,
} from '@/lib/api'
import { cn } from '@/lib/utils'

type DraftQuestion = {
  key: string
  prompt: string
  choices: string[]
  answerIndex: number
}

type Draft = {
  categoryName: string
  categoryDescription: string
  title: string
  questions: DraftQuestion[]
}

function blankQuestion(): DraftQuestion {
  return { key: crypto.randomUUID(), prompt: '', choices: ['', ''], answerIndex: 0 }
}

function blankDraft(): Draft {
  return { categoryName: '', categoryDescription: '', title: '', questions: [blankQuestion()] }
}

function toInput(draft: Draft): QuestionSetInput {
  return {
    categoryName: draft.categoryName.trim(),
    categoryDescription: draft.categoryDescription.trim(),
    title: draft.title.trim(),
    questions: draft.questions.map((question) => ({
      prompt: question.prompt.trim(),
      choices: question.choices.map((choice) => choice.trim()),
      answerIndex: question.answerIndex,
    })),
  }
}

export function SettingsScreen() {
  const navigate = useNavigate()
  const [library, setLibrary] = useState<SettingsLibrary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<QuestionSet | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  function load() {
    return getQuestionSets()
      .then(setLibrary)
      .catch((loadError: Error) => setError(loadError.message))
  }

  useEffect(() => {
    let cancelled = false
    getQuestionSets()
      .then((next) => {
        if (!cancelled) setLibrary(next)
      })
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categoryNames = [
    ...new Set([
      ...(library?.builtin.map((category) => category.name) ?? []),
      ...(library?.sets.map((set) => set.categoryName) ?? []),
    ]),
  ]

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) => (question.key === key ? { ...question, ...patch } : question)),
    }))
  }

  async function handleSave() {
    if (isSaving) return
    setIsSaving(true)
    setFormError(null)
    const input = toInput(draft)
    try {
      if (editingId) await updateQuestionSet(editingId, input)
      else {
        await createQuestionSet(input)
        showToast('Question set added successfully')
      }
      setDraft(blankDraft())
      setEditingId(null)
      await load()
    } catch (saveError) {
      setFormError((saveError as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  function startEdit(set: QuestionSet) {
    setEditingId(set.id)
    setFormError(null)
    setDraft({
      categoryName: set.categoryName,
      categoryDescription: set.categoryDescription,
      title: set.title,
      questions: set.questions.map((question) => ({
        key: question.id,
        prompt: question.prompt,
        choices: [...question.choices],
        answerIndex: question.answerIndex,
      })),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete() {
    if (!pendingDelete || isDeleting) return
    setIsDeleting(true)
    try {
      await deleteQuestionSet(pendingDelete.id)
      if (editingId === pendingDelete.id) {
        setEditingId(null)
        setDraft(blankDraft())
      }
      setPendingDelete(null)
      await load()
    } catch (deleteError) {
      setFormError((deleteError as Error).message)
      setPendingDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const grouped = new Map<string, QuestionSet[]>()
  for (const set of library?.sets ?? []) {
    const list = grouped.get(set.categoryName) ?? []
    list.push(set)
    grouped.set(set.categoryName, list)
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {toast && (
        <div
          role="status"
          className="animate-in fade-in slide-in-from-top-3 fixed top-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 font-semibold text-white shadow-[0_5px_0_0] shadow-emerald-800"
        >
          <Check className="size-5" />
          {toast}
        </div>
      )}
      <Button variant="ghost" className="self-start rounded-full" onClick={() => navigate('/')}>
        <ArrowLeft /> Back
      </Button>

      <header className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Library className="size-8" />
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
        <p className="max-w-sm text-balance text-muted-foreground">
          Add a category or another quiz. Every player sees new question sets on their profile.
        </p>
      </header>

      {error && <p className="text-center text-destructive">Couldn’t load settings: {error}</p>}

      <Card className="w-full rounded-2xl px-6 py-8 shadow-xl ring-2">
        <CardHeader>
          <CardTitle className="text-2xl">{editingId ? 'Edit question set' : 'New question set'}</CardTitle>
          <CardDescription>
            Use a category you already have, or type a new one. Mark which choice is right — players only see that
            after they answer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Category
            <Input
              value={draft.categoryName}
              onChange={(event) => setDraft({ ...draft, categoryName: event.target.value })}
              list="quiz-categories"
              placeholder="Robot Ethics"
              maxLength={40}
              className="h-12 rounded-2xl border-2 px-4 text-base md:text-base"
            />
            <datalist id="quiz-categories">
              {categoryNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Description
            <Input
              value={draft.categoryDescription}
              onChange={(event) => setDraft({ ...draft, categoryDescription: event.target.value })}
              placeholder="Shown when this category is new"
              maxLength={120}
              className="h-12 rounded-2xl border-2 px-4 text-base md:text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Quiz name
            <Input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Warm-up"
              maxLength={32}
              className="h-12 rounded-2xl border-2 px-4 text-base md:text-base"
            />
          </label>

          {draft.questions.map((question, questionIndex) => (
            <fieldset key={question.key} className="flex flex-col gap-2 rounded-2xl bg-secondary/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <legend className="text-sm font-semibold">Question {questionIndex + 1}</legend>
                {draft.questions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        questions: current.questions.filter((item) => item.key !== question.key),
                      }))
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
              <Input
                value={question.prompt}
                onChange={(event) => updateQuestion(question.key, { prompt: event.target.value })}
                placeholder="Ask something"
                aria-label={`Question ${questionIndex + 1} prompt`}
                maxLength={300}
                className="h-12 rounded-2xl border-2 bg-card px-4 text-base md:text-base"
              />
              {question.choices.map((choice, choiceIndex) => (
                <div key={choiceIndex} className="flex items-center gap-2">
                  <Input
                    value={choice}
                    onChange={(event) => {
                      const choices = [...question.choices]
                      choices[choiceIndex] = event.target.value
                      updateQuestion(question.key, { choices })
                    }}
                    placeholder={`Choice ${choiceIndex + 1}`}
                    aria-label={`Question ${questionIndex + 1} choice ${choiceIndex + 1}`}
                    maxLength={80}
                    className="h-11 rounded-2xl border-2 bg-card px-4 md:text-base"
                  />
                  <Button
                    type="button"
                    variant={question.answerIndex === choiceIndex ? 'default' : 'outline'}
                    className={cn(
                      'h-11 shrink-0 rounded-2xl px-3',
                      question.answerIndex === choiceIndex && 'shadow-[0_3px_0_0] shadow-primary/40',
                    )}
                    aria-pressed={question.answerIndex === choiceIndex}
                    onClick={() => updateQuestion(question.key, { answerIndex: choiceIndex })}
                  >
                    {question.answerIndex === choiceIndex ? 'Right' : 'Mark'}
                  </Button>
                  {question.choices.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 rounded-2xl"
                      aria-label={`Remove choice ${choiceIndex + 1}`}
                      onClick={() => {
                        const choices = question.choices.filter((_, index) => index !== choiceIndex)
                        const answerIndex =
                          question.answerIndex === choiceIndex
                            ? 0
                            : question.answerIndex > choiceIndex
                              ? question.answerIndex - 1
                              : question.answerIndex
                        updateQuestion(question.key, { choices, answerIndex })
                      }}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
              {question.choices.length < 4 && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-2xl border-dashed"
                  onClick={() => updateQuestion(question.key, { choices: [...question.choices, ''] })}
                >
                  <Plus /> Add choice
                </Button>
              )}
            </fieldset>
          ))}

          {draft.questions.length < 20 && (
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-2xl border-2 border-dashed"
              onClick={() => setDraft((current) => ({ ...current, questions: [...current.questions, blankQuestion()] }))}
            >
              <Plus /> Add question
            </Button>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex gap-2">
            {editingId && (
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 rounded-full"
                onClick={() => {
                  setEditingId(null)
                  setDraft(blankDraft())
                  setFormError(null)
                }}
              >
                Cancel
              </Button>
            )}
            <Button
              type="button"
              className="h-12 flex-1 rounded-full text-base font-semibold shadow-[0_4px_0_0] shadow-primary/40 active:translate-y-1 active:shadow-none"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Add question set'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-center text-2xl font-semibold">Your question sets</h2>
        {library && library.sets.length === 0 && (
          <p className="text-center text-muted-foreground">None yet. The first one you add shows up here.</p>
        )}
        {[...grouped.entries()].map(([categoryName, sets]) => (
          <Card key={categoryName} className="w-full rounded-2xl px-6 py-6 shadow-xl ring-2">
            <CardHeader>
              <CardTitle className="text-xl">{categoryName}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {sets.map((set) => (
                <div key={set.id} className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{set.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {set.questions.length} {set.questions.length === 1 ? 'question' : 'questions'}
                    </p>
                  </div>
                  <Button variant="outline" className="rounded-full" onClick={() => startEdit(set)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-2xl text-destructive"
                    aria-label={`Delete ${set.title}`}
                    onClick={() => setPendingDelete(set)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-center text-2xl font-semibold">Included quizzes</h2>
        <p className="text-center text-sm text-muted-foreground">
          These stay as they are. Add a quiz with the same category name to put it beside them.
        </p>
        {library?.builtin.map((category) => (
          <Card key={category.id} className="w-full rounded-2xl px-6 py-6 shadow-md ring-1">
            <CardHeader>
              <CardTitle className="text-lg">{category.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {category.quizzes.map((quiz) => (
                <span key={quiz.title} className="rounded-full bg-muted px-3 py-1 text-sm">
                  {quiz.title} · {quiz.questionCount}
                </span>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.title}?`}
          description="Players won’t see this quiz anymore. Scores already submitted stay on the leaderboard."
          confirmLabel="Delete quiz"
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
