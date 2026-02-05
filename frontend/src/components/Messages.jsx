import { useState, useEffect, useRef } from 'react'
import {
  useMessages,
  useConversation,
  useSendMessage,
  useMarkAllMessagesRead,
  useSmsStatus,
  useCustomers,
} from '../hooks/useApi'

function Messages() {
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [selectedCustomerForNew, setSelectedCustomerForNew] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const messagesEndRef = useRef(null)

  // Fetch data
  const { data: conversations = [], isLoading: loadingConversations, refetch: refetchConversations } = useMessages()
  const { data: smsStatus } = useSmsStatus()
  const { data: customers = [] } = useCustomers()

  // Get conversation details when selected
  const { data: conversationData, isLoading: loadingConversation } = useConversation(
    selectedConversation?.customer_id
  )

  // Mutations
  const sendMessage = useSendMessage()
  const markAllRead = useMarkAllMessagesRead()

  // Scroll to bottom of messages when conversation changes or new message arrives
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversationData?.messages])

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markAllRead.mutateAsync({
        customer_id: selectedConversation.customer_id,
        phone_number: selectedConversation.phone_number,
      }).catch(() => {
        // Silently fail - not critical
      })
    }
  }, [selectedConversation?.id])

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    const customerName = conv.customer
      ? `${conv.customer.first_name} ${conv.customer.last_name}`.toLowerCase()
      : ''
    return (
      customerName.includes(search) ||
      conv.phone_number?.includes(searchTerm) ||
      conv.last_message?.message_body?.toLowerCase().includes(search)
    )
  })

  // Customers without existing conversations (for new message modal)
  const customersWithPhone = customers.filter(c => c.phone)
  const existingCustomerIds = conversations.map(c => c.customer_id).filter(Boolean)
  const availableCustomers = customersWithPhone.filter(
    c => !existingCustomerIds.includes(c.id)
  )

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    setError('')
    setSuccess('')

    try {
      await sendMessage.mutateAsync({
        customer_id: selectedConversation?.customer_id,
        phone_number: selectedConversation?.phone_number,
        message_body: newMessage.trim(),
      })
      setNewMessage('')
      refetchConversations()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to send message')
    }
  }

  // Handle starting a new conversation
  const handleStartNewConversation = async () => {
    if (!selectedCustomerForNew || !newMessage.trim()) return

    setError('')
    setSuccess('')

    try {
      await sendMessage.mutateAsync({
        customer_id: selectedCustomerForNew.id,
        message_body: newMessage.trim(),
      })
      setNewMessage('')
      setShowNewMessageModal(false)
      setSelectedCustomerForNew(null)
      refetchConversations()
      setSuccess('Message sent successfully!')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to send message')
    }
  }

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  // Format full timestamp for message bubbles
  const formatMessageTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get customer display name
  const getCustomerName = (conversation) => {
    if (conversation.customer) {
      return `${conversation.customer.first_name} ${conversation.customer.last_name}`
    }
    return conversation.phone_number || 'Unknown'
  }

  // Show SMS not configured message
  if (smsStatus && !smsStatus.configured) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
                SMS Messaging Not Configured
              </h3>
              <p className="mt-2 text-yellow-700 dark:text-yellow-300">
                To enable SMS messaging, you need to configure Infobip credentials in your environment variables:
              </p>
              <ul className="mt-3 list-disc list-inside text-sm text-yellow-600 dark:text-yellow-400 space-y-1">
                <li>INFOBIP_API_KEY</li>
                <li>INFOBIP_BASE_URL</li>
                <li>INFOBIP_SENDER_ID</li>
              </ul>
              <p className="mt-3 text-sm text-yellow-600 dark:text-yellow-400">
                Visit <a href="https://portal.infobip.com/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Infobip Portal</a> to get your credentials.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <p className="text-gray-500 dark:text-gray-400">
            SMS conversations with your customers
            {smsStatus?.phone_number && (
              <span className="ml-2 text-sm">
                (from {smsStatus.phone_number})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowNewMessageModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          New Message
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
          {success}
        </div>
      )}

      {/* Main Content - Split View */}
      <div className="flex-1 flex gap-4 min-h-0 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {/* Conversation List (Left Panel) */}
        <div className="w-full sm:w-80 lg:w-96 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pool-blue focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pool-blue"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>No conversations yet</p>
                <p className="text-sm mt-1">Start by sending a message to a customer</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700/50 ${
                    selectedConversation?.id === conversation.id
                      ? 'bg-pool-blue/10 dark:bg-pool-blue/20'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pool-blue/20 dark:bg-pool-blue/30 flex items-center justify-center">
                      <span className="text-pool-blue dark:text-pool-light font-semibold">
                        {conversation.customer
                          ? `${conversation.customer.first_name[0]}${conversation.customer.last_name[0]}`
                          : '#'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium truncate ${
                          conversation.unread_count > 0
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {getCustomerName(conversation)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {formatDate(conversation.last_message?.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className={`text-sm truncate ${
                          conversation.unread_count > 0
                            ? 'text-gray-700 dark:text-gray-200 font-medium'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {conversation.last_message?.direction === 'outbound' && (
                            <span className="text-gray-400 dark:text-gray-500">You: </span>
                          )}
                          {conversation.last_message?.message_body}
                        </p>
                        {conversation.unread_count > 0 && (
                          <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold text-white bg-pool-blue rounded-full">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat View (Right Panel) */}
        <div className="hidden sm:flex flex-1 flex-col min-w-0">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-10 h-10 rounded-full bg-pool-blue/20 dark:bg-pool-blue/30 flex items-center justify-center">
                  <span className="text-pool-blue dark:text-pool-light font-semibold">
                    {selectedConversation.customer
                      ? `${selectedConversation.customer.first_name[0]}${selectedConversation.customer.last_name[0]}`
                      : '#'}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {getCustomerName(selectedConversation)}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedConversation.phone_number}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingConversation ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pool-blue"></div>
                  </div>
                ) : (
                  <>
                    {(conversationData?.messages || selectedConversation.messages || []).map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            message.direction === 'outbound'
                              ? 'bg-pool-blue text-white rounded-br-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.message_body}</p>
                          <p
                            className={`text-xs mt-1 ${
                              message.direction === 'outbound'
                                ? 'text-white/70'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {formatMessageTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendMessage.isPending}
                    className="px-6 py-2 bg-pool-blue hover:bg-pool-dark disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-colors"
                  >
                    {sendMessage.isPending ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a conversation from the list to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                New Message
              </h2>
              <button
                onClick={() => {
                  setShowNewMessageModal(false)
                  setSelectedCustomerForNew(null)
                  setNewMessage('')
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Customer
                </label>
                <select
                  value={selectedCustomerForNew?.id || ''}
                  onChange={(e) => {
                    const customer = customersWithPhone.find(c => c.id === e.target.value)
                    setSelectedCustomerForNew(customer || null)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                >
                  <option value="">Choose a customer...</option>
                  {customersWithPhone.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.first_name} {customer.last_name} - {customer.phone}
                    </option>
                  ))}
                </select>
                {customersWithPhone.length === 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                    No customers with phone numbers found. Add phone numbers to your customers first.
                  </p>
                )}
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your message..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pool-blue focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowNewMessageModal(false)
                  setSelectedCustomerForNew(null)
                  setNewMessage('')
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartNewConversation}
                disabled={!selectedCustomerForNew || !newMessage.trim() || sendMessage.isPending}
                className="px-6 py-2 bg-pool-blue hover:bg-pool-dark disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {sendMessage.isPending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Messages
