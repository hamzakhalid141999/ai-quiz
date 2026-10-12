import cors from 'cors'
import express from 'express'
import { listScores, openDb } from './db.js'

const PORT = process.env.PORT ?? 3001
const db = openDb()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/scores', (_req, res) => {
  res.json(listScores(db))
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
