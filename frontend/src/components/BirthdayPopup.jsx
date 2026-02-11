import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

const BIRTHDAY_STORAGE_KEY = 'tovyalla_birthday_dismissed'

function getTodayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function wasBirthdayDismissedToday() {
  try {
    return localStorage.getItem(BIRTHDAY_STORAGE_KEY) === getTodayKey()
  } catch {
    return false
  }
}

export function dismissBirthdayToday() {
  try {
    localStorage.setItem(BIRTHDAY_STORAGE_KEY, getTodayKey())
  } catch {}
}

export function getBirthdayEmployees(employees) {
  if (!employees?.length) return []
  const today = new Date()
  const todayMonth = today.getMonth()
  const todayDay = today.getDate()
  return employees.filter((emp) => {
    const dob = emp.date_of_birth
    if (!dob) return false
    // Parse YYYY-MM-DD directly to avoid timezone shifting (new Date("2025-02-10") = UTC midnight = Feb 9 in US tz)
    const str = String(dob).trim()
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return false
    const dobMonth = parseInt(match[2], 10) - 1 // 0-indexed
    const dobDay = parseInt(match[3], 10)
    return dobMonth === todayMonth && dobDay === todayDay
  })
}

function BirthdayPopup({ employees, onClose }) {
  const hasFiredConfetti = useRef(false)

  useEffect(() => {
    if (!hasFiredConfetti.current) {
      hasFiredConfetti.current = true
      // Confetti burst
      const duration = 3000
      const end = Date.now() + duration
      const colors = ['#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6']

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        })
        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()

      // Big burst on open
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors,
        })
      }, 200)
    }
  }, [])

  const names = employees.map((e) => e.name).join(', ')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Balloons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float-up"
            style={{
              left: `${5 + (i * 8)}%`,
              bottom: '-80px',
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${8 + (i % 4)}s`,
            }}
          >
            <span
              className="text-4xl drop-shadow-lg"
              style={{
                filter: `hue-rotate(${i * 30}deg)`,
              }}
            >
              {['🎈', '🎈', '🎉'][i % 3]}
            </span>
          </div>
        ))}
      </div>

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl mb-4">🎂</div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Happy Birthday!</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {employees.length === 1 ? (
            <>
              Today is <span className="font-semibold text-pool-blue">{names}</span>&apos;s birthday!
            </>
          ) : (
            <>
              Today we celebrate <span className="font-semibold text-pool-blue">{names}</span>!
            </>
          )}
        </p>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-lg transition-colors"
        >
          Celebrate!
        </button>
      </div>

      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-120vh) rotate(20deg);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation: float-up linear forwards;
        }
      `}</style>
    </div>
  )
}

export default BirthdayPopup
