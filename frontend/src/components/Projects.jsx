import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import ProjectExpenses from './ProjectExpenses'
import DocumentsModal from './DocumentsModal'
import {
  useProjects,
  useCustomers,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from '../hooks/useApi'

const PROJECT_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'HOA', label: 'HOA' },
]

const POOL_OR_SPA_OPTIONS = [
  { value: 'pool', label: 'Pool' },
  { value: 'spa', label: 'Spa' },
  { value: 'pool & spa', label: 'Pool & Spa' },
]

const PROJECT_STATUSES = [
  { value: 'proposal_request', label: 'Proposal Request', color: 'bg-gray-100 text-gray-800' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-blue-100 text-blue-800' },
  { value: 'sold', label: 'Sold', color: 'bg-green-100 text-green-800' },
  { value: 'complete', label: 'Complete', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
]

function Projects() {
  const { user, supabase } = useAuth()
  
  // Use cached queries
  const { data: projects = [], isLoading: loading, refetch } = useProjects()
  const { data: customers = [] } = useCustomers()
  
  // Mutations
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [selectedProjectForExpenses, setSelectedProjectForExpenses] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ success: 0, failed: 0, total: 0 })
  const [importErrors, setImportErrors] = useState([])
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedEntityForDocuments, setSelectedEntityForDocuments] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    customer_id: '',
    address: '',
    project_type: 'residential',
    pool_or_spa: 'pool',
    sq_feet: '',
    status: 'proposal_request',
    accessories_features: '',
    est_value: '',
    project_manager: '',
    notes: '',
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
      sq_feet: formData.sq_feet ? parseFloat(formData.sq_feet) : null,
      est_value: formData.est_value ? parseFloat(formData.est_value) : null,
      customer_id: formData.customer_id || null,
    }

    try {
      if (editingProject) {
        await updateProject.mutateAsync({ id: editingProject.id, data: payload })
        setSuccess('Project updated successfully!')
      } else {
        await createProject.mutateAsync(payload)
        setSuccess('Project added successfully!')
      }

      setShowForm(false)
      setEditingProject(null)
      resetForm()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save project')
    }
  }

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) {
      return
    }

    try {
      await deleteProject.mutateAsync(id)
      setSuccess('Project deleted successfully!')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete project')
    }
  }

  // Handle edit
  const handleEdit = (project) => {
    setEditingProject(project)
    setFormData({
      customer_id: project.customer_id || '',
      address: project.address || '',
      project_type: project.project_type || 'residential',
      pool_or_spa: project.pool_or_spa || 'pool',
      sq_feet: project.sq_feet || '',
      status: project.status || 'proposal_request',
      accessories_features: project.accessories_features || '',
      est_value: project.est_value || '',
      project_manager: project.project_manager || '',
      notes: project.notes || '',
    })
    setShowForm(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      customer_id: '',
      address: '',
      project_type: 'residential',
      pool_or_spa: 'pool',
      sq_feet: '',
      status: 'proposal_request',
      accessories_features: '',
      est_value: '',
      project_manager: '',
      notes: '',
    })
  }

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      searchTerm === '' ||
      project.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.project_manager?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.customers && `${project.customers.first_name} ${project.customers.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus
    const matchesType = filterType === 'all' || project.project_type === filterType
    
    return matchesSearch && matchesStatus && matchesType
  })

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus, filterType])

  const getStatusBadge = (status) => {
    const statusObj = PROJECT_STATUSES.find((s) => s.value === status)
    return statusObj || PROJECT_STATUSES[0]
  }

  const getCustomerName = (project) => {
    if (project.customers) {
      return `${project.customers.first_name} ${project.customers.last_name}`
    }
    return 'No customer assigned'
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
    const requiredColumns = ['project_type', 'pool_or_spa']
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
      if (!row.project_type && !row.pool_or_spa) {
        continue
      }
      
      rows.push(row)
    }

    return { headers, rows }
  }

  // Find customer ID by name
  const findCustomerIdByName = (customerName) => {
    if (!customerName) return null
    
    const nameParts = customerName.trim().split(/\s+/)
    if (nameParts.length < 2) return null
    
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ')
    
    const customer = customers.find(c => 
      c.first_name?.toLowerCase() === firstName.toLowerCase() &&
      c.last_name?.toLowerCase() === lastName.toLowerCase()
    )
    
    return customer?.id || null
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

      // Import projects one by one
      let successCount = 0
      let failedCount = 0
      const errors = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        
        // Map CSV columns to project fields
        let customerId = null
        if (row.customer_id) {
          customerId = row.customer_id
        } else if (row.customer_name || row.customer) {
          customerId = findCustomerIdByName(row.customer_name || row.customer)
        }

        const projectData = {
          customer_id: customerId || null,
          address: row.address || '',
          project_type: row.project_type || '',
          pool_or_spa: row.pool_or_spa || row['pool_or_spa'] || '',
          sq_feet: row.sq_feet || row['sq_feet'] || row['square feet'] || '',
          status: row.status || 'proposal_request',
          accessories_features: row.accessories_features || row['accessories_features'] || row['accessories & features'] || '',
          est_value: row.est_value || row['est_value'] || row['estimated value'] || '',
          project_manager: row.project_manager || row['project_manager'] || row['project manager'] || row.pm || '',
          notes: row.notes || '',
        }

        // Validate required fields
        if (!projectData.project_type || !projectData.pool_or_spa) {
          failedCount++
          errors.push({
            row: i + 2, // +2 because row 1 is header, and arrays are 0-indexed
            error: 'Missing required fields: project_type and pool_or_spa are required',
            data: projectData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Validate project_type
        const validProjectTypes = ['residential', 'commercial', 'HOA']
        if (!validProjectTypes.includes(projectData.project_type.toLowerCase())) {
          failedCount++
          errors.push({
            row: i + 2,
            error: `Invalid project_type: ${projectData.project_type}. Must be one of: ${validProjectTypes.join(', ')}`,
            data: projectData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Validate pool_or_spa
        const validPoolOrSpa = ['pool', 'spa', 'pool & spa']
        if (!validPoolOrSpa.includes(projectData.pool_or_spa.toLowerCase())) {
          failedCount++
          errors.push({
            row: i + 2,
            error: `Invalid pool_or_spa: ${projectData.pool_or_spa}. Must be one of: ${validPoolOrSpa.join(', ')}`,
            data: projectData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Normalize values
        projectData.project_type = projectData.project_type.toLowerCase()
        projectData.pool_or_spa = projectData.pool_or_spa.toLowerCase()

        // Convert numeric fields
        if (projectData.sq_feet) {
          const parsed = parseFloat(projectData.sq_feet)
          projectData.sq_feet = isNaN(parsed) ? null : parsed
        } else {
          projectData.sq_feet = null
        }

        if (projectData.est_value) {
          const parsed = parseFloat(projectData.est_value)
          projectData.est_value = isNaN(parsed) ? null : parsed
        } else {
          projectData.est_value = null
        }

        try {
          await axios.post('/api/projects', projectData, {
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
            error: err.response?.data?.error || err.message || 'Failed to import project',
            data: projectData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
        }
      }

      setImportErrors(errors)
      
      if (successCount > 0) {
        setSuccess(`Successfully imported ${successCount} project(s)${failedCount > 0 ? `. ${failedCount} failed.` : ''}`)
        // Refetch to update cache
        refetch()
      } else {
        setError(`Failed to import all projects. ${failedCount} error(s).`)
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
          <h2 className="text-2xl font-bold text-gray-800">Projects</h2>
          <p className="text-gray-600 mt-1">Manage your pool construction projects</p>
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
              setEditingProject(null)
              setShowForm(true)
            }}
            className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
          >
            + Add Project
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm whitespace-pre-line">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by address, customer, or PM..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
            >
              <option value="all">All Statuses</option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
            >
              <option value="all">All Types</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
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
                <h3 className="text-xl font-semibold text-gray-800">Import Projects from CSV</h3>
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
                      <li><code className="bg-blue-100 px-1 rounded">project_type</code> - Must be: <code className="bg-blue-100 px-1 rounded">residential</code>, <code className="bg-blue-100 px-1 rounded">commercial</code>, or <code className="bg-blue-100 px-1 rounded">HOA</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">pool_or_spa</code> - Must be: <code className="bg-blue-100 px-1 rounded">pool</code>, <code className="bg-blue-100 px-1 rounded">spa</code>, or <code className="bg-blue-100 px-1 rounded">pool & spa</code></li>
                    </ul>
                    <p className="mt-2"><strong>Optional:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li><code className="bg-blue-100 px-1 rounded">customer_name</code> or <code className="bg-blue-100 px-1 rounded">customer_id</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">address</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">sq_feet</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">status</code> (defaults to "proposal_request")</li>
                      <li><code className="bg-blue-100 px-1 rounded">accessories_features</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">est_value</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">project_manager</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">notes</code></li>
                    </ul>
                  </div>
                </div>

                {/* Example CSV */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Example CSV Format:</h4>
                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`project_type,pool_or_spa,address,customer_name,status,est_value
residential,pool,123 Main St,John Doe,sold,50000
commercial,spa,456 Business Ave,Jane Smith,proposal_request,75000`}
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
                      <span className="font-medium text-blue-900">Importing projects...</span>
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

      {/* Project Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingProject(null); resetForm(); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingProject ? 'Edit Project' : 'Add New Project'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingProject(null)
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
                      Customer
                    </label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    >
                      <option value="">Select a customer...</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.first_name} {customer.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Manager
                    </label>
                    <input
                      type="text"
                      value={formData.project_manager}
                      onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Type *
                    </label>
                    <select
                      value={formData.project_type}
                      onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    >
                      {PROJECT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pool or Spa *
                    </label>
                    <select
                      value={formData.pool_or_spa}
                      onChange={(e) => setFormData({ ...formData, pool_or_spa: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    >
                      {POOL_OR_SPA_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Square Feet
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.sq_feet}
                      onChange={(e) => setFormData({ ...formData, sq_feet: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    >
                      {PROJECT_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Value ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.est_value}
                      onChange={(e) => setFormData({ ...formData, est_value: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accessories & Features
                  </label>
                  <textarea
                    value={formData.accessories_features}
                    onChange={(e) => setFormData({ ...formData, accessories_features: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    placeholder="List accessories and features..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    placeholder="Additional project notes..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingProject(null)
                      resetForm()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createProject.isPending || updateProject.isPending}
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md disabled:opacity-50"
                  >
                    {(createProject.isPending || updateProject.isPending) ? 'Saving...' : (editingProject ? 'Update Project' : 'Add Project')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pool/Spa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sq Ft
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Est Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-gray-500">
                    {projects.length === 0
                      ? 'No projects yet. Click "Add Project" to get started.'
                      : 'No projects match your search criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedProjects.map((project) => {
                  const statusBadge = getStatusBadge(project.status)
                  return (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getCustomerName(project)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{project.address || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {PROJECT_TYPES.find((t) => t.value === project.project_type)?.label || project.project_type}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">{project.pool_or_spa}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {project.sq_feet ? project.sq_feet.toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.est_value
                          ? `$${parseFloat(project.est_value).toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {project.project_manager || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(project.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedEntityForDocuments({
                              id: project.id,
                              name: project.address || `Project ${project.id.substring(0, 8)}`,
                            })
                            setShowDocumentsModal(true)
                          }}
                          className="text-green-600 hover:text-green-800 mr-4"
                          title="View Files"
                        >
                          Files
                        </button>
                        <button
                          onClick={() => setSelectedProjectForExpenses(project)}
                          className="text-purple-600 hover:text-purple-800 mr-4"
                        >
                          Expenses
                        </button>
                        <button
                          onClick={() => handleEdit(project)}
                          className="text-pool-blue hover:text-pool-dark mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          disabled={deleteProject.isPending}
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
      {filteredProjects.length > itemsPerPage && (
        <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length} projects
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
          <p className="text-sm text-gray-500">Total Projects</p>
          <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Active (Sold/In Progress)</p>
          <p className="text-2xl font-bold text-gray-900">
            {projects.filter((p) => ['sold', 'complete'].includes(p.status)).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Proposals</p>
          <p className="text-2xl font-bold text-gray-900">
            {projects.filter((p) => ['proposal_request', 'proposal_sent'].includes(p.status)).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-2xl font-bold text-gray-900">
            ${projects
              .reduce((sum, p) => sum + (parseFloat(p.est_value) || 0), 0)
              .toLocaleString()}
          </p>
        </div>
      </div>

      {/* Project Expenses Modal */}
      {selectedProjectForExpenses && (
        <ProjectExpenses
          project={selectedProjectForExpenses}
          onClose={() => setSelectedProjectForExpenses(null)}
        />
      )}

      {/* Documents Modal */}
      {showDocumentsModal && selectedEntityForDocuments && (
        <DocumentsModal
          entityType="projects"
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

export default Projects
