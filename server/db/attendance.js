import { getPool, initDb } from './index.js'

export function initAttendanceDb() {
  return initDb()
}

export function getAttendanceDb() {
  return getPool()
}

export async function getAttendanceForStudentToday(studentId) {
  const d = getPool()
  const today = new Date().toISOString().slice(0, 10)
  const res = await d.query(
    `SELECT id FROM attendance
     WHERE student_id = $1 AND LEFT("timestamp", 10) = $2
     LIMIT 1`,
    [studentId.trim(), today]
  )
  return res.rows.length > 0
}

export async function insertAttendance(record) {
  const d = getPool()
  await d.query(
    `INSERT INTO attendance ("timestamp", student_id, full_name, faculty, membership_status)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      record.timestamp,
      record.studentId,
      record.fullName,
      record.faculty || '',
      record.membershipStatus,
    ]
  )
}

export async function getAttendanceRows(filters = {}) {
  const d = getPool()
  let query = 'SELECT * FROM attendance WHERE 1=1'
  const params = []
  let idx = 1

  if (filters.studentId) {
    query += ` AND student_id LIKE $${idx++}`
    params.push(`%${filters.studentId}%`)
  }
  if (filters.faculty) {
    query += ` AND faculty LIKE $${idx++}`
    params.push(`%${filters.faculty}%`)
  }
  if (filters.membershipStatus) {
    query += ` AND membership_status = $${idx++}`
    params.push(filters.membershipStatus)
  }
  if (filters.startDate) {
    query += ` AND "timestamp" >= $${idx++}`
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    query += ` AND "timestamp" <= $${idx++}`
    params.push(filters.endDate + 'T23:59:59')
  }

  query += ' ORDER BY "timestamp" DESC'

  return (await d.query(query, params)).rows
}

export async function getAttendanceSummary() {
  const d = getPool()

  const totalRow = (
    await d.query('SELECT COUNT(*)::int as count FROM attendance')
  ).rows[0]
  const totalAttendance = totalRow.count

  const memberRows = (await d.query('SELECT * FROM members')).rows
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

  const attRows = (await d.query('SELECT DISTINCT student_id FROM attendance')).rows
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
