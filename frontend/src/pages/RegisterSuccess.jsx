import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function RegisterSuccess() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [companyId, setCompanyId] = useState(null)
  const [success, setSuccess] = useState(false)
  const { supabase, setCurrentCompanyID } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session. Please complete the signup flow from the beginning.')
    }
  }, [sessionId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your password')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/billing/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      setCompanyId(data.companyId)
      if (data.companyId && setCurrentCompanyID) setCurrentCompanyID(data.companyId)

      // Sign in with Supabase
      if (supabase) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password,
        })

        if (signInError) {
          throw new Error(signInError.message || 'Failed to sign in')
        }

        navigate('/dashboard')
      } else {
        setError('Auth not configured. Please sign in manually.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="relative min-h-screen min-h-dvh w-screen overflow-hidden flex items-center justify-center p-4">
        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 max-w-md w-full z-10">
          <div className="text-center">
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
            <Link
              to="/register"
              className="inline-block text-pool-blue hover:text-pool-dark font-semibold"
            >
              Return to registration
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen min-h-dvh w-screen overflow-hidden flex items-center justify-center p-4">
      <div className="relative w-full max-w-md z-10">
        <div className="text-center mb-4">
          <img src="/tovyalla_logo.png" alt="Tovyalla CRM" className="h-12 w-auto mx-auto" />
          <p className="text-white/80 text-sm mt-1">Customer Relationship Management</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-pool-blue to-pool-dark px-6 py-5">
            <h2 className="text-xl font-bold text-white text-center">
              Payment Successful
            </h2>
            <p className="text-white/80 text-center text-sm mt-1">
              Create your password to finish setting up your account
            </p>
          </div>

          <div className="p-6">
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Account created! Redirecting to dashboard... Your Company ID: <strong>{companyId}</strong>. Save this for login.
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                  placeholder="Min. 6 characters"
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                  placeholder="Confirm password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-pool-blue hover:bg-pool-dark text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  'Complete Setup'
                )}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
              <Link to="/" className="text-sm text-pool-blue hover:text-pool-dark font-semibold">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/60">
            <Link to="/terms" className="hover:text-white/80 underline transition-colors">
              Terms of Service
            </Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-white/80 underline transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/refund" className="hover:text-white/80 underline transition-colors">
              Refund Policy
            </Link>
            <span>•</span>
            <Link to="/contact" className="hover:text-white/80 underline transition-colors">
              Contact
            </Link>
          </div>
          <p className="text-xs text-white/60">
            © 2026 Tovyalla CRM. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterSuccess
