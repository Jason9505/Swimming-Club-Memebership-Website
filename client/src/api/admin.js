const API_BASE = '/api'

export async function login(password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Login failed')
  return data
}

export async function logout() {
  await fetch(`${API_BASE}/admin/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

export async function checkAuth() {
  const res = await fetch(`${API_BASE}/admin/me`, { credentials: 'include' })
  return res.ok
}

export async function getAttendance(filters = {}) {
  const params = new URLSearchParams()
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.studentId) params.set('studentId', filters.studentId)
  if (filters.faculty) params.set('faculty', filters.faculty)
  if (filters.membershipStatus) params.set('membershipStatus', filters.membershipStatus)
  const qs = params.toString()
  const res = await fetch(`${API_BASE}/admin/attendance${qs ? '?' + qs : ''}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to fetch attendance records')
  return res.json()
}

export async function getSummary() {
  const res = await fetch(`${API_BASE}/admin/summary`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch summary')
  return res.json()
}
