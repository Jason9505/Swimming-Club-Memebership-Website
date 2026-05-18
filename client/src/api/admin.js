const API_BASE = '/api'

export async function getAttendance(filters = {}) {
  const params = new URLSearchParams()
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.studentId) params.set('studentId', filters.studentId)
  if (filters.faculty) params.set('faculty', filters.faculty)
  if (filters.membershipStatus) params.set('membershipStatus', filters.membershipStatus)
  const qs = params.toString()
  const res = await fetch(`${API_BASE}/admin/attendance${qs ? '?' + qs : ''}`)
  if (!res.ok) throw new Error('Failed to fetch attendance records')
  return res.json()
}

export async function getSummary() {
  const res = await fetch(`${API_BASE}/admin/summary`)
  if (!res.ok) throw new Error('Failed to fetch summary')
  return res.json()
}
