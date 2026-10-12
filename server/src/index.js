import cors from 'cors'
import express from 'express'
import {
  createQuestionSet,
  createUser,
  deleteQuestionSet,
  findUser,
  findUsers,
  deleteUser,
  findOpenAttempt,
  finishAttempt,
  getActiveAttempt,
  getLeaderboard,
  getProgress,
  getQuizProgress,
  leaderboardRules,
  getSavedAnswer,
  listQuestionSets,
  listSavedAnswers,
  openDb,
  renameUser,
  saveAnswer,
  scoreAttempt,
  startAttempt,
  syncQuestionSetCategory,
  updateQuestionSet,
} from './db.js'
import {
  builtinSummaries,
  getPlayableQuestion,
  getPlayableQuiz,
  listMergedCatalog,
  playableQuestionCount,
  resolveCategory,
  titleTaken,
} from './catalog.js'

const PORT = process.env.PORT ?? 3001
const USERNAME_MAX_LENGTH = 24
const LOOKUP_MAX_KEYS = 50
const db = openDb()

const app = express()
app.use(cors())
app.use(express.json())

function parseUsername(value) {
  if (typeof value !== 'string') return null
  const username = value.trim()
  if (username.length === 0 || username.length > USERNAME_MAX_LENGTH) return null
  return username
}

function requireUser(req, res, next) {
  const sessionKey = req.get('X-Session-Key')
  const user = sessionKey ? findUser(db, sessionKey) : null
  if (!user) {
    res.status(401).json({ error: 'Unknown session key' })
    return
  }
  req.user = user
  next()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/leaderboard', (req, res) => {
  const sessionKey = req.get('X-Session-Key')
  const user = sessionKey ? findUser(db, sessionKey) : null
  res.json({
    ...leaderboardRules(),
    entries: getLeaderboard(db, user?.sessionKey ?? null),
  })
})

app.post('/api/users', (req, res) => {
  const username = parseUsername(req.body?.username)
  if (!username) {
    res.status(400).json({ error: `Username must be 1-${USERNAME_MAX_LENGTH} characters` })
    return
  }
  res.status(201).json(createUser(db, username))
})

app.post('/api/users/lookup', (req, res) => {
  const sessionKeys = req.body?.sessionKeys
  if (!Array.isArray(sessionKeys)) {
    res.status(400).json({ error: 'sessionKeys must be an array' })
    return
  }
  const validKeys = sessionKeys.filter((key) => typeof key === 'string').slice(0, LOOKUP_MAX_KEYS)
  res.json(findUsers(db, validKeys))
})

app.get('/api/me', requireUser, (req, res) => {
  res.json({ ...req.user, progress: getProgress(db, req.user.sessionKey) })
})

function answersForClient(attempt) {
  return listSavedAnswers(db, attempt.id).flatMap((answer) => {
    const question = getPlayableQuestion(db, attempt.quizId, answer.questionId)
    if (!question) return []
    return [
      {
        questionId: answer.questionId,
        choiceIndex: answer.choiceIndex,
        correct: answer.correct,
        correctChoiceIndex: question.answerIndex,
        pointsAwarded: answer.correct ? 1 : 0,
      },
    ]
  })
}

const CATEGORY_NAME_MAX = 40
const DESCRIPTION_MAX = 120
const QUIZ_TITLE_MAX = 32
const PROMPT_MAX = 300
const CHOICE_MAX = 80
const MAX_QUESTIONS = 20
const MAX_CHOICES = 4

function parseQuestionSet(body) {
  const categoryName = typeof body?.categoryName === 'string' ? body.categoryName.trim() : ''
  const categoryDescription = typeof body?.categoryDescription === 'string' ? body.categoryDescription.trim() : ''
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!categoryName || categoryName.length > CATEGORY_NAME_MAX) {
    return { error: `Category name must be 1-${CATEGORY_NAME_MAX} characters` }
  }
  if (categoryDescription.length > DESCRIPTION_MAX) {
    return { error: `Description must be at most ${DESCRIPTION_MAX} characters` }
  }
  if (!title || title.length > QUIZ_TITLE_MAX) {
    return { error: `Quiz name must be 1-${QUIZ_TITLE_MAX} characters` }
  }
  if (!Array.isArray(body?.questions) || body.questions.length < 1 || body.questions.length > MAX_QUESTIONS) {
    return { error: `Add 1-${MAX_QUESTIONS} questions` }
  }

  const questions = []
  for (const [index, question] of body.questions.entries()) {
    const prompt = typeof question?.prompt === 'string' ? question.prompt.trim() : ''
    if (!prompt || prompt.length > PROMPT_MAX) return { error: `Question ${index + 1} needs a prompt` }
    if (!Array.isArray(question?.choices) || question.choices.length < 2 || question.choices.length > MAX_CHOICES) {
      return { error: `Question ${index + 1} needs 2-${MAX_CHOICES} choices` }
    }
    const choices = []
    for (const choice of question.choices) {
      if (typeof choice !== 'string' || choice.trim().length === 0 || choice.trim().length > CHOICE_MAX) {
        return { error: `Question ${index + 1} has an empty choice` }
      }
      choices.push(choice.trim())
    }
    if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= choices.length) {
      return { error: `Question ${index + 1} needs a correct choice` }
    }
    questions.push({ prompt, choices, answerIndex: question.answerIndex })
  }

  return { categoryName, categoryDescription, title, questions }
}

function saveQuestionSet(req, res, existingId) {
  const parsed = parseQuestionSet(req.body)
  if (parsed.error) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const category = resolveCategory(db, parsed.categoryName, parsed.categoryDescription)
  const categoryDescription =
    category.fromBuiltin || !parsed.categoryDescription
      ? category.categoryDescription
      : parsed.categoryDescription
  if (titleTaken(db, category.categoryId, parsed.title, existingId ?? '')) {
    res.status(409).json({ error: 'That category already has a quiz with this name' })
    return
  }
  const fields = {
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    categoryDescription,
    title: parsed.title,
    questions: parsed.questions,
  }
  const saved = existingId ? updateQuestionSet(db, existingId, fields) : createQuestionSet(db, fields)
  if (saved && !category.fromBuiltin) {
    syncQuestionSetCategory(db, fields.categoryId, fields.categoryName, fields.categoryDescription)
  }
  if (!saved) {
    res.status(404).json({ error: 'Question set not found' })
    return
  }
  res.status(existingId ? 200 : 201).json(saved)
}

app.get('/api/settings/question-sets', (_req, res) => {
  res.json({ builtin: builtinSummaries(), sets: listQuestionSets(db) })
})

app.post('/api/settings/question-sets', (req, res) => {
  saveQuestionSet(req, res)
})

app.put('/api/settings/question-sets/:id', (req, res) => {
  if (!listQuestionSets(db).some((set) => set.id === req.params.id)) {
    res.status(404).json({ error: 'Question set not found' })
    return
  }
  saveQuestionSet(req, res, req.params.id)
})

app.delete('/api/settings/question-sets/:id', (req, res) => {
  if (!deleteQuestionSet(db, req.params.id)) {
    res.status(404).json({ error: 'Question set not found' })
    return
  }
  res.json({ ok: true })
})

app.get('/api/quizzes', requireUser, (req, res) => {
  const progress = getQuizProgress(db, req.user.sessionKey)
  res.json(
    listMergedCatalog(db).map((category) => ({
      ...category,
      quizzes: category.quizzes.map((quiz) => ({
        ...quiz,
        status: progress[quiz.id]?.status ?? 'new',
        answeredCount: progress[quiz.id]?.answeredCount ?? 0,
        score: progress[quiz.id]?.score ?? null,
      })),
    })),
  )
})

app.post('/api/quizzes/:quizId/attempts', requireUser, (req, res) => {
  const quiz = getPlayableQuiz(db, req.params.quizId)
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found' })
    return
  }
  const existing = findOpenAttempt(db, req.user.sessionKey, quiz.id)
  const attempt = existing ?? startAttempt(db, req.user.sessionKey, quiz.id)
  res.status(existing ? 200 : 201).json({
    attemptId: attempt.id,
    resumed: Boolean(existing),
    ...quiz,
    answers: answersForClient(attempt),
  })
})

app.post('/api/attempts/:attemptId/answers', requireUser, (req, res) => {
  const attempt = getActiveAttempt(db, req.params.attemptId)
  if (!attempt || attempt.sessionKey !== req.user.sessionKey) {
    res.status(404).json({ error: 'Attempt not found' })
    return
  }
  if (attempt.finished) {
    res.status(409).json({ error: 'Quiz already finished' })
    return
  }

  const { questionId, choiceIndex } = req.body ?? {}
  const question = typeof questionId === 'string' ? getPlayableQuestion(db, attempt.quizId, questionId) : null
  if (!question) {
    res.status(400).json({ error: 'Unknown question' })
    return
  }
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= question.choices.length) {
    res.status(400).json({ error: 'Choice is out of range' })
    return
  }

  const alreadySaved = getSavedAnswer(db, attempt.id, question.id)
  if (!alreadySaved) {
    saveAnswer(db, attempt.id, question.id, choiceIndex, choiceIndex === question.answerIndex)
  }

  const totalQuestions = playableQuestionCount(db, attempt.quizId)
  const { answered, score } = scoreAttempt(db, attempt.id)

  const gradedChoice = alreadySaved?.choiceIndex ?? choiceIndex
  const correct = gradedChoice === question.answerIndex
  res.json({
    questionId: question.id,
    correct,
    correctChoiceIndex: question.answerIndex,
    pointsAwarded: correct ? 1 : 0,
    score,
    answeredCount: answered,
    totalQuestions,
    finished: false,
    message: correct
      ? 'Saved! That’s the right answer — you get 1 point.'
      : 'Saved. That’s not the one — the highlighted choice is right.',
  })
})

app.post('/api/attempts/:attemptId/submit', requireUser, (req, res) => {
  const attempt = getActiveAttempt(db, req.params.attemptId)
  if (!attempt || attempt.sessionKey !== req.user.sessionKey) {
    res.status(404).json({ error: 'Attempt not found' })
    return
  }
  if (attempt.finished) {
    res.status(409).json({ error: 'Quiz already submitted' })
    return
  }

  const totalQuestions = playableQuestionCount(db, attempt.quizId)
  const { answered, score } = scoreAttempt(db, attempt.id)
  if (answered !== totalQuestions) {
    res.status(400).json({ error: 'Answer every question before submitting' })
    return
  }

  finishAttempt(db, attempt, totalQuestions)
  res.json({ score, totalQuestions, submitted: true })
})

app.delete('/api/me', requireUser, (req, res) => {
  deleteUser(db, req.user.sessionKey)
  res.json({ ok: true })
})

app.patch('/api/me', requireUser, (req, res) => {
  const username = parseUsername(req.body?.username)
  if (!username) {
    res.status(400).json({ error: `Username must be 1-${USERNAME_MAX_LENGTH} characters` })
    return
  }
  res.json(renameUser(db, req.user.sessionKey, username))
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
