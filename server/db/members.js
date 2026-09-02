import { getPool, initDb } from './index.js'
import { parseDate, formatDisplayDate } from '../services/googleSheets.js'

export function initMembersDb() {
  return initDb()
}

export function getMembersDb() {
  return getPool()
}

function computeExpiryIfMissing(member) {
  if (member.expiryDate || !member.dateJoined) return member
  const joined = parseDate(member.dateJoined)
  if (!joined) return member
  const expiry = new Date(joined)
  expiry.setFullYear(expiry.getFullYear() + 1)
  member.expiryDate = formatDisplayDate(expiry)
  return member
}

export async function upsertMembers(members, spreadsheetLabel) {
  const d = getPool()
  const client = await d.connect()
  try {
    await client.query('BEGIN')

    const stmt = `
      INSERT INTO members (student_id, full_name, date_joined, expiry_date, level, gender, faculty, source_spreadsheet, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (student_id, source_spreadsheet) DO UPDATE SET
        full_name = CASE WHEN excluded.full_name != '' THEN excluded.full_name ELSE members.full_name END,
        date_joined = CASE WHEN excluded.date_joined != '' THEN excluded.date_joined ELSE members.date_joined END,
        expiry_date = CASE WHEN excluded.expiry_date != '' THEN excluded.expiry_date ELSE members.expiry_date END,
        level = CASE WHEN excluded.level != '' THEN excluded.level ELSE members.level END,
        gender = CASE WHEN excluded.gender != '' THEN excluded.gender ELSE members.gender END,
        faculty = CASE WHEN excluded.faculty != '' THEN excluded.faculty ELSE members.faculty END,
        updated_at = NOW()
    `

    for (const m of members) {
      await client.query(stmt, [
        m.studentId,
        m.fullName,
        m.dateJoined,
        m.expiryDate,
        m.level,
        m.gender,
        m.faculty,
        spreadsheetLabel,
      ])
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return members.length
}

export async function findMember(studentId) {
  const d = getPool()
  const sid = studentId.trim()

  const rows = (
    await d.query(
      `SELECT * FROM members WHERE student_id = $1 ORDER BY date_joined DESC NULLS LAST`,
      [sid]
    )
  ).rows

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

  return computeExpiryIfMissing({
    studentId: best.student_id,
    fullName: best.full_name,
    dateJoined: best.date_joined,
    expiryDate: best.expiry_date,
    level: best.level,
    gender: best.gender,
    faculty: best.faculty,
  })
}

export async function getAllMembersMap() {
  const d = getPool()
  const rows = (await d.query('SELECT * FROM members')).rows
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

  for (const sid of Object.keys(map)) {
    computeExpiryIfMissing(map[sid])
  }

  return map
}

export async function clearAllMembers() {
  await getPool().query('DELETE FROM members')
}

export async function getMemberCount() {
  const res = await getPool().query('SELECT COUNT(DISTINCT student_id)::int as count FROM members')
  return res.rows[0].count
}
