const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatClock(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map((n) => parseInt(n, 10))
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export default function SessionBars({ session }) {
  if (!session) return null

  return (
    <div className="mb-8 flex flex-col gap-2">
      {session.days.map((dayNum) => {
        const isActive = session.active && session.activeDay === dayNum
        return (
          <div
            key={dayNum}
            className={`
              inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wider border
              ${isActive
                ? 'bg-gold/15 text-goldLight border-gold'
                : 'bg-metallic-800 text-gray-500 border-gray-600/50'
              }
            `}
          >
            <span
              className={`h-2 w-2 rounded-full ${isActive ? 'bg-gold animate-pulse' : 'bg-gray-600'}`}
            />
            {isActive
              ? `Session open now · ${DAY_NAMES[dayNum]} · ${formatClock(session.start)} – ${formatClock(session.end)}`
              : `Sessions: ${DAY_NAMES[dayNum]} · ${formatClock(session.start)} – ${formatClock(session.end)}`}
          </div>
        )
      })}
    </div>
  )
}
