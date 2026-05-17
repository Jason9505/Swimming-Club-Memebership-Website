import { JWT } from 'google-auth-library'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

let jwtClient = null

async function getAuthClient() {
  if (jwtClient) return jwtClient

  const credsPath = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH
  const resolvedPath = path.resolve(__dirname, '..', credsPath || '')
  const credentials = JSON.parse(readFileSync(resolvedPath, 'utf8'))

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
  const parsed = new Date(dateStr)
  if (!isNaN(parsed)) return parsed
  const match = dateStr.match(/^(\w+)[- ](\d{2,4})$/)
  if (match) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const month = monthNames.indexOf(match[1])
    let year = parseInt(match[2])
    if (year < 100) year += 2000
    if (month !== -1) return new Date(year, month, 1)
  }
  match = dateStr.match(/^(\d{1,2})\s*(\w+)\s*(\d{2,4})$/)
  if (match) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const month = monthNames.indexOf(match[2])
    let year = parseInt(match[3])
    if (year < 100) year += 2000
    if (month !== -1) return new Date(year, month, parseInt(match[1]))
  }
  return null
}

function extractMemberRow(headers, row) {
  const sidIdx = findColumnIndex(headers, COLUMN_ALIASES.studentId)
  const nameIdx = findColumnIndex(headers, COLUMN_ALIASES.fullName)
  if (sidIdx === -1 && nameIdx === -1) return null

  return {
    studentId: sidIdx !== -1 ? (row[sidIdx] || '').toString().trim() : '',
    fullName: nameIdx !== -1 ? (row[nameIdx] || '').toString().trim() : '',
    dateJoined: extractField(headers, row, 'dateJoined'),
    expiryDate: extractField(headers, row, 'expiryDate'),
    level: extractField(headers, row, 'level'),
    gender: extractField(headers, row, 'gender'),
    faculty: extractField(headers, row, 'faculty'),
  }
}

function extractField(headers, row, field) {
  const idx = findColumnIndex(headers, COLUMN_ALIASES[field])
  return idx !== -1 ? (row[idx] || '').toString().trim() : ''
}

async function readTabData(sheetId, tabName) {
  const results = []
  let lastError = null

  for (const startRow of [1, 4]) {
    try {
      const range = `'${tabName}'!A${startRow}:Z1000`
      const data = await api(sheetId, 'GET', `values/${encodeURIComponent(range)}`)
      const rows = data.values
      if (!rows || rows.length < 2) continue

      const headers = rows[0]
      const sidIdx = findColumnIndex(headers, COLUMN_ALIASES.studentId)
      const nameIdx = findColumnIndex(headers, COLUMN_ALIASES.fullName)

      if (sidIdx === -1 && nameIdx === -1) continue

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        const member = extractMemberRow(headers, r)
        if (member && (member.studentId || member.fullName)) {
          results.push(member)
        }
      }

      if (results.length > 0) break
    } catch (e) {
      lastError = e
    }
  }

  return results
}

export async function getMemberRows(sheetId) {
  const info = await api(sheetId, 'GET', '')
  const tabs = info.sheets || []
  const allMembers = []

  for (const tab of tabs) {
    const name = tab.properties.title
    if (name === 'Attendance') continue
    try {
      const members = await readTabData(sheetId, name)
      allMembers.push(...members)
    } catch {
      // skip tabs that fail
    }
  }

  return allMembers
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
