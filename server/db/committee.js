import { getPool, initDb } from './index.js'

export function initCommitteeDb() {
  return initDb()
}

export function getCommitteeDb() {
  return getPool()
}

export async function upsertCommittee(members) {
  const d = getPool()

  const byId = new Map()
  for (const m of members) {
    const sid = (m.studentId || '').trim()
    if (!sid) continue
    byId.set(sid, m)
  }
  members = [...byId.values()]

  const ids = members.map((m) => m.studentId.trim())
  const names = members.map((m) => m.fullName || '')
  const positions = members.map((m) => m.position || '')
  const statuses = members.map((m) => m.status || '')

  await d.query(
    `
    INSERT INTO committee (student_id, full_name, position, status, updated_at)
    SELECT t.student_id, t.full_name, t.position, t.status, NOW()
    FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[])
      AS t(student_id, full_name, position, status)
    ON CONFLICT (student_id) DO UPDATE SET
      full_name = CASE WHEN excluded.full_name != '' THEN excluded.full_name ELSE committee.full_name END,
      position = CASE WHEN excluded.position != '' THEN excluded.position ELSE committee.position END,
      status = CASE WHEN excluded.status != '' THEN excluded.status ELSE committee.status END,
      updated_at = NOW()
    `,
    [ids, names, positions, statuses]
  )

  return members.length
}

export async function findCommitteeMember(studentId) {
  const d = getPool()
  const sid = (studentId || '').trim()
  if (!sid) return null

  const row = (await d.query('SELECT * FROM committee WHERE student_id = $1', [sid])).rows[0]
  if (!row) return null

  return {
    studentId: row.student_id,
    fullName: row.full_name,
    position: row.position,
    status: row.status,
  }
}

export async function pruneCommittee(members) {
  const ids = members.map(m => (m.studentId || '').trim()).filter(Boolean)
  await getPool().query(
    'DELETE FROM committee WHERE NOT (student_id = ANY($1::text[]))',
    [ids]
  )
}

export async function getAllCommitteeMap() {
  const d = getPool()
  const rows = (
    await d.query('SELECT student_id, full_name, position, status FROM committee')
  ).rows
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

export async function clearAllCommittee() {
  await getPool().query('DELETE FROM committee')
}

export async function getCommitteeCount() {
  const res = await getPool().query('SELECT COUNT(*)::int as count FROM committee')
  return res.rows[0].count
}
