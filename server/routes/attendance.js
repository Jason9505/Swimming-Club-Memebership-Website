import { Router } from 'express'
import { findMember, findCommitteeMember, getAttendanceForStudentToday, insertAttendance, getAttendanceMode } from '../database.js'
import { parseDate } from '../services/googleSheets.js'
import { isSessionTime, getSessionInfo } from '../services/session.js'
import { maybeSync } from '../sync.js'

const router = Router()

router.get('/session', async (req, res) => {
  const info = getSessionInfo()
  const { mode, updatedAt } = await getAttendanceMode()
  const active = mode === 'on' ? true : info.active
  res.json({ ...info, mode, active, overrideUpdatedAt: updatedAt })
})

router.post('/attendance', async (req, res) => {
  try {
    const { studentId } = req.body
    if (!studentId || !studentId.trim()) {
      return res.status(400).json({ error: 'Student ID is required.' })
    }

    await maybeSync()

    const now = new Date()
    const { mode } = await getAttendanceMode()
    const inSession = mode === 'on' ? true : isSessionTime(now)
    const alreadyRecorded = inSession && await getAttendanceForStudentToday(studentId)
    const attendanceRecorded = inSession && !alreadyRecorded

    const committeeMember = await findCommitteeMember(studentId)
    if (committeeMember) {
      if (attendanceRecorded) {
        await insertAttendance({
          timestamp: now.toISOString(),
          studentId: committeeMember.studentId,
          fullName: committeeMember.fullName,
          faculty: '',
          membershipStatus: 'Committee',
        })
      }

      return res.json({
        studentId: committeeMember.studentId,
        fullName: committeeMember.fullName,
        position: committeeMember.position,
        status: committeeMember.status,
        isCommittee: true,
        membershipStatus: 'Committee',
        isSessionTime: inSession,
        mode: inSession ? 'attendance' : 'membership-check',
        attendanceRecorded,
        showDigitalCard: true,
      })
    }

    const member = await findMember(studentId)
    if (!member) {
      return res.status(404).json({ error: 'Student ID Not Found' })
    }

    const expiry = parseDate(member.expiryDate)
    const membershipStatus = expiry && now > expiry ? 'Expired' : 'Active'

    if (attendanceRecorded) {
      await insertAttendance({
        timestamp: now.toISOString(),
        studentId: member.studentId,
        fullName: member.fullName,
        faculty: member.faculty || '',
        membershipStatus,
      })
    }

    res.json({
      studentId: member.studentId,
      fullName: member.fullName,
      swimmingLevel: member.level,
      membershipStatus,
      memberSince: member.dateJoined,
      validThru: member.expiryDate,
      isSessionTime: inSession,
      mode: inSession ? 'attendance' : 'membership-check',
      attendanceRecorded,
      showDigitalCard: true,
    })
  } catch (err) {
    console.error('Attendance error:', err)
    res.status(500).json({ error: 'Server error. Please try again later.' })
  }
})

export default router
