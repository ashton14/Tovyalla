import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

function Settings() {
  const { user } = useAuth()
  const { theme, toggleTheme, isDark } = useTheme()

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Appearance Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          Appearance
        </h3>
        
        <div className="space-y-4">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-100 dark:bg-indigo-900' : 'bg-amber-100'}`}>
                {isDark ? (
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isDark ? 'Currently using dark theme' : 'Currently using light theme'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pool-blue focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                isDark ? 'bg-pool-blue' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                  isDark ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Theme Options */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => !isDark || toggleTheme()}
              className={`p-4 rounded-lg border-2 transition-all ${
                !isDark
                  ? 'border-pool-blue bg-pool-light dark:bg-pool-blue/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-full h-16 rounded-md bg-white border border-gray-200 flex items-center justify-center">
                  <div className="w-8 h-8 rounded bg-gray-100"></div>
                </div>
                <span className={`text-sm font-medium ${!isDark ? 'text-pool-blue' : 'text-gray-600 dark:text-gray-400'}`}>
                  Light
                </span>
              </div>
            </button>
            <button
              onClick={() => isDark || toggleTheme()}
              className={`p-4 rounded-lg border-2 transition-all ${
                isDark
                  ? 'border-pool-blue bg-pool-light dark:bg-pool-blue/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-full h-16 rounded-md bg-gray-800 border border-gray-700 flex items-center justify-center">
                  <div className="w-8 h-8 rounded bg-gray-700"></div>
                </div>
                <span className={`text-sm font-medium ${isDark ? 'text-pool-blue' : 'text-gray-600 dark:text-gray-400'}`}>
                  Dark
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          Account Details
        </h3>

        {/* Account Info */}
        <div className="bg-pool-light dark:bg-pool-blue/20 border border-pool-blue rounded-md p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Company ID
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {user.user_metadata?.companyID || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Your Email
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Account Statistics */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">User ID:</span>
            <span className="text-sm font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
              {user.id}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Account Created:</span>
            <span className="text-sm text-gray-900 dark:text-white">
              {new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Last Sign In:</span>
            <span className="text-sm text-gray-900 dark:text-white">
              {user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Email Verified:</span>
            <span className={`text-sm font-medium ${user.email_confirmed_at ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {user.email_confirmed_at ? 'Verified' : 'Not verified'}
            </span>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          About
        </h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <span className="font-medium text-gray-900 dark:text-white">Tovyalla</span> - Customer Relationship Management
          </p>
          <p>
            Version 1.0.0
          </p>
        </div>
      </div>
    </div>
  )
}

export default Settings

