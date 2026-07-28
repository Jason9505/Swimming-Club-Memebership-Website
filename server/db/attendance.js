import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { getMembersDb } from './members.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '..', 'attendance.db')

let db = null

export function initAttendanceDb() {
  if (db) return db

  db = new Database(DB_PATH)
  db.pragma('journal_mode = DELETE')

  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      student_id TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      faculty TEXT DEFAULT '',
      membership_status TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
  `)

  return db
}

export function getAttendanceDb() {
  if (!db) throw new Error('Attendance DB not initialized. Call initAttendanceDb() first.')
  return db
}

export function getAttendanceForStudentToday(studentId) {
  const d = getAttendanceDb()
  const today = new Date().toISOString().slice(0, 10)
  const row = d.prepare(`
    SELECT id FROM attendance
    WHERE student_id = ? AND substr(timestamp, 1, 10) = ?
    LIMIT 1
  `).get(studentId.trim(), today)
  return !!row
}

export function insertAttendance(record) {
  const d = getAttendanceDb()
  d.prepare(`
    INSERT INTO attendance (timestamp, student_id, full_name, faculty, membership_status)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    record.timestamp,
    record.studentId,
    record.fullName,
    record.faculty || '',
    record.membershipStatus
  )
}

export function getAttendanceRows(filters = {}) {
  const d = getAttendanceDb()
  let query = 'SELECT * FROM attendance WHERE 1=1'
  const params = []

  if (filters.studentId) {
    query += ' AND student_id LIKE ?'
    params.push(`%${filters.studentId}%`)
  }
  if (filters.faculty) {
    query += ' AND faculty LIKE ?'
    params.push(`%${filters.faculty}%`)
  }
  if (filters.membershipStatus) {
    query += ' AND membership_status = ?'
    params.push(filters.membershipStatus)
  }
  if (filters.startDate) {
    query += ' AND timestamp >= ?'
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    query += ' AND timestamp <= ?'
    params.push(filters.endDate + 'T23:59:59')
  }

  query += ' ORDER BY timestamp DESC'

  return d.prepare(query).all(...params)
}

export function getAttendanceSummary() {
  const d = getAttendanceDb()
  const membersDb = getMembersDb()

  const totalRow = d.prepare('SELECT COUNT(*) as count FROM attendance').get()
  const totalAttendance = totalRow.count

  const memberRows = membersDb.prepare('SELECT * FROM members').all()
  const membersMap = {}
  for (const row of memberRows) {
    const sid = row.student_id
    if (!sid) continue
    if (!membersMap[sid]) {
      membersMap[sid] = { expiryDate: row.expiry_date }
    } else {
      if (!membersMap[sid].expiryDate && row.expiry_date) membersMap[sid].expiryDate = row.expiry_date
    }
  }

  const now = new Date()
  const activeSet = new Set()
  const expiredSet = new Set()

  const attRows = d.prepare('SELECT DISTINCT student_id FROM attendance').all()
  for (const row of attRows) {
    const sid = row.student_id
    const member = membersMap[sid]
    if (member && member.expiryDate) {
      const parsed = new Date(member.expiryDate)
      if (!isNaN(parsed) && now > parsed) {
        expiredSet.add(sid)
      } else {
        activeSet.add(sid)
      }
    } else {
      activeSet.add(sid)
    }
  }

  return {
    totalAttendance,
    activeMembers: activeSet.size,
    expiredMembers: expiredSet.size,
  }
}
