import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import MembershipCard from '../components/MembershipCard'
import { getMember } from '../api/attendance'

export default function MembershipCardPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [member, setMember] = useState(location.state?.member || null)
  const [loading, setLoading] = useState(!location.state?.member)
  const [error, setError] = useState('')

  useEffect(() => {
    if (member) return

    const studentId = searchParams.get('studentId')
    if (!studentId) {
      setError('No member data available.')
      setLoading(false)
      return
    }

    getMember(studentId)
      .then(setMember)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [member, searchParams])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-gray-400 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400">Loading membership card...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mb-6 text-5xl">⚠️</div>
          <p className="text-red-300 text-lg font-medium mb-2">{error}</p>
          <p className="text-gray-500 text-sm mb-6">
            Please check your Student ID and try again.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-gray-600 to-gray-500 text-gray-100 font-semibold hover:from-gray-500 hover:to-gray-400 transition-all"
          >
            Back to Attendance
          </button>
        </div>
      </div>
    )
  }

  if (!member) return null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm mx-auto">
        <img
          src="/MMUSwimmingClubLogo(white).png"
          alt="MMU Swimming Club"
          className="h-20 mx-auto mb-8 object-contain"
        />

        <MembershipCard member={member} />

        <div className="mt-8 text-center">
          <p className="text-green-400/80 text-sm font-medium mb-6">
            ✓ Attendance recorded successfully
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl bg-metallic-700 border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-metallic-600 transition-all"
          >
            Back to Attendance
          </button>
        </div>
      </div>
    </div>
  )
}
