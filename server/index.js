import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { initDb, getPool } from './database.js'
import { syncFromSheets } from './sync.js'
import attendanceRouter from './routes/attendance.js'
import memberRouter from './routes/member.js'
import adminRouter from './routes/admin.js'

dotenv.config({ path: '../.env' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

app.use(morgan('combined'))

app.use(express.json())
app.use(cookieParser())

const PgSessionStore = connectPgSimple(session)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: new PgSessionStore({ pool: getPool(), tableName: 'session', createTableIfMissing: true }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}))

const allowedOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin) {
    const sameOrigin =
      origin === `https://${req.get('host')}` ||
      origin === `http://${req.get('host')}`
    if (sameOrigin || allowedOrigins.includes(origin)) {
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
  }
  next()
})

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}))

app.get('/ping', (req, res) => res.json({ ok: true }))

app.use(express.static(path.join(__dirname, 'public')))

app.use('/api', attendanceRouter)
app.use('/api', memberRouter)
app.use('/api', adminRouter)

app.get('/api/sync', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET
  const isAuthorized = req.session?.isAdmin ||
    (cronSecret && req.headers.authorization === `Bearer ${cronSecret}`)
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const result = await syncFromSheets()
    res.json(result)
  } catch (err) {
    console.error('[Sync] Manual/cron sync failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

async function startServer() {
  try {
    await initDb()
    console.log('[DB] Postgres database initialized (members + committee + attendance + session)')
  } catch (err) {
    console.error('[DB] Database init failed:', err.message)
  }

  try {
    await syncFromSheets()
  } catch (err) {
    console.error('[Sync] Initial sync failed:', err.message)
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  }
}

export default app

startServer()
