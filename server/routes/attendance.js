import { Router } from 'express'
import { findMember, getAttendanceForStudentToday, insertAttendance } from '../database.js'
import { parseDate } from '../services/googleSheets.js'

const router = Router()

router.post('/attendance', async (req, res) => {
  try {
    const { studentId } = req.body
    if (!studentId || !studentId.trim()) {
      return res.status(400).json({ error: 'Student ID is required.' })
    }

    const member = findMember(studentId)
    if (!member) {
      return res.status(404).json({ error: 'Student ID Not Found' })
    }

    const now = new Date()
    const expiry = parseDate(member.expiryDate)
    const membershipStatus = expiry && now > expiry ? 'Expired' : 'Active'

    const alreadyRecorded = getAttendanceForStudentToday(studentId)

    if (!alreadyRecorded) {
      insertAttendance({
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
      attendanceRecorded: !alreadyRecorded,
      showDigitalCard: true,
    })
  } catch (err) {
    console.error('Attendance error:', err)
    res.status(500).json({ error: 'Server error. Please try again later.' })
  }
})

export default router
