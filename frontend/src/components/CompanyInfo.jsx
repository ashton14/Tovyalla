import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

function CompanyInfo() {
  const { user, supabase } = useAuth()
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    company_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
  })

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Fetch company info
  const fetchCompany = async () => {
    if (!user?.user_metadata?.companyID || !supabase) return

    setLoading(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get('/api/company', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const companyData = response.data.company
      setCompany(companyData)
      
      if (companyData) {
        setFormData({
          company_name: companyData.company_name || '',
          address_line1: companyData.address_line1 || '',
          address_line2: companyData.address_line2 || '',
          city: companyData.city || '',
          state: companyData.state || '',
          zip_code: companyData.zip_code || '',
          country: companyData.country || 'USA',
        })
      }
    } catch (err) {
      console.error('Error fetching company:', err)
      setError(err.response?.data?.error || 'Failed to load company information')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchCompany()
    }
  }, [user, supabase])

  // Handle save
  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.put(
        '/api/company',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      setCompany(response.data.company)
      setEditing(false)
      setSuccess('Company information updated successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error updating company:', err)
      setError(err.response?.data?.error || 'Failed to update company information')
    } finally {
      setSaving(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    if (company) {
      setFormData({
        company_name: company.company_name || '',
        address_line1: company.address_line1 || '',
        address_line2: company.address_line2 || '',
        city: company.city || '',
        state: company.state || '',
        zip_code: company.zip_code || '',
        country: company.country || 'USA',
      })
    }
    setEditing(false)
    setError('')
  }

  // Handle logo upload
  const handleLogoUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, GIF, WebP, or SVG image.')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.')
      return
    }

    setUploadingLogo(true)
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      // Convert file to base64
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64Data = reader.result

          const response = await axios.post(
            '/api/company/logo',
            {
              file_data: base64Data,
              file_name: file.name,
              content_type: file.type,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )

          setCompany(response.data.company)
          setSuccess('Logo uploaded successfully!')
          setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
          console.error('Error uploading logo:', err)
          setError(err.response?.data?.error || 'Failed to upload logo')
        } finally {
          setUploadingLogo(false)
        }
      }
      reader.onerror = () => {
        setError('Failed to read file')
        setUploadingLogo(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('Error uploading logo:', err)
      setError(err.response?.data?.error || 'Failed to upload logo')
      setUploadingLogo(false)
    }

    // Reset file input
    event.target.value = ''
  }

  // Handle logo delete
  const handleLogoDelete = async () => {
    if (!window.confirm('Are you sure you want to remove the company logo?')) return

    setUploadingLogo(true)
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.delete('/api/company/logo', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setCompany(response.data.company)
      setSuccess('Logo removed successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error removing logo:', err)
      setError(err.response?.data?.error || 'Failed to remove logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  if (!user?.user_metadata?.companyID) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pool-blue"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            Company Information
          </h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
            >
              Edit
            </button>
          )}
        </div>

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

        <div className="space-y-4">
          {/* Company Logo */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Company Logo</h4>
            <div className="flex items-center gap-6">
              {/* Logo Display */}
              <div className="flex-shrink-0">
                {company?.logo_url ? (
                  <div className="relative group">
                    <img
                      src={company.logo_url}
                      alt="Company Logo"
                      className="w-32 h-32 object-contain border border-gray-200 rounded-lg bg-white p-2"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-1 text-xs text-gray-500">No logo</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-3">
                  Upload your company logo. Recommended size: 200x200 pixels or larger. Max file size: 5MB.
                </p>
                <div className="flex gap-3">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                    <span className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                      uploadingLogo
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-pool-blue hover:bg-pool-dark text-white cursor-pointer'
                    }`}>
                      {uploadingLogo ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Upload Logo
                        </>
                      )}
                    </span>
                  </label>
                  {company?.logo_url && (
                    <button
                      onClick={handleLogoDelete}
                      disabled={uploadingLogo}
                      className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Supported formats: JPEG, PNG, GIF, WebP, SVG
                </p>
              </div>
            </div>
          </div>

          {/* Company ID (read-only) */}
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

          {/* Editable Company Information */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">
              Company Details
            </h4>
            
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    placeholder="Enter company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    placeholder="Suite, unit, building, etc. (optional)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      placeholder="ZIP Code"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    placeholder="Country"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-md p-4 space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-600">Company Name:</span>
                  <p className="text-sm text-gray-900 mt-1">
                    {company?.company_name || <span className="text-gray-400 italic">Not set</span>}
                  </p>
                </div>
                {(company?.address_line1 || company?.city || company?.state || company?.zip_code) && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Address:</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {company?.address_line1 && <>{company.address_line1}<br /></>}
                      {company?.address_line2 && <>{company.address_line2}<br /></>}
                      {company?.city && company?.state && (
                        <>
                          {company.city}, {company.state} {company.zip_code || ''}
                          {company?.country && company.country !== 'USA' && `, ${company.country}`}
                        </>
                      )}
                    </p>
                  </div>
                )}
                {!company?.company_name && !company?.address_line1 && (
                  <p className="text-sm text-gray-500 italic">
                    No company information set. Click "Edit" to add company details.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Account Details (read-only) */}
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

