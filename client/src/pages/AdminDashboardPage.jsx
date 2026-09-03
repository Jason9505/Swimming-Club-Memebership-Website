import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, logout, checkAuth, getAttendance, getSummary, getSyncStatus, triggerSync, getAttendanceMode, setAttendanceMode, getSessions, addSession, removeSession } from '../api/admin'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)

  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({ totalAttendance: 0, activeMembers: 0, expiredMembers: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [syncStatus, setSyncStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')

  const [modeStatus, setModeStatus] = useState({ mode: 'auto', updatedAt: null })
  const [modeUpdating, setModeUpdating] = useState(false)
  const [modeError, setModeError] = useState('')

  const [sessions, setSessions] = useState([])
  const [sessionTimezone, setSessionTimezone] = useState('Asia/Kuala_Lumpur')
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [sessionSaving, setSessionSaving] = useState(false)
  const [removingSessionId, setRemovingSessionId] = useState(null)
  const [newDay, setNewDay] = useState('2')
  const [newStart, setNewStart] = useState('19:50')
  const [newEnd, setNewEnd] = useState('22:00')

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    studentId: '',
    faculty: '',
    membershipStatus: '',
  })

  useEffect(() => {
    checkAuth().then((ok) => {
      setAuthenticated(ok)
      setChecking(false)
    }).catch(() => {
      setChecking(false)
    })
  }, [])

  const fetchData = useCallback(async (currentFilters) => {
    setLoading(true)
    setError('')
    try {
      const [attData, sumData] = await Promise.all([
        getAttendance(currentFilters || filters),
        getSummary(),
      ])
      setRecords(attData.records || [])
      setSummary(sumData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSyncStatus = useCallback(async () => {
    try {
      setSyncStatus(await getSyncStatus())
    } catch {
      setSyncStatus(null)
    }
  }, [])

  const fetchModeStatus = useCallback(async () => {
    try {
      setModeStatus(await getAttendanceMode())
      setModeError('')
    } catch {
      setModeError('Failed to load attendance mode')
    }
  }, [])

  useEffect(() => {
    if (authenticated) {
      fetchData(filters)
      fetchSyncStatus()
      fetchModeStatus()
      fetchSessions()
    }
  }, [authenticated])

  async function handleLogin(e) {
    e.preventDefault()
    if (!password.trim()) return
    setLoginLoading(true)
    setLoginError('')
    try {
      await login(password)
      setPassword('')
      setAuthenticated(true)
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleSyncNow() {
    setSyncing(true)
    setSyncError('')
    try {
      const data = await triggerSync()
      setSyncStatus(data)
      fetchData(filters)
    } catch (err) {
      if (err.status === 409) {
        fetchSyncStatus()
      }
      setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleToggleMode() {
    const next = modeStatus.mode === 'on' ? 'auto' : 'on'
    setModeUpdating(true)
    setModeError('')
    try {
      setModeStatus(await setAttendanceMode(next))
    } catch (err) {
      setModeError(err.message)
    } finally {
      setModeUpdating(false)
    }
  }

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true)
    setSessionError('')
    try {
      const data = await getSessions()
      setSessions(data.slots || [])
      setSessionTimezone(data.timezone || 'Asia/Kuala_Lumpur')
    } catch (err) {
      setSessionError(err.message)
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  async function handleAddSession(e) {
    e.preventDefault()
    setSessionSaving(true)
    setSessionError('')
    try {
      const data = await addSession({ dayOfWeek: newDay, start: newStart, end: newEnd })
      setSessions(data.slots || [])
      setNewDay('2')
      setNewStart('19:50')
      setNewEnd('22:00')
    } catch (err) {
      setSessionError(err.message)
    } finally {
      setSessionSaving(false)
    }
  }

  async function handleRemoveSession(id) {
    setRemovingSessionId(id)
    setSessionError('')
    try {
      const data = await removeSession(id)
      setSessions(data.slots || [])
    } catch (err) {
      setSessionError(err.message)
    } finally {
      setRemovingSessionId(null)
    }
  }

  function formatClock(time) {
    if (!time) return ''
    const [h, m] = time.split(':').map((n) => parseInt(n, 10))
    const period = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`
  }

  async function handleLogout() {
    await logout()
    setAuthenticated(false)
    setRecords([])
    setSummary({ totalAttendance: 0, activeMembers: 0, expiredMembers: 0 })
  }

  function handleFilterChange(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function handleSearch(e) {
    e.preventDefault()
    fetchData(filters)
  }

  function handleClear() {
    const cleared = { startDate: '', endDate: '', studentId: '', faculty: '', membershipStatus: '' }
    setFilters(cleared)
    fetchData(cleared)
  }

  function formatTimestamp(ts) {
    if (!ts) return '\u2014'
    const d = new Date(ts)
    if (!isNaN(d)) {
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return ts
  }

  const statusBadge = (status) => {
    const isActive = status === 'Active'
    const isCommittee = status === 'Committee'
    const cls = isActive
      ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
      : isCommittee
        ? 'bg-gold/20 text-goldLight border border-gold'
        : 'bg-red-900/60 text-red-300 border border-red-700'
    return (
      <span
        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${cls}`}
      >
        {status}
      </span>
    )
  }

  const levelBadge = (level) => {
    const colors = {
      Beginner: 'bg-beginner/20 text-beginner border border-beginner/40',
      Intermediate: 'bg-intermediate/20 text-intermediate border border-intermediate/40',
      Advanced: 'bg-advanced/20 text-advanced border border-advanced/40',
    }
    const cls = colors[level] || 'bg-gray-700 text-gray-400 border border-gray-600'
    if (!level) return null
    return (
      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${cls}`}>
        {level}
      </span>
    )
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm mx-auto text-center">
          <img
            src="/MMUSwimmingClubLogo(white).png"
            alt="MMU Swimming Club"
            className="h-20 mx-auto mb-6 object-contain"
          />
          <h1 className="text-xl font-light text-gray-300 mb-2">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mb-8">
            This page is locked. Enter the admin password to open the dashboard.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              disabled={loginLoading}
              autoFocus
              className="w-full px-5 py-4 rounded-xl text-center text-lg tracking-wider bg-metallic-800 border border-gray-600/50 text-gray-100 placeholder-gray-600 outline-none transition-all duration-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={loginLoading || !password.trim()}
              className="w-full py-4 rounded-xl font-semibold tracking-wider text-base bg-gradient-to-r from-gray-600 to-gray-500 text-gray-100 border border-gray-500/50 shadow-lg transition-all duration-200 hover:from-gray-500 hover:to-gray-400 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loginLoading ? 'Checking...' : 'Login'}
            </button>
          </form>

          {loginError && (
            <div className="mt-4 p-4 rounded-xl bg-red-900/30 border border-red-800/50">
              <p className="text-red-300 text-sm font-medium">{loginError}</p>
            </div>
          )}

          <button
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-3 rounded-xl bg-metallic-700 border border-gray-600/50 text-gray-300 text-sm font-medium hover:bg-metallic-600 transition-all"
          >
            Back to Attendance
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 print:py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 print:mb-4">
          <div className="flex items-center gap-4">
            <img
              src="/MMUSwimmingClubLogo(white).png"
              alt="MMU Swimming Club"
              className="h-12 object-contain print:h-8"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-100 print:text-black">Admin Dashboard</h1>
              <p className="text-xs text-gray-500 print:text-gray-600">
                {records.length} record{records.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg bg-metallic-700 border border-gray-600/50 text-gray-300 text-sm font-medium hover:bg-metallic-600 transition-all print:hidden"
            >
              Print / PDF
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-red-900/40 border border-red-800/50 text-red-300 text-sm font-medium hover:bg-red-900/60 transition-all print:hidden"
            >
              Logout
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-lg bg-metallic-700 border border-gray-600/50 text-gray-300 text-sm font-medium hover:bg-metallic-600 transition-all print:hidden"
            >
              Back to Attendance
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 print:mb-4">
          <div className="rounded-xl bg-metallic-800 border border-gray-600/50 p-5 print:border-gray-400">
            <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Total Attendance</div>
            <div className="text-3xl font-bold text-gray-100 print:text-black">{summary.totalAttendance}</div>
          </div>
          <div className="rounded-xl bg-metallic-800 border border-gray-600/50 p-5 print:border-gray-400">
            <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Active Members</div>
            <div className="text-3xl font-bold text-emerald-400">{summary.activeMembers}</div>
          </div>
          <div className="rounded-xl bg-metallic-800 border border-gray-600/50 p-5 print:border-gray-400">
            <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Expired Members</div>
            <div className="text-3xl font-bold text-red-400">{summary.expiredMembers}</div>
          </div>
        </div>

        <div className="rounded-xl bg-metallic-800 border border-gray-600/50 p-5 mb-6 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-200">Sync Status</h2>
              {(() => {
                const isSyncingNow = syncing || syncStatus?.syncing
                const failed = syncStatus?.lastResult && syncStatus.lastResult.success === false
                if (isSyncingNow) {
                  return (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-yellow-900/60 text-yellow-300 border border-yellow-700">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Syncing now…
                    </span>
                  )
                }
                if (failed) {
                  return (
                    <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-red-900/60 text-red-300 border border-red-700">
                      Needs attention
                    </span>
                  )
                }
                return (
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-emerald-900/60 text-emerald-300 border border-emerald-700">
                    In sync
                  </span>
                )
              })()}
            </div>
            <button
              onClick={handleSyncNow}
              disabled={syncing || syncStatus?.syncing}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                syncing || syncStatus?.syncing
                  ? 'bg-metallic-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-gray-600 to-gray-500 text-gray-100 border border-gray-500/50 shadow-lg hover:from-gray-500 hover:to-gray-400'
              }`}
            >
              {syncing && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg bg-metallic-900 border border-gray-700/50 p-4">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Last Synced</div>
              <div className="text-sm font-medium text-gray-200">
                {syncStatus?.lastSyncAt ? formatTimestamp(syncStatus.lastSyncAt) : 'Never'}
              </div>
            </div>
            <div className="rounded-lg bg-metallic-900 border border-gray-700/50 p-4">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Members</div>
              <div className="text-2xl font-bold text-gray-100">
                {syncStatus ? syncStatus.memberCount : '\u2014'}
              </div>
            </div>
            <div className="rounded-lg bg-metallic-900 border border-gray-700/50 p-4">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Committee</div>
              <div className="text-2xl font-bold text-gold">
                {syncStatus ? syncStatus.committeeCount : '\u2014'}
              </div>
            </div>
          </div>

          {(() => {
            const lr = syncStatus?.lastResult
            if (!lr) {
              return (
                <p className="mt-4 text-xs text-gray-500">No sync has run yet.</p>
              )
            }
            return (
              <div className="mt-4 text-xs text-gray-400">
                <p>
                  {lr.sheetsSynced} sheet{lr.sheetsSynced !== 1 ? 's' : ''} OK, {lr.sheetsFailed} failed · took {lr.elapsed}
                  {lr.success ? '' : ' — check the sync logs.'}
                </p>
                {Array.isArray(lr.errors) && lr.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {lr.errors.map((e, i) => (
                      <li key={i} className="text-red-300">
                        <span className="font-medium">{e.label}:</span> {e.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })()}

          {syncError && (
            <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50">
              <p className="text-red-300 text-xs font-medium">{syncError}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-metallic-800 border border-gray-600/50 p-5 mb-6 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-200">Attendance Mode</h2>
              {modeStatus.mode === 'on' ? (
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-gold/20 text-goldLight border border-gold">
                  Attendance open
                </span>
              ) : (
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-metallic-900 text-gray-400 border border-gray-600/50">
                  Auto
                </span>
              )}
            </div>
            <button
              onClick={handleToggleMode}
              disabled={modeUpdating}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                modeUpdating
                  ? 'bg-metallic-700 text-gray-500 cursor-not-allowed'
                  : modeStatus.mode === 'on'
                    ? 'bg-metallic-700 border border-gray-600/50 text-gray-300 hover:bg-metallic-600'
                    : 'bg-gradient-to-r from-gold to-goldLight text-gray-900 border border-gold shadow-lg hover:opacity-90'
              }`}
            >
              {modeUpdating && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {modeStatus.mode === 'on' ? 'Set to None' : 'Enable Attendance Mode'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-metallic-900 border border-gray-700/50 p-4">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Current Behavior</div>
              <div className="text-sm font-medium text-gray-200">
                {modeStatus.mode === 'on'
                  ? 'Attendance is recorded for every lookup, regardless of session time.'
                  : `Attendance follows the session schedule (${[...new Set(sessions.map((s) => DAY_NAMES[s.dayOfWeek]))].join(', ') || 'none set'}).`}
              </div>
            </div>
            <div className="rounded-lg bg-metallic-900 border border-gray-700/50 p-4">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Last Changed</div>
              <div className="text-sm font-medium text-gray-200">
                {modeStatus.updatedAt ? formatTimestamp(modeStatus.updatedAt) : 'Never'}
              </div>
            </div>
          </div>

          {modeError && (
            <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50">
              <p className="text-red-300 text-xs font-medium">{modeError}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-metallic-800 border border-gray-600/50 p-5 mb-6 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-200">Session Schedule</h2>
              <span className="inline-block text-[10px] uppercase tracking-widest text-gray-500">
                {sessionTimezone}
              </span>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-gray-500">No sessions scheduled. Add one below.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-metallic-900 border border-gray-700/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-100">{DAY_NAMES[s.dayOfWeek]}</span>
                    <span className="text-sm text-gray-400">
                      {formatClock(s.start)} – {formatClock(s.end)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveSession(s.id)}
                    disabled={removingSessionId === s.id}
                    className="px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-800/50 text-red-300 text-xs font-medium hover:bg-red-900/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {removingSessionId === s.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddSession} className="flex flex-wrap gap-3 items-end pt-4 border-t border-gray-700/50">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Day</label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                disabled={sessionSaving}
                className="w-full px-3 py-2 rounded-lg bg-metallic-900 border border-gray-600/50 text-gray-200 text-sm outline-none focus:border-gray-400"
              >
                {DAY_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Start</label>
              <input
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                disabled={sessionSaving}
                className="w-full px-3 py-2 rounded-lg bg-metallic-900 border border-gray-600/50 text-gray-200 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">End</label>
              <input
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                disabled={sessionSaving}
                className="w-full px-3 py-2 rounded-lg bg-metallic-900 border border-gray-600/50 text-gray-200 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={sessionSaving || !newStart || !newEnd}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-gray-600 to-gray-500 text-gray-100 border border-gray-500/50 shadow-lg hover:from-gray-500 hover:to-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sessionSaving ? 'Adding...' : 'Add Session'}
            </button>
          </form>

          {sessionError && (
            <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50">
              <p className="text-red-300 text-xs font-medium">{sessionError}</p>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSearch}
          className="rounded-xl bg-metallic-800 border border-gray-600/50 p-4 mb-6 flex flex-wrap gap-3 items-end print:hidden"
        >
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-metallic-900 border border-gray-600/50 text-gray-200 text-sm outline-none focus:border-gray-400"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-metallic-900 border border-gray-600/50 text-gray-200 text-sm outline-none focus:border-gray-400"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Student ID</label>
            <input
              type="text"
              value={filters.studentId}
              onChange={(e) => handleFilterChange('studentId', e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 rounded-lg bg-metallic-900 border border-gray-600/50 text-gray-200 text-sm outline-none placeholder-gray-600 focus:border-gray-400"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Faculty</label>
            <input
              type="text"
              value={filters.faculty}
              onChange={(e) => handleFilterChange('faculty', e.target.value)}
              placeholder="e.g. FCI"
              className="w-full px-3 py-2 rounded-lg bg-metallic-900 border border-gray-600/50 text-gray-200 text-sm outline-none placeholder-gray-600 focus:border-gray-400"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Status</label>
            <select
              value={filters.membershipStatus}
              onChange={(e) => handleFilterChange('membershipStatus', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-metallic-900 border border-gray-600/50 text-gray-200 text-sm outline-none focus:border-gray-400"
            >
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-500 text-gray-100 text-sm font-semibold hover:from-gray-500 hover:to-gray-400 transition-all"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 rounded-lg bg-metallic-700 border border-gray-600/50 text-gray-400 text-sm hover:bg-metallic-600 transition-all"
            >
              Clear
            </button>
          </div>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-900/30 border border-red-800/50 p-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-600/50 print:border-gray-400">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-metallic-700/80 print:bg-gray-200">
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-gray-400 font-medium print:text-gray-600">#</th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-gray-400 font-medium print:text-gray-600">Timestamp</th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-gray-400 font-medium print:text-gray-600">Student ID</th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-gray-400 font-medium print:text-gray-600">Full Name</th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-gray-400 font-medium print:text-gray-600">Faculty</th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-gray-400 font-medium print:text-gray-600">Level</th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-widest text-gray-400 font-medium print:text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  records.map((rec, idx) => (
                    <tr
                      key={`${rec.timestamp}-${rec.studentId}-${idx}`}
                      className="border-t border-gray-700/50 print:border-gray-300 hover:bg-metallic-700/30 print:hover:bg-transparent"
                    >
                      <td className="py-3 px-4 text-gray-500 print:text-gray-600">{idx + 1}</td>
                      <td className="py-3 px-4 text-gray-300 print:text-gray-800 whitespace-nowrap">
                        {formatTimestamp(rec.timestamp)}
                      </td>
                      <td className="py-3 px-4 text-gray-100 font-medium print:text-black tracking-wider">
                        {rec.studentId}
                      </td>
                      <td className="py-3 px-4 text-gray-200 print:text-gray-800">{rec.fullName}</td>
                      <td className="py-3 px-4 text-gray-300 print:text-gray-700">{rec.faculty || '\u2014'}</td>
                      <td className="py-3 px-4">{levelBadge(rec.swimmingLevel)}</td>
                      <td className="py-3 px-4">{statusBadge(rec.membershipStatus)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {records.length > 0 && (
          <div className="mt-4 text-center text-xs text-gray-600 print:text-gray-500 print:block hidden">
            Generated: {new Date().toLocaleString('en-GB')}
          </div>
        )}
      </div>
    </div>
  )
}
