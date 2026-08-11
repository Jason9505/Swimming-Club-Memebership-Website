import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULTS = {
  days: [2, 3],
  start: '19:50',
  end: '22:00',
  timezone: 'Asia/Kuala_Lumpur',
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

let cachedConfig = null

export function loadSessionConfig() {
  if (cachedConfig) return cachedConfig

  const configPath = path.resolve(__dirname, '..', 'session-config.json')
  let config = { ...DEFAULTS }
  if (existsSync(configPath)) {
    config = { ...config, ...JSON.parse(readFileSync(configPath, 'utf8')) }
  }
  cachedConfig = config
  return config
}

function toMinutes(timeStr) {
  const [h, m] = (timeStr || '').split(':').map((n) => parseInt(n, 10))
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export function isSessionTime(date = new Date()) {
  const { days, start, end, timezone } = loadSessionConfig()
  const startMin = toMinutes(start)
  const endMin = toMinutes(end)
  if (startMin === null || endMin === null) return false

  const { day, minutes } = getLocalParts(date, timezone)
  return days.includes(day) && minutes >= startMin && minutes < endMin
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

export function getSessionInfo(date = new Date()) {
  const { days, start, end, timezone } = loadSessionConfig()
  const active = isSessionTime(date)
  return {
    active,
    activeDay: active ? getLocalParts(date, timezone).day : null,
    days,
    dayLabels: days.map((d) => DAY_NAMES[d]).join(' & '),
    start,
    end,
    timezone,
  }
}
