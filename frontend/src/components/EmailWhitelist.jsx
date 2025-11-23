import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

function EmailWhitelist() {
  const { user, supabase } = useAuth()
  const [email, setEmail] = useState('')
  const [whitelist, setWhitelist] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)

  const companyID = user?.user_metadata?.companyID

  // Get auth token for API calls
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Fetch whitelist
  const fetchWhitelist = async () => {
    setLoadingList(true)
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get('/api/whitelist', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setWhitelist(response.data.whitelist || [])
    } catch (err) {
      console.error('Error fetching whitelist:', err)
      setError('Failed to load whitelist')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (user && companyID) {
      fetchWhitelist()
    }
  }, [user, companyID])

  const handleAddEmail = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (!email.trim()) {
      setError('Email is required')
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

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.post(
        '/api/whitelist',
        { email: email.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      setSuccess(`Email ${email} has been added to the whitelist`)
      setEmail('')
      fetchWhitelist()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add email')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveEmail = async (id) => {
    if (!window.confirm('Are you sure you want to remove this email from the whitelist?')) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.delete(`/api/whitelist/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSuccess('Email removed from whitelist')
      fetchWhitelist()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to remove email')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        Email Whitelist Management
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Manage which email addresses can register with your Company ID ({companyID}). 
        Only emails on this list will be able to create accounts for your company.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          {success}
        </div>
      )}

      {/* Add Email Form */}
      <form onSubmit={handleAddEmail} className="mb-6">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
            placeholder="Enter email address to whitelist"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding...' : 'Add Email'}
          </button>
        </div>
      </form>

      {/* Whitelist Table */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Whitelisted Emails ({whitelist.length})
        </h4>
        {loadingList ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pool-blue mx-auto"></div>
          </div>
        ) : whitelist.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No emails in whitelist. Add emails above to allow users to register.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {whitelist.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.email}</td>
                    <td className="px-4 py-3 text-sm">
                      {entry.registered ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Registered
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <button
                        onClick={() => handleRemoveEmail(entry.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          <strong>Note:</strong> Users with whitelisted emails can register at the registration page 
          using your Company ID ({companyID}). They will not be able to register if their email is not on this list.
        </p>
      </div>
    </div>
  )
}

export default EmailWhitelist

