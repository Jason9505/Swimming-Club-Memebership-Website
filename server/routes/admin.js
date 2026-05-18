import { Router } from 'express'
import {
  loadSheetsConfig,
  getMemberRows,
  getAttendanceRows,
  parseDate,
} from '../services/googleSheets.js'

const router = Router()

async function searchMemberAcrossSheets(studentId) {
  const configs = loadSheetsConfig()
  const allMatches = []

  const results = await Promise.allSettled(
    configs.map(cfg => getMemberRows(cfg.id))
  )

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const member of result.value) {
      if (member.studentId === studentId.trim()) {
        allMatches.push({ ...member })
      }
    }
  }

  if (allMatches.length === 0) return null

  allMatches.sort((a, b) => {
    const da = parseDate(a.dateJoined)
    const db = parseDate(b.dateJoined)
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return db.getTime() - da.getTime()
  })

  const best = { ...allMatches[0] }

  for (const match of allMatches) {
    if (!best.dateJoined && match.dateJoined) best.dateJoined = match.dateJoined
    if (!best.expiryDate && match.expiryDate) best.expiryDate = match.expiryDate
    if (!best.level && match.level) best.level = match.level
    if (!best.gender && match.gender) best.gender = match.gender
    if (!best.faculty && match.faculty) best.faculty = match.faculty
    if (!best.fullName && match.fullName) best.fullName = match.fullName
  }

  return best
}

async function getAllMembersMap() {
  const configs = loadSheetsConfig()
  const map = {}

  const results = await Promise.allSettled(
    configs.map(cfg => getMemberRows(cfg.id))
  )

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const member of result.value) {
      const sid = member.studentId
      if (!sid) continue
      if (!map[sid]) {
        map[sid] = { ...member }
      } else {
        const existing = map[sid]
        if (!existing.dateJoined && member.dateJoined) existing.dateJoined = member.dateJoined
        if (!existing.expiryDate && member.expiryDate) existing.expiryDate = member.expiryDate
        if (!existing.level && member.level) existing.level = member.level
        if (!existing.gender && member.gender) existing.gender = member.gender
        if (!existing.faculty && member.faculty) existing.faculty = member.faculty
        if (!existing.fullName && member.fullName) existing.fullName = member.fullName
      }
    }
  }

  return map
}

router.get('/admin/attendance', async (req, res) => {
  try {
    const configs = loadSheetsConfig()
    if (configs.length === 0) {
      return res.status(500).json({ error: 'No spreadsheets configured.' })
    }

    const primaryId = configs[0].id
    const attRows = await getAttendanceRows(primaryId)

    if (attRows.length < 2) {
      return res.json({ records: [], total: 0 })
    }

    const membersMap = await getAllMembersMap()
    const now = new Date()
    const { startDate, endDate, studentId, faculty, membershipStatus } = req.query

    const records = []
    for (let i = 1; i < attRows.length; i++) {
      const row = attRows[i]
      const timestamp = row[0] || ''
      const sid = (row[1] || '').trim()
      const name = row[2] || ''
      const fac = row[3] || ''
      const status = row[4] || ''

      if (studentId && !sid.toLowerCase().includes(studentId.toLowerCase())) continue
      if (faculty && !fac.toLowerCase().includes(faculty.toLowerCase())) continue
      if (membershipStatus && status !== membershipStatus) continue

      if (startDate || endDate) {
        const dt = parseDate(timestamp)
        if (dt) {
          if (startDate && dt < new Date(startDate)) continue
          if (endDate) {
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            if (dt > end) continue
          }
        }
      }

      const member = membersMap[sid]
      const expiry = member ? parseDate(member.expiryDate) : null
      const computedStatus = expiry && now > expiry ? 'Expired' : (status || 'Active')

      records.push({
        timestamp,
        studentId: sid,
        fullName: name,
        faculty: fac,
        swimmingLevel: member?.level || '',
        membershipStatus: computedStatus,
      })
    }

    records.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    res.json({ records, total: records.length })
  } catch (err) {
    console.error('Admin attendance error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

router.get('/admin/summary', async (req, res) => {
  try {
    const configs = loadSheetsConfig()
    if (configs.length === 0) {
      return res.status(500).json({ error: 'No spreadsheets configured.' })
    }

    const primaryId = configs[0].id
    const attRows = await getAttendanceRows(primaryId)
    const totalAttendance = attRows.length > 1 ? attRows.length - 1 : 0

    const membersMap = await getAllMembersMap()
    const now = new Date()
    const activeSet = new Set()
    const expiredSet = new Set()

    for (let i = 1; i < attRows.length; i++) {
      const sid = (attRows[i][1] || '').trim()
      if (!sid) continue
      const member = membersMap[sid]
      const expiry = member ? parseDate(member.expiryDate) : null
      if (expiry && now > expiry) {
        expiredSet.add(sid)
      } else {
        activeSet.add(sid)
      }
    }

    res.json({
      totalAttendance,
      activeMembers: activeSet.size,
      expiredMembers: expiredSet.size,
    })
  } catch (err) {
    console.error('Admin summary error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

export default router
