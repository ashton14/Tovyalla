import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import EmailWhitelist from '../components/EmailWhitelist'

function Dashboard() {
  const { user, logout, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/')
    }
  }, [user, loading, navigate])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pool-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-pool-dark">Tovyalla CRM</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Welcome Section */}
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Welcome to Tovyalla Dashboard
            </h2>
            <p className="text-gray-600 mb-6">
              You are successfully logged in. This is a placeholder dashboard page.
            </p>
            {user.user_metadata?.companyID && (
              <div className="bg-pool-light border border-pool-blue rounded-md p-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Company ID:</span> {user.user_metadata.companyID}
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  <span className="font-semibold">Email:</span> {user.email}
                </p>
              </div>
            )}
          </div>

          {/* Email Whitelist Management Section */}
          {user.user_metadata?.companyID && (
            <EmailWhitelist />
          )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard

