import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { downloadContractPdf, openContractPdf } from '../utils/contractPdfGenerator'

function DocumentsModal({ entityType, entityId, entityName, onClose }) {
  const { user, supabase } = useAuth()
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

      console.log('📥 Fetch Documents Debug:')
      console.log('  - Entity Type:', entityType)
      console.log('  - Entity ID:', entityId)
      console.log('  - Company ID:', user?.user_metadata?.companyID)

      const response = await axios.get(`/api/documents/${entityType}/${entityId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      console.log('  - Response:', response.data)
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

  // Generate contract PDF
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
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const contractData = response.data
      console.log('Contract data received:', contractData)

      // Generate and download the PDF
      downloadContractPdf(contractData)

      setSuccess(`Contract #${contractData.contractNumber} generated successfully!`)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      console.error('Error generating contract:', err)
      setError(err.response?.data?.error || err.message || 'Failed to generate contract')
    } finally {
      setGeneratingContract(false)
    }
  }

  // Handle file upload via backend (bypasses RLS)
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const companyID = user?.user_metadata?.companyID
      console.log('📤 Upload Debug Info:')
      console.log('  - User:', user?.email)
      console.log('  - Company ID:', companyID)
      console.log('  - Entity Type:', entityType)
      console.log('  - Entity ID:', entityId)
      console.log('  - File Name:', file.name)
      console.log('  - File Size:', file.size, 'bytes')
      console.log('  - File Type:', file.type)

      if (!companyID) {
        throw new Error('No company ID found')
      }

      // Use FormData for multipart/form-data upload
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(
        `/api/documents/${entityType}/${entityId}/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type - browser will set it with boundary for FormData
          },
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      console.log('✅ Upload successful!', data)
      setSuccess('Document uploaded successfully!')
      setTimeout(() => setSuccess(''), 3000)
      
      // Refresh documents list
      fetchDocuments()
      
      // Reset file input
      event.target.value = ''
    } catch (err) {
      console.error('❌ Error uploading document:', err)
      setError(err.message || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

  // Handle file download
  const handleDownload = async (fileName) => {
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get(
        `/api/documents/${entityType}/${entityId}/${fileName}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      // Open download URL in new tab
      window.open(response.data.url, '_blank')
    } catch (err) {
      console.error('Error downloading document:', err)
      setError(err.response?.data?.error || 'Failed to download document')
    }
  }

  // Handle file delete
  const handleDelete = async (fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.delete(`/api/documents/${entityType}/${entityId}/${fileName}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">
              Documents - {entityName}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
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

          {/* Upload Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Upload Document
              </label>
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
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowCreateMenu(false)
                            // TODO: Implement proposal creation
                            alert('Proposal creation coming soon!')
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Proposal
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateMenu(false)
                            handleGenerateContract()
                          }}
                          disabled={generatingContract}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {uploading && (
              <p className="mt-2 text-sm text-gray-600">Uploading...</p>
            )}
          </div>

          {/* Documents List */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Documents ({documents.length})
            </h4>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pool-blue"></div>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No documents uploaded yet.</p>
                <p className="text-sm mt-2">Upload a document using the form above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.name}
                      </p>
                      <div className="flex gap-4 mt-1 text-xs text-gray-500">
                        <span>{formatFileSize(doc.size)}</span>
                        {doc.created_at && (
                          <span>Uploaded: {formatDate(doc.created_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {isPreviewable(doc.name) && (
                        <button
                          onClick={() => handleView(doc.name)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          View
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(doc.name)}
                        className="px-3 py-1 bg-pool-blue hover:bg-pool-dark text-white text-sm font-medium rounded-md transition-colors"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDelete(doc.name)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
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
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
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
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentsModal

