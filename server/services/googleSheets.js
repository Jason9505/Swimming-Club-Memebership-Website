import { JWT } from 'google-auth-library'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

let jwtClient = null

async function getAuthClient() {
  if (jwtClient) return jwtClient

  let credentials
  const credsJson = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON
  if (credsJson) {
    credentials = JSON.parse(credsJson)
  } else {
    const credsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH
    const resolvedPath = path.resolve(__dirname, '..', credsPath || '')
    credentials = JSON.parse(readFileSync(resolvedPath, 'utf8'))
  }

  jwtClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  })
  return jwtClient
}

async function getAccessToken() {
  const client = await getAuthClient()
  const resp = await client.getAccessToken()
  return resp.token
}

export function loadSheetsConfig() {
  const configPath = path.resolve(__dirname, '..', 'sheets-config.json')
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  }
  const singleId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  if (singleId) {
    return [{ id: singleId, label: 'Default' }]
  }
  return []
}

async function api(sheetId, method, endpoint, body) {
  const token = await getAccessToken()
  const url = `${SHEETS_BASE}/${sheetId}/${endpoint}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API ${res.status}: ${err}`)
  }
  return res.json()
}

const COLUMN_ALIASES = {
  studentId: ['student_id', 'student id', 'student id:', 'studentid'],
  fullName: ['name', 'full name', 'fullname', 'full_name'],
  dateJoined: ['date_joined', 'date joined', 'start time', 'start_time', 'registration date', 'timestamp'],
  level: ['level', 'swimming level', 'swimming_level', 'swimming'],
  expiryDate: ['expiry_date', 'expiry date', 'expiry', 'valid thru'],
  gender: ['gender'],
  faculty: ['faculty'],
  position: ['position'],
  status: ['status'],
}

function normalizeHeader(h) {
  return (h || '').toString()
    .toLowerCase()
    .replace(/\n/g, ' ')
    .replace(/[:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function findColumnIndex(headers, aliases) {
  const normHeaders = headers.map(h => normalizeHeader(h))
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i]
    for (const alias of aliases) {
      if (h === alias) return i
    }
  }
  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i]
    for (const alias of aliases) {
      if (h.includes(alias)) return i
    }
  }
  return -1
}

function parseDate(dateStr) {
  if (!dateStr) return null
  const str = dateStr.toString().trim()

  const ddmmyyyyTime = str.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})[,\s]+\d{1,2}:\d{2}/)
  if (ddmmyyyyTime) {
    let day = parseInt(ddmmyyyyTime[1])
    let month = parseInt(ddmmyyyyTime[2])
    const year = parseInt(ddmmyyyyTime[3])
    if (month > 12) { const tmp = day; day = month; month = tmp }
    return new Date(year, month - 1, day)
  }

  const ddmmyyyy = str.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/)
  if (ddmmyyyy) {
    let day = parseInt(ddmmyyyy[1])
    let month = parseInt(ddmmyyyy[2])
    const year = parseInt(ddmmyyyy[3])
    if (month > 12) { const tmp = day; day = month; month = tmp }
    return new Date(year, month - 1, day)
  }

  let match = str.match(/^(\w+)[- ](\d{2,4})$/)
  if (match) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const month = monthNames.indexOf(match[1])
    let year = parseInt(match[2])
    if (year < 100) year += 2000
    if (month !== -1) return new Date(year, month, 1)
  }

  match = str.match(/^(\d{1,2})\s*(\w+)\s*(\d{2,4})$/)
  if (match) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const month = monthNames.indexOf(match[2])
    let year = parseInt(match[3])
    if (year < 100) year += 2000
    if (month !== -1) return new Date(year, month, parseInt(match[1]))
  }

  const parsed = new Date(str)
  if (!isNaN(parsed)) return parsed

  return null
}

function normalizeDate(dateStr) {
  if (!dateStr) return ''
  const str = dateStr.toString().trim()
  if (!str) return ''

  const parsed = parseDate(str)
  if (parsed) {
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const d = new Date(str)
  if (!isNaN(d)) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return str
}

function extractMemberRow(headers, row) {
  const sidIdx = findColumnIndex(headers, COLUMN_ALIASES.studentId)
  const nameIdx = findColumnIndex(headers, COLUMN_ALIASES.fullName)
  if (sidIdx === -1 && nameIdx === -1) return null

  return {
    studentId: sidIdx !== -1 ? (row[sidIdx] || '').toString().trim() : '',
    fullName: nameIdx !== -1 ? (row[nameIdx] || '').toString().trim() : '',
    dateJoined: normalizeDate(extractField(headers, row, 'dateJoined')),
    expiryDate: normalizeDate(extractField(headers, row, 'expiryDate')),
    level: extractField(headers, row, 'level'),
    gender: extractField(headers, row, 'gender'),
    faculty: extractField(headers, row, 'faculty'),
    position: extractField(headers, row, 'position'),
    status: extractField(headers, row, 'status'),
  }
}

function extractField(headers, row, field) {
  const idx = findColumnIndex(headers, COLUMN_ALIASES[field])
  return idx !== -1 ? (row[idx] || '').toString().trim() : ''
}

async function apiWithRetry(sheetId, method, endpoint, body, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await api(sheetId, method, endpoint, body)
    } catch (e) {
      const isRateLimit = e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED')
      if (isRateLimit && attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt) + Math.random() * 500
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw e
    }
  }
}

async function readTabData(sheetId, tabName) {
  const results = []

  try {
    const range = `'${tabName}'!A1:Z1000`
    const data = await apiWithRetry(sheetId, 'GET', `values/${encodeURIComponent(range)}`)
    const rows = data.values
    if (!rows || rows.length < 2) return results

    let headerRowIdx = -1
    let headers = null
    const maxHeaderScan = Math.min(10, rows.length)

    for (let h = 0; h < maxHeaderScan; h++) {
      const candidate = rows[h]
      const sidIdx = findColumnIndex(candidate, COLUMN_ALIASES.studentId)
      const nameIdx = findColumnIndex(candidate, COLUMN_ALIASES.fullName)
      if (sidIdx !== -1 || nameIdx !== -1) {
        headerRowIdx = h
        headers = candidate
        break
      }
    }

    if (headerRowIdx === -1) return results

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      const member = extractMemberRow(headers, r)
      if (member && (member.studentId || member.fullName)) {
        results.push(member)
      }
    }
  } catch {
    // failed tab returns empty
  }

  return results
}

export async function getMemberRows(sheetId) {
  const info = await apiWithRetry(sheetId, 'GET', '')
  const tabs = info.sheets || []
  const allMembers = []

  for (const tab of tabs) {
    const name = tab.properties.title
    if (name === 'Attendance') continue
    const members = await readTabData(sheetId, name)
    allMembers.push(...members)
  }

  return allMembers
}

export async function getSheetRowCounts(sheetId) {
  const info = await apiWithRetry(sheetId, 'GET', '')
  const counts = {}

  for (const tab of info.sheets || []) {
    const name = tab.properties.title
    if (name === 'Attendance') continue
    counts[name] = tab.properties?.gridProperties?.rowCount || 0
  }

  return counts
}

export async function ensureAttendanceSheet(sheetId) {
  const info = await api(sheetId, 'GET', '')
  const exists = info.sheets?.some(s => s.properties.title === 'Attendance')
  if (!exists) {
    await api(sheetId, 'POST', ':batchUpdate', {
      requests: [{ addSheet: { properties: { title: 'Attendance' } } }],
    })
    await appendAttendance(sheetId, [['Timestamp', 'Student ID', 'Full Name', 'Faculty', 'Membership Status']])
  }
}

export async function getAttendanceRows(sheetId) {
  try {
    const data = await api(sheetId, 'GET', `values/${encodeURIComponent("'Attendance'!A:E")}`)
    return data.values || []
  } catch {
    return []
  }
}

export async function appendAttendance(sheetId, values) {
  return api(sheetId, 'POST', `values/${encodeURIComponent("'Attendance'!A:E")}:append?valueInputOption=USER_ENTERED`, { values })
}

export { parseDate }
