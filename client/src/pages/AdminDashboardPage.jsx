import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, logout, checkAuth, getAttendance, getSummary } from '../api/admin'

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({ totalAttendance: 0, activeMembers: 0, expiredMembers: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => {
    if (authenticated) {
      fetchData(filters)
    }
  }, [authenticated])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      await login(password)
      setAuthenticated(true)
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleLogout() {
    await logout()
    setAuthenticated(false)
    setPassword('')
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
          <h1 className="text-xl font-light text-gray-300 mb-1">Admin Login</h1>
          <p className="text-xs text-gray-500 mb-6">Enter the admin password to continue</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-center text-sm tracking-wider bg-metallic-800 border border-gray-600/50 text-gray-100 placeholder-gray-600 outline-none transition-all duration-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
            />
            <button
              type="submit"
              disabled={loginLoading || !password}
              className="w-full py-3 rounded-xl font-semibold tracking-wider text-sm bg-gradient-to-r from-gray-600 to-gray-500 text-gray-100 border border-gray-500/50 shadow-lg transition-all duration-200 hover:from-gray-500 hover:to-gray-400 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {loginError && (
            <div className="mt-4 p-3 rounded-xl bg-red-900/30 border border-red-800/50">
              <p className="text-red-300 text-sm">{loginError}</p>
            </div>
          )}

          <button
            onClick={() => navigate('/')}
            className="mt-6 text-xs text-gray-600 hover:text-gray-400 transition-colors"
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
