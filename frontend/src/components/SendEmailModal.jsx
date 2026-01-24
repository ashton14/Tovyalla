import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

function SendEmailModal({ document, projectName, customerEmail, onClose, onSuccess }) {
  const { user, supabase } = useAuth()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    to: customerEmail || '',
    recipientName: '',
    subject: `${projectName || 'Project'} - ${document.document_type ? document.document_type.charAt(0).toUpperCase() + document.document_type.slice(1).replace('_', ' ') : 'Document'}${document.document_number ? ` #${String(document.document_number).padStart(5, '0')}` : ''}`,
    message: `Please review and sign the attached document.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\n${user?.user_metadata?.full_name || user?.email || ''}`,
  })

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Handle send for signature
  const handleSend = async () => {
    if (!formData.to) {
      setError('Recipient email is required')
      return
    }

    if (!formData.subject) {
      setError('Subject is required')
      return
    }

    setSending(true)
    setError('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.post(
        '/api/esign/send',
        {
          documentUrl: document.url,
          documentName: document.file_name || document.name,
          recipientEmail: formData.to,
          recipientName: formData.recipientName || formData.to,
          subject: formData.subject,
          message: formData.message,
          documentId: document.id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.data.success) {
        onSuccess?.('Document sent for signature!')
        onClose()
      }
    } catch (err) {
      console.error('Error sending document for signature:', err)
      setError(err.response?.data?.error || err.message || 'Failed to send document for signature')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Send Document for Signature</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Document: {document.name || document.file_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* From (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From
            </label>
            <input
              type="text"
              value={user?.email || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 text-sm"
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signer Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="to"
              value={formData.to}
              onChange={handleChange}
              placeholder="signer@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm"
            />
          </div>

          {/* Recipient Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signer Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              name="recipientName"
              value={formData.recipientName}
              onChange={handleChange}
              placeholder="Signer's full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Email subject"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={6}
              placeholder="Enter your message..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm resize-none"
            />
          </div>

          {/* Document Info */}
          <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Document will be sent for electronic signature</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-medium rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !formData.to || !formData.subject}
            className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Send for Signature
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SendEmailModal
