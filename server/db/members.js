import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isWSL = os.type() === 'Linux' && os.release().includes('microsoft')
const DB_PATH = isWSL
  ? path.join(os.homedir(), '.swimming-club-members.db')
  : path.resolve(__dirname, '..', 'members.db')

let db = null

export function initMembersDb() {
  if (db) return db

  db = new Database(DB_PATH)
  db.pragma('journal_mode = DELETE')

  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      student_id TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      date_joined TEXT DEFAULT '',
      expiry_date TEXT DEFAULT '',
      level TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      faculty TEXT DEFAULT '',
      source_spreadsheet TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (student_id, source_spreadsheet)
    );

    CREATE INDEX IF NOT EXISTS idx_members_student_id ON members(student_id);
  `)

  return db
}

export function getMembersDb() {
  if (!db) throw new Error('Members DB not initialized. Call initMembersDb() first.')
  return db
}

export function upsertMembers(members, spreadsheetLabel) {
  const d = getMembersDb()
  const stmt = d.prepare(`
    INSERT INTO members (student_id, full_name, date_joined, expiry_date, level, gender, faculty, source_spreadsheet, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(student_id, source_spreadsheet) DO UPDATE SET
      full_name = CASE WHEN excluded.full_name != '' THEN excluded.full_name ELSE members.full_name END,
      date_joined = CASE WHEN excluded.date_joined != '' THEN excluded.date_joined ELSE members.date_joined END,
      expiry_date = CASE WHEN excluded.expiry_date != '' THEN excluded.expiry_date ELSE members.expiry_date END,
      level = CASE WHEN excluded.level != '' THEN excluded.level ELSE members.level END,
      gender = CASE WHEN excluded.gender != '' THEN excluded.gender ELSE members.gender END,
      faculty = CASE WHEN excluded.faculty != '' THEN excluded.faculty ELSE members.faculty END,
      updated_at = datetime('now')
  `)

  const insertMany = d.transaction((rows) => {
    for (const m of rows) {
      stmt.run(
        m.studentId,
        m.fullName,
        m.dateJoined,
        m.expiryDate,
        m.level,
        m.gender,
        m.faculty,
        spreadsheetLabel
      )
    }
  })

  insertMany(members)
  return members.length
}

export function findMember(studentId) {
  const d = getMembersDb()
  const sid = studentId.trim()

  const rows = d.prepare(`
    SELECT * FROM members WHERE student_id = ?
    ORDER BY date_joined DESC
  `).all(sid)

  if (rows.length === 0) return null

  const best = { ...rows[0] }
  for (const row of rows) {
    if (!best.date_joined && row.date_joined) best.date_joined = row.date_joined
    if (!best.expiry_date && row.expiry_date) best.expiry_date = row.expiry_date
    if (!best.level && row.level) best.level = row.level
    if (!best.gender && row.gender) best.gender = row.gender
    if (!best.faculty && row.faculty) best.faculty = row.faculty
    if (!best.full_name && row.full_name) best.full_name = row.full_name
  }

  return {
    studentId: best.student_id,
    fullName: best.full_name,
    dateJoined: best.date_joined,
    expiryDate: best.expiry_date,
    level: best.level,
    gender: best.gender,
    faculty: best.faculty,
  }
}

export function getAllMembersMap() {
  const d = getMembersDb()
  const rows = d.prepare('SELECT * FROM members').all()
  const map = {}

  for (const row of rows) {
    const sid = row.student_id
    if (!sid) continue
    if (!map[sid]) {
      map[sid] = {
        studentId: sid,
        fullName: row.full_name,
        dateJoined: row.date_joined,
        expiryDate: row.expiry_date,
        level: row.level,
        gender: row.gender,
        faculty: row.faculty,
      }
    } else {
      const existing = map[sid]
      if (!existing.dateJoined && row.date_joined) existing.dateJoined = row.date_joined
      if (!existing.expiryDate && row.expiry_date) existing.expiryDate = row.expiry_date
      if (!existing.level && row.level) existing.level = row.level
      if (!existing.gender && row.gender) existing.gender = row.gender
      if (!existing.faculty && row.faculty) existing.faculty = row.faculty
      if (!existing.fullName && row.full_name) existing.fullName = row.full_name
    }
  }

  return map
}

export function clearAllMembers() {
  const d = getMembersDb()
  d.prepare('DELETE FROM members').run()
}

export function getMemberCount() {
  const d = getMembersDb()
  return d.prepare('SELECT COUNT(DISTINCT student_id) as count FROM members').get().count
}
