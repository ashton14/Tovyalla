import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

// Returns async function that resolves to { Authorization, 'X-Company-ID' } for API calls
const useAuthHeaders = () => {
  const { supabase, getAuthHeaders } = useAuth()
  return async () => {
    if (!supabase) return {}
    const { data: { session } } = await supabase.auth.getSession()
    return getAuthHeaders(session?.access_token) || {}
  }
}

// ============================================
// CUSTOMERS
// ============================================
export const useCustomers = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['customers', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/customers', {
        headers,
      })
      return response.data.customers || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  })
}

export const useCreateCustomer = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (customerData) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.post('/api/customers', customerData, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.put(`/api/customers/${id}`, data, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      await axios.delete(`/api/customers/${id}`, {
        headers,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

// ============================================
// PROJECTS
// ============================================
export const useProjects = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['projects', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/projects', {
        headers,
      })
      return response.data.projects || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useCreateProject = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (projectData) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.post('/api/projects', projectData, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['statistics'] })
    },
  })
}

export const useUpdateProject = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.put(`/api/projects/${id}`, data, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['statistics'] })
    },
  })
}

export const useTemplates = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['templates', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/templates', {
        headers,
      })
      return response.data.templates || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useDeleteProject = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      await axios.delete(`/api/projects/${id}`, {
        headers,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['statistics'] })
    },
  })
}

// ============================================
// INVENTORY
// ============================================
export const useInventory = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['inventory', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/inventory', {
        headers,
      })
      return response.data.materials || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useCreateInventoryItem = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (itemData) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.post('/api/inventory', itemData, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export const useUpdateInventoryItem = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.put(`/api/inventory/${id}`, data, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export const useDeleteInventoryItem = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      await axios.delete(`/api/inventory/${id}`, {
        headers,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

// ============================================
// EMPLOYEES
// ============================================
export const useEmployees = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['employees', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/employees', {
        headers,
      })
      return response.data.employees || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useCreateEmployee = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (employeeData) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.post('/api/employees', employeeData, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.put(`/api/employees/${id}`, data, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export const useDeleteEmployee = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      await axios.delete(`/api/employees/${id}`, {
        headers,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

// ============================================
// SUBCONTRACTORS
// ============================================
export const useSubcontractors = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['subcontractors', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/subcontractors', {
        headers,
      })
      return response.data.subcontractors || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useCreateSubcontractor = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (subcontractorData) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.post('/api/subcontractors', subcontractorData, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] })
    },
  })
}

export const useUpdateSubcontractor = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.put(`/api/subcontractors/${id}`, data, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] })
    },
  })
}

export const useDeleteSubcontractor = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      await axios.delete(`/api/subcontractors/${id}`, {
        headers,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] })
    },
  })
}

// ============================================
// GOALS
// ============================================
export const useGoals = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['goals', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/goals', {
        headers,
      })
      return response.data.goals || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useGoalDataPoints = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['goalDataPoints', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/goals/data-points', {
        headers,
      })
      return response.data.dataPoints || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 30 * 60 * 1000, // Data points rarely change
    gcTime: 60 * 60 * 1000,
  })
}

export const useCreateGoal = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (goalData) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.post('/api/goals', goalData, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export const useUpdateGoal = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.put(`/api/goals/${id}`, data, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export const useDeleteGoal = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      await axios.delete(`/api/goals/${id}`, {
        headers,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

// ============================================
// STATISTICS (Dashboard)
// ============================================
export const useStatistics = (period = 'total') => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['statistics', currentCompanyID, period],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/projects/statistics', {
        headers,
        params: { period },
      })
      return response.data
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

// Monthly statistics for charts
export const useMonthlyStatistics = (year) => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['monthlyStatistics', currentCompanyID, year],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/projects/monthly-statistics', {
        headers,
        params: { year },
      })
      return response.data
    },
    enabled: !!user && !!currentCompanyID && !!year,
    staleTime: 10 * 60 * 1000, // 10 minutes - monthly data doesn't change often
    gcTime: 60 * 60 * 1000,
  })
}

// ============================================
// COMPANY INFO
// ============================================
export const useCompanyInfo = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['companyInfo', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/company', {
        headers,
      })
      return response.data.company || null
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 10 * 60 * 1000, // Company info rarely changes
    gcTime: 60 * 60 * 1000,
  })
}

export const useUpdateCompanyInfo = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (companyData) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.put('/api/company', companyData, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyInfo'] })
    },
  })
}

// ============================================
// EMAIL WHITELIST
// ============================================
export const useEmailWhitelist = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['emailWhitelist', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/whitelist', {
        headers,
      })
      return response.data.whitelist || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useAddToWhitelist = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (email) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.post('/api/whitelist', { email }, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailWhitelist'] })
    },
  })
}

export const useRemoveFromWhitelist = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      await axios.delete(`/api/whitelist/${id}`, {
        headers,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailWhitelist'] })
    },
  })
}

// ============================================
// SMS MESSAGES (Twilio)
// ============================================

// Get all conversations (messages grouped by customer/phone)
export const useMessages = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['messages', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/messages', {
        headers,
      })
      return response.data.conversations || []
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 30 * 1000, // Data is fresh for 30 seconds (messages are more time-sensitive)
    gcTime: 5 * 60 * 1000,
  })
}

// Get conversation with a specific customer
export const useConversation = (customerId) => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['conversation', currentCompanyID, customerId],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get(`/api/messages/conversation/${customerId}`, {
        headers,
      })
      return response.data
    },
    enabled: !!user && !!currentCompanyID && !!customerId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Get unread message count (polls every 30 seconds)
export const useUnreadMessageCount = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['unreadMessageCount', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/messages/unread-count', {
        headers,
      })
      return response.data.unread_count || 0
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 15 * 1000, // Consider stale after 15 seconds
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000, // Poll every 30 seconds
  })
}

// Send a new SMS message
export const useSendMessage = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async ({ customer_id, phone_number, message_body }) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.post('/api/messages', {
        customer_id,
        phone_number,
        message_body,
      }, {
        headers,
      })
      return response.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      if (variables.customer_id) {
        queryClient.invalidateQueries({ queryKey: ['conversation', variables.customer_id] })
      }
    },
  })
}

// Mark a single message as read
export const useMarkMessageRead = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async (messageId) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.patch(`/api/messages/${messageId}/read`, {}, {
        headers,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      queryClient.invalidateQueries({ queryKey: ['unreadMessageCount'] })
    },
  })
}

// Mark all messages in a conversation as read
export const useMarkAllMessagesRead = () => {
  const queryClient = useQueryClient()
  const getAuthHeaders = useAuthHeaders()

  return useMutation({
    mutationFn: async ({ customer_id, phone_number }) => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.patch('/api/messages/mark-all-read', {
        customer_id,
        phone_number,
      }, {
        headers,
      })
      return response.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      queryClient.invalidateQueries({ queryKey: ['unreadMessageCount'] })
      if (variables.customer_id) {
        queryClient.invalidateQueries({ queryKey: ['conversation', variables.customer_id] })
      }
    },
  })
}

// Get SMS service (Infobip) configuration status
export const useSmsStatus = () => {
  const getAuthHeaders = useAuthHeaders()
  const { user, currentCompanyID } = useAuth()

  return useQuery({
    queryKey: ['smsStatus', currentCompanyID],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      if (!headers.Authorization) throw new Error('Not authenticated')

      const response = await axios.get('/api/sms/status', {
        headers,
      })
      return response.data
    },
    enabled: !!user && !!currentCompanyID,
    staleTime: 10 * 60 * 1000, // Configuration rarely changes
    gcTime: 30 * 60 * 1000,
  })
}

// Alias for backward compatibility
export const useTwilioStatus = useSmsStatus

