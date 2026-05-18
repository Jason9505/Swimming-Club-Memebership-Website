const LEVEL_COLORS = {
  Beginner: 'bg-beginner',
  Intermediate: 'bg-intermediate',
  Advanced: 'bg-advanced',
}

const LEVEL_TEXT_COLORS = {
  Beginner: 'text-beginner',
  Intermediate: 'text-intermediate',
  Advanced: 'text-advanced',
}

export default function MembershipCard({ member }) {
  const {
    studentId,
    fullName,
    swimmingLevel,
    membershipStatus,
    memberSince,
    validThru,
  } = member

  const expired = membershipStatus === 'Expired'
  const levelColor = LEVEL_COLORS[swimmingLevel] || 'bg-gray-500'
  const levelTextColor = LEVEL_TEXT_COLORS[swimmingLevel] || 'text-gray-400'

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (!isNaN(d)) {
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    }
    return dateStr
  }

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-sm mx-auto">
      <div className="rounded-2xl overflow-hidden bg-card-metallic border border-gray-600/50 shadow-2xl">
        <div className="card-shine p-6 pb-4">
          <div className="flex justify-between items-start mb-6">
            <div className="text-2xl font-bold tracking-wider text-gray-100">
              {studentId}
            </div>
            <div
              className={`
                text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider
                ${expired
                  ? 'bg-red-900/60 text-red-300 border border-red-700'
                  : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                }
              `}
            >
              {membershipStatus || 'Unknown'}
            </div>
          </div>

          <div className="mb-6">
            <div className="text-lg font-medium text-gray-200">{fullName}</div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                Member Since
              </div>
              <div className="text-sm font-medium text-gray-300">
                {formatDate(memberSince)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                Valid Thru
              </div>
              <div className="text-sm font-medium text-gray-300">
                {formatDate(validThru)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                Status
              </div>
              <div className="text-sm font-bold tracking-wider text-gray-200">
                MEMBER
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl overflow-hidden shadow-xl ${levelColor} px-6 py-3 text-center`}>
        <span className="text-white font-bold text-lg tracking-[0.3em] uppercase">
          {swimmingLevel || 'N/A'}
        </span>
      </div>

      {expired && (
        <div className="rounded-2xl bg-red-900/80 border border-red-700 px-6 py-2 text-center">
          <span className="text-red-300 font-bold text-sm tracking-wider">
            Membership Expired
          </span>
        </div>
      )}
    </div>
  )
}
