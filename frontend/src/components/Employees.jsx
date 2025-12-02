import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import EmailWhitelist from './EmailWhitelist'

const USER_TYPES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
]

const USER_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'sales', label: 'Sales' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'field_worker', label: 'Field Worker' },
  { value: 'office_staff', label: 'Office Staff' },
  { value: 'other', label: 'Other' },
]

function Employees() {
  const { user, supabase } = useAuth()
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

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    user_type: 'employee',
    user_role: '',
    email_address: '',
    phone: '',
    current: false,
    is_project_manager: false,
    is_sales_person: false,
    is_foreman: false,
    registered_time_zone: '',
    color: '#0ea5e9', // Default blue color
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setEmployees(response.data.employees || [])
      if (response.data.employees && response.data.employees.length > 0) {
        console.log('Fetched employees:', response.data.employees.length)
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
        is_project_manager: formData.is_project_manager || false,
        is_sales_person: formData.is_sales_person || false,
        is_foreman: formData.is_foreman || false,
        current: formData.current || false,
        color: formData.color && formData.color.trim() !== '' ? formData.color.trim() : null,
      }
      
      console.log('Sending payload:', payload)
      console.log('Color value in formData:', formData.color, 'Type:', typeof formData.color)
      console.log('Color value in payload:', payload.color)

      if (editingEmployee) {
        await axios.put(`/api/employees/${editingEmployee.id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setSuccess('Employee updated successfully!')
      } else {
        await axios.post('/api/employees', payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    setFormData({
      name: employee.name || '',
      user_type: employee.user_type || 'employee',
      user_role: employee.user_role || '',
      email_address: employee.email_address || '',
      phone: employee.phone || '',
      current: employee.current || false,
      is_project_manager: employee.is_project_manager || false,
      is_sales_person: employee.is_sales_person || false,
      is_foreman: employee.is_foreman || false,
      registered_time_zone: employee.registered_time_zone || '',
      color: employee.color || '#0ea5e9',
    })
    setShowForm(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      user_type: 'employee',
      user_role: '',
      email_address: '',
      phone: '',
      current: false,
      is_project_manager: false,
      is_sales_person: false,
      is_foreman: false,
      registered_time_zone: '',
      color: '#0ea5e9',
    })
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
        <h2 className="text-2xl font-bold text-gray-800">Employees</h2>
        <p className="text-gray-600 mt-1">Manage your employee database and email whitelist</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('employees')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'employees'
                ? 'border-pool-blue text-pool-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Employees
          </button>
          <button
            onClick={() => setActiveTab('whitelist')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'whitelist'
                ? 'border-pool-blue text-pool-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
              <h3 className="text-xl font-semibold text-gray-800">Employee Management</h3>
              <p className="text-gray-600 mt-1">Add, edit, and manage your employees</p>
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
      <div className="bg-white rounded-lg shadow p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, phone, user type, or role..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
          />
        </div>
      </div>

      {/* Employee Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingEmployee(null)
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
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User Type *
                    </label>
                    <select
                      value={formData.user_type}
                      onChange={(e) => setFormData({ ...formData, user_type: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    >
                      {USER_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User Role
                    </label>
                    <select
                      value={formData.user_role}
                      onChange={(e) => setFormData({ ...formData, user_role: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    >
                      <option value="">Select a role</option>
                      {USER_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.email_address}
                      onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>


                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registered Time Zone
                    </label>
                    <input
                      type="text"
                      value={formData.registered_time_zone}
                      onChange={(e) => setFormData({ ...formData, registered_time_zone: e.target.value })}
                      placeholder="e.g., PST, EST, UTC"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Calendar Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="h-10 w-20 border border-gray-300 rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        placeholder="#0ea5e9"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Color used for this employee's events on the calendar</p>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="current"
                      checked={formData.current}
                      onChange={(e) => setFormData({ ...formData, current: e.target.checked })}
                      className="h-4 w-4 text-pool-blue focus:ring-pool-blue border-gray-300 rounded"
                    />
                    <label htmlFor="current" className="ml-2 text-sm text-gray-700">
                      Current
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_project_manager"
                      checked={formData.is_project_manager}
                      onChange={(e) => setFormData({ ...formData, is_project_manager: e.target.checked })}
                      className="h-4 w-4 text-pool-blue focus:ring-pool-blue border-gray-300 rounded"
                    />
                    <label htmlFor="is_project_manager" className="ml-2 text-sm text-gray-700">
                      Project Manager
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_sales_person"
                      checked={formData.is_sales_person}
                      onChange={(e) => setFormData({ ...formData, is_sales_person: e.target.checked })}
                      className="h-4 w-4 text-pool-blue focus:ring-pool-blue border-gray-300 rounded"
                    />
                    <label htmlFor="is_sales_person" className="ml-2 text-sm text-gray-700">
                      Sales Person
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_foreman"
                      checked={formData.is_foreman}
                      onChange={(e) => setFormData({ ...formData, is_foreman: e.target.checked })}
                      className="h-4 w-4 text-pool-blue focus:ring-pool-blue border-gray-300 rounded"
                    />
                    <label htmlFor="is_foreman" className="ml-2 text-sm text-gray-700">
                      Foreman
                    </label>
                  </div>

                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingEmployee(null)
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
                    {editingEmployee ? 'Update Employee' : 'Add Employee'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Logon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time Zone
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-gray-500">
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
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: employee.color || '#0ea5e9',
                            }}
                            title={`Calendar color: ${employee.color || '#0ea5e9'}`}
                          />
                          <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">
                          {USER_TYPES.find((t) => t.value === employee.user_type)?.label || employee.user_type}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {USER_ROLES.find((r) => r.value === employee.user_role)?.label || employee.user_role || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{employee.email_address}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{employee.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {employee.last_logon
                            ? new Date(employee.last_logon).toLocaleString()
                            : 'Never'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            employee.current
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {employee.current ? 'Current' : 'Not Current'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {roles.length > 0 ? (
                            roles.map((role, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{employee.registered_time_zone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="text-pool-blue hover:text-pool-dark mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(employee.id)}
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

      {/* Pagination */}
      {activeTab === 'employees' && filteredEmployees.length > itemsPerPage && (
        <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredEmployees.length)} of {filteredEmployees.length} employees
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
        </div>
      )}

      {activeTab === 'whitelist' && <EmailWhitelist />}
    </div>
  )
}

export default Employees

