import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import axios from 'axios'

function Settings() {
  const { user, currentCompanyID, supabase, logout, getAuthHeaders } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme, isDark } = useTheme()
  
  const getAuthHeadersAsync = useCallback(async () => {
    if (!supabase) return {}
    const { data: { session } } = await supabase.auth.getSession()
    return getAuthHeaders(session?.access_token) || {}
  }, [supabase, getAuthHeaders])
  
  // Document preferences state
  const [docPrefs, setDocPrefs] = useState({
    default_initial_fee_percent: 10,
    default_final_fee_percent: 10,
    default_initial_fee_min: '',
    default_final_fee_max: '',
    default_final_fee_min: '',
    default_initial_fee_max: '',
    default_markup_percent: 0,
    default_subcontractor_markup_percent: '',
    default_subcontractor_fee_min: '',
    default_subcontractor_fee_max: '',
    default_equipment_materials_markup_percent: '',
    default_equipment_materials_fee_min: '',
    default_equipment_materials_fee_max: '',
    default_additional_expenses_markup_percent: '',
    default_additional_expenses_fee_min: '',
    default_additional_expenses_fee_max: '',
    auto_include_initial_payment: true,
    auto_include_final_payment: true,
    auto_include_subcontractor: true,
    auto_include_equipment_materials: true,
    auto_include_additional_expenses: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  // Which defaults modal is open: 'initial_fee' | 'final_fee' | 'subcontractor' | 'equipment_materials' | 'additional_expenses' | null
  const [defaultsModalKey, setDefaultsModalKey] = useState(null)

  // Fetch company settings on mount
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const headers = await getAuthHeadersAsync()
        if (!headers.Authorization) return
        
        const response = await axios.get('/api/company', {
          headers,
        })
        
        if (response.data.company) {
          const company = response.data.company
          setDocPrefs({
            default_initial_fee_percent: company.default_initial_fee_percent ?? 10,
            default_final_fee_percent: company.default_final_fee_percent ?? 10,
            default_initial_fee_min: company.default_initial_fee_min ?? '',
            default_initial_fee_max: company.default_initial_fee_max ?? '',
            default_final_fee_min: company.default_final_fee_min ?? '',
            default_final_fee_max: company.default_final_fee_max ?? '',
            default_markup_percent: company.default_markup_percent ?? 0,
            default_subcontractor_markup_percent: company.default_subcontractor_markup_percent ?? '',
            default_subcontractor_fee_min: company.default_subcontractor_fee_min ?? '',
            default_subcontractor_fee_max: company.default_subcontractor_fee_max ?? '',
            default_equipment_materials_markup_percent: company.default_equipment_materials_markup_percent ?? '',
            default_equipment_materials_fee_min: company.default_equipment_materials_fee_min ?? '',
            default_equipment_materials_fee_max: company.default_equipment_materials_fee_max ?? '',
            default_additional_expenses_markup_percent: company.default_additional_expenses_markup_percent ?? '',
            default_additional_expenses_fee_min: company.default_additional_expenses_fee_min ?? '',
            default_additional_expenses_fee_max: company.default_additional_expenses_fee_max ?? '',
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
  }, [getAuthHeadersAsync])

  // Save document preferences
  const saveDocPrefs = async () => {
    setSaving(true)
    setSaveMessage('')
    try {
      const headers = await getAuthHeadersAsync()
      if (!headers.Authorization) return
      
      const { data } = await axios.put('/api/company', docPrefs, {
        headers,
      })

      if (data.company) {
        const c = data.company
        setDocPrefs({
          default_initial_fee_percent: c.default_initial_fee_percent ?? 10,
          default_final_fee_percent: c.default_final_fee_percent ?? 10,
          default_initial_fee_min: c.default_initial_fee_min ?? '',
          default_initial_fee_max: c.default_initial_fee_max ?? '',
          default_final_fee_min: c.default_final_fee_min ?? '',
          default_final_fee_max: c.default_final_fee_max ?? '',
          default_markup_percent: c.default_markup_percent ?? 0,
          default_subcontractor_markup_percent: c.default_subcontractor_markup_percent ?? '',
          default_subcontractor_fee_min: c.default_subcontractor_fee_min ?? '',
          default_subcontractor_fee_max: c.default_subcontractor_fee_max ?? '',
          default_equipment_materials_markup_percent: c.default_equipment_materials_markup_percent ?? '',
          default_equipment_materials_fee_min: c.default_equipment_materials_fee_min ?? '',
          default_equipment_materials_fee_max: c.default_equipment_materials_fee_max ?? '',
          default_additional_expenses_markup_percent: c.default_additional_expenses_markup_percent ?? '',
          default_additional_expenses_fee_min: c.default_additional_expenses_fee_min ?? '',
          default_additional_expenses_fee_max: c.default_additional_expenses_fee_max ?? '',
          auto_include_initial_payment: c.auto_include_initial_payment ?? true,
          auto_include_final_payment: c.auto_include_final_payment ?? true,
          auto_include_subcontractor: c.auto_include_subcontractor ?? true,
          auto_include_equipment_materials: c.auto_include_equipment_materials ?? true,
          auto_include_additional_expenses: c.auto_include_additional_expenses ?? true,
        })
      }
      
      setSaveMessage('Settings saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      setSaveMessage(error?.response?.data?.error || 'Error saving settings')
    } finally {
      setSaving(false)
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
            {/* Auto-Include Options - each row has a "Set defaults" button */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-pool-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Auto-Include in Documents
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Select which items to auto-include. Use <strong>Set defaults</strong> to configure default fee/markup %, min, and max for each.
              </p>
              <div className="space-y-3">
                {[
                  { key: 'initial_fee', label: 'Initial Payment', desc: 'Include initial fee milestone in payment schedule', prefKey: 'auto_include_initial_payment' },
                  { key: 'final_fee', label: 'Final Payment', desc: 'Include final inspection milestone in payment schedule', prefKey: 'auto_include_final_payment' },
                  { key: 'subcontractor', label: 'Subcontractor Work', desc: 'Include subcontractor fees in scope and milestones', prefKey: 'auto_include_subcontractor' },
                  { key: 'equipment_materials', label: 'Equipment & Materials', desc: 'Include equipment and materials in scope and milestones', prefKey: 'auto_include_equipment_materials' },
                  { key: 'additional_expenses', label: 'Additional Expenses', desc: 'Include additional project expenses in scope and milestones', prefKey: 'auto_include_additional_expenses' },
                ].map(({ key, label, desc, prefKey }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div
                      onClick={() => setDocPrefs(prev => ({ ...prev, [prefKey]: !prev[prefKey] }))}
                      className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                    >
                      <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${docPrefs[prefKey] ? 'bg-pool-blue border-pool-blue' : 'border-gray-300 dark:border-gray-500'}`}>
                        {docPrefs[prefKey] && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900 dark:text-white">{label}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDefaultsModalKey(key); }}
                      className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-pool-blue hover:bg-pool-light dark:hover:bg-pool-blue/20 rounded-md transition-colors"
                    >
                      Set defaults
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Defaults modal for the selected category */}
            {defaultsModalKey && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDefaultsModalKey(null)}>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {defaultsModalKey === 'initial_fee' && 'Initial Payment defaults'}
                    {defaultsModalKey === 'final_fee' && 'Final Payment defaults'}
                    {defaultsModalKey === 'subcontractor' && 'Subcontractor Work defaults'}
                    {defaultsModalKey === 'equipment_materials' && 'Equipment & Materials defaults'}
                    {defaultsModalKey === 'additional_expenses' && 'Additional Expenses defaults'}
                  </h4>
                  <div className="space-y-4">
                    {(['initial_fee', 'final_fee'].includes(defaultsModalKey)) ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fee %</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={defaultsModalKey === 'initial_fee' ? docPrefs.default_initial_fee_percent : docPrefs.default_final_fee_percent}
                              onChange={(e) => setDocPrefs(prev => ({
                                ...prev,
                                [defaultsModalKey === 'initial_fee' ? 'default_initial_fee_percent' : 'default_final_fee_percent']: parseFloat(e.target.value) || 0
                              }))}
                              min={0}
                              max={100}
                              step={1}
                              className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min ($)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                              <input
                                type="number"
                                value={defaultsModalKey === 'initial_fee' ? docPrefs.default_initial_fee_min : docPrefs.default_final_fee_min}
                                onChange={(e) => setDocPrefs(prev => ({
                                  ...prev,
                                  [defaultsModalKey === 'initial_fee' ? 'default_initial_fee_min' : 'default_final_fee_min']: e.target.value
                                }))}
                                min={0}
                                step={0.01}
                                placeholder="No min"
                                className="w-full pl-7 pr-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max ($)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                              <input
                                type="number"
                                value={defaultsModalKey === 'initial_fee' ? docPrefs.default_initial_fee_max : docPrefs.default_final_fee_max}
                                onChange={(e) => setDocPrefs(prev => ({
                                  ...prev,
                                  [defaultsModalKey === 'initial_fee' ? 'default_initial_fee_max' : 'default_final_fee_max']: e.target.value
                                }))}
                                min={0}
                                step={0.01}
                                placeholder="No max"
                                className="w-full pl-7 pr-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Markup %</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={docPrefs[`default_${defaultsModalKey}_markup_percent`] ?? ''}
                              onChange={(e) => setDocPrefs(prev => ({ ...prev, [`default_${defaultsModalKey}_markup_percent`]: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                              min={0}
                              step={1}
                              placeholder="0"
                              className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Leave blank for 0%</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min ($)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                              <input
                                type="number"
                                value={docPrefs[`default_${defaultsModalKey}_fee_min`] ?? ''}
                                onChange={(e) => setDocPrefs(prev => ({ ...prev, [`default_${defaultsModalKey}_fee_min`]: e.target.value }))}
                                min={0}
                                step={0.01}
                                placeholder="No min"
                                className="w-full pl-7 pr-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max ($)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                              <input
                                type="number"
                                value={docPrefs[`default_${defaultsModalKey}_fee_max`] ?? ''}
                                onChange={(e) => setDocPrefs(prev => ({ ...prev, [`default_${defaultsModalKey}_fee_max`]: e.target.value }))}
                                min={0}
                                step={0.01}
                                placeholder="No max"
                                className="w-full pl-7 pr-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button
                      type="button"
                      onClick={() => setDefaultsModalKey(null)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await saveDocPrefs()
                        setDefaultsModalKey(null)
                      }}
                      disabled={saving}
                      className="flex-1 px-3 py-2 bg-pool-blue hover:bg-pool-dark text-white font-medium rounded-md disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                {currentCompanyID || 'N/A'}
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

