import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { openContractPdf } from '../utils/contractPdfGenerator'
import ContractPreview from './ContractPreview'
import SendEmailModal from './SendEmailModal'

function DocumentsModal({ entityType, entityId, entityName, customerEmail, onClose, canUploadDocuments, canDeleteDocuments }) {
  const { user, supabase, currentCompanyID, getAuthHeaders } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewFileName, setPreviewFileName] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [generatingContract, setGeneratingContract] = useState(false)
  const [documentName, setDocumentName] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [editingDocument, setEditingDocument] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', document_type: '', status: '' })
  const [saving, setSaving] = useState(false)
  const [showContractPreview, setShowContractPreview] = useState(false)
  const [contractData, setContractData] = useState(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailDocument, setEmailDocument] = useState(null)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [selectedDocumentForNotes, setSelectedDocumentForNotes] = useState(null)
  const [documentNotes, setDocumentNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [syncingDocId, setSyncingDocId] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Fetch documents
  const fetchDocuments = async () => {
    if (!entityId || !supabase) return

    setLoading(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get(`/api/documents/${entityType}/${entityId}`, {
        headers: getAuthHeaders(token),
      })
      setDocuments(response.data.documents || [])
    } catch (err) {
      console.error('❌ Error fetching documents:', err)
      console.error('  - Response:', err.response?.data)
      console.error('  - Status:', err.response?.status)
      setError(err.response?.data?.error || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (entityId) {
      fetchDocuments()
    }
  }, [entityId, entityType])

  // Subscribe to real-time updates for documents
  useEffect(() => {
    if (!supabase || !entityId || entityType !== 'project') return

    // Subscribe to changes on project_documents table for this project
    const channel = supabase
      .channel(`documents-${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'project_documents',
          filter: `project_id=eq.${entityId}`,
        },
        (payload) => {
          console.log('📄 Document change detected:', payload.eventType)
          // Refresh the documents list when any change occurs
          fetchDocuments()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, entityId, entityType])

  // Close create menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCreateMenu && !event.target.closest('.create-document-menu')) {
        setShowCreateMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCreateMenu])

  // Generate contract PDF - now shows preview first
  const handleGenerateContract = async () => {
    setGeneratingContract(true)
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Fetch contract data from backend
      const response = await axios.post(
        `/api/projects/${entityId}/contract`,
        { document_type: 'contract' },
        {
          headers: getAuthHeaders(token),
        }
      )

      const data = response.data

      // Show the preview instead of generating PDF directly
      setContractData(data)
      setShowContractPreview(true)
      setShowCreateMenu(false)
    } catch (err) {
      console.error('Error fetching contract data:', err)
      setError(err.response?.data?.error || err.message || 'Failed to load contract data')
    } finally {
      setGeneratingContract(false)
    }
  }

  const handleGenerateProposal = async () => {
    setGeneratingContract(true)
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Fetch proposal data from backend
      const response = await axios.post(
        `/api/projects/${entityId}/contract`,
        { document_type: 'proposal' },
        {
          headers: getAuthHeaders(token),
        }
      )

      const data = response.data

      // Show the preview instead of generating PDF directly
      setContractData(data)
      setShowContractPreview(true)
      setShowCreateMenu(false)
    } catch (err) {
      console.error('Error fetching proposal data:', err)
      setError(err.response?.data?.error || err.message || 'Failed to load proposal data')
    } finally {
      setGeneratingContract(false)
    }
  }

  const handleGenerateChangeOrder = async () => {
    setGeneratingContract(true)
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Fetch contract data from backend (change orders use same data structure as contracts)
      const response = await axios.post(
        `/api/projects/${entityId}/contract`,
        { document_type: 'change_order' },
        {
          headers: getAuthHeaders(token),
        }
      )

      const data = response.data

      // Show the preview instead of generating PDF directly
      setContractData(data)
      setShowContractPreview(true)
      setShowCreateMenu(false)
    } catch (err) {
      console.error('Error fetching change order data:', err)
      setError(err.response?.data?.error || err.message || 'Failed to load change order data')
    } finally {
      setGeneratingContract(false)
    }
  }

  // Handle when PDF is generated from preview
  const handleContractGenerated = (modifiedData) => {
    setSuccess(`Document #${modifiedData.documentNumber} generated successfully!`)
    setTimeout(() => setSuccess(''), 5000)
    setShowContractPreview(false)
    setContractData(null)
  }

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
      // Auto-fill document name from file name if empty
      if (!documentName) {
        setDocumentName(file.name.replace(/\.[^/.]+$/, '')) // Remove extension
      }
    }
  }

  // Handle file upload via backend (bypasses RLS)
  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file')
      return
    }
    if (!documentType) {
      setError('Please select a document type')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      if (!currentCompanyID) {
        throw new Error('No company selected. Please log in with a company.')
      }

      // Use FormData for multipart/form-data upload
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name', documentName.trim())
      formData.append('document_type', documentType)
      
      const response = await fetch(
        `/api/documents/${entityType}/${entityId}/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Company-ID': currentCompanyID,
          },
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setSuccess('Document uploaded successfully!')
      setTimeout(() => setSuccess(''), 3000)
      
      // Refresh documents list
      fetchDocuments()
      
      // Reset form and close modal
      setSelectedFile(null)
      setDocumentName('')
      setDocumentType('')
      setShowUploadModal(false)
    } catch (err) {
      console.error('❌ Error uploading document:', err)
      setError(err.message || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const handleCloseUploadModal = () => {
    setShowUploadModal(false)
    setSelectedFile(null)
    setDocumentName('')
    setDocumentType('')
    setError('')
  }

  // Handle file view/preview
  const handleView = async (fileName) => {
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get(
        `/api/documents/${entityType}/${entityId}/${fileName}/download`,
        {
          headers: getAuthHeaders(token),
        }
      )

      setPreviewUrl(response.data.url)
      setPreviewFileName(fileName)
      setShowPreview(true)
    } catch (err) {
      console.error('Error viewing document:', err)
      setError(err.response?.data?.error || 'Failed to load document preview')
    }
  }

  // Handle file download/view - mobile-friendly approach
  const handleDownload = async (doc) => {
    // On mobile, window.open in async callbacks gets blocked as popup
    // Solution: Open window FIRST (sync), then navigate it (async)
    const newWindow = window.open('about:blank', '_blank')
    
    try {
      const token = await getAuthToken()
      if (!token) {
        if (newWindow) newWindow.close()
        throw new Error('Not authenticated')
      }

      // Use by-id endpoint if document has file_path stored (for signed documents)
      // Otherwise use the standard path-based endpoint
      let downloadUrl
      if (doc.id && doc.file_path) {
        downloadUrl = `/api/documents/by-id/${doc.id}/download`
      } else {
        const fileName = doc.file_name || doc.name || doc
        downloadUrl = `/api/documents/${entityType}/${entityId}/${fileName}/download`
      }

      const response = await axios.get(
        downloadUrl,
        {
          headers: getAuthHeaders(token),
        }
      )

      // Navigate the already-opened window to the document URL
      if (newWindow) {
        newWindow.location.href = response.data.url
      } else {
        // Fallback if window was blocked - try direct navigation
        window.location.href = response.data.url
      }
    } catch (err) {
      if (newWindow) newWindow.close()
      console.error('Error downloading document:', err)
      setError(err.response?.data?.error || 'Failed to download document')
    }
  }

  // Handle notes click
  const handleNotesClick = (doc) => {
    setSelectedDocumentForNotes(doc)
    setDocumentNotes(doc.notes || '')
    setError('')
    setSuccess('')
    setShowNotesModal(true)
  }

  // Handle save notes
  const handleSaveNotes = async () => {
    if (!selectedDocumentForNotes || !selectedDocumentForNotes.id) {
      setError('Document ID is required to save notes')
      return
    }

    // Only allow notes for projects, subcontractors, customers, and inventory (they have document tables)
    if (entityType !== 'projects' && entityType !== 'subcontractors' && entityType !== 'customers' && entityType !== 'inventory') {
      setError('Notes can only be added for project, subcontractor, customer, and inventory documents')
      return
    }

    setSavingNotes(true)
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.put(
        `/api/documents/${entityType}/${entityId}/${selectedDocumentForNotes.id}/notes`,
        { notes: documentNotes },
        {
          headers: getAuthHeaders(token),
        }
      )

      setSuccess('Notes saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
      setShowNotesModal(false)
      
      // Refresh documents list
      fetchDocuments()
    } catch (err) {
      console.error('Error saving notes:', err)
      setError(err.response?.data?.error || 'Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  // Handle file delete
  const handleDelete = async (fileName, documentId = null) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Build URL with optional document ID for project_documents table deletion
      let url = `/api/documents/${entityType}/${entityId}/${fileName}`
      if (documentId) {
        url += `?documentId=${documentId}`
      }

      await axios.delete(url, {
        headers: getAuthHeaders(token),
      })

      setSuccess('Document deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
      
      // Refresh documents list
      fetchDocuments()
    } catch (err) {
      console.error('Error deleting document:', err)
      setError(err.response?.data?.error || 'Failed to delete document')
    }
  }

  // Handle send for signature
  const handleSendClick = async (doc) => {
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const fileName = doc.file_name || doc.name

      // Get the document URL
      const response = await axios.get(
        `/api/documents/${entityType}/${entityId}/${fileName}/download`,
        {
          headers: getAuthHeaders(token),
        }
      )

      // Set the document with URL for the email modal
      setEmailDocument({
        ...doc,
        url: response.data.url,
      })
      setShowEmailModal(true)
    } catch (err) {
      console.error('Error getting document URL:', err)
      setError(err.response?.data?.error || 'Failed to prepare document for sending')
    }
  }

  // Handle sync all documents (check BoldSign and download signed docs if completed)
  const handleSyncAll = async () => {
    // Find all documents that have been sent for signature but not yet marked as signed
    const docsToSync = documents.filter(doc => doc.esign_contract_id && doc.status !== 'signed')
    
    if (docsToSync.length === 0) {
      setSuccess('No documents to sync')
      return
    }

    setSyncingDocId('all')
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      let synced = 0
      let downloaded = 0

      for (const doc of docsToSync) {
        try {
          const response = await axios.post(
            `/api/esign/sync/${doc.id}`,
            {},
            {
              headers: getAuthHeaders(token),
            }
          )

          if (response.data.success) {
            synced++
            if (response.data.signedDocumentUploaded) {
              downloaded++
            }
          }
        } catch (err) {
          console.error(`Error syncing document ${doc.id}:`, err)
        }
      }

      if (downloaded > 0) {
        setSuccess(`Synced ${synced} document(s), downloaded ${downloaded} signed document(s)`)
      } else {
        setSuccess(`Synced ${synced} document(s)`)
      }
      
      // Refresh documents list
      fetchDocuments()
    } catch (err) {
      console.error('Error syncing documents:', err)
      setError(err.response?.data?.error || 'Failed to sync documents')
    } finally {
      setSyncingDocId(null)
    }
  }

  // Handle edit document
  const handleEditClick = (doc) => {
    setEditingDocument(doc)
    setEditForm({
      name: doc.name || '',
      document_type: doc.document_type || 'other',
      status: doc.status || 'draft',
    })
  }

  const hasEditChanges = editingDocument && (
    (editForm.name || '').trim() !== (editingDocument.name || editingDocument.file_name || '').trim() ||
    editForm.document_type !== (editingDocument.document_type || 'other') ||
    editForm.status !== (editingDocument.status || 'draft')
  )
  const hasNotesChanges = selectedDocumentForNotes && documentNotes !== (selectedDocumentForNotes.notes || '')

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingDocument) return

    setSaving(true)
    setError('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.put(
        `/api/documents/projects/${entityId}/${editingDocument.id}`,
        {
          name: editForm.name.trim() || editingDocument.file_name,
          document_type: editForm.document_type,
          status: editForm.status,
        },
        {
          headers: getAuthHeaders(token),
        }
      )

      setSuccess('Document updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
      setEditingDocument(null)
      fetchDocuments()
    } catch (err) {
      console.error('Error updating document:', err)
      setError(err.response?.data?.error || 'Failed to update document')
    } finally {
      setSaving(false)
    }
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  // Check if file type is previewable
  const isPreviewable = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    const previewableTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
    return previewableTypes.includes(extension)
  }

  // Get file type for preview
  const getFileType = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    if (extension === 'pdf') return 'pdf'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return 'image'
    return 'other'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Documents - {entityName}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
            >
              ✕
            </button>
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

          {/* Document Actions - Upload and Create buttons */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {(canUploadDocuments !== false) && (
            <button
              onClick={() => { setError(''); setShowUploadModal(true) }}
              className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white text-sm font-semibold rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Document
            </button>
            )}
            {/* Create Document Button - Only show for projects */}
            {entityType === 'projects' && (
              <div className="relative create-document-menu">
                <button
                  onClick={() => setShowCreateMenu(!showCreateMenu)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-md transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Document
                  <svg className={`w-4 h-4 transition-transform ${showCreateMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* Dropdown Menu */}
                {showCreateMenu && (
                  <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-10">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowCreateMenu(false)
                          handleGenerateProposal()
                        }}
                        disabled={generatingContract}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingContract ? (
                          <>
                            <svg className="animate-spin w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Proposal
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateMenu(false)
                          handleGenerateContract()
                        }}
                        disabled={generatingContract}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingContract ? (
                          <>
                            <svg className="animate-spin w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Contract
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateMenu(false)
                          handleGenerateChangeOrder()
                        }}
                        disabled={generatingContract}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingContract ? (
                          <>
                            <svg className="animate-spin w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Change Order
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upload Document Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={handleCloseUploadModal}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Document</h3>
                </div>
                <div className="p-4 space-y-3">
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm">
                      {error}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Document Name <span className="text-gray-400 font-normal">(optional - defaults to file name)</span>
                    </label>
                    <input
                      type="text"
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      placeholder="Enter document name or leave blank"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Document Type *
                    </label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${!documentType ? 'border-gray-300 dark:border-gray-600 text-gray-500' : 'border-gray-300 dark:border-gray-600'}`}
                    >
                      <option value="" disabled>Select document type...</option>
                      <option value="contract">Contract</option>
                      <option value="proposal">Proposal</option>
                      <option value="change_order">Change Order</option>
                      <option value="insurance">Insurance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      File *
                    </label>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    {selectedFile && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-2">
                  <button
                    onClick={handleCloseUploadModal}
                    disabled={uploading}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFileUpload}
                    disabled={uploading || !selectedFile || !documentType}
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Documents List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Documents ({documents.length})
              </h4>
              {documents.some(doc => doc.esign_contract_id && doc.status !== 'signed') && (
                <button
                  onClick={handleSyncAll}
                  disabled={syncingDocId === 'all'}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1"
                  title="Sync all pending e-signatures and download signed documents"
                >
                  {syncingDocId === 'all' ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync Signatures
                    </>
                  )}
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pool-blue"></div>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No documents uploaded yet.</p>
                <p className="text-sm mt-2">Upload a document using the Upload Document button above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc, index) => {
                  const fileName = doc.file_name || doc.name
                  const displayName = doc.name || fileName
                  const docType = doc.document_type
                  
                  // Type badge colors
                  const typeColors = {
                    contract: 'bg-purple-100 text-purple-800',
                    proposal: 'bg-blue-100 text-blue-800',
                    change_order: 'bg-orange-100 text-orange-800',
                    other: 'bg-gray-100 text-gray-800',
                  }
                  
                  const typeLabels = {
                    contract: 'Contract',
                    proposal: 'Proposal',
                    change_order: 'Change Order',
                    other: 'Other',
                  }

                  // Status badge colors
                  const statusColors = {
                    draft: 'bg-yellow-100 text-yellow-800',
                    sent: 'bg-blue-100 text-blue-800',
                    signed: 'bg-green-100 text-green-800',
                    cancelled: 'bg-red-100 text-red-800',
                    expired: 'bg-gray-100 text-gray-800',
                  }
                  
                  const statusLabels = {
                    draft: 'Draft',
                    sent: 'Sent',
                    signed: 'Signed',
                    cancelled: 'Cancelled',
                    expired: 'Expired',
                  }

                  
                  return (
                  <div
                      key={doc.id || index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100"
                  >
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1" title={displayName}>
                            {displayName}
                          </p>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {docType && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[docType] || typeColors.other}`}>
                              {typeLabels[docType] || docType}
                            </span>
                          )}
                          {doc.status && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[doc.status] || statusColors.draft}`}>
                              {statusLabels[doc.status] || doc.status}
                            </span>
                          )}
                          {doc.document_number && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-700">
                              #{String(doc.document_number).padStart(5, '0')}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap items-center">
                          {doc.file_name && doc.file_name !== displayName && (
                            <span className="truncate max-w-[150px]" title={doc.file_name}>{doc.file_name}</span>
                          )}
                        <span>{formatFileSize(doc.size)}</span>
                        {doc.created_at && (
                          <span>Uploaded: {formatDate(doc.created_at)}</span>
                        )}
                          {doc.esign_contract_id && (
                            <span className="text-gray-400" title={`Contract ID: ${doc.esign_contract_id}`}>
                              Contract: {doc.esign_contract_id.substring(0, 8)}...
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4 items-center">
                        {/* Notes Icon - show for projects, subcontractors, customers, and inventory */}
                        {(entityType === 'projects' || entityType === 'subcontractors' || entityType === 'customers' || entityType === 'inventory') && doc.id && (
                          <button
                            onClick={() => handleNotesClick(doc)}
                            className={`p-2 rounded-md transition-colors ${
                              doc.notes && doc.notes.trim() 
                                ? 'text-orange-600 hover:text-orange-800 hover:bg-orange-50' 
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                            title={doc.notes && doc.notes.trim() ? 'View/Edit Notes' : 'Add Notes'}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(doc)}
                          className="px-3 py-1 bg-pool-blue hover:bg-pool-dark text-white text-sm font-medium rounded-md transition-colors"
                        >
                          View
                        </button>
                        {entityType !== 'employees' && (
                        <button
                          onClick={() => handleSendClick(doc)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                          title="Send for signature"
                        >
                          Send
                        </button>
                        )}
                        {doc.id && (
                      <button
                            onClick={() => handleEditClick(doc)}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
                      >
                            Edit
                      </button>
                        )}
                        {(canDeleteDocuments !== false) && (
                      <button
                          onClick={() => handleDelete(fileName, doc.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        Delete
                      </button>
                        )}
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4" onClick={() => { setShowPreview(false); setPreviewUrl(null); setPreviewFileName(''); }}>
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Preview Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 truncate flex-1 mr-4">
                {previewFileName}
              </h3>
              <button
                onClick={() => {
                  setShowPreview(false)
                  setPreviewUrl(null)
                  setPreviewFileName('')
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {getFileType(previewFileName) === 'pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[600px] border-0 rounded"
                  title={previewFileName}
                />
              ) : getFileType(previewFileName) === 'image' ? (
                <div className="flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={previewFileName}
                    className="max-w-full max-h-[80vh] object-contain rounded shadow-lg"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <p className="text-lg mb-4">Preview not available for this file type</p>
                  <button
                    onClick={() => window.open(previewUrl, '_blank')}
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white rounded-md transition-colors"
                  >
                    Open in New Tab
                  </button>
                </div>
              )}
            </div>

            {/* Preview Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => window.open(previewUrl, '_blank')}
                className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white text-sm font-medium rounded-md transition-colors"
              >
                Open in New Tab
              </button>
              <button
                onClick={() => {
                  setShowPreview(false)
                  setPreviewUrl(null)
                  setPreviewFileName('')
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white text-sm font-medium rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Preview Modal */}
      {showContractPreview && contractData && (
        <ContractPreview
          contractData={contractData}
          onClose={() => {
            setShowContractPreview(false)
            setContractData(null)
          }}
          onGenerate={handleContractGenerated}
          onDocumentUploaded={() => {
            // Refresh the documents list when a document is uploaded
            fetchDocuments()
          }}
        />
      )}

      {/* Edit Document Modal */}
      {editingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => setEditingDocument(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Edit Document</h3>
              <button
                onClick={() => setEditingDocument(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Enter document name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Type
                </label>
                <select
                  value={editForm.document_type}
                  onChange={(e) => setEditForm({ ...editForm, document_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="contract">Contract</option>
                  <option value="proposal">Proposal</option>
                  <option value="change_order">Change Order</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="signed">Signed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              {editingDocument.document_number && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Document #: {String(editingDocument.document_number).padStart(5, '0')}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                onClick={() => setEditingDocument(null)}
                disabled={saving}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !hasEditChanges}
                className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {showEmailModal && emailDocument && (
        <SendEmailModal
          document={emailDocument}
          projectName={entityName}
          customerEmail={customerEmail}
          onClose={() => {
            setShowEmailModal(false)
            setEmailDocument(null)
          }}
          onSuccess={(message) => {
            setSuccess(message)
            setTimeout(() => setSuccess(''), 5000)
            fetchDocuments() // Refresh to show updated status
          }}
        />
      )}

      {/* Notes Modal */}
      {showNotesModal && selectedDocumentForNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowNotesModal(false); setSelectedDocumentForNotes(null); setDocumentNotes(''); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Notes for {selectedDocumentForNotes.name || selectedDocumentForNotes.file_name}
                </h3>
                <button
                  onClick={() => {
                    setShowNotesModal(false)
                    setSelectedDocumentForNotes(null)
                    setDocumentNotes('')
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={documentNotes}
                    onChange={(e) => setDocumentNotes(e.target.value)}
                    placeholder="Add notes about this document..."
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
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

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotesModal(false)
                      setSelectedDocumentForNotes(null)
                      setDocumentNotes('')
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes || !hasNotesChanges}
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md disabled:opacity-50"
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentsModal

