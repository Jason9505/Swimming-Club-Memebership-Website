import { Router } from 'express'
import { findMember, findCommitteeMember } from '../database.js'
import { parseDate } from '../services/googleSheets.js'

const router = Router()

router.get('/member/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params

    const committeeMember = findCommitteeMember(studentId)
    if (committeeMember) {
      return res.json({
        studentId: committeeMember.studentId,
        fullName: committeeMember.fullName,
        position: committeeMember.position,
        status: committeeMember.status,
        isCommittee: true,
        membershipStatus: 'Committee',
        showDigitalCard: true,
      })
    }

    const member = findMember(studentId)
    if (!member) {
      return res.status(404).json({ error: 'Student ID Not Found' })
    }

    const expiry = parseDate(member.expiryDate)
    const membershipStatus = expiry && new Date() > expiry ? 'Expired' : 'Active'

    res.json({
      studentId: member.studentId,
      fullName: member.fullName,
      swimmingLevel: member.level,
      membershipStatus,
      memberSince: member.dateJoined,
      validThru: member.expiryDate,
      showDigitalCard: true,
    })
  } catch (err) {
    console.error('Member fetch error:', err)
    res.status(500).json({ error: 'Server error. Please try again later.' })
  }
})

export default router
