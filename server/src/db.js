import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')

export function openDb() {
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new Database(path.join(dataDir, 'quiz.db'))
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      session_key TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL REFERENCES users(session_key) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      completed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS active_attempts (
      id TEXT PRIMARY KEY,
      session_key TEXT NOT NULL REFERENCES users(session_key) ON DELETE CASCADE,
      quiz_id TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attempt_answers (
      attempt_id TEXT NOT NULL REFERENCES active_attempts(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      choice_index INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      PRIMARY KEY (attempt_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS question_sets (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      category_description TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS question_set_questions (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      choices TEXT NOT NULL,
      answer_index INTEGER NOT NULL
    );
  `)

  const attemptColumns = db.prepare('PRAGMA table_info(quiz_attempts)').all()
  if (!attemptColumns.some((column) => column.name === 'quiz_id')) {
    db.exec('ALTER TABLE quiz_attempts ADD COLUMN quiz_id TEXT')
  }

  return db
}

function toUser(row) {
  return {
    sessionKey: row.session_key,
    username: row.username,
    createdAt: row.created_at,
  }
}

export function createUser(db, username) {
  const sessionKey = crypto.randomUUID()
  db.prepare('INSERT INTO users (session_key, username) VALUES (?, ?)').run(sessionKey, username)
  return findUser(db, sessionKey)
}

export function findUser(db, sessionKey) {
  const row = db
    .prepare('SELECT session_key, username, created_at FROM users WHERE session_key = ?')
    .get(sessionKey)
  return row ? toUser(row) : null
}

export function findUsers(db, sessionKeys) {
  if (sessionKeys.length === 0) return []

  const placeholders = sessionKeys.map(() => '?').join(', ')
  return db
    .prepare(
      `SELECT session_key, username, created_at
       FROM users
       WHERE session_key IN (${placeholders})
       ORDER BY created_at ASC`,
    )
    .all(...sessionKeys)
    .map(toUser)
}

export function deleteUser(db, sessionKey) {
  const result = db.prepare('DELETE FROM users WHERE session_key = ?').run(sessionKey)
  return result.changes > 0
}

export function renameUser(db, sessionKey, username) {
  db.prepare(
    `UPDATE users SET username = ?, updated_at = datetime('now') WHERE session_key = ?`,
  ).run(username, sessionKey)
  return findUser(db, sessionKey)
}

export function findOpenAttempt(db, sessionKey, quizId) {
  const row = db
    .prepare(
      `SELECT id, session_key, quiz_id, finished_at
       FROM active_attempts
       WHERE session_key = ? AND quiz_id = ? AND finished_at IS NULL
       ORDER BY rowid DESC
       LIMIT 1`,
    )
    .get(sessionKey, quizId)
  if (!row) return null
  return {
    id: row.id,
    sessionKey: row.session_key,
    quizId: row.quiz_id,
    finished: false,
  }
}

export function listSavedAnswers(db, attemptId) {
  return db
    .prepare(
      `SELECT question_id, choice_index, correct
       FROM attempt_answers
       WHERE attempt_id = ?`,
    )
    .all(attemptId)
    .map((row) => ({
      questionId: row.question_id,
      choiceIndex: row.choice_index,
      correct: row.correct === 1,
    }))
}

export function getQuizProgress(db, sessionKey) {
  const openAttempts = db
    .prepare(
      `SELECT a.quiz_id, COUNT(ans.question_id) AS answered_count
       FROM active_attempts a
       LEFT JOIN attempt_answers ans ON ans.attempt_id = a.id
       WHERE a.session_key = ? AND a.finished_at IS NULL
       GROUP BY a.id`,
    )
    .all(sessionKey)

  const submittedAttempts = db
    .prepare(
      `SELECT quiz_id, score, total_questions
       FROM quiz_attempts
       WHERE session_key = ?
       ORDER BY id DESC`,
    )
    .all(sessionKey)

  const progress = {}
  for (const attempt of submittedAttempts) {
    if (progress[attempt.quiz_id]) continue
    progress[attempt.quiz_id] = {
      status: 'submitted',
      answeredCount: attempt.total_questions,
      score: attempt.score,
    }
  }
  for (const attempt of openAttempts) {
    progress[attempt.quiz_id] = {
      status: 'in_progress',
      answeredCount: attempt.answered_count,
      score: null,
    }
  }
  return progress
}

export function startAttempt(db, sessionKey, quizId) {
  const id = crypto.randomUUID()
  db.prepare('INSERT INTO active_attempts (id, session_key, quiz_id) VALUES (?, ?, ?)').run(
    id,
    sessionKey,
    quizId,
  )
  return { id, sessionKey, quizId }
}

export function getActiveAttempt(db, attemptId) {
  const row = db
    .prepare('SELECT id, session_key, quiz_id, finished_at FROM active_attempts WHERE id = ?')
    .get(attemptId)
  if (!row) return null
  return {
    id: row.id,
    sessionKey: row.session_key,
    quizId: row.quiz_id,
    finished: row.finished_at !== null,
  }
}

export function getSavedAnswer(db, attemptId, questionId) {
  const row = db
    .prepare(
      'SELECT choice_index, correct FROM attempt_answers WHERE attempt_id = ? AND question_id = ?',
    )
    .get(attemptId, questionId)
  return row ? { choiceIndex: row.choice_index, correct: row.correct === 1 } : null
}

export function saveAnswer(db, attemptId, questionId, choiceIndex, correct) {
  db.prepare(
    `INSERT INTO attempt_answers (attempt_id, question_id, choice_index, correct)
     VALUES (?, ?, ?, ?)`,
  ).run(attemptId, questionId, choiceIndex, correct ? 1 : 0)
}

export function scoreAttempt(db, attemptId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS answered, COALESCE(SUM(correct), 0) AS score
       FROM attempt_answers
       WHERE attempt_id = ?`,
    )
    .get(attemptId)
  return { answered: row.answered, score: row.score }
}

export function finishAttempt(db, attempt, totalQuestions) {
  const { score } = scoreAttempt(db, attempt.id)
  const record = db.transaction(() => {
    db.prepare(
      `INSERT INTO quiz_attempts (session_key, quiz_id, score, total_questions)
       VALUES (?, ?, ?, ?)`,
    ).run(attempt.sessionKey, attempt.quizId, score, totalQuestions)
    db.prepare(`UPDATE active_attempts SET finished_at = datetime('now') WHERE id = ?`).run(attempt.id)
    return score
  })
  return record()
}

const POINTS_PER_CORRECT = 10
const POINTS_PER_QUIZ = 15

export function leaderboardRules() {
  return { pointsPerCorrect: POINTS_PER_CORRECT, pointsPerQuiz: POINTS_PER_QUIZ }
}

export function getLeaderboard(db, sessionKey = null) {
  const rows = db
    .prepare(
      `SELECT
         u.session_key,
         u.username,
         COUNT(qa.id) AS quizzes_played,
         COALESCE(SUM(qa.score), 0) AS total_correct,
         COALESCE(SUM(qa.total_questions), 0) AS total_questions
       FROM users u
       LEFT JOIN quiz_attempts qa ON qa.session_key = u.session_key
       GROUP BY u.session_key`,
    )
    .all()

  const entries = rows.map((row) => {
    const quizzesPlayed = row.quizzes_played
    const accuracy =
      row.total_questions === 0 ? 0 : Math.round((row.total_correct / row.total_questions) * 100)
    return {
      username: row.username,
      quizzesPlayed,
      accuracy,
      points:
        quizzesPlayed === 0 ? 0 : row.total_correct * POINTS_PER_CORRECT + quizzesPlayed * POINTS_PER_QUIZ,
      you: sessionKey !== null && row.session_key === sessionKey,
      rank: null,
    }
  })

  const ranked = entries
    .filter((entry) => entry.quizzesPlayed > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.accuracy - a.accuracy ||
        b.quizzesPlayed - a.quizzesPlayed ||
        a.username.localeCompare(b.username),
    )

  let lastPoints = null
  ranked.forEach((entry, index) => {
    if (entry.points !== lastPoints) {
      entry.rank = index + 1
      lastPoints = entry.points
    } else {
      entry.rank = ranked[index - 1].rank
    }
  })

  const unranked = entries
    .filter((entry) => entry.quizzesPlayed === 0)
    .sort((a, b) => a.username.localeCompare(b.username))

  return [...ranked, ...unranked]
}

function toQuestionSet(row, questions) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryDescription: row.category_description,
    title: row.title,
    questions,
  }
}

function questionsForSet(rows) {
  return rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    choices: JSON.parse(row.choices),
    answerIndex: row.answer_index,
  }))
}

export function listQuestionSets(db) {
  const sets = db
    .prepare(
      `SELECT id, category_id, category_name, category_description, title
       FROM question_sets
       ORDER BY created_at ASC, rowid ASC`,
    )
    .all()
  const questions = db
    .prepare(
      `SELECT id, set_id, prompt, choices, answer_index
       FROM question_set_questions
       ORDER BY position ASC`,
    )
    .all()
  const bySet = new Map()
  for (const question of questions) {
    const list = bySet.get(question.set_id) ?? []
    list.push(question)
    bySet.set(question.set_id, list)
  }
  return sets.map((set) => toQuestionSet(set, questionsForSet(bySet.get(set.id) ?? [])))
}

export function getQuestionSet(db, id) {
  const row = db
    .prepare(
      `SELECT id, category_id, category_name, category_description, title
       FROM question_sets
       WHERE id = ?`,
    )
    .get(id)
  if (!row) return null
  const questions = db
    .prepare(
      `SELECT id, prompt, choices, answer_index
       FROM question_set_questions
       WHERE set_id = ?
       ORDER BY position ASC`,
    )
    .all(id)
  return toQuestionSet(row, questionsForSet(questions))
}

export function findQuestionSetCategory(db, categoryName) {
  return db
    .prepare(
      `SELECT category_id, category_name, category_description
       FROM question_sets
       WHERE category_name = ? COLLATE NOCASE
       LIMIT 1`,
    )
    .get(categoryName)
}

export function categoryIdTaken(db, categoryId) {
  return Boolean(db.prepare('SELECT 1 FROM question_sets WHERE category_id = ? LIMIT 1').get(categoryId))
}

export function questionSetTitleTaken(db, categoryId, title, exceptId = '') {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM question_sets
         WHERE category_id = ? AND title = ? COLLATE NOCASE AND id != ?
         LIMIT 1`,
      )
      .get(categoryId, title, exceptId),
  )
}

function insertQuestions(db, setId, questions) {
  const insert = db.prepare(
    `INSERT INTO question_set_questions (id, set_id, position, prompt, choices, answer_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  questions.forEach((question, position) => {
    insert.run(
      crypto.randomUUID(),
      setId,
      position,
      question.prompt,
      JSON.stringify(question.choices),
      question.answerIndex,
    )
  })
}

export function syncQuestionSetCategory(db, categoryId, categoryName, categoryDescription) {
  db.prepare(
    `UPDATE question_sets
     SET category_name = ?, category_description = ?
     WHERE category_id = ?`,
  ).run(categoryName, categoryDescription, categoryId)
}

export function clearOpenAttempts(db, quizId) {
  db.prepare('DELETE FROM active_attempts WHERE quiz_id = ? AND finished_at IS NULL').run(quizId)
}

export function createQuestionSet(db, fields) {
  const id = `custom-${crypto.randomUUID()}`
  db.transaction(() => {
    db.prepare(
      `INSERT INTO question_sets (id, category_id, category_name, category_description, title)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, fields.categoryId, fields.categoryName, fields.categoryDescription, fields.title)
    insertQuestions(db, id, fields.questions)
  })()
  return getQuestionSet(db, id)
}

export function updateQuestionSet(db, id, fields) {
  if (!getQuestionSet(db, id)) return null
  db.transaction(() => {
    db.prepare(
      `UPDATE question_sets
       SET category_id = ?, category_name = ?, category_description = ?, title = ?
       WHERE id = ?`,
    ).run(fields.categoryId, fields.categoryName, fields.categoryDescription, fields.title, id)
    db.prepare('DELETE FROM question_set_questions WHERE set_id = ?').run(id)
    insertQuestions(db, id, fields.questions)
    clearOpenAttempts(db, id)
  })()
  return getQuestionSet(db, id)
}

export function deleteQuestionSet(db, id) {
  const removed = db.transaction(() => {
    clearOpenAttempts(db, id)
    return db.prepare('DELETE FROM question_sets WHERE id = ?').run(id).changes > 0
  })
  return removed()
}

export function getProgress(db, sessionKey) {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS quizzes_played,
         COALESCE(MAX(score), 0) AS best_score,
         COALESCE(SUM(score), 0) AS total_correct,
         COALESCE(SUM(total_questions), 0) AS total_questions
       FROM quiz_attempts
       WHERE session_key = ?`,
    )
    .get(sessionKey)

  return {
    quizzesPlayed: row.quizzes_played,
    bestScore: row.best_score,
    accuracy:
      row.total_questions === 0
        ? 0
        : Math.round((row.total_correct / row.total_questions) * 100),
  }
}
