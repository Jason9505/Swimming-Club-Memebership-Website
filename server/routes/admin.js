import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  getAttendanceRows,
  getAttendanceSummary,
  getAllMembersMap,
  getAllCommitteeMap,
} from '../database.js'
import { parseDate } from '../services/googleSheets.js'
import { getSyncStatus, forceSync } from '../sync.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next()
  res.status(401).json({ error: 'Unauthorized' })
}

router.post('/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body || {}
  if (!password) {
    return res.status(400).json({ error: 'Password required' })
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return res.status(500).json({ error: 'Admin password not configured' })
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  req.session.isAdmin = true
  res.json({ ok: true })
})

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid')
    res.json({ ok: true })
  })
})

router.get('/admin/me', (req, res) => {
  if (req.session?.isAdmin) {
    return res.json({ isAdmin: true })
  }
  res.status(401).json({ error: 'Unauthorized' })
})

router.get('/admin/attendance', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, studentId, faculty, membershipStatus } = req.query

    const filters = {}
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate
    if (studentId) filters.studentId = studentId
    if (faculty) filters.faculty = faculty
    if (membershipStatus) filters.membershipStatus = membershipStatus

    const attRows = await getAttendanceRows(filters)
    const membersMap = await getAllMembersMap()
    const committeeMap = await getAllCommitteeMap()
    const now = new Date()

    const records = attRows.map((row) => {
      const sid = (row.student_id || '').trim()
      const committeeMember = committeeMap[sid]
      const member = membersMap[sid]
      const expiry = member ? parseDate(member.expiryDate) : null
      const computedStatus = committeeMember
        ? 'Committee'
        : expiry && now > expiry ? 'Expired' : (row.membership_status || 'Active')

      return {
        timestamp: row.timestamp,
        studentId: sid,
        fullName: row.full_name || '',
        faculty: row.faculty || '',
        swimmingLevel: member?.level || '',
        membershipStatus: computedStatus,
      }
    })

    res.json({ records, total: records.length })
  } catch (err) {
    console.error('Admin attendance error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

router.get('/admin/summary', requireAdmin, async (req, res) => {
  try {
    const summary = await getAttendanceSummary()
    res.json(summary)
  } catch (err) {
    console.error('Admin summary error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

router.get('/admin/sync', requireAdmin, async (req, res) => {
  try {
    res.json(await getSyncStatus())
  } catch (err) {
    console.error('Admin sync status error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

router.post('/admin/sync', requireAdmin, async (req, res) => {
  try {
    const result = await forceSync()
    if (result.success === false && result.message) {
      return res.status(409).json(result)
    }
    res.json({ ...result, ...(await getSyncStatus()) })
  } catch (err) {
    console.error('Admin sync trigger error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

export default router
