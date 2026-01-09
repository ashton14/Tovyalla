import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

// Custom hook to get auth token
const useAuthToken = () => {
  const { supabase } = useAuth()

  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  return getAuthToken
}

// ============================================
// CUSTOMERS
// ============================================
export const useCustomers = () => {
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/customers', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.customers || []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  })
}

export const useCreateCustomer = () => {
  const queryClient = useQueryClient()
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (customerData) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.post('/api/customers', customerData, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.put(`/api/customers/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (id) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(`/api/customers/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.projects || []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useCreateProject = () => {
  const queryClient = useQueryClient()
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (projectData) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.post('/api/projects', projectData, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.put(`/api/projects/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['statistics'] })
    },
  })
}

export const useDeleteProject = () => {
  const queryClient = useQueryClient()
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (id) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(`/api/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/inventory', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.materials || []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useCreateInventoryItem = () => {
  const queryClient = useQueryClient()
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (itemData) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.post('/api/inventory', itemData, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.put(`/api/inventory/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (id) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(`/api/inventory/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/employees', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.employees || []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useCreateEmployee = () => {
  const queryClient = useQueryClient()
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (employeeData) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.post('/api/employees', employeeData, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.put(`/api/employees/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (id) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(`/api/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['subcontractors'],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/subcontractors', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.subcontractors || []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useCreateSubcontractor = () => {
  const queryClient = useQueryClient()
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (subcontractorData) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.post('/api/subcontractors', subcontractorData, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.put(`/api/subcontractors/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (id) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(`/api/subcontractors/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/goals', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.goals || []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useGoalDataPoints = () => {
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['goalDataPoints'],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/goals/data-points', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.dataPoints || []
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000, // Data points rarely change
    gcTime: 60 * 60 * 1000,
  })
}

export const useCreateGoal = () => {
  const queryClient = useQueryClient()
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (goalData) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.post('/api/goals', goalData, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.put(`/api/goals/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (id) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(`/api/goals/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['statistics', period],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/projects/statistics', {
        headers: { Authorization: `Bearer ${token}` },
        params: { period },
      })
      return response.data
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

// Monthly statistics for charts
export const useMonthlyStatistics = (year) => {
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['monthlyStatistics', year],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/projects/monthly-statistics', {
        headers: { Authorization: `Bearer ${token}` },
        params: { year },
      })
      return response.data
    },
    enabled: !!user && !!year,
    staleTime: 10 * 60 * 1000, // 10 minutes - monthly data doesn't change often
    gcTime: 60 * 60 * 1000,
  })
}

// ============================================
// COMPANY INFO
// ============================================
export const useCompanyInfo = () => {
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['companyInfo'],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/company', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.company || null
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // Company info rarely changes
    gcTime: 60 * 60 * 1000,
  })
}

export const useUpdateCompanyInfo = () => {
  const queryClient = useQueryClient()
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (companyData) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.put('/api/company', companyData, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['emailWhitelist'],
    queryFn: async () => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get('/api/whitelist', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.whitelist || []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export const useAddToWhitelist = () => {
  const queryClient = useQueryClient()
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (email) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.post('/api/whitelist', { email }, {
        headers: { Authorization: `Bearer ${token}` },
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
  const getAuthToken = useAuthToken()

  return useMutation({
    mutationFn: async (id) => {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(`/api/whitelist/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailWhitelist'] })
    },
  })
}

