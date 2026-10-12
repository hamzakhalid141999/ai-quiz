export type User = {
  sessionKey: string
  username: string
  createdAt: string
}

export type Progress = {
  quizzesPlayed: number
  bestScore: number
  accuracy: number
}

export type Profile = User & { progress: Progress }

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  sessionKey?: string
}

async function request<T>(path: string, { method = 'GET', body, sessionKey }: RequestOptions = {}) {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (sessionKey) headers['X-Session-Key'] = sessionKey

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(data?.error ?? `Request failed (${response.status})`, response.status)
  }
  return data as T
}

export function createUser(username: string) {
  return request<User>('/api/users', { method: 'POST', body: { username } })
}

export function lookupUsers(sessionKeys: string[]) {
  return request<User[]>('/api/users/lookup', { method: 'POST', body: { sessionKeys } })
}

export function getProfile(sessionKey: string) {
  return request<Profile>('/api/me', { sessionKey })
}

export type LeaderboardEntry = {
  rank: number | null
  username: string
  points: number
  quizzesPlayed: number
  accuracy: number
  you: boolean
}

export type Leaderboard = {
  pointsPerCorrect: number
  pointsPerQuiz: number
  entries: LeaderboardEntry[]
}

export function getLeaderboard(sessionKey?: string) {
  return request<Leaderboard>('/api/leaderboard', { sessionKey })
}

export function renameUser(sessionKey: string, username: string) {
  return request<User>('/api/me', { method: 'PATCH', body: { username }, sessionKey })
}

export function deleteUser(sessionKey: string) {
  return request<{ ok: true }>('/api/me', { method: 'DELETE', sessionKey })
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export type QuizSummary = {
  id: string
  difficulty: Difficulty | 'custom'
  title: string
  questionCount: number
  status: 'new' | 'in_progress' | 'submitted'
  answeredCount: number
  score: number | null
}

export type Category = {
  id: string
  name: string
  description: string
  quizzes: QuizSummary[]
}

export type PublicQuestion = {
  id: string
  prompt: string
  choices: string[]
}

export type RestoredAnswer = {
  questionId: string
  choiceIndex: number
  correct: boolean
  correctChoiceIndex: number
  pointsAwarded: number
}

export type StartedQuiz = {
  attemptId: string
  resumed: boolean
  id: string
  categoryName: string
  difficulty: Difficulty | 'custom'
  title: string
  questionCount: number
  questions: PublicQuestion[]
  answers: RestoredAnswer[]
}

export type Grade = {
  questionId: string
  correct: boolean
  correctChoiceIndex: number
  pointsAwarded: number
  score: number
  answeredCount: number
  totalQuestions: number
  finished: boolean
  message: string
}

export function listQuizzes(sessionKey: string) {
  return request<Category[]>('/api/quizzes', { sessionKey })
}

export function startQuiz(sessionKey: string, quizId: string) {
  return request<StartedQuiz>(`/api/quizzes/${quizId}/attempts`, { method: 'POST', sessionKey })
}

export function submitQuiz(sessionKey: string, attemptId: string) {
  return request<{ score: number; totalQuestions: number; submitted: true }>(
    `/api/attempts/${attemptId}/submit`,
    { method: 'POST', sessionKey },
  )
}

export type QuestionDraft = {
  prompt: string
  choices: string[]
  answerIndex: number
}

export type QuestionSetInput = {
  categoryName: string
  categoryDescription: string
  title: string
  questions: QuestionDraft[]
}

export type QuestionSet = {
  id: string
  categoryId: string
  categoryName: string
  categoryDescription: string
  title: string
  questions: Array<QuestionDraft & { id: string }>
}

export type SettingsLibrary = {
  builtin: Array<{
    id: string
    name: string
    quizzes: Array<{ title: string; questionCount: number }>
  }>
  sets: QuestionSet[]
}

export function getQuestionSets() {
  return request<SettingsLibrary>('/api/settings/question-sets')
}

export function createQuestionSet(input: QuestionSetInput) {
  return request<QuestionSet>('/api/settings/question-sets', { method: 'POST', body: input })
}

export function updateQuestionSet(id: string, input: QuestionSetInput) {
  return request<QuestionSet>(`/api/settings/question-sets/${id}`, { method: 'PUT', body: input })
}

export function deleteQuestionSet(id: string) {
  return request<{ ok: true }>(`/api/settings/question-sets/${id}`, { method: 'DELETE' })
}

export function submitAnswer(
  sessionKey: string,
  attemptId: string,
  questionId: string,
  choiceIndex: number,
) {
  return request<Grade>(`/api/attempts/${attemptId}/answers`, {
    method: 'POST',
    sessionKey,
    body: { questionId, choiceIndex },
  })
}
