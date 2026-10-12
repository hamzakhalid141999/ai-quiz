import crypto from 'node:crypto'
import {
  categoryIdTaken,
  findQuestionSetCategory,
  getQuestionSet,
  listQuestionSets,
  questionSetTitleTaken,
} from './db.js'
import { categories, getPublicQuiz, getQuestion, listCatalog, questionCount } from './quizzes.js'

export const difficultyTitle = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return slug || 'set'
}

export function builtinSummaries() {
  return listCatalog().map((category) => ({
    id: category.id,
    name: category.name,
    quizzes: category.quizzes.map((quiz) => ({
      title: difficultyTitle[quiz.difficulty],
      questionCount: quiz.questionCount,
    })),
  }))
}

export function resolveCategory(db, categoryName, categoryDescription) {
  const builtin = categories.find((category) => category.name.toLowerCase() === categoryName.toLowerCase())
  if (builtin) {
    return {
      categoryId: builtin.id,
      categoryName: builtin.name,
      categoryDescription: builtin.description,
      fromBuiltin: true,
    }
  }

  const existing = findQuestionSetCategory(db, categoryName)
  if (existing) {
    return {
      categoryId: existing.category_id,
      categoryName: existing.category_name,
      categoryDescription: existing.category_description,
      fromBuiltin: false,
    }
  }

  let categoryId = `custom-${slugify(categoryName)}`
  if (categories.some((category) => category.id === categoryId) || categoryIdTaken(db, categoryId)) {
    categoryId = `${categoryId}-${crypto.randomUUID().slice(0, 8)}`
  }
  return {
    categoryId,
    categoryName,
    categoryDescription: categoryDescription || 'Custom questions.',
    fromBuiltin: false,
  }
}

export function titleTaken(db, categoryId, title, exceptId = '') {
  const builtin = listCatalog().find((category) => category.id === categoryId)
  if (builtin?.quizzes.some((quiz) => difficultyTitle[quiz.difficulty].toLowerCase() === title.toLowerCase())) {
    return true
  }
  return questionSetTitleTaken(db, categoryId, title, exceptId)
}

export function listMergedCatalog(db) {
  const catalog = listCatalog().map((category) => ({
    ...category,
    quizzes: category.quizzes.map((quiz) => ({
      ...quiz,
      title: difficultyTitle[quiz.difficulty],
    })),
  }))

  for (const set of listQuestionSets(db)) {
    let category = catalog.find((item) => item.id === set.categoryId)
    if (!category) {
      category = {
        id: set.categoryId,
        name: set.categoryName,
        description: set.categoryDescription || 'Custom questions.',
        quizzes: [],
      }
      catalog.push(category)
    }
    category.quizzes.push({
      id: set.id,
      difficulty: 'custom',
      title: set.title,
      questionCount: set.questions.length,
    })
  }

  return catalog
}

export function getPlayableQuiz(db, quizId) {
  const builtin = getPublicQuiz(quizId)
  if (builtin) return { ...builtin, title: difficultyTitle[builtin.difficulty] }

  const set = getQuestionSet(db, quizId)
  if (!set) return null
  return {
    id: set.id,
    categoryId: set.categoryId,
    categoryName: set.categoryName,
    difficulty: 'custom',
    title: set.title,
    questionCount: set.questions.length,
    questions: set.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      choices: question.choices,
    })),
  }
}

export function getPlayableQuestion(db, quizId, questionId) {
  return getQuestion(quizId, questionId) ?? getQuestionSet(db, quizId)?.questions.find((question) => question.id === questionId) ?? null
}

export function playableQuestionCount(db, quizId) {
  const builtinCount = questionCount(quizId)
  if (builtinCount > 0) return builtinCount
  return getQuestionSet(db, quizId)?.questions.length ?? 0
}
