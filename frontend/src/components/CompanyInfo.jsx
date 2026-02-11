import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { formatPhoneInput } from '../utils/phoneFormat'

function CompanyInfo() {
  const { user, currentCompanyID, supabase, getAuthHeaders } = useAuth()
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
    phone: '',
    website: '',
    license_numbers: [],
    terms_of_service: '',
    default_initial_fee_percent: 20,
    default_final_fee_percent: 80,
    default_initial_fee_min: '',
    default_initial_fee_max: '',
    default_final_fee_min: '',
    default_final_fee_max: '',
  })
  
  const [newLicense, setNewLicense] = useState('')

  const getAuthHeadersAsync = async () => {
    if (!supabase) return {}
    const { data: { session } } = await supabase.auth.getSession()
    return getAuthHeaders(session?.access_token) || {}
  }

  // Fetch company info
  const fetchCompany = async () => {
    if (!currentCompanyID || !supabase) return

    setLoading(true)
    setError('')
    try {
      const headers = await getAuthHeadersAsync()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/company', {
        headers,
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
          phone: formatPhoneInput(companyData.phone || ''),
          website: companyData.website || '',
          license_numbers: companyData.license_numbers || [],
          terms_of_service: companyData.terms_of_service || '',
          default_initial_fee_percent: companyData.default_initial_fee_percent ?? 20,
          default_final_fee_percent: companyData.default_final_fee_percent ?? 80,
          default_initial_fee_min: companyData.default_initial_fee_min || '',
          default_initial_fee_max: companyData.default_initial_fee_max || '',
          default_final_fee_min: companyData.default_final_fee_min || '',
          default_final_fee_max: companyData.default_final_fee_max || '',
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
      const headers = await getAuthHeadersAsync()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.put(
        '/api/company',
        formData,
        {
          headers: {
            ...headers,
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
        phone: formatPhoneInput(company.phone || ''),
        website: company.website || '',
        license_numbers: company.license_numbers || [],
        terms_of_service: company.terms_of_service || '',
        default_initial_fee_percent: company.default_initial_fee_percent ?? 20,
        default_final_fee_percent: company.default_final_fee_percent ?? 80,
        default_initial_fee_min: company.default_initial_fee_min || '',
        default_initial_fee_max: company.default_initial_fee_max || '',
        default_final_fee_min: company.default_final_fee_min || '',
        default_final_fee_max: company.default_final_fee_max || '',
      })
    }
    setNewLicense('')
    setEditing(false)
    setError('')
  }

  // Handle adding a license number
  const handleAddLicense = () => {
    if (newLicense.trim()) {
      setFormData({
        ...formData,
        license_numbers: [...formData.license_numbers, newLicense.trim()]
      })
      setNewLicense('')
    }
  }

  // Handle removing a license number
  const handleRemoveLicense = (index) => {
    setFormData({
      ...formData,
      license_numbers: formData.license_numbers.filter((_, i) => i !== index)
    })
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
      const headers = await getAuthHeadersAsync()
      if (!headers.Authorization) throw new Error('Not authenticated')

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
                ...headers,
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
      const headers = await getAuthHeadersAsync()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.delete('/api/company/logo', {
        headers: {
          ...headers,
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

  if (!currentCompanyID) {
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
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
          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Company Logo</h4>
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
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
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
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Supported formats: JPEG, PNG, GIF, WebP, SVG
                </p>
              </div>
            </div>
          </div>

          {/* Company ID (read-only) */}
          <div className="bg-pool-light dark:bg-pool-blue/20 border border-pool-blue rounded-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Company ID
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {currentCompanyID}
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

          {/* Editable Company Information */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
              Company Details
            </h4>
            
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Suite, unit, building, etc. (optional)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="ZIP Code"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Country"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhoneInput(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="https://www.example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    License Numbers
                  </label>
                  <div className="space-y-2">
                    {formData.license_numbers.map((license, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm">
                          {license}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLicense(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newLicense}
                        onChange={(e) => setNewLicense(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLicense())}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                        placeholder="Enter license number (e.g., CPB #1234567)"
                      />
                      <button
                        type="button"
                        onClick={handleAddLicense}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-md transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Add contractor license numbers that will appear on contracts
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Terms of Service / Legal Clauses
                  </label>
                  <textarea
                    value={formData.terms_of_service}
                    onChange={(e) => setFormData({ ...formData, terms_of_service: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter your company's terms of service, legal clauses, warranty information, and other legal text that will appear on generated contracts and proposals..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This text will be included in the legal section of generated documents (contracts, proposals, change orders).
                  </p>
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
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Company Name:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {company?.company_name || <span className="text-gray-400 italic">Not set</span>}
                  </p>
                </div>
                {(company?.address_line1 || company?.city || company?.state || company?.zip_code) && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Address:</span>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
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
                {(company?.phone || company?.website) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {company?.phone && (
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Phone:</span>
                        <p className="text-sm text-gray-900 dark:text-white mt-1">{company.phone}</p>
                      </div>
                    )}
                    {company?.website && (
                      <div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Website:</span>
                        <p className="text-sm text-gray-900 dark:text-white mt-1">
                          <a
                            href={/^https?:\/\//i.test(company.website) ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pool-blue hover:underline"
                          >
                            {company.website}
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {company?.license_numbers && company.license_numbers.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">License Numbers:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {company.license_numbers.map((license, index) => (
                        <span key={index} className="px-3 py-1 bg-pool-light text-pool-dark text-sm rounded-full border border-pool-blue">
                          {license}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {company?.terms_of_service && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Terms of Service / Legal Clauses:</span>
                    <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-600 rounded-md max-h-40 overflow-y-auto">
                      <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{company.terms_of_service}</p>
                    </div>
                  </div>
                )}
                {!company?.company_name && !company?.address_line1 && !company?.phone && !company?.website && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No company information set. Click "Edit" to add company details.
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default CompanyInfo

