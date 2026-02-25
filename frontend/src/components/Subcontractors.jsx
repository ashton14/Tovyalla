import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import ActionsMenu, { DOCUMENT_ICON, EDIT_ICON, DELETE_ICON } from './ActionsMenu'
import DocumentsModal from './DocumentsModal'
import { formatPhoneInput } from '../utils/phoneFormat'

function Subcontractors() {
  const { user, supabase, getAuthHeaders } = useAuth()
  const [subcontractors, setSubcontractors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ success: 0, failed: 0, total: 0 })
  const [importErrors, setImportErrors] = useState([])
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedEntityForDocuments, setSelectedEntityForDocuments] = useState(null)
  const [openActionsId, setOpenActionsId] = useState(null)
  const actionsMenuRef = useRef(null)

  // Form state
  const [initialFormData, setInitialFormData] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    primary_contact_name: '',
    primary_contact_phone: '',
    primary_contact_email: '',
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
        headers: getAuthHeaders(token),
      })

      setSubcontractors(response.data.subcontractors || [])
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

  const hasChanges = initialFormData != null && JSON.stringify(formData) !== JSON.stringify(initialFormData)

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
      }

      if (editingSubcontractor) {
        await axios.put(`/api/subcontractors/${editingSubcontractor.id}`, payload, {
          headers: getAuthHeaders(token),
        })
        setSuccess('Subcontractor updated successfully!')
      } else {
        await axios.post('/api/subcontractors', payload, {
          headers: getAuthHeaders(token),
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
        headers: getAuthHeaders(token),
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

  const emptySubForm = { name: '', primary_contact_name: '', primary_contact_phone: '', primary_contact_email: '', coi_expiration: '', notes: '' }

  // Handle edit
  const handleEdit = (subcontractor) => {
    setEditingSubcontractor(subcontractor)
    const data = {
      name: subcontractor.name || '',
      primary_contact_name: subcontractor.primary_contact_name || '',
      primary_contact_phone: formatPhoneInput(subcontractor.primary_contact_phone || ''),
      primary_contact_email: subcontractor.primary_contact_email || '',
      coi_expiration: formatDateForInput(subcontractor.coi_expiration) || '',
      notes: subcontractor.notes || '',
    }
    setFormData(data)
    setInitialFormData(data)
    setShowForm(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData(emptySubForm)
    setInitialFormData(emptySubForm)
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

  // Pagination
  const totalPages = Math.ceil(filteredSubcontractors.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSubcontractors = filteredSubcontractors.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!openActionsId) return
      if (actionsMenuRef.current?.contains(e.target)) return
      if (e.target.closest('[data-actions-menu-dropdown]')) return
      setOpenActionsId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openActionsId])

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
    const requiredColumns = ['name']
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
      if (!row.name) {
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

      // Import subcontractors one by one
      let successCount = 0
      let failedCount = 0
      const errors = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        
        // Map CSV columns to subcontractor fields
        const subcontractorData = {
          name: row.name || '',
          primary_contact_name: row.primary_contact_name || row['primary_contact_name'] || '',
          primary_contact_phone: row.primary_contact_phone || row['primary_contact_phone'] || '',
          primary_contact_email: row.primary_contact_email || row['primary_contact_email'] || '',
          coi_expiration: row.coi_expiration || row['coi_expiration'] || '',
          notes: row.notes || '',
        }

        // Validate required fields
        if (!subcontractorData.name) {
          failedCount++
          errors.push({
            row: i + 2, // +2 because row 1 is header, and arrays are 0-indexed
            error: 'Missing required field: name is required',
            data: subcontractorData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Format coi_expiration date (should be YYYY-MM-DD)
        if (subcontractorData.coi_expiration) {
          // Try to parse and reformat the date
          const date = new Date(subcontractorData.coi_expiration)
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            subcontractorData.coi_expiration = `${year}-${month}-${day}`
          } else {
            // If it's already in YYYY-MM-DD format, keep it
            if (!/^\d{4}-\d{2}-\d{2}$/.test(subcontractorData.coi_expiration)) {
              subcontractorData.coi_expiration = null
            }
          }
        } else {
          subcontractorData.coi_expiration = null
        }

        try {
          await axios.post('/api/subcontractors', subcontractorData, {
            headers: getAuthHeaders(token),
          })
          successCount++
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
        } catch (err) {
          failedCount++
          errors.push({
            row: i + 2,
            error: err.response?.data?.error || err.message || 'Failed to import subcontractor',
            data: subcontractorData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
        }
      }

      setImportErrors(errors)
      
      if (successCount > 0) {
        setSuccess(`Successfully imported ${successCount} subcontractor(s)${failedCount > 0 ? `. ${failedCount} failed.` : ''}`)
        fetchSubcontractors()
      } else {
        setError(`Failed to import all subcontractors. ${failedCount} error(s).`)
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Subcontractors</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your subcontractor database</p>
        </div>
          <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="hidden md:block px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors"
          >
            📥 Import CSV
          </button>
          <button
            onClick={() => {
              resetForm()
              setEditingSubcontractor(null)
              setShowForm(true)
            }}
            className="px-2 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
          >
            + Add Subcontractor
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

      {/* Search Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, contact name, email, or phone..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowImportModal(false); setImportErrors([]); setImportProgress({ success: 0, failed: 0, total: 0 }); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Import Subcontractors from CSV</h3>
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportErrors([])
                    setImportProgress({ success: 0, failed: 0, total: 0 })
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                      <li><code className="bg-blue-100 px-1 rounded">name</code></li>
                    </ul>
                    <p className="mt-2"><strong>Optional:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li><code className="bg-blue-100 px-1 rounded">primary_contact_name</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">primary_contact_phone</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">primary_contact_email</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">coi_expiration</code> (YYYY-MM-DD format)</li>
                      <li><code className="bg-blue-100 px-1 rounded">notes</code></li>
                    </ul>
                  </div>
                </div>

                {/* Example CSV */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Example CSV Format:</h4>
                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`name,primary_contact_name,primary_contact_phone,primary_contact_email,coi_expiration
ABC Construction,John Smith,555-0100,john@abc.com,2025-12-31
XYZ Plumbing,Jane Doe,555-0101,jane@xyz.com,2025-06-30`}
                  </pre>
                </div>

                {/* File Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVImport}
                    disabled={importing}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-pool-blue file:text-white hover:file:bg-pool-dark"
                  />
                </div>

                {/* Import Progress */}
                {importing && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <span className="font-medium text-blue-900">Importing subcontractors...</span>
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
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subcontractor Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingSubcontractor(null); resetForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-pool-blue to-pool-dark px-6 py-4 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {editingSubcontractor ? 'Edit Subcontractor' : 'New Subcontractor'}
                  </h3>
                  <p className="text-pool-light text-sm mt-0.5">
                    {editingSubcontractor ? 'Update subcontractor details' : 'Add a new subcontractor to your network'}
                  </p>
                </div>
                <button
                  onClick={() => { setShowForm(false); setEditingSubcontractor(null); resetForm(); }}
                  className="text-white/70 hover:text-white transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Company Information */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Company Information
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="ABC Construction Co."
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                    />
                  </div>
                </div>
              </div>

              {/* Primary Contact */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Primary Contact
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={formData.primary_contact_name}
                        onChange={(e) => setFormData({ ...formData, primary_contact_name: e.target.value })}
                        placeholder="John Smith"
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.primary_contact_phone}
                        onChange={(e) => setFormData({ ...formData, primary_contact_phone: formatPhoneInput(e.target.value) })}
                        placeholder="(555) 555-5555"
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.primary_contact_email}
                      onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                      placeholder="contact@company.com"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                    />
                  </div>
                </div>
              </div>

              {/* Insurance & Compliance */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Insurance & Compliance
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">COI Expiration Date</label>
                    <input
                      type="date"
                      value={formData.coi_expiration}
                      onChange={(e) => setFormData({ ...formData, coi_expiration: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Certificate of Insurance expiration date</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Notes
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow resize-none"
                    placeholder="Specialties, rates, availability notes..."
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingSubcontractor(null); resetForm(); }}
                  className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!hasChanges}
                  className="px-6 py-2.5 bg-gradient-to-r from-pool-blue to-pool-dark hover:from-pool-dark hover:to-pool-blue text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {editingSubcontractor ? 'Update Subcontractor' : 'Create Subcontractor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcontractors Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Primary Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  COI Expiration
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSubcontractors.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {subcontractors.length === 0
                      ? 'No subcontractors yet. Click "Add Subcontractor" to get started.'
                      : 'No subcontractors match your search criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedSubcontractors.map((subcontractor) => {
                  const coiStatus = getCOIStatus(subcontractor.coi_expiration)
                  return (
                    <tr key={subcontractor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{subcontractor.name || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">{subcontractor.primary_contact_name || '-'}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{subcontractor.primary_contact_phone || '-'}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{subcontractor.primary_contact_email || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
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
                        <div ref={openActionsId === subcontractor.id ? actionsMenuRef : null}>
                          <ActionsMenu
                            isOpen={openActionsId === subcontractor.id}
                            onToggle={() => setOpenActionsId((prev) => (prev === subcontractor.id ? null : subcontractor.id))}
                            onAction={() => setOpenActionsId(null)}
                            actions={[
                              { icon: DOCUMENT_ICON, label: 'Documents', iconColor: 'text-green-600 dark:text-green-400', onClick: () => { setSelectedEntityForDocuments({ id: subcontractor.id, name: subcontractor.name || 'Subcontractor' }); setShowDocumentsModal(true) } },
                              { icon: EDIT_ICON, label: 'Edit', onClick: () => handleEdit(subcontractor) },
                              { icon: DELETE_ICON, label: 'Delete', danger: true, onClick: () => handleDelete(subcontractor.id) },
                            ]}
                          />
                        </div>
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
      {filteredSubcontractors.length > itemsPerPage && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredSubcontractors.length)} of {filteredSubcontractors.length} subcontractors
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
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
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
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
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Subcontractors</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{subcontractors.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Expired COIs</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {subcontractors.filter((s) => {
              if (!s.coi_expiration) return false
              const today = getTodayString()
              return compareDates(s.coi_expiration, today) < 0
            }).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Expiring Soon (30 days)</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {subcontractors.filter((s) => {
              if (!s.coi_expiration) return false
              const today = getTodayString()
              const daysUntilExpiration = daysBetween(s.coi_expiration, today)
              return daysUntilExpiration > 0 && daysUntilExpiration <= 30
            }).length}
          </p>
        </div>
      </div>

      {/* Documents Modal */}
      {showDocumentsModal && selectedEntityForDocuments && (
        <DocumentsModal
          entityType="subcontractors"
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

export default Subcontractors

