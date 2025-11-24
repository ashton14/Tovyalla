import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

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
  const [projects, setProjects] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [selectedProjectForDocs, setSelectedProjectForDocs] = useState(null)

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
    documents: [],
  })

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Fetch customers for dropdown
  const fetchCustomers = async () => {
    try {
      const token = await getAuthToken()
      if (!token) return

      const response = await axios.get('/api/customers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setCustomers(response.data.customers || [])
    } catch (err) {
      console.error('Error fetching customers:', err)
    }
  }

  // Fetch projects
  const fetchProjects = async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get('/api/projects', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setProjects(response.data.projects || [])
    } catch (err) {
      console.error('Error fetching projects:', err)
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchCustomers()
      fetchProjects()
    }
  }, [user])

  // Handle file upload
  const handleFileUpload = async (files, projectId) => {
    if (!supabase || !files || files.length === 0) return []

    setUploadingFiles(true)
    const uploadedFiles = []

    try {
      const companyID = user?.user_metadata?.companyID
      if (!companyID) throw new Error('Company ID not found')

      // Try to determine if bucket is public by attempting to get a public URL first
      // If that fails, we'll use signed URLs
      let isBucketPublic = false
      // We'll determine this after the first upload attempt

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        // Ensure companyID is used as the first folder in the path
        const filePath = `${companyID}/projects/${projectId || 'temp'}/${fileName}`
        
        // Debug: Log the path being used
        console.log('Uploading file to path:', filePath, 'Company ID:', companyID)

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('project-documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          
          // Provide helpful error message for common issues
          if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
            throw new Error(
              `Storage bucket "project-documents" not found or not accessible.\n\n` +
              `Please verify:\n` +
              `1. The bucket name is exactly "project-documents"\n` +
              `2. The bucket exists in your Supabase Storage dashboard\n` +
              `3. Your user has permission to upload to this bucket\n` +
              `4. Check Storage policies in Supabase if the bucket is private`
            )
          }
          
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
        }

        // Get URL - try signed URL first (works for both public and private buckets)
        // If signed URL fails, fallback to public URL
        let fileUrl
        try {
          // Try to create a signed URL (works for private buckets, and some public ones)
          const { data: signedUrlData, error: signedError } = await supabase.storage
            .from('project-documents')
            .createSignedUrl(filePath, 3600)
          
          if (!signedError && signedUrlData) {
            fileUrl = signedUrlData.signedUrl
          } else {
            // Fallback to public URL
            const { data: urlData } = supabase.storage
              .from('project-documents')
              .getPublicUrl(filePath)
            fileUrl = urlData.publicUrl
          }
        } catch (urlError) {
          // If both fail, use public URL as last resort
          const { data: urlData } = supabase.storage
            .from('project-documents')
            .getPublicUrl(filePath)
          fileUrl = urlData.publicUrl
        }

        uploadedFiles.push({
          name: file.name,
          path: filePath,
          url: fileUrl,
          size: file.size,
          type: file.type,
          uploaded_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('File upload error:', err)
      throw err
    } finally {
      setUploadingFiles(false)
    }

    return uploadedFiles
  }

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

      let projectId = editingProject?.id

      // If creating new project, create it first to get the ID for file uploads
      if (!editingProject) {
        const payload = {
          ...formData,
          sq_feet: formData.sq_feet ? parseFloat(formData.sq_feet) : null,
          est_value: formData.est_value ? parseFloat(formData.est_value) : null,
          customer_id: formData.customer_id || null,
          documents: [], // Will update after file upload
        }

        const response = await axios.post('/api/projects', payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        projectId = response.data.project.id
      }

      // Handle file uploads if there are new files
      const fileInput = document.getElementById('project-documents-input')
      let newDocuments = [...formData.documents]

      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const uploadedFiles = await handleFileUpload(fileInput.files, projectId)
        newDocuments = [...formData.documents, ...uploadedFiles]
      }

      // Update project with documents
      const payload = {
        ...formData,
        sq_feet: formData.sq_feet ? parseFloat(formData.sq_feet) : null,
        est_value: formData.est_value ? parseFloat(formData.est_value) : null,
        customer_id: formData.customer_id || null,
        documents: newDocuments,
      }

      if (editingProject) {
        await axios.put(`/api/projects/${editingProject.id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setSuccess('Project updated successfully!')
      } else {
        setSuccess('Project added successfully!')
      }

      // Clear file input
      if (fileInput) {
        fileInput.value = ''
      }

      setShowForm(false)
      setEditingProject(null)
      resetForm()
      fetchProjects()
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save project'
      
      // If it's a bucket error, provide detailed instructions
      if (errorMessage.includes('bucket') || errorMessage.includes('Bucket not found') || errorMessage.includes('Storage')) {
        setError(
          `Storage bucket error: ${errorMessage}\n\n` +
          'To fix this, create a storage bucket in Supabase:\n' +
          '1. Go to your Supabase dashboard\n' +
          '2. Navigate to Storage\n' +
          '3. Click "New bucket"\n' +
          '4. Name it: project-documents (exact name required)\n' +
          '5. Set Public: false (or true for public access)\n' +
          '6. Click "Create bucket"\n\n' +
          'See STORAGE_SETUP.md for detailed instructions.'
        )
      } else {
        setError(errorMessage)
      }
    }
  }

  // Handle document delete
  const handleDeleteDocument = async (projectId, documentIndex) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const project = projects.find((p) => p.id === projectId)
      if (!project) return

      const document = project.documents[documentIndex]
      if (!document) return

      // Delete from storage
      if (supabase && document.path) {
        const { error: deleteError } = await supabase.storage
          .from('project-documents')
          .remove([document.path])

        if (deleteError) {
          console.error('Error deleting file:', deleteError)
        }
      }

      // Remove from documents array
      const updatedDocuments = project.documents.filter((_, idx) => idx !== documentIndex)

      // Update project
      await axios.put(
        `/api/projects/${projectId}`,
        { ...project, documents: updatedDocuments },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      setSuccess('Document deleted successfully!')
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete document')
    }
  }

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.delete(`/api/projects/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSuccess('Project deleted successfully!')
      fetchProjects()
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
      documents: project.documents || [],
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
      documents: [],
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

      {/* Project Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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

                {/* Documents Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documents
                  </label>
                  
                  {/* Existing Documents */}
                  {formData.documents && formData.documents.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {formData.documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">{doc.name}</span>
                            <span className="text-xs text-gray-500">
                              ({(doc.size / 1024).toFixed(2)} KB)
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-pool-blue hover:text-pool-dark text-sm"
                            >
                              View
                            </a>
                            {editingProject && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedDocs = formData.documents.filter((_, i) => i !== idx)
                                  setFormData({ ...formData, documents: updatedDocs })
                                }}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* File Upload Input */}
                  <input
                    id="project-documents-input"
                    type="file"
                    multiple
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    onChange={(e) => {
                      // Files will be uploaded on form submit
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Upload project documents (proposals, contracts, photos, etc.)
                  </p>
                  {uploadingFiles && (
                    <p className="mt-1 text-xs text-blue-600">Uploading files...</p>
                  )}
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
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md"
                  >
                    {editingProject ? 'Update Project' : 'Add Project'}
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
                  Documents
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
                  <td colSpan="11" className="px-6 py-12 text-center text-gray-500">
                    {projects.length === 0
                      ? 'No projects yet. Click "Add Project" to get started.'
                      : 'No projects match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => {
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
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {project.documents && project.documents.length > 0 ? (
                            <>
                              <span className="text-sm text-gray-900">
                                {project.documents.length} file{project.documents.length !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => setSelectedProjectForDocs(project)}
                                className="text-xs text-pool-blue hover:text-pool-dark"
                              >
                                View Documents
                              </button>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">No documents</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(project.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(project)}
                          className="text-pool-blue hover:text-pool-dark mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
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

      {/* Documents Modal */}
      {selectedProjectForDocs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  Documents - {getCustomerName(selectedProjectForDocs)}
                </h3>
                <button
                  onClick={() => setSelectedProjectForDocs(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {selectedProjectForDocs.documents && selectedProjectForDocs.documents.length > 0 ? (
                <div className="space-y-3">
                  {selectedProjectForDocs.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{doc.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(doc.size / 1024).toFixed(2)} KB)
                          </span>
                        </div>
                        {doc.uploaded_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Uploaded: {new Date(doc.uploaded_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-pool-blue hover:bg-pool-dark text-white text-sm rounded-md transition-colors"
                        >
                          View
                        </a>
                        <a
                          href={doc.url}
                          download={doc.name}
                          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-md transition-colors"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => {
                            handleDeleteDocument(selectedProjectForDocs.id, idx)
                            setSelectedProjectForDocs(null)
                          }}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-md transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No documents uploaded yet.</p>
              )}
            </div>
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
    </div>
  )
}

export default Projects

