import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

function Subcontractors() {
  const { user, supabase } = useAuth()
  const [subcontractors, setSubcontractors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    primary_contact_name: '',
    primary_contact_phone: '',
    primary_contact_email: '',
    rate: '',
    coi_expiration: '',
    notes: '',
  })

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Fetch subcontractors
  const fetchSubcontractors = async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get('/api/subcontractors', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSubcontractors(response.data.subcontractors || [])
      if (response.data.subcontractors && response.data.subcontractors.length > 0) {
        console.log('Fetched subcontractors:', response.data.subcontractors.length)
      }
    } catch (err) {
      console.error('Error fetching subcontractors:', err)
      console.error('Error details:', err.response?.data || err.message)
      setError(err.response?.data?.error || err.message || 'Failed to load subcontractors')
      setSubcontractors([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchSubcontractors()
    }
  }, [user])

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const payload = {
        ...formData,
        rate: formData.rate ? parseFloat(formData.rate) : null,
      }

      if (editingSubcontractor) {
        await axios.put(`/api/subcontractors/${editingSubcontractor.id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setSuccess('Subcontractor updated successfully!')
      } else {
        await axios.post('/api/subcontractors', payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setSuccess('Subcontractor added successfully!')
      }

      setShowForm(false)
      setEditingSubcontractor(null)
      resetForm()
      fetchSubcontractors()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save subcontractor')
    }
  }

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subcontractor?')) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.delete(`/api/subcontractors/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSuccess('Subcontractor deleted successfully!')
      fetchSubcontractors()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete subcontractor')
    }
  }

  // Helper function to format date for input field (YYYY-MM-DD)
  const formatDateForInput = (dateString) => {
    if (!dateString) return ''
    // Extract just the date part (YYYY-MM-DD) from ISO string or date string
    return dateString.split('T')[0]
  }

  // Handle edit
  const handleEdit = (subcontractor) => {
    setEditingSubcontractor(subcontractor)
    setFormData({
      name: subcontractor.name || '',
      primary_contact_name: subcontractor.primary_contact_name || '',
      primary_contact_phone: subcontractor.primary_contact_phone || '',
      primary_contact_email: subcontractor.primary_contact_email || '',
      rate: subcontractor.rate || '',
      coi_expiration: formatDateForInput(subcontractor.coi_expiration) || '',
      notes: subcontractor.notes || '',
    })
    setShowForm(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      primary_contact_name: '',
      primary_contact_phone: '',
      primary_contact_email: '',
      rate: '',
      coi_expiration: '',
      notes: '',
    })
  }

  // Filter subcontractors
  const filteredSubcontractors = subcontractors.filter((subcontractor) => {
    const matchesSearch =
      searchTerm === '' ||
      subcontractor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subcontractor.primary_contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subcontractor.primary_contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subcontractor.primary_contact_phone?.includes(searchTerm)

    return matchesSearch
  })

  // Helper function to format date without timezone issues
  const formatDateLocal = (dateString) => {
    if (!dateString) return ''
    // Parse date string as local date (YYYY-MM-DD format)
    const [year, month, day] = dateString.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString()
  }

  // Helper function to compare dates without timezone issues
  const compareDates = (dateString1, dateString2) => {
    if (!dateString1 || !dateString2) return 0
    const [y1, m1, d1] = dateString1.split('T')[0].split('-').map(Number)
    const [y2, m2, d2] = dateString2.split('T')[0].split('-').map(Number)
    const date1 = new Date(y1, m1 - 1, d1)
    const date2 = new Date(y2, m2 - 1, d2)
    return date1 - date2
  }

  // Helper function to get today's date as YYYY-MM-DD string
  const getTodayString = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper function to calculate days between dates
  const daysBetween = (dateString1, dateString2) => {
    if (!dateString1 || !dateString2) return 0
    const [y1, m1, d1] = dateString1.split('T')[0].split('-').map(Number)
    const [y2, m2, d2] = dateString2.split('T')[0].split('-').map(Number)
    const date1 = new Date(y1, m1 - 1, d1)
    const date2 = new Date(y2, m2 - 1, d2)
    return Math.ceil((date1 - date2) / (1000 * 60 * 60 * 24))
  }

  // Check if COI is expired or expiring soon
  const getCOIStatus = (expirationDate) => {
    if (!expirationDate) return { status: 'unknown', color: 'bg-gray-100 text-gray-800', label: 'No expiration' }
    
    const today = getTodayString()
    const daysUntilExpiration = daysBetween(expirationDate, today)

    if (daysUntilExpiration < 0) {
      return { status: 'expired', color: 'bg-red-100 text-red-800', label: 'Expired' }
    } else if (daysUntilExpiration <= 30) {
      return { status: 'expiring', color: 'bg-yellow-100 text-yellow-800', label: 'Expiring Soon' }
    } else {
      return { status: 'valid', color: 'bg-green-100 text-green-800', label: 'Valid' }
    }
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Subcontractors</h2>
          <p className="text-gray-600 mt-1">Manage your subcontractor database</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setEditingSubcontractor(null)
            setShowForm(true)
          }}
          className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
        >
          + Add Subcontractor
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          {success}
        </div>
      )}

      {/* Search Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, contact name, email, or phone..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
          />
        </div>
      </div>

      {/* Subcontractor Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingSubcontractor ? 'Edit Subcontractor' : 'Add New Subcontractor'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingSubcontractor(null)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.primary_contact_name}
                      onChange={(e) => setFormData({ ...formData, primary_contact_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.primary_contact_phone}
                      onChange={(e) => setFormData({ ...formData, primary_contact_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Contact Email
                  </label>
                  <input
                    type="email"
                    value={formData.primary_contact_email}
                    onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rate ($/hr)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      COI Expiration
                    </label>
                    <input
                      type="date"
                      value={formData.coi_expiration}
                      onChange={(e) => setFormData({ ...formData, coi_expiration: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    placeholder="Additional notes about this subcontractor..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingSubcontractor(null)
                      resetForm()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md"
                  >
                    {editingSubcontractor ? 'Update Subcontractor' : 'Add Subcontractor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Subcontractors Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Primary Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  COI Expiration
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSubcontractors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    {subcontractors.length === 0
                      ? 'No subcontractors yet. Click "Add Subcontractor" to get started.'
                      : 'No subcontractors match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredSubcontractors.map((subcontractor) => {
                  const coiStatus = getCOIStatus(subcontractor.coi_expiration)
                  return (
                    <tr key={subcontractor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{subcontractor.name || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{subcontractor.primary_contact_name || '-'}</div>
                        <div className="text-sm text-gray-500">{subcontractor.primary_contact_phone || '-'}</div>
                        <div className="text-sm text-gray-500">{subcontractor.primary_contact_email || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {subcontractor.rate ? `$${parseFloat(subcontractor.rate).toFixed(2)}/hr` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {subcontractor.coi_expiration
                            ? formatDateLocal(subcontractor.coi_expiration)
                            : '-'}
                        </div>
                        {subcontractor.coi_expiration && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${coiStatus.color}`}
                          >
                            {coiStatus.label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(subcontractor)}
                          className="text-pool-blue hover:text-pool-dark mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(subcontractor.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Subcontractors</p>
          <p className="text-2xl font-bold text-gray-900">{subcontractors.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Expired COIs</p>
          <p className="text-2xl font-bold text-red-600">
            {subcontractors.filter((s) => {
              if (!s.coi_expiration) return false
              const today = getTodayString()
              return compareDates(s.coi_expiration, today) < 0
            }).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Expiring Soon (30 days)</p>
          <p className="text-2xl font-bold text-yellow-600">
            {subcontractors.filter((s) => {
              if (!s.coi_expiration) return false
              const today = getTodayString()
              const daysUntilExpiration = daysBetween(s.coi_expiration, today)
              return daysUntilExpiration > 0 && daysUntilExpiration <= 30
            }).length}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Subcontractors

