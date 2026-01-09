import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import DocumentsModal from './DocumentsModal'
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from '../hooks/useApi'

const PIPELINE_STATUSES = [
  { value: 'lead', label: 'Lead', color: 'bg-gray-100 text-gray-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-100 text-blue-800' },
  { value: 'quoted', label: 'Quoted', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'signed', label: 'Signed', color: 'bg-green-100 text-green-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-purple-100 text-purple-800' },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-orange-100 text-orange-800' },
]

function Customers() {
  const { user, supabase } = useAuth()
  
  // Use cached query for customers
  const { data: customers = [], isLoading: loading, refetch } = useCustomers()
  
  // Mutations
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ success: 0, failed: 0, total: 0 })
  const [importErrors, setImportErrors] = useState([])
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedEntityForDocuments, setSelectedEntityForDocuments] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
    referred_by: '',
    pipeline_status: 'lead',
    notes: '',
    estimated_value: '',
  })

  // Get auth token for CSV import
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      ...formData,
      estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
    }

    try {
      if (editingCustomer) {
        await updateCustomer.mutateAsync({ id: editingCustomer.id, data: payload })
        setSuccess('Customer updated successfully!')
      } else {
        await createCustomer.mutateAsync(payload)
        setSuccess('Customer added successfully!')
      }

      setShowForm(false)
      setEditingCustomer(null)
      resetForm()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save customer')
    }
  }

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) {
      return
    }

    try {
      await deleteCustomer.mutateAsync(id)
      setSuccess('Customer deleted successfully!')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete customer')
    }
  }

  // Handle edit
  const handleEdit = (customer) => {
    setEditingCustomer(customer)
    setFormData({
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address_line1: customer.address_line1 || '',
      address_line2: customer.address_line2 || '',
      city: customer.city || '',
      state: customer.state || '',
      zip_code: customer.zip_code || '',
      country: customer.country || 'USA',
      referred_by: customer.referred_by || '',
      pipeline_status: customer.pipeline_status || 'lead',
      notes: customer.notes || '',
      estimated_value: customer.estimated_value || '',
    })
    setShowForm(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'USA',
      referred_by: '',
      pipeline_status: 'lead',
      notes: '',
      estimated_value: '',
    })
  }

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    const search = searchTerm.toLowerCase()
    const matchesSearch =
      searchTerm === '' ||
      `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search) ||
      customer.phone?.includes(searchTerm) ||
      customer.address_line1?.toLowerCase().includes(search) ||
      customer.address_line2?.toLowerCase().includes(search) ||
      customer.city?.toLowerCase().includes(search) ||
      customer.state?.toLowerCase().includes(search) ||
      customer.zip_code?.includes(searchTerm)
    
    const matchesStatus = filterStatus === 'all' || customer.pipeline_status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus])

  const getStatusBadge = (status) => {
    const statusObj = PIPELINE_STATUSES.find((s) => s.value === status)
    return statusObj || PIPELINE_STATUSES[0]
  }

  // CSV parsing helper - handles quoted fields
  const parseCSVLine = (line) => {
    const values = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    // Add last field
    values.push(current.trim())
    return values
  }

  // CSV parsing helper
  const parseCSV = (csvText) => {
    // Normalize line endings
    const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalized.split('\n').filter(line => line.trim() !== '')
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row')
    }

    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
    
    // Required columns
    const requiredColumns = ['first_name', 'last_name']
    const missingColumns = requiredColumns.filter(col => !headers.includes(col))
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`)
    }

    // Parse data rows
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''))
      const row = {}
      headers.forEach((header, index) => {
        row[header] = (values[index] || '').trim()
      })
      
      // Skip empty rows
      if (!row.first_name && !row.last_name) {
        continue
      }
      
      rows.push(row)
    }

    return { headers, rows }
  }

  // Handle CSV file import
  const handleCSVImport = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    setImporting(true)
    setError('')
    setSuccess('')
    setImportProgress({ success: 0, failed: 0, total: 0 })
    setImportErrors([])

    try {
      const fileText = await file.text()
      const { rows } = parseCSV(fileText)

      if (rows.length === 0) {
        throw new Error('No valid rows found in CSV file')
      }

      setImportProgress({ success: 0, failed: 0, total: rows.length })

      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Import customers one by one
      let successCount = 0
      let failedCount = 0
      const errors = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        
        // Map CSV columns to customer fields
        const customerData = {
          first_name: row.first_name || row['first name'] || '',
          last_name: row.last_name || row['last name'] || '',
          email: row.email || '',
          phone: row.phone || '',
          address_line1: row.address_line1 || row['address line 1'] || row.address || '',
          address_line2: row.address_line2 || row['address line 2'] || '',
          city: row.city || '',
          state: row.state || '',
          zip_code: row.zip_code || row['zip code'] || row.zip || '',
          country: row.country || 'USA',
          referred_by: row.referred_by || row['referred by'] || '',
          pipeline_status: row.pipeline_status || row['pipeline status'] || row.status || 'lead',
          notes: row.notes || '',
          estimated_value: row.estimated_value || row['estimated value'] || '',
        }

        // Validate required fields
        if (!customerData.first_name || !customerData.last_name) {
          failedCount++
          errors.push({
            row: i + 2, // +2 because row 1 is header, and arrays are 0-indexed
            error: 'Missing required fields: first_name and last_name are required',
            data: customerData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Convert estimated_value to number if present
        if (customerData.estimated_value) {
          const parsed = parseFloat(customerData.estimated_value)
          customerData.estimated_value = isNaN(parsed) ? null : parsed
        } else {
          customerData.estimated_value = null
        }

        try {
          await axios.post('/api/customers', customerData, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          successCount++
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
        } catch (err) {
          failedCount++
          errors.push({
            row: i + 2,
            error: err.response?.data?.error || err.message || 'Failed to import customer',
            data: customerData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
        }
      }

      setImportErrors(errors)
      
      if (successCount > 0) {
        setSuccess(`Successfully imported ${successCount} customer(s)${failedCount > 0 ? `. ${failedCount} failed.` : ''}`)
        // Refetch to update cache
        refetch()
      } else {
        setError(`Failed to import all customers. ${failedCount} error(s).`)
      }
    } catch (err) {
      setError(err.message || 'Failed to parse CSV file')
    } finally {
      setImporting(false)
      // Reset file input
      event.target.value = ''
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
          <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
          <p className="text-gray-600 mt-1">Manage your customer database</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors"
          >
            📥 Import CSV
          </button>
          <button
            onClick={() => {
              resetForm()
              setEditingCustomer(null)
              setShowForm(true)
            }}
            className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
          >
            + Add Customer
          </button>
        </div>
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, phone, or location..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
            >
              <option value="all">All Statuses</option>
              {PIPELINE_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowImportModal(false); setImportErrors([]); setImportProgress({ success: 0, failed: 0, total: 0 }); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Import Customers from CSV</h3>
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportErrors([])
                    setImportProgress({ success: 0, failed: 0, total: 0 })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Required Columns Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Required CSV Columns:</h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p><strong>Required:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li><code className="bg-blue-100 px-1 rounded">first_name</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">last_name</code></li>
                    </ul>
                    <p className="mt-2"><strong>Optional:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li><code className="bg-blue-100 px-1 rounded">email</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">phone</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">address_line1</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">address_line2</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">city</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">state</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">zip_code</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">country</code> (defaults to "USA")</li>
                      <li><code className="bg-blue-100 px-1 rounded">referred_by</code> (Lead Source)</li>
                      <li><code className="bg-blue-100 px-1 rounded">pipeline_status</code> (defaults to "lead")</li>
                      <li><code className="bg-blue-100 px-1 rounded">notes</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">estimated_value</code></li>
                    </ul>
                  </div>
                </div>

                {/* Example CSV */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Example CSV Format:</h4>
                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`first_name,last_name,email,phone,city,state
John,Doe,john@example.com,555-0100,New York,NY
Jane,Smith,jane@example.com,555-0101,Los Angeles,CA`}
                  </pre>
                </div>

                {/* File Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVImport}
                    disabled={importing}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Import Progress */}
                {importing && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <span className="font-medium text-blue-900">Importing customers...</span>
                    </div>
                    <div className="text-sm text-blue-800">
                      <p>Progress: {importProgress.success + importProgress.failed} / {importProgress.total}</p>
                      <p>✓ Success: {importProgress.success} | ✗ Failed: {importProgress.failed}</p>
                    </div>
                  </div>
                )}

                {/* Import Errors */}
                {importErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 max-h-48 overflow-y-auto">
                    <h4 className="font-semibold text-red-900 mb-2">Import Errors:</h4>
                    <div className="space-y-2 text-sm">
                      {importErrors.slice(0, 10).map((error, index) => (
                        <div key={index} className="text-red-800">
                          <strong>Row {error.row}:</strong> {error.error}
                        </div>
                      ))}
                      {importErrors.length > 10 && (
                        <p className="text-red-600 italic">... and {importErrors.length - 10} more errors</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Close Button */}
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false)
                      setImportErrors([])
                      setImportProgress({ success: 0, failed: 0, total: 0 })
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingCustomer(null); resetForm(); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingCustomer(null)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                    <input
                      type="text"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
                    <input
                      type="text"
                      value={formData.referred_by}
                      onChange={(e) => setFormData({ ...formData, referred_by: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pipeline Status *
                    </label>
                    <select
                      value={formData.pipeline_status}
                      onChange={(e) => setFormData({ ...formData, pipeline_status: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    >
                      {PIPELINE_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Value ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estimated_value}
                    onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    placeholder="Additional notes about this customer..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingCustomer(null)
                      resetForm()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createCustomer.isPending || updateCustomer.isPending}
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md disabled:opacity-50"
                  >
                    {(createCustomer.isPending || updateCustomer.isPending) ? 'Saving...' : (editingCustomer ? 'Update Customer' : 'Add Customer')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lead Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estimated Value
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    {customers.length === 0
                      ? 'No customers yet. Click "Add Customer" to get started.'
                      : 'No customers match your search criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => {
                  const statusBadge = getStatusBadge(customer.pipeline_status)
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.first_name} {customer.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.email || '-'}</div>
                        <div className="text-sm text-gray-500">{customer.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {customer.city && customer.state
                            ? `${customer.city}, ${customer.state}`
                            : customer.city || customer.state || '-'}
                        </div>
                        {customer.zip_code && (
                          <div className="text-sm text-gray-500">{customer.zip_code}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.referred_by || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.estimated_value
                          ? `$${parseFloat(customer.estimated_value).toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedEntityForDocuments({
                              id: customer.id,
                              name: `${customer.first_name} ${customer.last_name}`,
                            })
                            setShowDocumentsModal(true)
                          }}
                          className="text-green-600 hover:text-green-800 mr-4"
                          title="View Documents"
                        >
                          Documents
                        </button>
                        <button
                          onClick={() => handleEdit(customer)}
                          className="text-pool-blue hover:text-pool-dark mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          disabled={deleteCustomer.isPending}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
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

      {/* Pagination */}
      {filteredCustomers.length > itemsPerPage && (
        <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length} customers
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 border rounded-md text-sm font-medium ${
                        currentPage === page
                          ? 'bg-pool-blue text-white border-pool-blue'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2 text-gray-500">...</span>
                }
                return null
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Leads</p>
          <p className="text-2xl font-bold text-gray-900">
            {customers.filter((c) => c.pipeline_status === 'lead').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Active Projects</p>
          <p className="text-2xl font-bold text-gray-900">
            {customers.filter((c) => ['signed', 'in_progress'].includes(c.pipeline_status)).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-gray-900">
            {customers.filter((c) => c.pipeline_status === 'completed').length}
          </p>
        </div>
      </div>

      {/* Documents Modal */}
      {showDocumentsModal && selectedEntityForDocuments && (
        <DocumentsModal
          entityType="customers"
          entityId={selectedEntityForDocuments.id}
          entityName={selectedEntityForDocuments.name}
          onClose={() => {
            setShowDocumentsModal(false)
            setSelectedEntityForDocuments(null)
          }}
        />
      )}
    </div>
  )
}

export default Customers
