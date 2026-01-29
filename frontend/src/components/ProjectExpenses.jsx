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
    flat_fee: '',
    expected_value: '',
    date_added: new Date().toISOString().split('T')[0],
    status: 'incomplete',
    notes: '',
    job_description: '',
  })

  const [materialForm, setMaterialForm] = useState({
    inventory_id: '',
    quantity: '',
    date_ordered: new Date().toISOString().split('T')[0],
    date_received: '',
    status: 'incomplete',
    expected_price: '',
    actual_price: '',
    notes: '',
  })

  const [additionalForm, setAdditionalForm] = useState({
    description: '',
    amount: '',
    expected_value: '',
    expense_date: new Date().toISOString().split('T')[0],
    status: 'incomplete',
    category: '',
    notes: '',
  })

  const [showEquipmentForm, setShowEquipmentForm] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState(null)
  const [equipmentForm, setEquipmentForm] = useState({
    inventory_id: '',
    quantity: '1',
    date_ordered: new Date().toISOString().split('T')[0],
    date_received: '',
    status: 'pending',
    expected_price: '',
    actual_price: '',
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
        // Store all inventory items
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

  // Handle subcontractor fee
  const handleSubcontractorSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const payload = {
        ...subcontractorForm,
        flat_fee: subcontractorForm.flat_fee ? parseFloat(subcontractorForm.flat_fee) : null,
        expected_value: subcontractorForm.expected_value ? parseFloat(subcontractorForm.expected_value) : null,
      }

      if (editingSubcontractor) {
        await axios.put(
          `/api/projects/${project.id}/expenses/subcontractor-fees/${editingSubcontractor.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Subcontractor fee updated!')
      } else {
        await axios.post(
          `/api/projects/${project.id}/expenses/subcontractor-fees`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Subcontractor fee added!')
      }

      // Close form and reset state
      setShowSubcontractorForm(false)
      setEditingSubcontractor(null)
      setSubcontractorForm({
        subcontractor_id: '',
        flat_fee: '',
        expected_value: '',
        date_added: new Date().toISOString().split('T')[0],
        status: 'incomplete',
        notes: '',
        job_description: '',
      })
      
      // Refetch expenses to get updated data
      await fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save subcontractor fee')
    }
  }

  const handleSubcontractorEdit = (entry) => {
    setEditingSubcontractor(entry)
    // Extract date part only (YYYY-MM-DD) to avoid timezone issues
    const dateAdded = entry.date_added ? entry.date_added.split('T')[0] : ''
    setSubcontractorForm({
      subcontractor_id: entry.subcontractor_id,
      flat_fee: entry.flat_fee || '',
      expected_value: entry.expected_value || '',
      date_added: dateAdded,
      status: entry.status || 'incomplete',
      notes: entry.notes || '',
      job_description: entry.job_description || '',
    })
    setShowSubcontractorForm(true)
  }

  const handleSubcontractorSelect = (subcontractorId) => {
    setSubcontractorForm({ ...subcontractorForm, subcontractor_id: subcontractorId })
  }

  const handleSubcontractorDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(
        `/api/projects/${project.id}/expenses/subcontractor-fees/${id}`,
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

      const payload = {
        inventory_id: materialForm.inventory_id,
        quantity: materialForm.quantity ? parseFloat(materialForm.quantity) : null,
        date_ordered: materialForm.date_ordered || null,
        date_received: materialForm.date_received || null,
        status: materialForm.status || 'incomplete',
        expected_price: materialForm.expected_price ? parseFloat(materialForm.expected_price) : null,
        actual_price: materialForm.actual_price ? parseFloat(materialForm.actual_price) : null,
        notes: materialForm.notes || null,
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
        date_ordered: new Date().toISOString().split('T')[0],
        date_received: '',
        status: 'incomplete',
        expected_price: '',
        actual_price: '',
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
    const dateOrdered = entry.date_ordered ? entry.date_ordered.split('T')[0] : (entry.date_used ? entry.date_used.split('T')[0] : '')
    const dateReceived = entry.date_received ? entry.date_received.split('T')[0] : ''
    setMaterialForm({
      inventory_id: entry.inventory_id,
      quantity: entry.quantity || '',
      date_ordered: dateOrdered,
      date_received: dateReceived,
      status: entry.status || 'incomplete',
      expected_price: entry.expected_price || entry.expected_value || '',
      actual_price: entry.actual_price || (entry.unit_cost && entry.quantity ? (parseFloat(entry.unit_cost) * parseFloat(entry.quantity)).toFixed(2) : ''),
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
        amount: additionalForm.amount ? parseFloat(additionalForm.amount) : null,
        expected_value: additionalForm.expected_value ? parseFloat(additionalForm.expected_value) : null,
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
        expected_value: '',
        expense_date: new Date().toISOString().split('T')[0],
        status: 'incomplete',
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
      amount: entry.amount || '',
      expected_value: entry.expected_value || '',
      expense_date: expenseDate,
      status: entry.status || 'incomplete',
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

  // Handle equipment
  const handleEquipmentSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      const payload = {
        inventory_id: equipmentForm.inventory_id,
        expected_price: equipmentForm.expected_price ? parseFloat(equipmentForm.expected_price) : null,
        actual_price: equipmentForm.actual_price ? parseFloat(equipmentForm.actual_price) : null,
        quantity: equipmentForm.quantity ? parseInt(equipmentForm.quantity) : 1,
        date_ordered: equipmentForm.date_ordered || null,
        date_received: equipmentForm.date_received || null,
        status: equipmentForm.status || 'pending',
        notes: equipmentForm.notes || null,
      }

      if (editingEquipment) {
        await axios.put(
          `/api/projects/${project.id}/expenses/equipment/${editingEquipment.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Equipment updated!')
      } else {
        await axios.post(
          `/api/projects/${project.id}/expenses/equipment`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuccess('Equipment added!')
      }

      setShowEquipmentForm(false)
      setEditingEquipment(null)
      setEquipmentForm({
        inventory_id: '',
        quantity: '1',
        date_ordered: new Date().toISOString().split('T')[0],
        date_received: '',
        status: 'pending',
        expected_price: '',
        actual_price: '',
        notes: '',
      })

      await fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save equipment')
    }
  }

  const handleEquipmentEdit = (entry) => {
    setEditingEquipment(entry)
    const dateOrdered = entry.date_ordered ? entry.date_ordered.split('T')[0] : ''
    const dateReceived = entry.date_received ? entry.date_received.split('T')[0] : ''
    setEquipmentForm({
      inventory_id: entry.inventory_id || '',
      expected_price: entry.expected_price || '',
      actual_price: entry.actual_price || '',
      quantity: entry.quantity || '1',
      date_ordered: dateOrdered,
      date_received: dateReceived,
      status: entry.status || 'pending',
      notes: entry.notes || '',
    })
    setShowEquipmentForm(true)
  }

  const handleEquipmentDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this equipment?')) return

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')

      await axios.delete(
        `/api/projects/${project.id}/expenses/equipment/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setSuccess('Equipment deleted!')
      await fetchExpenses()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete equipment')
    }
  }

  // Handle inventory selection for materials
  const handleMaterialInventorySelect = (inventoryId) => {
    const item = inventory.find((i) => i.id === inventoryId)
    if (item && item.unit_price) {
      const unitPrice = parseFloat(item.unit_price)
      const quantity = parseFloat(materialForm.quantity) || 1
      const calculatedPrice = (unitPrice * quantity).toFixed(2)
      setMaterialForm({ 
        ...materialForm, 
        inventory_id: inventoryId,
        expected_price: materialForm.expected_price || calculatedPrice,
        actual_price: materialForm.actual_price || calculatedPrice,
      })
    } else {
      setMaterialForm({ ...materialForm, inventory_id: inventoryId })
    }
  }

  // Handle quantity change for materials - autofill prices
  const handleMaterialQuantityChange = (quantity) => {
    const item = inventory.find((i) => i.id === materialForm.inventory_id)
    if (item && item.unit_price) {
      const unitPrice = parseFloat(item.unit_price)
      const qty = parseFloat(quantity) || 0
      const calculatedPrice = (unitPrice * qty).toFixed(2)
      setMaterialForm({ 
        ...materialForm, 
        quantity: quantity,
        expected_price: calculatedPrice,
        actual_price: calculatedPrice,
      })
    } else {
      setMaterialForm({ ...materialForm, quantity: quantity })
    }
  }

  // Handle inventory selection for equipment
  const handleEquipmentInventorySelect = (inventoryId) => {
    const item = inventory.find((i) => i.id === inventoryId)
    if (item && item.unit_price) {
      const unitPrice = parseFloat(item.unit_price)
      const quantity = parseFloat(equipmentForm.quantity) || 1
      const calculatedPrice = (unitPrice * quantity).toFixed(2)
      setEquipmentForm({ 
        ...equipmentForm, 
        inventory_id: inventoryId,
        expected_price: equipmentForm.expected_price || calculatedPrice,
        actual_price: equipmentForm.actual_price || calculatedPrice,
      })
    } else {
      setEquipmentForm({ ...equipmentForm, inventory_id: inventoryId })
    }
  }

  // Handle quantity change for equipment - autofill prices
  const handleEquipmentQuantityChange = (quantity) => {
    const item = inventory.find((i) => i.id === equipmentForm.inventory_id)
    if (item && item.unit_price) {
      const unitPrice = parseFloat(item.unit_price)
      const qty = parseFloat(quantity) || 0
      const calculatedPrice = (unitPrice * qty).toFixed(2)
      setEquipmentForm({ 
        ...equipmentForm, 
        quantity: quantity,
        expected_price: calculatedPrice,
        actual_price: calculatedPrice,
      })
    } else {
      setEquipmentForm({ ...equipmentForm, quantity: quantity })
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Project Expenses</h2>
              <p className="text-gray-600">{project.address || 'Project'}</p>
            </div>
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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Est. Value</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${projectData.estValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Closing Price</p>
              <p className="text-xl font-bold text-pool-blue">
                {projectData.closingPrice > 0 
                  ? `$${projectData.closingPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '-'}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Expected Expenses</p>
              <p className="text-xl font-bold text-orange-600">
                ${totals.totalExpected?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Actual Expenses</p>
              <p className="text-xl font-bold text-red-600">
                ${totals.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Profit</p>
              <p className={`text-xl font-bold ${projectData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${projectData.profit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Profit Margin</p>
              <p className={`text-xl font-bold ${projectData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(() => {
                  const revenue = (projectData.closingPrice > 0 ? projectData.closingPrice : projectData.estValue) || 0;
                  return revenue > 0 ? `${((projectData.profit / revenue) * 100).toFixed(1)}%` : '0%';
                })()}
              </p>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 font-medium">Subcontractors</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-blue-600">Expected</p>
                  <p className="text-sm text-blue-800">
                    ${totals.subcontractorsExpected?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-600">Actual</p>
                  <p className="text-lg font-bold text-blue-900">
                    ${totals.subcontractors?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-700 font-medium">Materials</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-purple-600">Expected</p>
                  <p className="text-sm text-purple-800">
                    ${totals.materialsExpected?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-purple-600">Actual</p>
                  <p className="text-lg font-bold text-purple-900">
                    ${totals.materials?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-700 font-medium">Equipment</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-orange-600">Expected</p>
                  <p className="text-sm text-orange-800">
                    ${totals.equipmentExpected?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-orange-600">Actual</p>
                  <p className="text-lg font-bold text-orange-900">
                    ${totals.equipment?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <p className="text-sm text-teal-700 font-medium">Additional</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-teal-600">Expected</p>
                  <p className="text-sm text-teal-800">
                    ${totals.additionalExpected?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-teal-600">Actual</p>
                  <p className="text-lg font-bold text-teal-900">
                    ${totals.additional?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Add Expense Buttons */}
          <div className="mb-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Add Expense</p>
            
            {/* Mobile: Grid with colored buttons */}
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              <button
                onClick={() => {
                  setShowSubcontractorForm(true)
                  setEditingSubcontractor(null)
                  setSubcontractorForm({
                    subcontractor_id: '',
                    flat_fee: '',
                    expected_value: '',
                    date_added: new Date().toISOString().split('T')[0],
                    status: 'incomplete',
                    notes: '',
                  })
                }}
                className="px-3 py-2 text-xs font-medium text-pool-blue bg-pool-light hover:bg-pool-blue hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Sub
              </button>
              <button
                onClick={() => {
                  setShowMaterialForm(true)
                  setEditingMaterial(null)
                  setMaterialForm({
                    inventory_id: '',
                    quantity: '',
                    unit_cost: '',
                    expected_value: '',
                    date_used: new Date().toISOString().split('T')[0],
                    status: 'incomplete',
                    notes: '',
                  })
                }}
                className="px-3 py-2 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-600 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Material
              </button>
              <button
                onClick={() => {
                  setShowEquipmentForm(true)
                  setEditingEquipment(null)
                  setEquipmentForm({
                    inventory_id: '',
                    description: '',
                    expected_price: '',
                    actual_price: '',
                    quantity: '1',
                    date_ordered: new Date().toISOString().split('T')[0],
                    date_received: '',
                    status: 'pending',
                    notes: '',
                  })
                }}
                className="px-3 py-2 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-600 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Equipment
              </button>
              <button
                onClick={() => {
                  setShowAdditionalForm(true)
                  setEditingAdditional(null)
                  setAdditionalForm({
                    description: '',
                    amount: '',
                    expected_value: '',
                    expense_date: new Date().toISOString().split('T')[0],
                    status: 'incomplete',
                    category: '',
                    notes: '',
                  })
                }}
                className="px-3 py-2 text-xs font-medium text-teal-700 bg-teal-100 hover:bg-teal-600 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Other
              </button>
            </div>

            {/* Desktop: Simple text links */}
            <div className="hidden sm:flex sm:flex-wrap gap-6">
              <button
                onClick={() => {
                  setShowSubcontractorForm(true)
                  setEditingSubcontractor(null)
                  setSubcontractorForm({
                    subcontractor_id: '',
                    flat_fee: '',
                    expected_value: '',
                    date_added: new Date().toISOString().split('T')[0],
                    status: 'incomplete',
                    notes: '',
                  })
                }}
                className="text-sm font-medium text-pool-blue hover:text-pool-dark flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Subcontractor
              </button>
              <button
                onClick={() => {
                  setShowMaterialForm(true)
                  setEditingMaterial(null)
                  setMaterialForm({
                    inventory_id: '',
                    quantity: '',
                    unit_cost: '',
                    expected_value: '',
                    date_used: new Date().toISOString().split('T')[0],
                    status: 'incomplete',
                    notes: '',
                  })
                }}
                className="text-sm font-medium text-pool-blue hover:text-pool-dark flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Material
              </button>
              <button
                onClick={() => {
                  setShowEquipmentForm(true)
                  setEditingEquipment(null)
                  setEquipmentForm({
                    inventory_id: '',
                    description: '',
                    expected_price: '',
                    actual_price: '',
                    quantity: '1',
                    date_ordered: new Date().toISOString().split('T')[0],
                    date_received: '',
                    status: 'pending',
                    notes: '',
                  })
                }}
                className="text-sm font-medium text-pool-blue hover:text-pool-dark flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Equipment
              </button>
              <button
                onClick={() => {
                  setShowAdditionalForm(true)
                  setEditingAdditional(null)
                  setAdditionalForm({
                    description: '',
                    amount: '',
                    expected_value: '',
                    expense_date: new Date().toISOString().split('T')[0],
                    status: 'incomplete',
                    category: '',
                    notes: '',
                  })
                }}
                className="text-sm font-medium text-pool-blue hover:text-pool-dark flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Additional
              </button>
            </div>
          </div>

          {/* Subcontractor Fees List */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Subcontractor Fees</h3>
            {expenses.subcontractorFees && expenses.subcontractorFees.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Subcontractor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Job Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expected</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actual Fee</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                    {expenses.subcontractorFees.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{entry.subcontractors?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{entry.job_description || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDateString(entry.date_added)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            entry.status === 'complete' ? 'bg-green-100 text-green-800' :
                            entry.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.status === 'in_progress' ? 'In Progress' : 
                             entry.status === 'complete' ? 'Complete' : 'Incomplete'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {entry.expected_value ? `$${parseFloat(entry.expected_value).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {entry.flat_fee ? `$${parseFloat(entry.flat_fee).toFixed(2)}` : '-'}
                        </td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No subcontractor fees logged yet.</p>
            )}
          </div>

          {/* Materials List */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Materials</h3>
            {expenses.materials && expenses.materials.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ordered</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Received</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expected</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actual</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                    {expenses.materials.map((entry) => {
                      const expectedPrice = parseFloat(entry.expected_price || 0)
                      const actualPrice = parseFloat(entry.actual_price || 0)
                      return (
                        <tr key={entry.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.inventory?.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDateString(entry.date_ordered) || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDateString(entry.date_received) || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              entry.status === 'complete' ? 'bg-green-100 text-green-800' :
                              entry.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {entry.status === 'in_progress' ? 'In Progress' : 
                               entry.status === 'complete' ? 'Complete' : 'Incomplete'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {entry.quantity ? `${entry.quantity} ${entry.inventory?.unit || ''}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {expectedPrice > 0 ? `$${expectedPrice.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {actualPrice > 0 ? `$${actualPrice.toFixed(2)}` : '-'}
                          </td>
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
              <p className="text-gray-500 text-sm">No materials added yet.</p>
            )}
          </div>

          {/* Equipment List */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Equipment</h3>
            {expenses.equipment && expenses.equipment.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ordered</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Received</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expected</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actual</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                    {expenses.equipment.map((entry) => {
                      const expectedTotal = parseFloat(entry.expected_price || 0)
                      const actualTotal = parseFloat(entry.actual_price || 0)
                      return (
                        <tr key={entry.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.inventory?.name || entry.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDateString(entry.date_ordered) || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDateString(entry.date_received) || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              entry.status === 'complete' ? 'bg-green-100 text-green-800' :
                              entry.status === 'installed' ? 'bg-blue-100 text-blue-800' :
                              entry.status === 'received' ? 'bg-teal-100 text-teal-800' :
                              entry.status === 'ordered' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {entry.status === 'pending' ? 'Pending' :
                               entry.status === 'ordered' ? 'Ordered' :
                               entry.status === 'received' ? 'Received' :
                               entry.status === 'installed' ? 'Installed' :
                               'Complete'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.quantity || 1}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {expectedTotal > 0 ? `$${expectedTotal.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {actualTotal > 0 ? `$${actualTotal.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <button
                              onClick={() => handleEquipmentEdit(entry)}
                              className="text-pool-blue hover:text-pool-dark mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleEquipmentDelete(entry.id)}
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
              <p className="text-gray-500 text-sm">No equipment added yet.</p>
            )}
          </div>

           {/* Additional Expenses List */}
           <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Additional Expenses</h3>
            {expenses.additionalExpenses && expenses.additionalExpenses.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expected</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actual</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700">
                    {expenses.additionalExpenses.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDateString(entry.expense_date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{entry.description}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            entry.status === 'complete' ? 'bg-green-100 text-green-800' :
                            entry.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.status === 'in_progress' ? 'In Progress' : 
                             entry.status === 'complete' ? 'Complete' : 'Incomplete'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{entry.category || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {entry.expected_value ? `$${parseFloat(entry.expected_value).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {entry.amount ? `$${parseFloat(entry.amount).toFixed(2)}` : '-'}
                        </td>
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowSubcontractorForm(false); setEditingSubcontractor(null); }}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                      {editingSubcontractor ? 'Edit' : 'Add'} Subcontractor Fee
                    </h3>
                    <button
                      onClick={() => {
                        setShowSubcontractorForm(false)
                        setEditingSubcontractor(null)
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSubcontractorSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subcontractor *</label>
                      <select
                        value={subcontractorForm.subcontractor_id}
                        onChange={(e) => handleSubcontractorSelect(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select subcontractor...</option>
                        {subcontractors.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                        <input
                          type="date"
                          value={subcontractorForm.date_added}
                          onChange={(e) => setSubcontractorForm({ ...subcontractorForm, date_added: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status *</label>
                        <select
                          value={subcontractorForm.status}
                          onChange={(e) => setSubcontractorForm({ ...subcontractorForm, status: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="incomplete">Incomplete</option>
                          <option value="in_progress">In Progress</option>
                          <option value="complete">Complete</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Description *</label>
                      <input
                        type="text"
                        value={subcontractorForm.job_description}
                        onChange={(e) => setSubcontractorForm({ ...subcontractorForm, job_description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., Excavation, Plumbing, Electrical, etc."
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Value ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={subcontractorForm.expected_value}
                          onChange={(e) => setSubcontractorForm({ ...subcontractorForm, expected_value: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={subcontractorForm.flat_fee}
                          onChange={(e) => setSubcontractorForm({ ...subcontractorForm, flat_fee: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <textarea
                        value={subcontractorForm.notes}
                        onChange={(e) => setSubcontractorForm({ ...subcontractorForm, notes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSubcontractorForm(false)
                          setEditingSubcontractor(null)
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowMaterialForm(false); setEditingMaterial(null); }}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                      {editingMaterial ? 'Edit' : 'Add'} Material
                    </h3>
                    <button
                      onClick={() => {
                        setShowMaterialForm(false)
                        setEditingMaterial(null)
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleMaterialSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Material *</label>
                      <select
                        value={materialForm.inventory_id}
                        onChange={(e) => handleMaterialInventorySelect(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select material...</option>
                        {inventory.filter(item => item.type === 'material').map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} {item.unit_price ? `($${parseFloat(item.unit_price).toFixed(2)})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Ordered</label>
                        <input
                          type="date"
                          value={materialForm.date_ordered}
                          onChange={(e) => setMaterialForm({ ...materialForm, date_ordered: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Received</label>
                        <input
                          type="date"
                          value={materialForm.date_received}
                          onChange={(e) => setMaterialForm({ ...materialForm, date_received: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                      <input
                        type="number"
                        step="0.01"
                        value={materialForm.quantity}
                        onChange={(e) => handleMaterialQuantityChange(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status *</label>
                      <select
                        value={materialForm.status}
                        onChange={(e) => setMaterialForm({ ...materialForm, status: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="incomplete">Incomplete</option>
                        <option value="in_progress">In Progress</option>
                        <option value="complete">Complete</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={materialForm.expected_price}
                          onChange={(e) => setMaterialForm({ ...materialForm, expected_price: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={materialForm.actual_price}
                          onChange={(e) => setMaterialForm({ ...materialForm, actual_price: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <textarea
                        value={materialForm.notes}
                        onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMaterialForm(false)
                          setEditingMaterial(null)
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowAdditionalForm(false); setEditingAdditional(null); }}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                      {editingAdditional ? 'Edit' : 'Add'} Additional Expense
                    </h3>
                    <button
                      onClick={() => {
                        setShowAdditionalForm(false)
                        setEditingAdditional(null)
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleAdditionalSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
                      <input
                        type="text"
                        value={additionalForm.description}
                        onChange={(e) => setAdditionalForm({ ...additionalForm, description: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                        <input
                          type="date"
                          value={additionalForm.expense_date}
                          onChange={(e) => setAdditionalForm({ ...additionalForm, expense_date: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status *</label>
                        <select
                          value={additionalForm.status}
                          onChange={(e) => setAdditionalForm({ ...additionalForm, status: e.target.value })}
                          required
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="incomplete">Incomplete</option>
                          <option value="in_progress">In Progress</option>
                          <option value="complete">Complete</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Value ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={additionalForm.expected_value}
                          onChange={(e) => setAdditionalForm({ ...additionalForm, expected_value: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Amount ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={additionalForm.amount}
                          onChange={(e) => setAdditionalForm({ ...additionalForm, amount: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                      <input
                        type="text"
                        value={additionalForm.category}
                        onChange={(e) => setAdditionalForm({ ...additionalForm, category: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., Equipment, Permit, Travel"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <textarea
                        value={additionalForm.notes}
                        onChange={(e) => setAdditionalForm({ ...additionalForm, notes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdditionalForm(false)
                          setEditingAdditional(null)
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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

          {/* Equipment Form Modal */}
          {showEquipmentForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowEquipmentForm(false); setEditingEquipment(null); }}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                      {editingEquipment ? 'Edit' : 'Add'} Equipment
                    </h3>
                    <button
                      onClick={() => {
                        setShowEquipmentForm(false)
                        setEditingEquipment(null)
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleEquipmentSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipment *</label>
                      <select
                        value={equipmentForm.inventory_id}
                        onChange={(e) => handleEquipmentInventorySelect(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select equipment...</option>
                        {inventory.filter(item => item.type === 'equipment').map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} {item.unit_price ? `($${parseFloat(item.unit_price).toFixed(2)})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Ordered</label>
                        <input
                          type="date"
                          value={equipmentForm.date_ordered}
                          onChange={(e) => setEquipmentForm({ ...equipmentForm, date_ordered: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Received</label>
                        <input
                          type="date"
                          value={equipmentForm.date_received}
                          onChange={(e) => setEquipmentForm({ ...equipmentForm, date_received: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={equipmentForm.quantity}
                        onChange={(e) => handleEquipmentQuantityChange(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                      <select
                        value={equipmentForm.status}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, status: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="ordered">Ordered</option>
                        <option value="received">Received</option>
                        <option value="installed">Installed</option>
                        <option value="complete">Complete</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={equipmentForm.expected_price}
                          onChange={(e) => setEquipmentForm({ ...equipmentForm, expected_price: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={equipmentForm.actual_price}
                          onChange={(e) => setEquipmentForm({ ...equipmentForm, actual_price: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <textarea
                        value={equipmentForm.notes}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, notes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEquipmentForm(false)
                          setEditingEquipment(null)
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md"
                      >
                        {editingEquipment ? 'Update' : 'Add'}
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

