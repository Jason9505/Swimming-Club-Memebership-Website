import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitAttendance } from '../api/attendance'

export default function AttendancePage() {
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = studentId.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')

    try {
      const data = await submitAttendance(trimmed)
      if (data.isAdmin) {
        navigate('/admin')
      } else {
        navigate('/card', { state: { member: data } })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto text-center">
        <img
          src="/MMUSwimmingClubLogo(white).png"
          alt="MMU Swimming Club"
          className="h-28 mx-auto mb-8 object-contain"
        />

        <h1 className="text-2xl font-light text-gray-300 mb-2">
          Enter Student ID
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Record your attendance for today
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. 252UC2546J"
            disabled={loading}
            className={`
              w-full px-5 py-4 rounded-xl text-center text-lg tracking-wider
              bg-metallic-800 border border-gray-600/50 text-gray-100
              placeholder-gray-600 outline-none
              transition-all duration-200
              focus:border-gray-400 focus:ring-1 focus:ring-gray-400
              disabled:opacity-50
            `}
          />

          <button
            type="submit"
            disabled={loading || !studentId.trim()}
            className={`
              w-full py-4 rounded-xl font-semibold tracking-wider text-base
              bg-gradient-to-r from-gray-600 to-gray-500 text-gray-100
              border border-gray-500/50 shadow-lg
              transition-all duration-200
              hover:from-gray-500 hover:to-gray-400
              active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Checking...
              </span>
            ) : (
              'Submit'
            )}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-900/30 border border-red-800/50">
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
