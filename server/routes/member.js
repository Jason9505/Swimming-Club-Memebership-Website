import { Router } from 'express'
import { loadSheetsConfig, getMemberRows, parseDate } from '../services/googleSheets.js'

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

router.get('/member/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params
    const configs = loadSheetsConfig()
    if (configs.length === 0) {
      return res.status(500).json({ error: 'No spreadsheets configured.' })
    }

    const member = await searchMemberAcrossSheets(studentId)
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
