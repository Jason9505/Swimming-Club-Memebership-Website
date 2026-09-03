import { getSessionSlots, getTimezone } from '../db/sessionSchedule.js'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function toMinutes(timeStr) {
  const [h, m] = (timeStr || '').split(':').map((n) => parseInt(n, 10))
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export async function loadSessionConfig() {
  const [slots, timezone] = await Promise.all([getSessionSlots(), getTimezone()])
  return { slots, timezone }
}

export async function isSessionTime(date = new Date()) {
  const { slots, timezone } = await loadSessionConfig()
  const { day, minutes } = getLocalParts(date, timezone)

  for (const slot of slots) {
    const startMin = toMinutes(slot.start)
    const endMin = toMinutes(slot.end)
    if (startMin === null || endMin === null) continue
    if (slot.dayOfWeek === day && minutes >= startMin && minutes < endMin) {
      return true
    }
  }
  return false
}

function getLocalParts(date, timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date).map((p) => [p.type, p.value])
  )

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day = dayNames.indexOf(parts.weekday)
  const hour = parseInt(parts.hour, 10) % 24
  const minute = parseInt(parts.minute, 10)

  return { day, minutes: hour * 60 + minute }
}

export async function getSessionInfo(date = new Date()) {
  const { slots, timezone } = await loadSessionConfig()
  const active = await isSessionTime(date)
  const days = [...new Set(slots.map((s) => s.dayOfWeek))]
  return {
    active,
    activeDay: active ? getLocalParts(date, timezone).day : null,
    days,
    dayLabels: days.map((d) => DAY_NAMES[d]).join(' & '),
    slots,
    timezone,
  }
}
