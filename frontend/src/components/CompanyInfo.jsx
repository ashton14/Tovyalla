import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import EmailWhitelist from './EmailWhitelist'

function CompanyInfo() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('info')

  if (!user?.user_metadata?.companyID) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'info'
                ? 'border-pool-blue text-pool-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Company Information
          </button>
          <button
            onClick={() => setActiveTab('whitelist')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'whitelist'
                ? 'border-pool-blue text-pool-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Email Whitelist
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'info' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Company Information
            </h3>
            <div className="space-y-4">
              <div className="bg-pool-light border border-pool-blue rounded-md p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Company ID
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {user.user_metadata.companyID}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Your Email
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Account Details
                </h4>
                <div className="bg-gray-50 rounded-md p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">User ID:</span>
                    <span className="text-sm font-mono text-gray-900">{user.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Account Created:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Last Sign In:</span>
                    <span className="text-sm text-gray-900">
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'whitelist' && <EmailWhitelist />}
      </div>
    </div>
  )
}

export default CompanyInfo

