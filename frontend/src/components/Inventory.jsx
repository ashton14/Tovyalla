import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import DocumentsModal from './DocumentsModal'
import {
  useInventory,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
} from '../hooks/useApi'

function Inventory() {
  const { user, supabase } = useAuth()
  
  // Use cached query for inventory
  const { data: materials = [], isLoading: loading, refetch } = useInventory()
  
  // Mutations
  const createItem = useCreateInventoryItem()
  const updateItem = useUpdateInventoryItem()
  const deleteItem = useDeleteInventoryItem()

  const [showForm, setShowForm] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ success: 0, failed: 0, total: 0 })
  const [importErrors, setImportErrors] = useState([])
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedEntityForDocuments, setSelectedEntityForDocuments] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    stock: '',
    unit: '',
    brand: '',
    model: '',
    color: '',
    unit_price: '',
  })

  // Get auth token for CSV import
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      ...formData,
      stock: formData.stock ? parseInt(formData.stock) : 0,
      unit_price: formData.unit_price ? parseFloat(formData.unit_price) : 0,
    }

    try {
      if (editingMaterial) {
        await updateItem.mutateAsync({ id: editingMaterial.id, data: payload })
        setSuccess('Material updated successfully!')
      } else {
        await createItem.mutateAsync(payload)
        setSuccess('Material added successfully!')
      }

      setShowForm(false)
      setEditingMaterial(null)
      resetForm()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save material')
    }
  }

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material?')) {
      return
    }

    try {
      await deleteItem.mutateAsync(id)
      setSuccess('Material deleted successfully!')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete material')
    }
  }

  // Handle edit
  const handleEdit = (material) => {
    setEditingMaterial(material)
    setFormData({
      name: material.name || '',
      stock: material.stock || '',
      unit: material.unit || '',
      brand: material.brand || '',
      model: material.model || '',
      color: material.color || '',
      unit_price: material.unit_price || '',
    })
    setShowForm(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      stock: '',
      unit: '',
      brand: '',
      model: '',
      color: '',
      unit_price: '',
    })
  }

  // Filter materials
  const filteredMaterials = materials.filter((material) => {
    const matchesSearch =
      searchTerm === '' ||
      material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.color?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  // Pagination
  const totalPages = Math.ceil(filteredMaterials.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedMaterials = filteredMaterials.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // CSV parsing helper - handles quoted fields
  const parseCSVLine = (line) => {
    const values = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    // Add last field
    values.push(current.trim())
    return values
  }

  // CSV parsing helper
  const parseCSV = (csvText) => {
    // Normalize line endings
    const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalized.split('\n').filter(line => line.trim() !== '')
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row')
    }

    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
    
    // Required columns
    const requiredColumns = ['name', 'unit']
    const missingColumns = requiredColumns.filter(col => !headers.includes(col))
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`)
    }

    // Parse data rows
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''))
      const row = {}
      headers.forEach((header, index) => {
        row[header] = (values[index] || '').trim()
      })
      
      // Skip empty rows
      if (!row.name && !row.unit) {
        continue
      }
      
      rows.push(row)
    }

    return { headers, rows }
  }

  // Handle CSV file import
  const handleCSVImport = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    setImporting(true)
    setError('')
    setSuccess('')
    setImportProgress({ success: 0, failed: 0, total: 0 })
    setImportErrors([])

    try {
      const fileText = await file.text()
      const { rows } = parseCSV(fileText)

      if (rows.length === 0) {
        throw new Error('No valid rows found in CSV file')
      }

      setImportProgress({ success: 0, failed: 0, total: rows.length })

      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Valid units
      const validUnits = ['unit', 'ft', 'lbs', 'gal', 'sq ft', 'cu ft', 'yd', 'in']

      // Import materials one by one
      let successCount = 0
      let failedCount = 0
      const errors = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        
        // Map CSV columns to material fields
        const materialData = {
          name: row.name || '',
          stock: row.stock || '0',
          unit: row.unit || '',
          brand: row.brand || '',
          model: row.model || '',
          color: row.color || '',
          unit_price: row.unit_price || row['unit_price'] || '0',
        }

        // Validate required fields
        if (!materialData.name || !materialData.unit) {
          failedCount++
          errors.push({
            row: i + 2, // +2 because row 1 is header, and arrays are 0-indexed
            error: 'Missing required fields: name and unit are required',
            data: materialData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Validate unit
        if (!validUnits.includes(materialData.unit.toLowerCase())) {
          failedCount++
          errors.push({
            row: i + 2,
            error: `Invalid unit: ${materialData.unit}. Must be one of: ${validUnits.join(', ')}`,
            data: materialData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
          continue
        }

        // Convert numeric fields
        const stock = parseInt(materialData.stock)
        const unitPrice = parseFloat(materialData.unit_price)

        materialData.stock = isNaN(stock) ? 0 : stock
        materialData.unit_price = isNaN(unitPrice) ? 0 : unitPrice

        try {
          await axios.post('/api/inventory', materialData, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          successCount++
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
        } catch (err) {
          failedCount++
          errors.push({
            row: i + 2,
            error: err.response?.data?.error || err.message || 'Failed to import material',
            data: materialData,
          })
          setImportProgress({ success: successCount, failed: failedCount, total: rows.length })
        }
      }

      setImportErrors(errors)
      
      if (successCount > 0) {
        setSuccess(`Successfully imported ${successCount} material(s)${failedCount > 0 ? `. ${failedCount} failed.` : ''}`)
        // Refetch to update cache
        refetch()
      } else {
        setError(`Failed to import all materials. ${failedCount} error(s).`)
      }
    } catch (err) {
      setError(err.message || 'Failed to parse CSV file')
    } finally {
      setImporting(false)
      // Reset file input
      event.target.value = ''
    }
  }

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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Inventory</h2>
          <p className="text-gray-600 mt-1">Manage your materials inventory</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors"
          >
            📥 Import CSV
          </button>
          <button
            onClick={() => {
              resetForm()
              setEditingMaterial(null)
              setShowForm(true)
            }}
            className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
          >
            + Add Material
          </button>
        </div>
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
            placeholder="Search by name, brand, model, or color..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
          />
        </div>
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowImportModal(false); setImportErrors([]); setImportProgress({ success: 0, failed: 0, total: 0 }); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Import Materials from CSV</h3>
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportErrors([])
                    setImportProgress({ success: 0, failed: 0, total: 0 })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Required Columns Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Required CSV Columns:</h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p><strong>Required:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li><code className="bg-blue-100 px-1 rounded">name</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">unit</code> - Must be one of: <code className="bg-blue-100 px-1 rounded">unit</code>, <code className="bg-blue-100 px-1 rounded">ft</code>, <code className="bg-blue-100 px-1 rounded">lbs</code>, <code className="bg-blue-100 px-1 rounded">gal</code>, <code className="bg-blue-100 px-1 rounded">sq ft</code>, <code className="bg-blue-100 px-1 rounded">cu ft</code>, <code className="bg-blue-100 px-1 rounded">yd</code>, <code className="bg-blue-100 px-1 rounded">in</code></li>
                    </ul>
                    <p className="mt-2"><strong>Optional:</strong></p>
                    <ul className="list-disc list-inside ml-2">
                      <li><code className="bg-blue-100 px-1 rounded">stock</code> (defaults to 0)</li>
                      <li><code className="bg-blue-100 px-1 rounded">unit_price</code> (defaults to 0)</li>
                      <li><code className="bg-blue-100 px-1 rounded">brand</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">model</code></li>
                      <li><code className="bg-blue-100 px-1 rounded">color</code></li>
                    </ul>
                  </div>
                </div>

                {/* Example CSV */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Example CSV Format:</h4>
                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{`name,unit,stock,unit_price,brand,model,color
Pool Liner,unit,10,250.00,PoolPro,PL-1234,Blue
Chlorine Tablets,lbs,50,15.99,ChemClear,CC-500,White
Pool Pump,unit,5,450.00,FlowMaster,FM-2000,Black`}
                  </pre>
                </div>

                {/* File Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVImport}
                    disabled={importing}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Import Progress */}
                {importing && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <span className="font-medium text-blue-900">Importing materials...</span>
                    </div>
                    <div className="text-sm text-blue-800">
                      <p>Progress: {importProgress.success + importProgress.failed} / {importProgress.total}</p>
                      <p>✓ Success: {importProgress.success} | ✗ Failed: {importProgress.failed}</p>
                    </div>
                  </div>
                )}

                {/* Import Errors */}
                {importErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 max-h-48 overflow-y-auto">
                    <h4 className="font-semibold text-red-900 mb-2">Import Errors:</h4>
                    <div className="space-y-2 text-sm">
                      {importErrors.slice(0, 10).map((error, index) => (
                        <div key={index} className="text-red-800">
                          <strong>Row {error.row}:</strong> {error.error}
                        </div>
                      ))}
                      {importErrors.length > 10 && (
                        <p className="text-red-600 italic">... and {importErrors.length - 10} more errors</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Close Button */}
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false)
                      setImportErrors([])
                      setImportProgress({ success: 0, failed: 0, total: 0 })
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Material Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingMaterial(null); resetForm(); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingMaterial ? 'Edit Material' : 'Add New Material'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingMaterial(null)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stock *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit *
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    >
                      <option value="">Select unit</option>
                      <option value="unit">Unit</option>
                      <option value="ft">ft</option>
                      <option value="lbs">lbs</option>
                      <option value="gal">gal</option>
                      <option value="sq ft">sq ft</option>
                      <option value="cu ft">cu ft</option>
                      <option value="yd">yd</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Price ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingMaterial(null)
                      resetForm()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createItem.isPending || updateItem.isPending}
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md disabled:opacity-50"
                  >
                    {(createItem.isPending || updateItem.isPending) ? 'Saving...' : (editingMaterial ? 'Update Material' : 'Add Material')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Materials Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brand
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Color
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    {materials.length === 0
                      ? 'No materials yet. Click "Add Material" to get started.'
                      : 'No materials match your search criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedMaterials.map((material) => (
                  <tr key={material.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{material.name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{material.stock ?? '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{material.unit || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{material.brand || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{material.model || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{material.color || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {material.unit_price
                          ? `$${parseFloat(material.unit_price).toFixed(2)}`
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedEntityForDocuments({
                            id: material.id,
                            name: material.name,
                          })
                          setShowDocumentsModal(true)
                        }}
                        className="text-green-600 hover:text-green-800 mr-4"
                        title="View Files"
                      >
                        Files
                      </button>
                      <button
                        onClick={() => handleEdit(material)}
                        className="text-pool-blue hover:text-pool-dark mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(material.id)}
                        disabled={deleteItem.isPending}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredMaterials.length > itemsPerPage && (
        <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredMaterials.length)} of {filteredMaterials.length} materials
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Materials</p>
          <p className="text-2xl font-bold text-gray-900">{materials.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Stock Value</p>
          <p className="text-2xl font-bold text-gray-900">
            ${materials
              .reduce((sum, m) => sum + (m.stock || 0) * (m.unit_price || 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Low Stock Items</p>
          <p className="text-2xl font-bold text-red-600">
            {materials.filter((m) => (m.stock || 0) < 10).length}
          </p>
        </div>
      </div>

      {/* Documents Modal */}
      {showDocumentsModal && selectedEntityForDocuments && (
        <DocumentsModal
          entityType="inventory"
          entityId={selectedEntityForDocuments.id}
          entityName={selectedEntityForDocuments.name}
          onClose={() => {
            setShowDocumentsModal(false)
            setSelectedEntityForDocuments(null)
          }}
        />
      )}
    </div>
  )
}

export default Inventory
