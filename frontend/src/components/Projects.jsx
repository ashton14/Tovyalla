import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import ProjectExpenses from './ProjectExpenses'
import DocumentsModal from './DocumentsModal'
import AddressAutocomplete from './AddressAutocomplete'
import ActionsMenu, { DOCUMENT_ICON, EDIT_ICON, DELETE_ICON, EXPENSE_ICON, TIMELINE_ICON } from './ActionsMenu'
import ProjectTimelineModal from './ProjectTimelineModal'
import {
  useProjects,
  useCustomers,
  useEmployees,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from '../hooks/useApi'

const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'HOA', label: 'HOA' },
]

const PROJECT_TYPE_OPTIONS = [
  { value: 'pool', label: 'Pool' },
  { value: 'spa', label: 'Spa' },
  { value: 'building', label: 'Building' },
  { value: 'roof', label: 'Roof' },
  { value: 'yard', label: 'Yard' },
  { value: 'patio', label: 'Patio' },
  { value: 'deck', label: 'Deck' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'fencing', label: 'Fencing' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'other', label: 'Other' },
]

const PROJECT_STATUSES = [
  { value: 'contacted', label: 'Contacted', color: 'bg-gray-100 text-gray-800' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-gray-100 text-blue-800' },
  { value: 'proposal_signed', label: 'Proposal Signed', color: 'bg-blue-50 text-blue-800' },
  { value: 'contract_sent', label: 'Contract Sent', color: 'bg-blue-100 text-blue-800' },
  { value: 'sold', label: 'Sold', color: 'bg-green-100 text-green-800' },
  { value: 'complete', label: 'Complete', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
]

function Projects() {
  const { user, supabase, getAuthHeaders } = useAuth()
  
  // Use cached queries
  const { data: projects = [], isLoading: loading, refetch } = useProjects()
  const { data: customers = [] } = useCustomers()
  const { data: employees = [] } = useEmployees()
  
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
  const [filterPM, setFilterPM] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [selectedProjectForExpenses, setSelectedProjectForExpenses] = useState(null)
  const [selectedProjectForTimeline, setSelectedProjectForTimeline] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ success: 0, failed: 0, total: 0 })
  const [importErrors, setImportErrors] = useState([])
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedEntityForDocuments, setSelectedEntityForDocuments] = useState(null)
  const [openActionsProjectId, setOpenActionsProjectId] = useState(null)
  const actionsMenuRef = useRef(null)
  const [projectTypeDropdownOpen, setProjectTypeDropdownOpen] = useState(false)
  const projectTypeDropdownRef = useRef(null)

  // Form state
  const emptyProjectForm = {
    project_name: '', customer_id: '', address: '', property_type: 'residential', project_types: [],
    sq_feet: '', status: 'contacted', accessories_features: '', est_value: '', closing_price: '',
    project_manager: '', notes: '',
  }
  const [initialFormData, setInitialFormData] = useState(null)
  const [formData, setFormData] = useState({
    project_name: '',
    customer_id: '',
    address: '',
    property_type: 'residential',
    project_types: [],
    sq_feet: '',
    status: 'contacted',
    accessories_features: '',
    est_value: '',
    closing_price: '',
    project_manager: '',
    notes: '',
  })

  // Get auth token for CSV import
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const hasChanges = initialFormData != null && JSON.stringify(formData) !== JSON.stringify(initialFormData)

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const projectTypes = Array.isArray(formData.project_types)
      ? formData.project_types.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)
      : []

    const payload = {
      project_name: formData.project_name || null,
      customer_id: formData.customer_id || null,
      address: formData.address || null,
      property_type: formData.property_type || 'residential',
      project_types: projectTypes,
      sq_feet: formData.sq_feet ? parseFloat(formData.sq_feet) : null,
      est_value: formData.est_value ? parseFloat(formData.est_value) : null,
      closing_price: formData.closing_price ? parseFloat(formData.closing_price) : null,
      status: formData.status || 'contacted',
      accessories_features: formData.accessories_features || null,
      project_manager: formData.project_manager || null,
      notes: formData.notes || null,
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
    const data = {
      project_name: project.project_name || '',
      customer_id: project.customer_id || '',
      address: project.address || '',
      property_type: project.property_type || 'residential',
      project_types: Array.isArray(project.project_types) ? [...project.project_types] : [],
      sq_feet: project.sq_feet || '',
      status: project.status || 'contacted',
      accessories_features: project.accessories_features || '',
      est_value: project.est_value || '',
      closing_price: project.closing_price || '',
      project_manager: project.project_manager || '',
      notes: project.notes || '',
    }
    setFormData(data)
    setInitialFormData(data)
    setShowForm(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData(emptyProjectForm)
    setInitialFormData(emptyProjectForm)
    setProjectTypeDropdownOpen(false)
  }

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      searchTerm === '' ||
      project.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.project_manager?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.customers && `${project.customers.first_name} ${project.customers.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus
    const matchesType = filterType === 'all' || project.property_type === filterType
    const matchesPM = filterPM === 'all' || project.project_manager === filterPM
    
    return matchesSearch && matchesStatus && matchesType && matchesPM
  })

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus, filterType, filterPM])

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!openActionsProjectId) return
      if (actionsMenuRef.current?.contains(e.target)) return
      if (e.target.closest('[data-actions-menu-dropdown]')) return
      setOpenActionsProjectId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openActionsProjectId])

  // Close project type dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (projectTypeDropdownOpen && projectTypeDropdownRef.current && !projectTypeDropdownRef.current.contains(e.target)) {
        setProjectTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [projectTypeDropdownOpen])

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
    const requiredColumns = ['property_type']
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
      if (!row.property_type) {
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

        const projectTypesRaw = (row.project_types || row['project_types'] || row['project types'] || '').trim()
        const projectTypesParsed = projectTypesRaw
          ? projectTypesRaw.split(/[,|;]/).map(s => s.trim().toLowerCase()).filter(Boolean)
          : []

        const projectData = {
          project_name: row.project_name || row['project_name'] || row['project name'] || row.name || '',
          customer_id: customerId || null,
          address: row.address || '',
          property_type: (row.property_type || row['property_type'] || row['property type'] || '').trim(),
          project_types: projectTypesParsed,
          sq_feet: row.sq_feet || row['sq_feet'] || row['square feet'] || '',
          status: row.status || 'contacted',
          accessories_features: row.accessories_features || row['accessories_features'] || row['accessories & features'] || '',
          est_value: row.est_value || row['est_value'] || row['estimated value'] || '',
          closing_price: row.closing_price || row['closing_price'] || row['closing price'] || '',
          project_manager: row.project_manager || row['project_manager'] || row['project manager'] || row.pm || '',
          notes: row.notes || '',
        }

        // Validate required fields
        if (!projectData.property_type) {
          failedCount++
          errors.push({
            row: i + 2,
            error: 'Missing required field: property_type is required',
            data: projectData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Validate property_type
        const validPropertyTypes = ['residential', 'commercial', 'hoa']
        if (!validPropertyTypes.includes(projectData.property_type.toLowerCase())) {
          failedCount++
          errors.push({
            row: i + 2,
            error: `Invalid property_type: ${projectData.property_type}. Must be one of: residential, commercial, HOA`,
            data: projectData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Validate project_types (each must be valid)
        const validProjectTypeValues = PROJECT_TYPE_OPTIONS.map(o => o.value)
        const invalidTypes = projectTypesParsed.filter(t => !validProjectTypeValues.includes(t))
        if (invalidTypes.length > 0) {
          failedCount++
          errors.push({
            row: i + 2,
            error: `Invalid project_types: ${invalidTypes.join(', ')}. Valid values: ${validProjectTypeValues.join(', ')}`,
            data: projectData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Normalize property_type for HOA (DB may use uppercase)
        projectData.property_type = projectData.property_type.toLowerCase() === 'hoa' ? 'HOA' : projectData.property_type.toLowerCase()

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

        if (projectData.closing_price) {
          const parsed = parseFloat(projectData.closing_price)
          projectData.closing_price = isNaN(parsed) ? null : parsed
        } else {
          projectData.closing_price = null
        }

        try {
          await axios.post('/api/projects', projectData, {
            headers: {
              ...getAuthHeaders(token),
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Projects</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your construction projects</p>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by address, customer, or PM..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Property Types</option>
              {PROPERTY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Manager</label>
            <select
              value={filterPM}
              onChange={(e) => setFilterPM(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All PMs</option>
              {[...new Set([
                ...projects.map(p => p.project_manager).filter(Boolean),
                ...employees
                  .filter((emp) => emp.is_project_manager === true || emp.user_role?.toLowerCase().includes('project_manager') || emp.user_role?.toLowerCase().includes('project manager'))
                  .map((emp) => emp.name)
                  .filter(Boolean),
              ])].sort().map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowImportModal(false); setImportErrors([]); setImportProgress({ success: 0, failed: 0, total: 0 }); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Import Projects from CSV</h3>
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
                      <li><code className="bg-blue-100 px-1 rounded">property_type</code> - Must be: <code className="bg-blue-100 px-1 rounded">residential</code>, <code className="bg-blue-100 px-1 rounded">commercial</code>, or <code className="bg-blue-100 px-1 rounded">HOA</code></li>
                    </ul>
                    <p className="mt-2"><strong>Optional:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li><code className="bg-blue-100 px-1 rounded">project_types</code> - Comma-separated: building, roof, yard, patio, deck, renovation, landscaping, fencing, foundation, electrical, plumbing, hvac, other</li>
                      <li><code className="bg-blue-100 px-1 rounded">project_name</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">customer_name</code> or <code className="bg-blue-100 px-1 rounded">customer_id</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">address</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">sq_feet</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">status</code> (defaults to "contacted")</li>
                      <li><code className="bg-blue-100 px-1 rounded">accessories_features</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">est_value</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">closing_price</code> (used for profit calculation)</li>
                      <li><code className="bg-blue-100 px-1 rounded">project_manager</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">notes</code></li>
                    </ul>
                  </div>
                </div>

                {/* Example CSV */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Example CSV Format:</h4>
                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`project_name,property_type,project_types,address,customer_name,status,est_value,closing_price
Smith Renovation,residential,building;renovation,123 Main St,John Doe,sold,50000,48000
Downtown Office Build,commercial,building;electrical;hvac,456 Business Ave,Jane Smith,contacted,75000,`}
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

      {/* Project Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingProject(null); resetForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-pool-blue to-pool-dark px-6 py-4 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {editingProject ? 'Edit Project' : 'New Project'}
                  </h3>
                  <p className="text-pool-light text-sm mt-0.5">
                    {editingProject ? 'Update project details' : 'Fill in the project information'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingProject(null)
                    resetForm()
                  }}
                  className="text-white/70 hover:text-white transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Project Identity Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Project Details
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name</label>
                    <input
                      type="text"
                      value={formData.project_name}
                      onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                      placeholder="e.g., Smith Pool Build"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                      <select
                        value={formData.customer_id}
                        onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Manager</label>
                      <select
                        value={formData.project_manager}
                        onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      >
                        <option value="">Select a project manager...</option>
                        {employees
                          .filter((employee) => 
                            employee.is_project_manager === true || 
                            employee.user_role?.toLowerCase().includes('project_manager') ||
                            employee.user_role?.toLowerCase().includes('project manager')
                          )
                          .map((employee) => (
                            <option key={employee.id} value={employee.name}>
                              {employee.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location & Specifications Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Location & Specifications
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                    <AddressAutocomplete
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      onSelect={(parsed) => {
                        setFormData(prev => ({
                          ...prev,
                          address: parsed.full_address,
                        }))
                      }}
                      placeholder="Start typing an address..."
                      mode="full"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Property Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.property_type}
                        onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      >
                        {PROPERTY_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Square Feet</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.sq_feet}
                        onChange={(e) => setFormData({ ...formData, sq_feet: e.target.value })}
                        placeholder="0"
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      />
                    </div>
                    <div ref={projectTypeDropdownRef} className="relative">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Project Type
                      </label>
                      <button
                        type="button"
                        onClick={() => setProjectTypeDropdownOpen((prev) => !prev)}
                        className="w-full px-4 py-2.5 text-left border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow flex items-center justify-between"
                      >
                        <span className={formData.project_types?.length ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                          {formData.project_types?.length
                            ? formData.project_types.map((v) => PROJECT_TYPE_OPTIONS.find((o) => o.value === v)?.label || v).join(', ')
                            : 'Select project type...'}
                        </span>
                        <svg className={`w-4 h-4 text-gray-500 transition-transform ${projectTypeDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {projectTypeDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg max-h-48 overflow-y-auto py-1">
                          {PROJECT_TYPE_OPTIONS.map((option) => {
                            const checked = formData.project_types?.includes(option.value) ?? false
                            return (
                              <label
                                key={option.value}
                                className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...(formData.project_types || []), option.value]
                                      : (formData.project_types || []).filter((v) => v !== option.value)
                                    setFormData({ ...formData, project_types: next })
                                  }}
                                  className="rounded border-gray-300 text-pool-blue focus:ring-pool-blue"
                                />
                                <span>{option.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Financials Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Status & Financials
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      >
                        {PROJECT_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Value</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.est_value}
                          onChange={(e) => setFormData({ ...formData, est_value: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-7 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Closing Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.closing_price}
                          onChange={(e) => setFormData({ ...formData, closing_price: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-7 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used for profit calculation</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description & Notes Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Description & Notes
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description of Work</label>
                    <textarea
                      value={formData.accessories_features}
                      onChange={(e) => setFormData({ ...formData, accessories_features: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow resize-none"
                      placeholder="Describe the project scope, features, and requirements..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Internal Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow resize-none"
                      placeholder="Additional notes for internal use..."
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingProject(null)
                    resetForm()
                  }}
                  className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProject.isPending || updateProject.isPending || !hasChanges}
                  className="px-6 py-2.5 bg-gradient-to-r from-pool-blue to-pool-dark hover:from-pool-dark hover:to-pool-blue text-white font-semibold rounded-lg disabled:opacity-50 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  {(createProject.isPending || updateProject.isPending) ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {editingProject ? 'Update Project' : 'Create Project'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Property
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Project Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  SqFt
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  PM
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Updated
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-2 py-8 text-center text-gray-500 dark:text-gray-400">
                    {projects.length === 0
                      ? 'No projects yet. Click "Add Project" to get started.'
                      : 'No projects match your search criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedProjects.map((project) => {
                  const statusBadge = getStatusBadge(project.status)
                  return (
                    <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div 
                          className="text-sm font-medium text-gray-900 dark:text-white"
                          title={project.project_name || ''}
                        >
                          {project.project_name ? (project.project_name.length > 24 ? project.project_name.substring(0, 21) + '...' : project.project_name) : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {getCustomerName(project)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className="text-sm text-gray-900 dark:text-white"
                          title={project.address || ''}
                        >
                          {project.address ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-pool-blue hover:text-pool-dark hover:underline"
                            >
                              {project.address.length > 24 ? project.address.substring(0, 21) + '...' : project.address}
                            </a>
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {project.property_type === 'residential' ? 'Res' : project.property_type === 'commercial' ? 'Com' : (PROPERTY_TYPES.find((t) => t.value === project.property_type)?.label || project.property_type || '-')}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white" title={Array.isArray(project.project_types) && project.project_types.length ? project.project_types.map(v => PROJECT_TYPE_OPTIONS.find(o => o.value === v)?.label || v).join(', ') : ''}>
                          {Array.isArray(project.project_types) && project.project_types.length
                            ? project.project_types.slice(0, 2).map(v => PROJECT_TYPE_OPTIONS.find(o => o.value === v)?.label || v).join(', ') + (project.project_types.length > 2 ? '…' : '')
                            : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {project.sq_feet ? project.sq_feet.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusBadge.color}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {project.est_value
                          ? `$${parseFloat(project.est_value).toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {project.project_manager || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(project.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div ref={openActionsProjectId === project.id ? actionsMenuRef : null}>
                          <ActionsMenu
                            isOpen={openActionsProjectId === project.id}
                            onToggle={() => setOpenActionsProjectId((prev) => (prev === project.id ? null : project.id))}
                            onAction={() => setOpenActionsProjectId(null)}
                            actions={[
                              { icon: DOCUMENT_ICON, label: 'Documents', iconColor: 'text-green-600 dark:text-green-400', onClick: () => { setSelectedEntityForDocuments({ id: project.id, name: project.project_name || `Project ${project.id.substring(0, 8)}`, customerEmail: project.customers?.email || '' }); setShowDocumentsModal(true) } },
                              { icon: EXPENSE_ICON, label: 'Expenses', iconColor: 'text-purple-600 dark:text-purple-400', onClick: () => setSelectedProjectForExpenses(project) },
                              { icon: TIMELINE_ICON, label: 'Timeline', iconColor: 'text-amber-600 dark:text-amber-400', onClick: () => setSelectedProjectForTimeline(project) },
                              { icon: EDIT_ICON, label: 'Edit', onClick: () => handleEdit(project) },
                              { icon: DELETE_ICON, label: 'Delete', danger: true, disabled: deleteProject.isPending, onClick: () => handleDelete(project.id) },
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
      {filteredProjects.length > itemsPerPage && (
        <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Projects</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{projects.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active (Sold/In Progress)</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {projects.filter((p) => ['sold', 'complete'].includes(p.status)).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Proposals</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {projects.filter((p) => ['contract_sent', 'proposal_sent', 'proposal_signed'].includes(p.status)).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
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
          customerEmail={selectedEntityForDocuments.customerEmail}
          onClose={() => {
            setShowDocumentsModal(false)
            setSelectedEntityForDocuments(null)
          }}
        />
      )}

      {/* Timeline Modal */}
      {selectedProjectForTimeline && (
        <ProjectTimelineModal
          project={selectedProjectForTimeline}
          onClose={() => setSelectedProjectForTimeline(null)}
          onProjectUpdated={(updated) => setSelectedProjectForTimeline(updated)}
        />
      )}
    </div>
  )
}

export default Projects
