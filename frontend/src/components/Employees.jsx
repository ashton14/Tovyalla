import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import EmailWhitelist from './EmailWhitelist'
import ActionsMenu, { DOCUMENT_ICON, EDIT_ICON, DELETE_ICON } from './ActionsMenu'
import DocumentsModal from './DocumentsModal'
import { formatPhoneInput } from '../utils/phoneFormat'

const USER_TYPES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
]

const USER_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'sales', label: 'Sales' },
  { value: 'office_staff', label: 'Office Staff' },
  { value: 'other', label: 'Other' },
]

// US time zones for dropdown
const TIME_ZONES = [
  { value: '', label: 'Select time zone' },
  { value: 'America/Los_Angeles', label: 'Pacific Standard Time (PST): UTC-8' },
  { value: 'America/Denver', label: 'Mountain Standard Time (MST): UTC-7' },
  { value: 'America/Chicago', label: 'Central Standard Time (CST): UTC-6' },
  { value: 'America/New_York', label: 'Eastern Standard Time (EST): UTC-5' },
  { value: 'America/Anchorage', label: 'Alaska Standard Time (AKST): UTC-9' },
  { value: 'Pacific/Honolulu', label: 'Hawaii-Aleutian Standard Time (HST): UTC-10' },
]

function Employees() {
  const { user, supabase, getAuthHeaders } = useAuth()
  const [activeTab, setActiveTab] = useState('employees')
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedEntityForDocuments, setSelectedEntityForDocuments] = useState(null)
  const [openActionsId, setOpenActionsId] = useState(null)
  const actionsMenuRef = useRef(null)
  const [currentUserEmployee, setCurrentUserEmployee] = useState(null)
  
  // Check if current user is admin, manager, or owner (can modify user types, roles, active status)
  const canModifyPrivileges = currentUserEmployee?.user_type === 'admin' || currentUserEmployee?.user_type === 'manager' || currentUserEmployee?.user_type === 'owner'
  // Can edit an employee: self (basic info only) or admin/manager (full edit)
  const canEditEmployee = (emp) => emp?.id === currentUserEmployee?.id || canModifyPrivileges
  // Editing self without admin/manager: only basic info (name, email, phone, TZ)
  const isEditingSelfOnly = editingEmployee && editingEmployee.id === currentUserEmployee?.id && !canModifyPrivileges

  // Form state
  const emptyEmployeeForm = {
    name: '', user_type: 'employee', user_roles: [], email_address: '', phone: '', current: false,
    registered_time_zone: '', color: '#0ea5e9', date_of_birth: '', sms_opt_in: false,
  }
  const [initialFormData, setInitialFormData] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    user_type: 'employee',
    user_roles: [], // Array for multiple role selection
    email_address: '',
    phone: '',
    current: false,
    sms_opt_in: false,
    registered_time_zone: '',
    color: '#0ea5e9', // Default blue color
    date_of_birth: '',
  })

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Fetch employees
  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get('/api/employees', {
        headers: getAuthHeaders(token),
      })

      const employeesList = response.data.employees || []
      setEmployees(employeesList)
      
      // Find current user's employee record by email
      if (user?.email) {
        const currentEmp = employeesList.find(emp => emp.email_address?.toLowerCase() === user.email.toLowerCase())
        setCurrentUserEmployee(currentEmp || null)
      }
    } catch (err) {
      console.error('Error fetching employees:', err)
      console.error('Error details:', err.response?.data || err.message)
      setError(err.response?.data?.error || err.message || 'Failed to load employees')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchEmployees()
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
        // Convert user_roles array to comma-separated string for storage
        user_role: formData.user_roles.join(', '),
        // Set responsibility flags based on selected roles
        is_project_manager: formData.user_roles.includes('project_manager'),
        is_sales_person: formData.user_roles.includes('sales'),
        is_foreman: formData.user_roles.includes('foreman'),
        current: formData.current || false,
        sms_opt_in: formData.sms_opt_in === true,
        color: formData.color && formData.color.trim() !== '' ? formData.color.trim() : null,
        date_of_birth: formData.date_of_birth || null,
      }
      // Remove user_roles from payload as we've converted it to user_role
      delete payload.user_roles

      if (editingEmployee) {
        await axios.put(`/api/employees/${editingEmployee.id}`, payload, {
          headers: getAuthHeaders(token),
        })
        setSuccess('Employee updated successfully!')
      } else {
        await axios.post('/api/employees', payload, {
          headers: getAuthHeaders(token),
        })
        setSuccess('Employee added successfully!')
      }

      setShowForm(false)
      setEditingEmployee(null)
      resetForm()
      fetchEmployees()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save employee')
    }
  }

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.delete(`/api/employees/${id}`, {
        headers: getAuthHeaders(token),
      })

      setSuccess('Employee deleted successfully!')
      fetchEmployees()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete employee')
    }
  }

  // Handle edit
  const handleEdit = (employee) => {
    setEditingEmployee(employee)
    const rolesArray = employee.user_role 
      ? employee.user_role.split(',').map(r => r.trim()).filter(r => r)
      : []
    const data = {
      name: employee.name || '',
      user_type: employee.user_type || 'employee',
      user_roles: rolesArray,
      email_address: employee.email_address || '',
      phone: formatPhoneInput(employee.phone || ''),
      current: employee.current || false,
      sms_opt_in: employee.sms_opt_in === true,
      registered_time_zone: employee.registered_time_zone || '',
      color: employee.color || '#0ea5e9',
      date_of_birth: employee.date_of_birth ? employee.date_of_birth.split('T')[0] : '',
    }
    setFormData(data)
    setInitialFormData(JSON.parse(JSON.stringify(data)))
    setShowForm(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData(emptyEmployeeForm)
    setInitialFormData(JSON.parse(JSON.stringify(emptyEmployeeForm)))
  }

  // Filter employees
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      searchTerm === '' ||
      employee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.phone?.includes(searchTerm) ||
      employee.user_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.user_role?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex)

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
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Employees</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your employee database and email whitelist</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('employees')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'employees'
                ? 'border-pool-blue text-pool-blue'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            Employees
          </button>
          <button
            onClick={() => setActiveTab('whitelist')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'whitelist'
                ? 'border-pool-blue text-pool-blue'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            Email Whitelist
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'employees' && (
        <div className="space-y-6">
          {/* Employees Header */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Employee Management</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Add, edit, and manage your employees</p>
            </div>
            <button
              onClick={() => {
                resetForm()
                setEditingEmployee(null)
                setShowForm(true)
              }}
              className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
            >
              + Add Employee
            </button>
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
            placeholder="Search by name, email, phone, user type, or role..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Employee Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingEmployee(null); resetForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-pool-blue to-pool-dark px-6 py-4 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {editingEmployee ? 'Edit Employee' : 'New Employee'}
                  </h3>
                  <p className="text-pool-light text-sm mt-0.5">
                    {editingEmployee ? 'Update employee information' : 'Add a new team member'}
                  </p>
                </div>
                <button
                  onClick={() => { setShowForm(false); setEditingEmployee(null); resetForm(); }}
                  className="text-white/70 hover:text-white transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Basic Information */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Basic Information
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="John Doe"
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Address {!editingEmployee && <span className="text-red-500">*</span>}
                      </label>
                      {editingEmployee ? (
                        <p className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm">
                          {formData.email_address}
                        </p>
                      ) : (
                        <input
                          type="email"
                          value={formData.email_address}
                          onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                          required
                          placeholder="john@company.com"
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                        />
                      )}
                      {editingEmployee && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: formatPhoneInput(e.target.value) })}
                        placeholder="(555) 555-5555"
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      />
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.sms_opt_in || false}
                          onChange={(e) => setFormData({ ...formData, sms_opt_in: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-pool-blue focus:ring-pool-blue"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Opt in to text message notifications</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time Zone</label>
                      <select
                        value={formData.registered_time_zone}
                        onChange={(e) => setFormData({ ...formData, registered_time_zone: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      >
                        {TIME_ZONES.map((tz) => (
                          <option key={tz.value || 'empty'} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                        {formData.registered_time_zone && !TIME_ZONES.some((tz) => tz.value === formData.registered_time_zone) && (
                          <option value={formData.registered_time_zone}>
                            {formData.registered_time_zone} (current)
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Role & Classification - Admin/Manager only when editing others; hidden when editing self as regular employee */}
              {!isEditingSelfOnly && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Role & Classification
                  {!canModifyPrivileges && (
                    <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">(Admin/Manager only)</span>
                  )}
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        User Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.user_type}
                        onChange={(e) => setFormData({ ...formData, user_type: e.target.value })}
                        required
                        disabled={!canModifyPrivileges}
                        className={`w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow ${
                          !canModifyPrivileges ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                      >
                        {USER_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Active
                      </label>
                      <button
                        type="button"
                        onClick={() => canModifyPrivileges && setFormData({ ...formData, current: !formData.current })}
                        disabled={!canModifyPrivileges}
                        className={`w-full px-4 py-2.5 rounded-lg border font-medium transition-all flex items-center justify-center gap-2 ${
                          !canModifyPrivileges ? 'opacity-60 cursor-not-allowed' : ''
                        } ${
                          formData.current 
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {formData.current ? (
                          <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Active
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Inactive
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* User Roles - Multi-select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">User Roles</label>
                    <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 ${!canModifyPrivileges ? 'opacity-60' : ''}`}>
                      {USER_ROLES.map((role) => {
                        const isSelected = formData.user_roles.includes(role.value)
                        return (
                          <label
                            key={role.value}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                              !canModifyPrivileges ? 'cursor-not-allowed' : 'cursor-pointer'
                            } ${
                              isSelected 
                                ? 'border-pool-blue bg-pool-light/30 dark:bg-pool-blue/20' 
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canModifyPrivileges}
                              onChange={(e) => {
                                if (!canModifyPrivileges) return
                                if (e.target.checked) {
                                  setFormData({ ...formData, user_roles: [...formData.user_roles, role.value] })
                                } else {
                                  setFormData({ ...formData, user_roles: formData.user_roles.filter(r => r !== role.value) })
                                }
                              }}
                              className="h-4 w-4 text-pool-blue focus:ring-pool-blue border-gray-300 rounded disabled:cursor-not-allowed"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{role.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Calendar Settings - Admin/Manager only when editing others; hidden when editing self as regular employee */}
              {!isEditingSelfOnly && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Calendar Settings
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Calendar Color</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-12 w-16 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#0ea5e9"
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Used for this employee's events on the calendar</p>
                </div>
              </div>
              )}

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingEmployee(null); resetForm(); }}
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
                  {editingEmployee ? 'Update Employee' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Last Logon
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Active
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Roles
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  TZ
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-2 py-8 text-center text-gray-500 dark:text-gray-400">
                    {employees.length === 0
                      ? 'No employees yet. Click "Add Employee" to get started.'
                      : 'No employees match your search criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((employee) => {
                  const roles = []
                  if (employee.is_project_manager) roles.push('PM')
                  if (employee.is_sales_person) roles.push('Sales')
                  if (employee.is_foreman) roles.push('Foreman')

                  return (
                    <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: employee.color || '#0ea5e9',
                            }}
                            title={`Calendar color: ${employee.color || '#0ea5e9'}`}
                          />
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{employee.name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white capitalize">
                          {USER_TYPES.find((t) => t.value === employee.user_type)?.label || employee.user_type}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {USER_ROLES.find((r) => r.value === employee.user_role)?.label || employee.user_role || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{employee.email_address}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">{employee.phone || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {employee.last_logon
                            ? new Date(employee.last_logon).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            employee.current
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {employee.current ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {roles.length > 0 ? (
                            roles.map((role, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">{employee.registered_time_zone ? employee.registered_time_zone.split('/')[1] || employee.registered_time_zone : '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div ref={openActionsId === employee.id ? actionsMenuRef : null}>
                          <ActionsMenu
                            isOpen={openActionsId === employee.id}
                            onToggle={() => setOpenActionsId((prev) => (prev === employee.id ? null : employee.id))}
                            onAction={() => setOpenActionsId(null)}
                            actions={[
                              { icon: DOCUMENT_ICON, label: 'Documents', iconColor: 'text-green-600 dark:text-green-400', onClick: () => { setSelectedEntityForDocuments({ id: employee.id, name: employee.name || 'Employee' }); setShowDocumentsModal(true) } },
                              ...(canEditEmployee(employee) ? [{ icon: EDIT_ICON, label: 'Edit', onClick: () => handleEdit(employee) }] : []),
                              ...(canModifyPrivileges ? [{ icon: DELETE_ICON, label: 'Delete', danger: true, onClick: () => handleDelete(employee.id) }] : []),
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
      {activeTab === 'employees' && filteredEmployees.length > itemsPerPage && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredEmployees.length)} of {filteredEmployees.length} employees
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
        </div>
      )}

      {activeTab === 'whitelist' && <EmailWhitelist />}

      {/* Documents Modal */}
      {showDocumentsModal && selectedEntityForDocuments && (
        <DocumentsModal
          entityType="employees"
          entityId={selectedEntityForDocuments.id}
          entityName={selectedEntityForDocuments.name}
          onClose={() => {
            setShowDocumentsModal(false)
            setSelectedEntityForDocuments(null)
          }}
          canUploadDocuments={canModifyPrivileges || selectedEntityForDocuments?.id === currentUserEmployee?.id}
          canDeleteDocuments={canModifyPrivileges || selectedEntityForDocuments?.id === currentUserEmployee?.id}
        />
      )}
    </div>
  )
}

export default Employees

