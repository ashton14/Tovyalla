import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import ActionsMenu, { EDIT_ICON, DELETE_ICON } from './ActionsMenu'
import { useTemplates } from '../hooks/useApi'

const emptySubcontractor = {
  subcontractor_id: '',
  flat_fee: '',
  expected_value: '',
  job_description: '',
  notes: '',
}

const emptyMaterial = {
  inventory_id: '',
  quantity: '',
  expected_price: '',
  actual_price: '',
  notes: '',
}

const emptyEquipment = {
  inventory_id: '',
  quantity: '1',
  expected_price: '',
  actual_price: '',
  notes: '',
}

const emptyAdditional = {
  name: '',
  expected_value: '',
  description: '',
  notes: '',
}

function Templates() {
  const { supabase, getAuthHeaders } = useAuth()
  const { data: templates = [], isLoading, refetch } = useTemplates()
  const [subcontractors, setSubcontractors] = useState([])
  const [inventory, setInventory] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formName, setFormName] = useState('')
  const [subcontractorFees, setSubcontractorFees] = useState([])
  const [materials, setMaterials] = useState([])
  const [equipment, setEquipment] = useState([])
  const [additionalExpenses, setAdditionalExpenses] = useState([])
  const [showSubForm, setShowSubForm] = useState(false)
  const [showMatForm, setShowMatForm] = useState(false)
  const [showEquipForm, setShowEquipForm] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSubIdx, setEditingSubIdx] = useState(null)
  const [editingMatIdx, setEditingMatIdx] = useState(null)
  const [editingEquipIdx, setEditingEquipIdx] = useState(null)
  const [editingAddIdx, setEditingAddIdx] = useState(null)
  const [subForm, setSubForm] = useState(emptySubcontractor)
  const [matForm, setMatForm] = useState(emptyMaterial)
  const [equipForm, setEquipForm] = useState(emptyEquipment)
  const [addForm, setAddForm] = useState(emptyAdditional)
  const [saving, setSaving] = useState(false)
  const [openActionsId, setOpenActionsId] = useState(null)
  const actionsMenuRef = useRef(null)

  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  useEffect(() => {
    const fetchData = async () => {
      const token = await getAuthToken()
      if (!token) return
      try {
        const [subsRes, invRes] = await Promise.all([
          axios.get('/api/subcontractors', { headers: getAuthHeaders(token) }),
          axios.get('/api/inventory', { headers: getAuthHeaders(token) }),
        ])
        setSubcontractors(subsRes.data.subcontractors || [])
        setInventory(invRes.data.materials || [])
      } catch (err) {
        console.error('Error fetching data:', err)
      }
    }
    if (supabase) fetchData()
  }, [supabase])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openActionsId && actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setOpenActionsId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openActionsId])

  const resetForm = () => {
    setFormName('')
    setSubcontractorFees([])
    setMaterials([])
    setEquipment([])
    setAdditionalExpenses([])
    setEditingTemplate(null)
    setSubForm(emptySubcontractor)
    setMatForm(emptyMaterial)
    setEquipForm(emptyEquipment)
    setAddForm(emptyAdditional)
    setEditingSubIdx(null)
    setEditingMatIdx(null)
    setEditingEquipIdx(null)
    setEditingAddIdx(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setShowForm(true)
  }

  const handleOpenEdit = async (template) => {
    setError('')
    const token = await getAuthToken()
    if (!token) return
    try {
      const res = await axios.get(`/api/templates/${template.id}`, {
        headers: getAuthHeaders(token),
      })
      const t = res.data.template
      setFormName(t.name || '')
      setSubcontractorFees((t.expense_template_subcontractor_fees || []).map((f) => ({
        id: f.id,
        subcontractor_id: f.subcontractor_id,
        flat_fee: f.flat_fee ?? '',
        expected_value: f.expected_value ?? '',
        job_description: f.job_description ?? '',
        notes: f.notes ?? '',
      })))
      setMaterials((t.expense_template_materials || []).map((m) => ({
        id: m.id,
        inventory_id: m.inventory_id,
        quantity: m.quantity ?? '',
        expected_price: m.expected_price ?? '',
        actual_price: m.actual_price ?? '',
        notes: m.notes ?? '',
      })))
      setEquipment((t.expense_template_equipment || []).map((e) => ({
        id: e.id,
        inventory_id: e.inventory_id,
        quantity: e.quantity ?? '1',
        expected_price: e.expected_price ?? '',
        actual_price: e.actual_price ?? '',
        notes: e.notes ?? '',
      })))
      setAdditionalExpenses((t.expense_template_additional || []).map((a) => ({
        id: a.id,
        name: a.name ?? '',
        expected_value: a.expected_value ?? '',
        description: a.description ?? '',
        notes: a.notes ?? '',
      })))
      setEditingTemplate(template)
      setShowForm(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load template')
    }
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    if (!formName.trim()) {
      setError('Template name is required')
      return
    }
    setSaving(true)
    const token = await getAuthToken()
    if (!token) {
      setSaving(false)
      return
    }
    try {
      const payload = {
        name: formName.trim(),
        subcontractorFees: subcontractorFees.map((f) => ({
          subcontractor_id: f.subcontractor_id,
          flat_fee: f.flat_fee || null,
          expected_value: f.expected_value || null,
          job_description: f.job_description || null,
          notes: f.notes || null,
        })).filter((f) => f.subcontractor_id),
        materials: materials.map((m) => ({
          inventory_id: m.inventory_id,
          quantity: m.quantity || null,
          expected_price: m.expected_price || null,
          actual_price: m.actual_price || null,
          notes: m.notes || null,
        })).filter((m) => m.inventory_id),
        equipment: equipment.map((e) => ({
          inventory_id: e.inventory_id,
          quantity: e.quantity || 1,
          expected_price: e.expected_price || null,
          actual_price: e.actual_price || null,
          notes: e.notes || null,
        })).filter((e) => e.inventory_id),
        additionalExpenses: additionalExpenses.map((a) => ({
          name: a.name || 'Additional',
          expected_value: a.expected_value || null,
          description: a.description || null,
          notes: a.notes || null,
        })).filter((a) => a.name),
      }
      if (editingTemplate) {
        await axios.put(`/api/templates/${editingTemplate.id}`, payload, {
          headers: getAuthHeaders(token),
        })
        setSuccess('Template updated!')
      } else {
        await axios.post('/api/templates', payload, {
          headers: getAuthHeaders(token),
        })
        setSuccess('Template created!')
      }
      refetch()
      setShowForm(false)
      resetForm()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (template) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return
    setError('')
    const token = await getAuthToken()
    if (!token) return
    try {
      await axios.delete(`/api/templates/${template.id}`, {
        headers: getAuthHeaders(token),
      })
      setSuccess('Template deleted!')
      refetch()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete template')
    }
  }

  const addSubcontractor = () => {
    if (!subForm.subcontractor_id) return
    if (editingSubIdx != null) {
      const next = [...subcontractorFees]
      next[editingSubIdx] = { ...subForm }
      setSubcontractorFees(next)
      setEditingSubIdx(null)
    } else {
      setSubcontractorFees((prev) => [...prev, { ...subForm }])
    }
    setSubForm(emptySubcontractor)
    setShowSubForm(false)
  }

  const addMaterial = () => {
    if (!matForm.inventory_id) return
    if (editingMatIdx != null) {
      const next = [...materials]
      next[editingMatIdx] = { ...matForm }
      setMaterials(next)
      setEditingMatIdx(null)
    } else {
      setMaterials((prev) => [...prev, { ...matForm }])
    }
    setMatForm(emptyMaterial)
    setShowMatForm(false)
  }

  const addEquipment = () => {
    if (!equipForm.inventory_id) return
    if (editingEquipIdx != null) {
      const next = [...equipment]
      next[editingEquipIdx] = { ...equipForm }
      setEquipment(next)
      setEditingEquipIdx(null)
    } else {
      setEquipment((prev) => [...prev, { ...equipForm }])
    }
    setEquipForm(emptyEquipment)
    setShowEquipForm(false)
  }

  const addAdditional = () => {
    if (!addForm.name?.trim()) return
    if (editingAddIdx != null) {
      const next = [...additionalExpenses]
      next[editingAddIdx] = { ...addForm }
      setAdditionalExpenses(next)
      setEditingAddIdx(null)
    } else {
      setAdditionalExpenses((prev) => [...prev, { ...addForm }])
    }
    setAddForm(emptyAdditional)
    setShowAddForm(false)
  }

  const handleMaterialInventorySelect = (inventoryId) => {
    const item = inventory.find((i) => i.id === inventoryId)
    if (item && item.unit_price) {
      const unitPrice = parseFloat(item.unit_price)
      const quantity = parseFloat(matForm.quantity) || 1
      const calculatedPrice = (unitPrice * quantity).toFixed(2)
      setMatForm({
        ...matForm,
        inventory_id: inventoryId,
        expected_price: calculatedPrice,
        actual_price: calculatedPrice,
      })
    } else {
      setMatForm({ ...matForm, inventory_id: inventoryId })
    }
  }

  const handleMaterialQuantityChange = (quantity) => {
    const item = inventory.find((i) => i.id === matForm.inventory_id)
    if (item && item.unit_price) {
      const unitPrice = parseFloat(item.unit_price)
      const qty = parseFloat(quantity) || 0
      const calculatedPrice = (unitPrice * qty).toFixed(2)
      setMatForm({
        ...matForm,
        quantity: quantity,
        expected_price: calculatedPrice,
        actual_price: calculatedPrice,
      })
    } else {
      setMatForm({ ...matForm, quantity: quantity })
    }
  }

  const handleEquipmentInventorySelect = (inventoryId) => {
    const item = inventory.find((i) => i.id === inventoryId)
    if (item && item.unit_price) {
      const unitPrice = parseFloat(item.unit_price)
      const quantity = parseFloat(equipForm.quantity) || 1
      const calculatedPrice = (unitPrice * quantity).toFixed(2)
      setEquipForm({
        ...equipForm,
        inventory_id: inventoryId,
        expected_price: calculatedPrice,
        actual_price: calculatedPrice,
      })
    } else {
      setEquipForm({ ...equipForm, inventory_id: inventoryId })
    }
  }

  const handleEquipmentQuantityChange = (quantity) => {
    const item = inventory.find((i) => i.id === equipForm.inventory_id)
    if (item && item.unit_price) {
      const unitPrice = parseFloat(item.unit_price)
      const qty = parseFloat(quantity) || 0
      const calculatedPrice = (unitPrice * qty).toFixed(2)
      setEquipForm({
        ...equipForm,
        quantity: quantity,
        expected_price: calculatedPrice,
        actual_price: calculatedPrice,
      })
    } else {
      setEquipForm({ ...equipForm, quantity: quantity })
    }
  }

  const getSubName = (id) => subcontractors.find((s) => s.id === id)?.name || '-'
  const getInvName = (id) => inventory.find((i) => i.id === id)?.name || '-'

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pool-blue"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Templates</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Create reusable expense templates for common project types</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
        >
          + Add Template
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

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subcontractors</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Materials</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Equipment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Additional</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {templates.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No templates yet. Click &quot;Add Template&quot; to create one.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{t.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{t.subcontractorCount || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{t.materialCount || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{t.equipmentCount || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{t.additionalCount || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div ref={openActionsId === t.id ? actionsMenuRef : null}>
                      <ActionsMenu
                        isOpen={openActionsId === t.id}
                        onToggle={() => setOpenActionsId((prev) => (prev === t.id ? null : t.id))}
                        onAction={() => setOpenActionsId(null)}
                        actions={[
                          { icon: EDIT_ICON, label: 'Edit', onClick: () => handleOpenEdit(t) },
                          { icon: DELETE_ICON, label: 'Delete', danger: true, onClick: () => handleDelete(t) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  {editingTemplate ? 'Edit' : 'Add'} Template
                </h2>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl">✕</button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Standard Pool Build"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Add Expense Buttons */}
              <div className="mb-6">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Add Expense</p>
                <div className="grid grid-cols-2 gap-2 sm:hidden">
                  <button type="button" onClick={() => { setSubForm(emptySubcontractor); setEditingSubIdx(null); setShowSubForm(true); }} className="px-3 py-2 text-xs font-medium text-pool-blue bg-pool-light hover:bg-pool-blue hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Subcontractor
                  </button>
                  <button type="button" onClick={() => { setMatForm(emptyMaterial); setEditingMatIdx(null); setShowMatForm(true); }} className="px-3 py-2 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-600 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Material
                  </button>
                  <button type="button" onClick={() => { setEquipForm(emptyEquipment); setEditingEquipIdx(null); setShowEquipForm(true); }} className="px-3 py-2 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-600 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Equipment
                  </button>
                  <button type="button" onClick={() => { setAddForm(emptyAdditional); setEditingAddIdx(null); setShowAddForm(true); }} className="px-3 py-2 text-xs font-medium text-teal-700 bg-teal-100 hover:bg-teal-600 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Other
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-wrap gap-6">
                  <button type="button" onClick={() => { setSubForm(emptySubcontractor); setEditingSubIdx(null); setShowSubForm(true); }} className="text-sm font-medium text-pool-blue hover:text-pool-dark flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Subcontractor
                  </button>
                  <button type="button" onClick={() => { setMatForm(emptyMaterial); setEditingMatIdx(null); setShowMatForm(true); }} className="text-sm font-medium text-pool-blue hover:text-pool-dark flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Material
                  </button>
                  <button type="button" onClick={() => { setEquipForm(emptyEquipment); setEditingEquipIdx(null); setShowEquipForm(true); }} className="text-sm font-medium text-pool-blue hover:text-pool-dark flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Equipment
                  </button>
                  <button type="button" onClick={() => { setAddForm(emptyAdditional); setEditingAddIdx(null); setShowAddForm(true); }} className="text-sm font-medium text-pool-blue hover:text-pool-dark flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Other
                  </button>
                </div>
              </div>

              {/* Subcontractors Table */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Subcontractors</h3>
                {subcontractorFees.length > 0 ? (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Subcontractor</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Job Description</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expected</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Flat Fee</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {subcontractorFees.map((f, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{getSubName(f.subcontractor_id)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{f.job_description || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{f.expected_value ? `$${parseFloat(f.expected_value).toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{f.flat_fee ? `$${parseFloat(f.flat_fee).toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div ref={openActionsId === `form-sub-${i}` ? actionsMenuRef : null}>
                                <ActionsMenu
                                  isOpen={openActionsId === `form-sub-${i}`}
                                  onToggle={() => setOpenActionsId((prev) => (prev === `form-sub-${i}` ? null : `form-sub-${i}`))}
                                  onAction={() => setOpenActionsId(null)}
                                  actions={[
                                    { icon: EDIT_ICON, label: 'Edit', onClick: () => { setSubForm({ ...f }); setEditingSubIdx(i); setShowSubForm(true) } },
                                    { icon: DELETE_ICON, label: 'Delete', danger: true, onClick: () => setSubcontractorFees((p) => p.filter((_, j) => j !== i)) },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No subcontractor fees added yet.</p>
                )}
              </div>

              {/* Materials Table */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Materials</h3>
                {materials.length > 0 ? (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expected</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actual</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {materials.map((m, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{getInvName(m.inventory_id)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{m.quantity ? `${m.quantity} ${inventory.find((inv) => inv.id === m.inventory_id)?.unit || ''}` : '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{m.expected_price ? `$${parseFloat(m.expected_price).toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{m.actual_price ? `$${parseFloat(m.actual_price).toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div ref={openActionsId === `form-mat-${i}` ? actionsMenuRef : null}>
                                <ActionsMenu
                                  isOpen={openActionsId === `form-mat-${i}`}
                                  onToggle={() => setOpenActionsId((prev) => (prev === `form-mat-${i}` ? null : `form-mat-${i}`))}
                                  onAction={() => setOpenActionsId(null)}
                                  actions={[
                                    { icon: EDIT_ICON, label: 'Edit', onClick: () => { setMatForm({ ...m }); setEditingMatIdx(i); setShowMatForm(true) } },
                                    { icon: DELETE_ICON, label: 'Delete', danger: true, onClick: () => setMaterials((p) => p.filter((_, j) => j !== i)) },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No materials added yet.</p>
                )}
              </div>

              {/* Equipment Table */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Equipment</h3>
                {equipment.length > 0 ? (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expected</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actual</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {equipment.map((e, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{getInvName(e.inventory_id)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{e.quantity || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{e.expected_price ? `$${parseFloat(e.expected_price).toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{e.actual_price ? `$${parseFloat(e.actual_price).toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div ref={openActionsId === `form-equip-${i}` ? actionsMenuRef : null}>
                                <ActionsMenu
                                  isOpen={openActionsId === `form-equip-${i}`}
                                  onToggle={() => setOpenActionsId((prev) => (prev === `form-equip-${i}` ? null : `form-equip-${i}`))}
                                  onAction={() => setOpenActionsId(null)}
                                  actions={[
                                    { icon: EDIT_ICON, label: 'Edit', onClick: () => { setEquipForm({ ...e }); setEditingEquipIdx(i); setShowEquipForm(true) } },
                                    { icon: DELETE_ICON, label: 'Delete', danger: true, onClick: () => setEquipment((p) => p.filter((_, j) => j !== i)) },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No equipment added yet.</p>
                )}
              </div>

              {/* Additional Expenses Table */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Additional Expenses</h3>
                {additionalExpenses.length > 0 ? (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expected</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {additionalExpenses.map((a, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{a.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{a.description || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{a.expected_value ? `$${parseFloat(a.expected_value).toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div ref={openActionsId === `form-add-${i}` ? actionsMenuRef : null}>
                                <ActionsMenu
                                  isOpen={openActionsId === `form-add-${i}`}
                                  onToggle={() => setOpenActionsId((prev) => (prev === `form-add-${i}` ? null : `form-add-${i}`))}
                                  onAction={() => setOpenActionsId(null)}
                                  actions={[
                                    { icon: EDIT_ICON, label: 'Edit', onClick: () => { setAddForm({ ...a }); setEditingAddIdx(i); setShowAddForm(true) } },
                                    { icon: DELETE_ICON, label: 'Delete', danger: true, onClick: () => setAdditionalExpenses((p) => p.filter((_, j) => j !== i)) },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No additional expenses added yet.</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md disabled:opacity-50">
                  {saving ? 'Saving...' : (editingTemplate ? 'Update' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subcontractor Form Modal (popup) */}
      {showSubForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => { setShowSubForm(false); setSubForm(emptySubcontractor); setEditingSubIdx(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{editingSubIdx != null ? 'Edit' : 'Add'} Subcontractor Fee</h3>
                <button onClick={() => { setShowSubForm(false); setSubForm(emptySubcontractor); setEditingSubIdx(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addSubcontractor(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subcontractor *</label>
                  <select value={subForm.subcontractor_id} onChange={(e) => setSubForm({ ...subForm, subcontractor_id: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Select subcontractor...</option>
                    {subcontractors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Description</label>
                  <input type="text" value={subForm.job_description} onChange={(e) => setSubForm({ ...subForm, job_description: e.target.value })} placeholder="e.g., Excavation, Plumbing, Electrical, etc." className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Value ($)</label>
                    <input type="number" step="0.01" value={subForm.expected_value} onChange={(e) => setSubForm({ ...subForm, expected_value: e.target.value })} placeholder="0.00" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flat Fee ($)</label>
                    <input type="number" step="0.01" value={subForm.flat_fee} onChange={(e) => setSubForm({ ...subForm, flat_fee: e.target.value })} placeholder="0.00" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={subForm.notes} onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setShowSubForm(false); setSubForm(emptySubcontractor); setEditingSubIdx(null); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md">{editingSubIdx != null ? 'Update' : 'Add'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Material Form Modal (popup) */}
      {showMatForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => { setShowMatForm(false); setMatForm(emptyMaterial); setEditingMatIdx(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{editingMatIdx != null ? 'Edit' : 'Add'} Material</h3>
                <button onClick={() => { setShowMatForm(false); setMatForm(emptyMaterial); setEditingMatIdx(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addMaterial(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Material *</label>
                  <select value={matForm.inventory_id} onChange={(e) => handleMaterialInventorySelect(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Select material...</option>
                    {inventory.filter((i) => i.type === 'material').map((item) => <option key={item.id} value={item.id}>{item.name} {item.unit_price ? `($${parseFloat(item.unit_price).toFixed(2)})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.01" value={matForm.quantity} onChange={(e) => handleMaterialQuantityChange(e.target.value)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    {matForm.inventory_id && <span className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{inventory.find((i) => i.id === matForm.inventory_id)?.unit || ''}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Price ($)</label>
                    <input type="number" step="0.01" value={matForm.expected_price} onChange={(e) => setMatForm({ ...matForm, expected_price: e.target.value })} placeholder="0.00" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Price ($)</label>
                    <input type="number" step="0.01" value={matForm.actual_price} onChange={(e) => setMatForm({ ...matForm, actual_price: e.target.value })} placeholder="0.00" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={matForm.notes} onChange={(e) => setMatForm({ ...matForm, notes: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setShowMatForm(false); setMatForm(emptyMaterial); setEditingMatIdx(null); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md">{editingMatIdx != null ? 'Update' : 'Add'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Form Modal (popup) */}
      {showEquipForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => { setShowEquipForm(false); setEquipForm(emptyEquipment); setEditingEquipIdx(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{editingEquipIdx != null ? 'Edit' : 'Add'} Equipment</h3>
                <button onClick={() => { setShowEquipForm(false); setEquipForm(emptyEquipment); setEditingEquipIdx(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addEquipment(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipment *</label>
                  <select value={equipForm.inventory_id} onChange={(e) => handleEquipmentInventorySelect(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="">Select equipment...</option>
                    {inventory.filter((i) => i.type === 'equipment').map((item) => <option key={item.id} value={item.id}>{item.name} {item.unit_price ? `($${parseFloat(item.unit_price).toFixed(2)})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.01" value={equipForm.quantity} onChange={(e) => handleEquipmentQuantityChange(e.target.value)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    {equipForm.inventory_id && <span className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{inventory.find((i) => i.id === equipForm.inventory_id)?.unit || ''}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Price ($)</label>
                    <input type="number" step="0.01" value={equipForm.expected_price} onChange={(e) => setEquipForm({ ...equipForm, expected_price: e.target.value })} placeholder="0.00" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Price ($)</label>
                    <input type="number" step="0.01" value={equipForm.actual_price} onChange={(e) => setEquipForm({ ...equipForm, actual_price: e.target.value })} placeholder="0.00" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={equipForm.notes} onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setShowEquipForm(false); setEquipForm(emptyEquipment); setEditingEquipIdx(null); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md">{editingEquipIdx != null ? 'Update' : 'Add'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Additional Expense Form Modal (popup) */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => { setShowAddForm(false); setAddForm(emptyAdditional); setEditingAddIdx(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{editingAddIdx != null ? 'Edit' : 'Add'} Additional Expense</h3>
                <button onClick={() => { setShowAddForm(false); setAddForm(emptyAdditional); setEditingAddIdx(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); addAdditional(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <input type="text" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} placeholder="e.g., Equipment, Permit, Travel" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Value ($)</label>
                  <input type="number" step="0.01" value={addForm.expected_value} onChange={(e) => setAddForm({ ...addForm, expected_value: e.target.value })} placeholder="0.00" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setShowAddForm(false); setAddForm(emptyAdditional); setEditingAddIdx(null); }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md">{editingAddIdx != null ? 'Update' : 'Add'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Templates
