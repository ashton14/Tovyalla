import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

// Helper function to format date string (YYYY-MM-DD) to local date without timezone issues
const formatDateString = (dateString) => {
  if (!dateString) return '-'
  
  try {
    // Handle various date formats - extract just the date part (YYYY-MM-DD)
    let dateOnly = String(dateString).trim()
    
    // Remove any time component (handle ISO strings with time)
    if (dateOnly.includes('T')) {
      dateOnly = dateOnly.split('T')[0]
    }
    
    // Handle space-separated dates
    if (dateOnly.includes(' ')) {
      dateOnly = dateOnly.split(' ')[0]
    }
    
    // Split by hyphen
    const parts = dateOnly.split('-')
    
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)
      
      // Validate the date values
      if (isNaN(year) || isNaN(month) || isNaN(day) || year < 1900 || year > 2100) {
        console.warn('Invalid date values:', { dateString, year, month, day })
        return dateString
      }
      
      // Format directly without Date object to avoid ANY timezone conversion
      // This ensures the date displayed matches exactly what's in the database
      // Returns format like "1/15/2024"
      return `${month}/${day}/${year}`
    }
  } catch (error) {
    console.error('Error formatting date:', dateString, error)
  }
  
  // Fallback: return as-is if we can't parse it
  return String(dateString)
}

function ProjectExpenses({ project, onClose }) {
  const { user, supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState(null)
  const [subcontractors, setSubcontractors] = useState([])
  const [inventory, setInventory] = useState([])
  
  // Form states
  const [showSubcontractorForm, setShowSubcontractorForm] = useState(false)
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [showAdditionalForm, setShowAdditionalForm] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState(null)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [editingAdditional, setEditingAdditional] = useState(null)
  
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [subcontractorForm, setSubcontractorForm] = useState({
    subcontractor_id: '',
    hours: '',
    rate: '',
    date_worked: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const [materialForm, setMaterialForm] = useState({
    inventory_id: '',
    quantity: '',
    unit_cost: '',
    date_used: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const [additionalForm, setAdditionalForm] = useState({
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: '',
    notes: '',
  })

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Fetch expenses
  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const response = await axios.get(`/api/projects/${project.id}/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setExpenses(response.data)
    } catch (err) {
      console.error('Error fetching expenses:', err)
      setError(err.response?.data?.error || 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  // Fetch subcontractors and inventory for dropdowns
  useEffect(() => {
    const fetchData = async () => {
      const token = await getAuthToken()
      if (!token) return

      try {
        const [subsRes, invRes] = await Promise.all([
          axios.get('/api/subcontractors', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get('/api/inventory', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        setSubcontractors(subsRes.data.subcontractors || [])
        setInventory(invRes.data.materials || [])
      } catch (err) {
        console.error('Error fetching data:', err)
      }
    }

    if (user) {
      fetchData()
      fetchExpenses()
    }
  }, [user, project])

  // Handle subcontractor hours
  const handleSubcontractorSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const payload = {
        ...subcontractorForm,
        hours: parseFloat(subcontractorForm.hours),
        rate: subcontractorForm.rate ? parseFloat(subcontractorForm.rate) : undefined,
      }

      if (editingSubcontractor) {
        await axios.put(
          `/api/projects/${project.id}/expenses/subcontractor-hours/${editingSubcontractor.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Subcontractor hours updated!')
      } else {
        await axios.post(
          `/api/projects/${project.id}/expenses/subcontractor-hours`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Subcontractor hours added!')
      }

      // Close form and reset state
      setShowSubcontractorForm(false)
      setEditingSubcontractor(null)
      setSubcontractorForm({
        subcontractor_id: '',
        hours: '',
        rate: '',
        date_worked: new Date().toISOString().split('T')[0],
        notes: '',
      })
      
      // Refetch expenses to get updated data
      await fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save subcontractor hours')
    }
  }

  const handleSubcontractorEdit = (entry) => {
    setEditingSubcontractor(entry)
    // Extract date part only (YYYY-MM-DD) to avoid timezone issues
    const dateWorked = entry.date_worked ? entry.date_worked.split('T')[0] : ''
    setSubcontractorForm({
      subcontractor_id: entry.subcontractor_id,
      hours: entry.hours,
      rate: entry.rate || entry.subcontractors?.rate || '',
      date_worked: dateWorked,
      notes: entry.notes || '',
    })
    setShowSubcontractorForm(true)
  }

  // Auto-fill rate when subcontractor is selected
  const handleSubcontractorSelect = (subcontractorId) => {
    const sub = subcontractors.find((s) => s.id === subcontractorId)
    if (sub && sub.rate && !subcontractorForm.rate) {
      setSubcontractorForm({ ...subcontractorForm, subcontractor_id: subcontractorId, rate: sub.rate })
    } else {
      setSubcontractorForm({ ...subcontractorForm, subcontractor_id: subcontractorId })
    }
  }

  const handleSubcontractorDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(
        `/api/projects/${project.id}/expenses/subcontractor-hours/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setSuccess('Entry deleted!')
      await fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete entry')
    }
  }

  // Handle materials
  const handleMaterialSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const invItem = inventory.find((item) => item.id === materialForm.inventory_id)
      const unitCost = materialForm.unit_cost || (invItem ? invItem.unit_price : 0)

      const payload = {
        ...materialForm,
        quantity: parseFloat(materialForm.quantity),
        unit_cost: parseFloat(unitCost),
      }

      if (editingMaterial) {
        await axios.put(
          `/api/projects/${project.id}/expenses/materials/${editingMaterial.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Material updated!')
      } else {
        await axios.post(
          `/api/projects/${project.id}/expenses/materials`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Material added!')
      }

      setShowMaterialForm(false)
      setEditingMaterial(null)
      setMaterialForm({
        inventory_id: '',
        quantity: '',
        unit_cost: '',
        date_used: new Date().toISOString().split('T')[0],
        notes: '',
      })
      
      // Refetch expenses to get updated data
      await fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save material')
    }
  }

  const handleMaterialEdit = (entry) => {
    setEditingMaterial(entry)
    // Extract date part only (YYYY-MM-DD) to avoid timezone issues
    const dateUsed = entry.date_used ? entry.date_used.split('T')[0] : ''
    setMaterialForm({
      inventory_id: entry.inventory_id,
      quantity: entry.quantity,
      unit_cost: entry.unit_cost,
      date_used: dateUsed,
      notes: entry.notes || '',
    })
    setShowMaterialForm(true)
  }

  const handleMaterialDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(
        `/api/projects/${project.id}/expenses/materials/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setSuccess('Entry deleted!')
      await fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete entry')
    }
  }

  // Handle additional expenses
  const handleAdditionalSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const payload = {
        ...additionalForm,
        amount: parseFloat(additionalForm.amount),
      }

      if (editingAdditional) {
        await axios.put(
          `/api/projects/${project.id}/expenses/additional/${editingAdditional.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Expense updated!')
      } else {
        await axios.post(
          `/api/projects/${project.id}/expenses/additional`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Expense added!')
      }

      setShowAdditionalForm(false)
      setEditingAdditional(null)
      setAdditionalForm({
        description: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        category: '',
        notes: '',
      })
      
      // Refetch expenses to get updated data
      await fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save expense')
    }
  }

  const handleAdditionalEdit = (entry) => {
    setEditingAdditional(entry)
    // Extract date part only (YYYY-MM-DD) to avoid timezone issues
    const expenseDate = entry.expense_date ? entry.expense_date.split('T')[0] : ''
    setAdditionalForm({
      description: entry.description,
      amount: entry.amount,
      expense_date: expenseDate,
      category: entry.category || '',
      notes: entry.notes || '',
    })
    setShowAdditionalForm(true)
  }

  const handleAdditionalDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(
        `/api/projects/${project.id}/expenses/additional/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setSuccess('Expense deleted!')
      await fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete expense')
    }
  }

  // Auto-fill unit cost when inventory item is selected
  const handleInventorySelect = (inventoryId) => {
    const item = inventory.find((i) => i.id === inventoryId)
    if (item) {
      // Default to unit_price from inventory if unit_cost is empty (when adding new or when field is cleared)
      const unitCost = (!materialForm.unit_cost && item.unit_price) ? item.unit_price : materialForm.unit_cost
      setMaterialForm({ ...materialForm, inventory_id: inventoryId, unit_cost: unitCost })
    } else {
      setMaterialForm({ ...materialForm, inventory_id: inventoryId })
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pool-blue mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!expenses) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <p className="text-red-600">Failed to load expenses</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-300 rounded-md">
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totals = expenses.totals || {}
  const projectData = expenses.project || {}

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Project Expenses</h2>
              <p className="text-gray-600">{project.address || 'Project'}</p>
            </div>
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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Est. Value</p>
              <p className="text-xl font-bold text-gray-900">
                ${projectData.estValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-xl font-bold text-red-600">
                ${totals.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Profit</p>
              <p className={`text-xl font-bold ${projectData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${projectData.profit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Profit Margin</p>
              <p className={`text-xl font-bold ${projectData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {projectData.estValue > 0
                  ? `${((projectData.profit / projectData.estValue) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 font-medium">Subcontractors</p>
              <p className="text-lg font-bold text-blue-900">
                ${totals.subcontractors?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-700 font-medium">Materials</p>
              <p className="text-lg font-bold text-purple-900">
                ${totals.materials?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-700 font-medium">Additional</p>
              <p className="text-lg font-bold text-orange-900">
                ${totals.additional?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
          </div>

          {/* Tabs/Sections */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => {
                  setShowSubcontractorForm(true)
                  setEditingSubcontractor(null)
                  setSubcontractorForm({
                    subcontractor_id: '',
                    hours: '',
                    rate: '',
                    date_worked: new Date().toISOString().split('T')[0],
                    notes: '',
                  })
                }}
                className="py-2 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
              >
                + Subcontractor Hours
              </button>
              <button
                onClick={() => {
                  setShowMaterialForm(true)
                  setEditingMaterial(null)
                  setMaterialForm({
                    inventory_id: '',
                    quantity: '',
                    unit_cost: '',
                    date_used: new Date().toISOString().split('T')[0],
                    notes: '',
                  })
                }}
                className="py-2 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
              >
                + Material
              </button>
              <button
                onClick={() => {
                  setShowAdditionalForm(true)
                  setEditingAdditional(null)
                  setAdditionalForm({
                    description: '',
                    amount: '',
                    expense_date: new Date().toISOString().split('T')[0],
                    category: '',
                    notes: '',
                  })
                }}
                className="py-2 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
              >
                + Additional Expense
              </button>
            </nav>
          </div>

          {/* Subcontractor Hours List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Subcontractor Hours</h3>
            {expenses.subcontractorHours && expenses.subcontractorHours.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subcontractor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenses.subcontractorHours.map((entry) => {
                      // Use stored rate if available, otherwise fall back to subcontractor's default rate
                      const rate = entry.rate || entry.subcontractors?.rate || 0
                      const total = parseFloat(entry.hours || 0) * parseFloat(rate)
                      return (
                        <tr key={entry.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.subcontractors?.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDateString(entry.date_worked)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.hours}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">${parseFloat(rate).toFixed(2)}/hr</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">${total.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <button
                              onClick={() => handleSubcontractorEdit(entry)}
                              className="text-pool-blue hover:text-pool-dark mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleSubcontractorDelete(entry.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No subcontractor hours logged yet.</p>
            )}
          </div>

          {/* Materials List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Materials Used</h3>
            {expenses.materials && expenses.materials.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenses.materials.map((entry) => {
                      const total = parseFloat(entry.quantity || 0) * parseFloat(entry.unit_cost || 0)
                      return (
                        <tr key={entry.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.inventory?.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDateString(entry.date_used)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.quantity} {entry.inventory?.unit || ''}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">${parseFloat(entry.unit_cost).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">${total.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <button
                              onClick={() => handleMaterialEdit(entry)}
                              className="text-pool-blue hover:text-pool-dark mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleMaterialDelete(entry.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No materials used yet.</p>
            )}
          </div>

          {/* Additional Expenses List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Additional Expenses</h3>
            {expenses.additionalExpenses && expenses.additionalExpenses.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenses.additionalExpenses.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDateString(entry.expense_date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{entry.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{entry.category || '-'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">${parseFloat(entry.amount).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <button
                            onClick={() => handleAdditionalEdit(entry)}
                            className="text-pool-blue hover:text-pool-dark mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleAdditionalDelete(entry.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No additional expenses yet.</p>
            )}
          </div>

          {/* Forms will be rendered as modals */}
          {/* Subcontractor Form Modal */}
          {showSubcontractorForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">
                      {editingSubcontractor ? 'Edit' : 'Add'} Subcontractor Hours
                    </h3>
                    <button
                      onClick={() => {
                        setShowSubcontractorForm(false)
                        setEditingSubcontractor(null)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSubcontractorSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subcontractor *</label>
                      <select
                        value={subcontractorForm.subcontractor_id}
                        onChange={(e) => handleSubcontractorSelect(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      >
                        <option value="">Select subcontractor...</option>
                        {subcontractors.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name} (${sub.rate ? parseFloat(sub.rate).toFixed(2) : '0.00'}/hr)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hours *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={subcontractorForm.hours}
                          onChange={(e) => setSubcontractorForm({ ...subcontractorForm, hours: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($/hr) *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={subcontractorForm.rate}
                          onChange={(e) => setSubcontractorForm({ ...subcontractorForm, rate: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                          placeholder="0.00"
                        />
                        {subcontractorForm.subcontractor_id && (
                          <p className="mt-1 text-xs text-gray-500">
                            Default: ${subcontractors.find((s) => s.id === subcontractorForm.subcontractor_id)?.rate ? parseFloat(subcontractors.find((s) => s.id === subcontractorForm.subcontractor_id).rate).toFixed(2) : '0.00'}/hr
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                        <input
                          type="date"
                          value={subcontractorForm.date_worked}
                          onChange={(e) => setSubcontractorForm({ ...subcontractorForm, date_worked: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={subcontractorForm.notes}
                        onChange={(e) => setSubcontractorForm({ ...subcontractorForm, notes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSubcontractorForm(false)
                          setEditingSubcontractor(null)
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md"
                      >
                        {editingSubcontractor ? 'Update' : 'Add'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Material Form Modal */}
          {showMaterialForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">
                      {editingMaterial ? 'Edit' : 'Add'} Material
                    </h3>
                    <button
                      onClick={() => {
                        setShowMaterialForm(false)
                        setEditingMaterial(null)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleMaterialSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
                      <select
                        value={materialForm.inventory_id}
                        onChange={(e) => handleInventorySelect(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      >
                        <option value="">Select material...</option>
                        {inventory.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} {item.unit_price ? `($${parseFloat(item.unit_price).toFixed(2)})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={materialForm.quantity}
                          onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost ($) *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={materialForm.unit_cost}
                          onChange={(e) => setMaterialForm({ ...materialForm, unit_cost: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Used *</label>
                      <input
                        type="date"
                        value={materialForm.date_used}
                        onChange={(e) => setMaterialForm({ ...materialForm, date_used: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={materialForm.notes}
                        onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMaterialForm(false)
                          setEditingMaterial(null)
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md"
                      >
                        {editingMaterial ? 'Update' : 'Add'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Additional Expense Form Modal */}
          {showAdditionalForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">
                      {editingAdditional ? 'Edit' : 'Add'} Additional Expense
                    </h3>
                    <button
                      onClick={() => {
                        setShowAdditionalForm(false)
                        setEditingAdditional(null)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleAdditionalSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                      <input
                        type="text"
                        value={additionalForm.description}
                        onChange={(e) => setAdditionalForm({ ...additionalForm, description: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={additionalForm.amount}
                          onChange={(e) => setAdditionalForm({ ...additionalForm, amount: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                        <input
                          type="date"
                          value={additionalForm.expense_date}
                          onChange={(e) => setAdditionalForm({ ...additionalForm, expense_date: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <input
                        type="text"
                        value={additionalForm.category}
                        onChange={(e) => setAdditionalForm({ ...additionalForm, category: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                        placeholder="e.g., Equipment, Permit, Travel"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={additionalForm.notes}
                        onChange={(e) => setAdditionalForm({ ...additionalForm, notes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdditionalForm(false)
                          setEditingAdditional(null)
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md"
                      >
                        {editingAdditional ? 'Update' : 'Add'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectExpenses

