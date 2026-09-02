import { getPool, initDb } from './index.js'

const ALLOWED_MODES = ['auto', 'on']

export function initAttendanceModeDb() {
  return initDb()
}

export function getAttendanceModeDb() {
  return getPool()
}

export async function getAttendanceMode() {
  const d = getPool()
  const row = (await d.query('SELECT mode, updated_at FROM attendance_mode WHERE id = 1')).rows[0]
  if (!row) return { mode: 'auto', updatedAt: null }
  return {
    mode: row.mode,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  }
}

export async function setAttendanceMode(mode) {
  if (!ALLOWED_MODES.includes(mode)) {
    throw new Error(`Invalid attendance mode: ${mode}`)
  }
  const d = getPool()
  await d.query(
    `INSERT INTO attendance_mode (id, mode, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET mode = $1, updated_at = NOW()`,
    [mode]
  )
  return getAttendanceMode()
}