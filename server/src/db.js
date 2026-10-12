import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')

export function openDb() {
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new Database(path.join(dataDir, 'quiz.db'))

  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  return db
}

export function listScores(db) {
  return db
    .prepare(
      `SELECT id, player_name, score, created_at
       FROM scores
       ORDER BY score DESC, created_at ASC
       LIMIT 20`,
    )
    .all()
}
