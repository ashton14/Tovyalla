import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import axios from 'axios'

function Settings() {
  const { user, supabase, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme, isDark } = useTheme()
  
  // Get auth token helper - memoized to prevent useEffect re-runs
  const getAuthToken = useCallback(async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [supabase])
  
  // Document preferences state
  const [docPrefs, setDocPrefs] = useState({
    default_initial_fee_percent: 20,
    default_final_fee_percent: 80,
    default_initial_fee_min: '',
    default_final_fee_max: '',
    default_final_fee_min: '',
    default_initial_fee_max: '',
    auto_include_initial_payment: true,
    auto_include_final_payment: true,
    auto_include_subcontractor: true,
    auto_include_equipment_materials: true,
    auto_include_additional_expenses: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Fetch company settings on mount
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const token = await getAuthToken()
        if (!token) return
        
        const response = await axios.get('/api/company', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.data.company) {
          const company = response.data.company
          setDocPrefs({
            default_initial_fee_percent: company.default_initial_fee_percent ?? 20,
            default_final_fee_percent: company.default_final_fee_percent ?? 80,
            default_initial_fee_min: company.default_initial_fee_min || '',
            default_initial_fee_max: company.default_initial_fee_max || '',
            default_final_fee_min: company.default_final_fee_min || '',
            default_final_fee_max: company.default_final_fee_max || '',
            auto_include_initial_payment: company.auto_include_initial_payment ?? true,
            auto_include_final_payment: company.auto_include_final_payment ?? true,
            auto_include_subcontractor: company.auto_include_subcontractor ?? true,
            auto_include_equipment_materials: company.auto_include_equipment_materials ?? true,
            auto_include_additional_expenses: company.auto_include_additional_expenses ?? true,
          })
        }
      } catch (error) {
        console.error('Error fetching company settings:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchCompanySettings()
  }, [getAuthToken])

  // Save document preferences
  const saveDocPrefs = async () => {
    setSaving(true)
    setSaveMessage('')
    try {
      const token = await getAuthToken()
      if (!token) return
      
      await axios.put('/api/company', docPrefs, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      setSaveMessage('Settings saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setSaveMessage('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelSubscription = async () => {
    setCancelling(true)
    try {
      const token = await getAuthToken()
      if (!token) return

      await axios.post('/api/billing/cancel-subscription', {}, {
        headers: { Authorization: `Bearer ${token}` }
      })

      await logout()
      navigate('/')
    } catch (error) {
      console.error('Cancel subscription error:', error)
      setSaveMessage(error.response?.data?.error || 'Failed to cancel subscription')
      setShowCancelModal(false)
    } finally {
      setCancelling(false)
    }
  }

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
        </div>
      </div>

      {/* Document Preferences */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          Document Preferences
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Configure default settings for contracts and proposals
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pool-blue"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Contract Signing Fee Percentages */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-pool-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Default Contract Signing Fee Percentages
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Set the default initial and final payment percentages for new contracts
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Initial Fee Percentage
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={docPrefs.default_initial_fee_percent}
                        onChange={(e) => setDocPrefs({ ...docPrefs, default_initial_fee_percent: parseFloat(e.target.value) || 0 })}
                        min="0"
                        max="100"
                        step="1"
                        className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Minimum
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={docPrefs.default_initial_fee_min}
                          onChange={(e) => setDocPrefs({ ...docPrefs, default_initial_fee_min: e.target.value })}
                          min="0"
                          step="0.01"
                          className="w-full pl-7 pr-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          placeholder="No min"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Maximum
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={docPrefs.default_initial_fee_max}
                          onChange={(e) => setDocPrefs({ ...docPrefs, default_initial_fee_max: e.target.value })}
                          min="0"
                          step="0.01"
                          className="w-full pl-7 pr-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          placeholder="No max"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Final Fee Percentage
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={docPrefs.default_final_fee_percent}
                        onChange={(e) => setDocPrefs({ ...docPrefs, default_final_fee_percent: parseFloat(e.target.value) || 0 })}
                        min="0"
                        max="100"
                        step="1"
                        className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="80"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Minimum
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={docPrefs.default_final_fee_min}
                          onChange={(e) => setDocPrefs({ ...docPrefs, default_final_fee_min: e.target.value })}
                          min="0"
                          step="0.01"
                          className="w-full pl-7 pr-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          placeholder="No min"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Maximum
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={docPrefs.default_final_fee_max}
                          onChange={(e) => setDocPrefs({ ...docPrefs, default_final_fee_max: e.target.value })}
                          min="0"
                          step="0.01"
                          className="w-full pl-7 pr-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          placeholder="No max"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-Include Options */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-pool-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Auto-Include in Documents
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Select which items to automatically include when creating new contracts, proposals, or change orders
              </p>
              <div className="space-y-3">
                <div 
                  onClick={() => setDocPrefs(prev => ({ ...prev, auto_include_initial_payment: !prev.auto_include_initial_payment }))}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center ${docPrefs.auto_include_initial_payment ? 'bg-pool-blue border-pool-blue' : 'border-gray-300 dark:border-gray-500'}`}>
                    {docPrefs.auto_include_initial_payment && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Initial Payment</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Include initial fee milestone in payment schedule</p>
                  </div>
                </div>
                <div 
                  onClick={() => setDocPrefs(prev => ({ ...prev, auto_include_final_payment: !prev.auto_include_final_payment }))}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center ${docPrefs.auto_include_final_payment ? 'bg-pool-blue border-pool-blue' : 'border-gray-300 dark:border-gray-500'}`}>
                    {docPrefs.auto_include_final_payment && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Final Payment</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Include final inspection milestone in payment schedule</p>
                  </div>
                </div>
                <div 
                  onClick={() => setDocPrefs(prev => ({ ...prev, auto_include_subcontractor: !prev.auto_include_subcontractor }))}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center ${docPrefs.auto_include_subcontractor ? 'bg-pool-blue border-pool-blue' : 'border-gray-300 dark:border-gray-500'}`}>
                    {docPrefs.auto_include_subcontractor && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Subcontractor Work</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Include subcontractor fees in scope and milestones</p>
                  </div>
                </div>
                <div 
                  onClick={() => setDocPrefs(prev => ({ ...prev, auto_include_equipment_materials: !prev.auto_include_equipment_materials }))}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center ${docPrefs.auto_include_equipment_materials ? 'bg-pool-blue border-pool-blue' : 'border-gray-300 dark:border-gray-500'}`}>
                    {docPrefs.auto_include_equipment_materials && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Equipment & Materials</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Include equipment and materials in scope and milestones</p>
                  </div>
                </div>
                <div 
                  onClick={() => setDocPrefs(prev => ({ ...prev, auto_include_additional_expenses: !prev.auto_include_additional_expenses }))}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center ${docPrefs.auto_include_additional_expenses ? 'bg-pool-blue border-pool-blue' : 'border-gray-300 dark:border-gray-500'}`}>
                    {docPrefs.auto_include_additional_expenses && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Additional Expenses</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Include additional project expenses in scope and milestones</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={saveDocPrefs}
                disabled={saving}
                className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Preferences
                  </>
                )}
              </button>
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {saveMessage}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Subscription */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-red-200 dark:border-red-900/50">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Danger Zone
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Permanently cancel your subscription and delete all company data. This cannot be undone.
        </p>
        <button
          onClick={() => setShowCancelModal(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors"
        >
          Cancel Subscription
        </button>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Cancel Subscription?
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You will lose access to your company dashboard. All company data will be permanently deleted. Your Stripe billing will be stopped. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {cancelling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel My Subscription'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

