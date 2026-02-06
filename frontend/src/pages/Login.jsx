import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const REMEMBER_KEY = 'tovyalla_remember_login'

function Login() {
  const [companyID, setCompanyID] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY)
      if (saved) {
        const { companyID: cid, username: u, password: p } = JSON.parse(saved)
        if (cid && u && p) {
          setCompanyID(cid)
          setUsername(u)
          setPassword(p)
          setRememberMe(true)
        }
      }
    } catch {
      localStorage.removeItem(REMEMBER_KEY)
    }
  }, [])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, loading: authLoading, inactivityMessage, clearInactivityMessage } = useAuth()
  const navigate = useNavigate()
  
  // Show inactivity message if user was auto-logged out
  const displayError = error || inactivityMessage
  const errorTitle = inactivityMessage ? 'Session Expired' : 'Authentication Error'

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="relative min-h-screen min-h-dvh w-screen overflow-hidden flex items-center justify-center">
        <div className="relative text-center z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white/80">Loading...</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    clearInactivityMessage() // Clear any inactivity message on new login attempt
    setLoading(true)

    // Basic validation
    if (!companyID.trim() || !username.trim() || !password.trim()) {
      setError('All fields are required')
      setLoading(false)
      return
    }

    try {
      await login(companyID, username, password)
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ companyID: companyID.trim(), username: username.trim(), password }))
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen min-h-dvh w-screen overflow-y-auto flex items-center justify-center p-4 py-8">
      <div className="relative w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6">
          <img src="/tovyalla_logo.png" alt="Tovyalla CRM" className="h-12 sm:h-16 w-auto mx-auto mb-1" />
          <p className="text-white/80 font-light text-sm sm:text-base">Customer Relationship Management</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-pool-blue to-pool-dark px-6 py-5">
            <h2 className="text-2xl font-bold text-white text-center">
              Welcome Back
            </h2>
            <p className="text-white/80 text-center text-sm mt-1">
              Sign in to access your dashboard
            </p>
          </div>

          {/* Card Body */}
          <div className="p-6">
            {displayError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium">{errorTitle}</p>
                  <p className="text-red-600 mt-0.5">{displayError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="companyID" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Company ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <input
                    id="companyID"
                    type="text"
                    value={companyID}
                    onChange={(e) => setCompanyID(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent transition-all bg-gray-50 hover:bg-white"
                    placeholder="Enter your company ID"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent transition-all bg-gray-50 hover:bg-white"
                    placeholder="you@company.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent transition-all bg-gray-50 hover:bg-white"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-pool-blue focus:ring-pool-blue border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Remember me</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pool-blue to-pool-dark hover:from-pool-dark hover:to-pool-blue text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pool-blue/25 hover:shadow-pool-dark/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Sign In
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Card Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <p className="text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-pool-blue hover:text-pool-dark font-semibold transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Trust Indicators - hidden on very small screens */}
        <div className="hidden sm:flex items-center justify-center gap-6 mt-5">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Secure Login</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>256-bit Encryption</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-xs sm:text-sm mt-4">
          © 2026 Tovyalla CRM. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default Login
