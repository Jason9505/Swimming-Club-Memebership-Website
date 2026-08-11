import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '..', 'members.db')

let db = null

export function initCommitteeDb() {
  if (db) return db

  db = new Database(DB_PATH)
  db.pragma('journal_mode = DELETE')

  db.exec(`
    CREATE TABLE IF NOT EXISTS committee (
      student_id TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      position TEXT DEFAULT '',
      status TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (student_id)
    );

    CREATE INDEX IF NOT EXISTS idx_committee_student_id ON committee(student_id);
  `)

  const columns = db.prepare('PRAGMA table_info(committee)').all()
  if (!columns.some(c => c.name === 'status')) {
    db.exec(`ALTER TABLE committee ADD COLUMN status TEXT DEFAULT ''`)
  }

  return db
}

export function getCommitteeDb() {
  if (!db) throw new Error('Committee DB not initialized. Call initCommitteeDb() first.')
  return db
}

export function upsertCommittee(members) {
  const d = getCommitteeDb()
  const stmt = d.prepare(`
    INSERT INTO committee (student_id, full_name, position, status, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(student_id) DO UPDATE SET
      full_name = CASE WHEN excluded.full_name != '' THEN excluded.full_name ELSE committee.full_name END,
      position = CASE WHEN excluded.position != '' THEN excluded.position ELSE committee.position END,
      status = CASE WHEN excluded.status != '' THEN excluded.status ELSE committee.status END,
      updated_at = datetime('now')
  `)

  const insertMany = d.transaction((rows) => {
    for (const m of rows) {
      if (!m.studentId) continue
      stmt.run(
        m.studentId.trim(),
        m.fullName || '',
        m.position || '',
        m.status || ''
      )
    }
  })

  insertMany(members)
  return members.length
}

export function findCommitteeMember(studentId) {
  const d = getCommitteeDb()
  const sid = (studentId || '').trim()
  if (!sid) return null

  const row = d.prepare('SELECT * FROM committee WHERE student_id = ?').get(sid)
  if (!row) return null

  return {
    studentId: row.student_id,
    fullName: row.full_name,
    position: row.position,
    status: row.status,
  }
}

export function getAllCommitteeMap() {
  const d = getCommitteeDb()
  const rows = d.prepare('SELECT student_id, full_name, position, status FROM committee').all()
  const map = {}
  for (const row of rows) {
    map[row.student_id] = {
      studentId: row.student_id,
      fullName: row.full_name,
      position: row.position,
      status: row.status,
    }
  }
  return map
}

export function clearAllCommittee() {
  const d = getCommitteeDb()
  d.prepare('DELETE FROM committee').run()
}

export function getCommitteeCount() {
  const d = getCommitteeDb()
  return d.prepare('SELECT COUNT(*) as count FROM committee').get().count
}
