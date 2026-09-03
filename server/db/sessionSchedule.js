import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool, initDb } from './index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_TIMEZONE = 'Asia/Kuala_Lumpur'

function toMinutes(timeStr) {
  const [h, m] = (timeStr || '').split(':').map((n) => parseInt(n, 10))
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export function isValidTime(timeStr) {
  const min = toMinutes(timeStr)
  return min !== null && min >= 0 && min < 24 * 60
}

export function initSessionScheduleDb() {
  return initDb()
}

export async function getTimezone() {
  const d = getPool()
  const row = (await d.query('SELECT timezone FROM session_settings WHERE id = 1')).rows[0]
  return row ? row.timezone : DEFAULT_TIMEZONE
}

async function seedDefaultSlots() {
  const count = (await getPool().query('SELECT COUNT(*)::int AS n FROM session_schedule')).rows[0].n
  if (count > 0) return

  const configPath = path.resolve(__dirname, '..', '..', 'session-config.json')
  let days = [2, 3]
  let start = '19:50'
  let end = '22:00'
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
      if (Array.isArray(cfg.days)) days = cfg.days
      if (cfg.start) start = cfg.start
      if (cfg.end) end = cfg.end
    } catch {
      // fall back to defaults
    }
  }

  for (const day of days) {
    await getPool().query(
      `INSERT INTO session_schedule (day_of_week, start_time, end_time)
       VALUES ($1, $2, $3)`,
      [day, start, end]
    )
  }
}

export async function getSessionSlots() {
  await seedDefaultSlots()
  const d = getPool()
  const rows = await d.query(
    'SELECT id, day_of_week, start_time, end_time FROM session_schedule ORDER BY day_of_week, start_time'
  )
  return rows.rows.map((r) => ({
    id: r.id,
    dayOfWeek: r.day_of_week,
    start: r.start_time,
    end: r.end_time,
  }))
}

export async function addSessionSlot({ dayOfWeek, start, end }) {
  const day = parseInt(dayOfWeek, 10)
  if (isNaN(day) || day < 0 || day > 6) {
    throw new Error('Day must be between 0 (Sunday) and 6 (Saturday)')
  }
  if (!isValidTime(start)) {
    throw new Error('Invalid start time. Use HH:MM.')
  }
  if (!isValidTime(end)) {
    throw new Error('Invalid end time. Use HH:MM.')
  }
  if (toMinutes(end) <= toMinutes(start)) {
    throw new Error('End time must be after start time.')
  }

  const d = getPool()
  await d.query(
    `INSERT INTO session_schedule (day_of_week, start_time, end_time)
     VALUES ($1, $2, $3)`,
    [day, start, end]
  )
  return getSessionSlots()
}

export async function removeSessionSlot(id) {
  const numericId = parseInt(id, 10)
  if (isNaN(numericId)) {
    throw new Error('Invalid session id')
  }
  const d = getPool()
  await d.query('DELETE FROM session_schedule WHERE id = $1', [numericId])
  return getSessionSlots()
}
