import { useAuth } from '../context/AuthContext'

function CompanyInfo() {
  const { user } = useAuth()

  if (!user?.user_metadata?.companyID) {
    return null
  }

  return (
    <div className="space-y-6">
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
    </div>
  )
}

export default CompanyInfo

