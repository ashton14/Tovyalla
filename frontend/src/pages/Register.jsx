import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Register() {
  const [companyID, setCompanyID] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="relative min-h-screen w-screen overflow-hidden flex items-center justify-center">
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
    setSuccess('')
    setLoading(true)

    // Basic validation
    if (!companyID.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('All fields are required')
      setLoading(false)
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    // Password validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    // Confirm password match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      await register(companyID, email, password)
      setSuccess('Account created successfully! Redirecting to dashboard...')
      setTimeout(() => {
        navigate('/dashboard')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: '📊', text: 'Complete CRM Dashboard' },
    { icon: '👥', text: 'Customer & Employee Management' },
    { icon: '📁', text: 'Project Tracking & Documents' },
    { icon: '📅', text: 'Calendar & Scheduling' },
    { icon: '📦', text: 'Inventory Management' },
    { icon: '💰', text: 'Expense Tracking & Reporting' },
    { icon: '📧', text: 'Integrated Email and Esignatures System' },
  ]

  return (
    <div className="relative h-screen w-screen overflow-hidden flex items-center justify-center p-3">
      <div className="relative w-full max-w-5xl z-10">
        {/* Header */}
        <div className="text-center mb-4">
          <img src="/tovyalla_logo.png" alt="Tovyalla CRM" className="h-14 w-auto mx-auto mb-1" />
          <p className="text-white/80 text-sm">Customer Relationship Management</p>
        </div>

        {/* Main Container - Two Panels */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
            
            {/* Left Panel - Existing Company */}
            <div className="p-5 lg:p-6">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-pool-light rounded-xl mb-3">
                  <svg className="w-5 h-5 text-pool-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Your Company Uses Tovyalla
                </h2>
                <p className="text-gray-600 text-xs">
                  Join your team by creating an account with your company ID
                </p>
              </div>

              {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-start gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-3 p-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs flex items-start gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-2.5">
                <div>
                  <label htmlFor="companyID" className="block text-xs font-medium text-gray-700 mb-1">
                    Company ID
                  </label>
                  <input
                    id="companyID"
                    type="text"
                    value={companyID}
                    onChange={(e) => setCompanyID(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent transition-all"
                    placeholder="Enter your company ID"
                    required
                  />
                  <p className="mt-1 text-[10px] text-gray-500">
                    Ask your administrator for the company ID and ensure your email is whitelisted.
                  </p>
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent transition-all"
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent transition-all"
                      placeholder="Min. 6 characters"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent transition-all"
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-pool-blue hover:bg-pool-dark text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pool-blue/25 hover:shadow-pool-dark/30 text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating account...
                    </span>
                  ) : 'Create Account'}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-600">
                  Already have an account?{' '}
                  <Link to="/" className="text-pool-blue hover:text-pool-dark font-semibold transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>

            {/* Right Panel - New Company / Pricing */}
            <div className="p-5 lg:p-6 bg-gradient-to-br from-gray-50 to-gray-100">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-pool-blue to-pool-dark rounded-xl mb-3 shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  New to Tovyalla?
                </h2>
                <p className="text-gray-600 text-xs">
                  Start managing your business with our complete CRM solution
                </p>
              </div>

              {/* Pricing Card */}
              <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200 mb-4">
                <div className="text-center mb-2">
                  <span className="text-xs font-medium text-pool-blue bg-pool-light px-2.5 py-0.5 rounded-full">
                    Business Plan
                  </span>
                </div>
                <div className="text-center mb-1">
                  <span className="text-3xl font-bold text-gray-900">$249</span>
                  <span className="text-gray-600 text-sm">/month</span>
                </div>
                <p className="text-center text-xs text-gray-500 mb-4">
                  Unlimited users included
                </p>

                {/* Features List */}
                <ul className="space-y-2 mb-4">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-pool-light rounded-full text-[10px]">
                        {feature.icon}
                      </span>
                      {feature.text}
                    </li>
                  ))}
                </ul>

                <a
                  href=""
                  className="block w-full bg-gradient-to-r from-pool-blue to-pool-dark hover:from-pool-dark hover:to-pool-blue text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-300 text-center shadow-lg shadow-pool-blue/25 hover:shadow-pool-dark/30 text-sm"
                >
                  Get Started
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-4 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    No setup fees
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Cancel anytime
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">
                  Have questions?{' '}
                  <a href="" className="text-pool-blue hover:text-pool-dark font-medium">
                    Contact our sales team
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-xs mt-4">
          © 2025 Tovyalla CRM. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default Register
