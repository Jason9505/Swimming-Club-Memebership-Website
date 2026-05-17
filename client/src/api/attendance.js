const API_BASE = '/api'

export async function submitAttendance(studentId) {
  const res = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

export async function getMember(studentId) {
  const res = await fetch(`${API_BASE}/member/${encodeURIComponent(studentId)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}
