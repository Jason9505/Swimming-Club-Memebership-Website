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

export async function getSyncStatus() {
  const res = await fetch(`${API_BASE}/admin/sync`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch sync status')
  return res.json()
}

export async function triggerSync() {
  const res = await fetch(`${API_BASE}/admin/sync`, {
    method: 'POST',
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || data.message || 'Sync failed')
    err.status = res.status
    throw err
  }
  return data
}

export async function getAttendanceMode() {
  const res = await fetch(`${API_BASE}/admin/mode`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch attendance mode')
  return res.json()
}

export async function setAttendanceMode(mode) {
  const res = await fetch(`${API_BASE}/admin/mode`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update attendance mode')
  return data
}

export async function getSessions() {
  const res = await fetch(`${API_BASE}/admin/sessions`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

export async function addSession({ dayOfWeek, start, end }) {
  const res = await fetch(`${API_BASE}/admin/sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dayOfWeek, start, end }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to add session')
  return data
}

export async function removeSession(id) {
  const res = await fetch(`${API_BASE}/admin/sessions/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to remove session')
  return data
}
