import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { getContractPdfBlob } from '../utils/contractPdfGenerator'

// Helper to format currency
const formatCurrency = (amount) => {
  if (!amount || isNaN(amount)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function ContractPreview({ contractData, onClose, onGenerate, onDocumentUploaded }) {
  const { supabase, user } = useAuth()
  const [activeTab, setActiveTab] = useState('scope') // 'scope' or 'milestones'
  const [totalCustomerPrice, setTotalCustomerPrice] = useState('')
  const [milestones, setMilestones] = useState([])
  const [scopeOfWork, setScopeOfWork] = useState([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nextMilestoneId, setNextMilestoneId] = useState(1)
  const [nextScopeId, setNextScopeId] = useState(1)
  
  // Upload dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadDocName, setUploadDocName] = useState('')
  const [uploadDocType, setUploadDocType] = useState('')
  const [pdfBlob, setPdfBlob] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Calculate total cost from expenses (use actual prices, fall back to expected if no actual)
  const calculateTotalCost = () => {
    if (!contractData?.expenses) return 0
    const { expenses } = contractData
    let total = 0

    // Subcontractor fees (use flat_fee/actual first, then expected_value)
    if (expenses.subcontractorFees && expenses.subcontractorFees.length > 0) {
      expenses.subcontractorFees.forEach((fee) => {
        total += parseFloat(fee.flat_fee || fee.expected_value || 0)
      })
    }

    // Equipment (use actual_price first, then expected_price)
    if (expenses.equipment && Array.isArray(expenses.equipment) && expenses.equipment.length > 0) {
      expenses.equipment.forEach((eq) => {
        total += parseFloat(eq.actual_price || eq.expected_price || 0)
      })
    }

    // Materials (use actual_price first, then expected_price)
    if (expenses.materials && expenses.materials.length > 0) {
      expenses.materials.forEach((mat) => {
        total += parseFloat(mat.actual_price || mat.expected_price || 0)
      })
    }

    // Additional expenses (use amount/actual first, then expected_value)
    if (expenses.additionalExpenses && expenses.additionalExpenses.length > 0) {
      expenses.additionalExpenses.forEach((exp) => {
        total += parseFloat(exp.amount || exp.expected_value || 0)
      })
    }

    return total
  }

  const totalCost = calculateTotalCost()

  // Generate Equipment & Materials description from expenses
  const generateEquipmentMaterialsDescription = () => {
    if (!contractData?.expenses) return ''
    
    const { expenses } = contractData
    const lines = []
    
    // Add equipment items
    if (expenses.equipment && Array.isArray(expenses.equipment) && expenses.equipment.length > 0) {
      expenses.equipment.forEach((eq) => {
        const name = eq.inventory?.name || eq.name || 'Unknown Equipment'
        const quantity = eq.quantity || 1
        const unit = eq.inventory?.unit || 'unit'
        lines.push(`• ${name} — ${quantity} ${unit}${quantity !== 1 && !unit.endsWith('s') ? 's' : ''}`)
      })
    }
    
    // Add materials items
    if (expenses.materials && expenses.materials.length > 0) {
      expenses.materials.forEach((mat) => {
        const name = mat.inventory?.name || mat.name || 'Unknown Material'
        const quantity = mat.quantity || 1
        const unit = mat.inventory?.unit || 'unit'
        lines.push(`• ${name} — ${quantity} ${unit}${quantity !== 1 && !unit.endsWith('s') ? 's' : ''}`)
      })
    }
    
    return lines.join('\n')
  }

  // Initialize from saved data if available
  useEffect(() => {
    if (!contractData) return

    const { savedMilestones, savedCustomerPrice, savedScopeOfWork } = contractData

    // Use saved customer price from project if available, otherwise calculate from milestones
    if (savedCustomerPrice) {
      setTotalCustomerPrice(savedCustomerPrice.toString())
    } else if (savedMilestones && savedMilestones.length > 0) {
      const savedTotal = savedMilestones.reduce((sum, m) => sum + parseFloat(m.customer_price || 0), 0)
      setTotalCustomerPrice(savedTotal.toString())
    }

    // Load milestones
    if (savedMilestones && savedMilestones.length > 0) {
      // Use saved customer price or calculate from milestones for percentage calculation
      const totalForPercentage = savedCustomerPrice || savedMilestones.reduce((sum, m) => sum + parseFloat(m.customer_price || 0), 0)

      // Convert saved milestones to our format with percentages
      const loadedMilestones = savedMilestones.map((m, idx) => {
        const price = parseFloat(m.customer_price || 0)
        const percentage = totalForPercentage > 0 ? ((price / totalForPercentage) * 100).toFixed(2) : 0
        return {
          id: `milestone-${idx + 1}`,
          name: m.name || '',
          percentage: percentage.toString(),
          milestoneType: m.milestone_type || 'custom',
          subcontractorFeeId: m.subcontractor_fee_id || null,
        }
      })
      setMilestones(loadedMilestones)
      setNextMilestoneId(loadedMilestones.length + 1)
    } else {
      // Set default milestones for new documents
      const docType = contractData.documentType || 'contract'
      const defaultMilestones = [
        { id: 'milestone-1', name: docType === 'proposal' ? 'Initial Sign Fee' : 'Initial Contract Fee', percentage: '20', milestoneType: 'initial_fee' },
        { id: 'milestone-2', name: 'Final Payment', percentage: '80', milestoneType: 'final_inspection' },
      ]
      setMilestones(defaultMilestones)
      setNextMilestoneId(3)
    }

    // Generate the auto Equipment & Materials scope item
    const equipmentMaterialsDescription = generateEquipmentMaterialsDescription()
    const hasEquipmentMaterials = equipmentMaterialsDescription.length > 0

    // Load scope of work items
    if (savedScopeOfWork && savedScopeOfWork.length > 0) {
      const loadedScope = savedScopeOfWork.map((item, idx) => ({
        id: `scope-${idx + 1}`,
        title: item.title || '',
        description: item.description || '',
      }))
      
      // Check if Equipment & Materials already exists
      const hasExisting = loadedScope.some(item => item.title === 'Equipment & Materials')
      
      if (hasEquipmentMaterials && !hasExisting) {
        // Add Equipment & Materials at the end
        const equipmentItem = {
          id: `scope-${loadedScope.length + 1}`,
          title: 'Equipment & Materials',
          description: equipmentMaterialsDescription,
          isAutoGenerated: true,
        }
        setScopeOfWork([...loadedScope, equipmentItem])
        setNextScopeId(loadedScope.length + 2)
      } else if (hasEquipmentMaterials && hasExisting) {
        // Update the existing Equipment & Materials item with fresh data
        const updatedScope = loadedScope.map(item => 
          item.title === 'Equipment & Materials' 
            ? { ...item, description: equipmentMaterialsDescription, isAutoGenerated: true }
            : item
        )
        setScopeOfWork(updatedScope)
        setNextScopeId(loadedScope.length + 1)
      } else {
        setScopeOfWork(loadedScope)
        setNextScopeId(loadedScope.length + 1)
      }
    } else {
      // Set default scope of work with Equipment & Materials if available
      const defaultScope = [{ id: 'scope-1', title: '', description: '' }]
      
      if (hasEquipmentMaterials) {
        defaultScope.push({
          id: 'scope-2',
          title: 'Equipment & Materials',
          description: equipmentMaterialsDescription,
          isAutoGenerated: true,
        })
        setScopeOfWork(defaultScope)
        setNextScopeId(3)
      } else {
        setScopeOfWork(defaultScope)
        setNextScopeId(2)
      }
    }
  }, [contractData])

  // ==================== MILESTONE FUNCTIONS ====================

  // Add a new milestone
  const addMilestone = () => {
    const newMilestone = {
      id: `milestone-${nextMilestoneId}`,
      name: '',
      percentage: '',
      milestoneType: 'custom',
    }
    setMilestones(prev => [...prev, newMilestone])
    setNextMilestoneId(prev => prev + 1)
  }

  // Remove a milestone
  const removeMilestone = (id) => {
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  // Update a milestone
  const updateMilestone = (id, field, value) => {
    setMilestones(prev => prev.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ))
  }

  // Update milestone percentage (and auto-calculate amount display)
  const updateMilestonePercentage = (id, percentage) => {
    setMilestones(prev => prev.map(m => 
      m.id === id ? { ...m, percentage } : m
    ))
  }

  // Update milestone by amount (auto-calculate percentage)
  const updateMilestoneByAmount = (id, amount) => {
    const total = parseFloat(totalCustomerPrice) || 0
    const amountValue = parseFloat(amount) || 0
    const percentage = total > 0 ? ((amountValue / total) * 100).toFixed(2) : '0'
    setMilestones(prev => prev.map(m => 
      m.id === id ? { ...m, percentage, _inputAmount: amount } : m
    ))
  }

  // Calculate the dollar amount from percentage
  const calculateAmount = (percentage) => {
    const total = parseFloat(totalCustomerPrice) || 0
    const pct = parseFloat(percentage) || 0
    return (total * pct) / 100
  }

  // ==================== SCOPE OF WORK FUNCTIONS ====================

  // Add a new scope of work item
  const addScopeItem = () => {
    const newItem = {
      id: `scope-${nextScopeId}`,
      title: '',
      description: '',
    }
    setScopeOfWork(prev => [...prev, newItem])
    setNextScopeId(prev => prev + 1)
  }

  // Remove a scope of work item
  const removeScopeItem = (id) => {
    setScopeOfWork(prev => prev.filter(item => item.id !== id))
  }

  // Update a scope of work item
  const updateScopeItem = (id, field, value) => {
    setScopeOfWork(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // Calculate totals
  const customerTotal = parseFloat(totalCustomerPrice) || 0
  const totalPercentage = milestones.reduce((sum, m) => sum + (parseFloat(m.percentage) || 0), 0)
  const profit = customerTotal - totalCost

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Save milestones to the database
  const saveMilestones = async () => {
    const token = await getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    const docType = contractData.documentType || 'contract'

    const milestonesToSave = milestones.map((m, index) => ({
      name: m.name || `Milestone ${index + 1}`,
      milestone_type: m.milestoneType || 'custom',
      cost: 0, // Cost is tracked at expense level, not milestone level in new system
      customer_price: calculateAmount(m.percentage),
      subcontractor_fee_id: m.subcontractorFeeId || null,
    }))

    const response = await axios.put(
      `/api/projects/${contractData.project.id}/milestones`,
      { 
        milestones: milestonesToSave,
        document_type: docType,
        customer_price: parseFloat(totalCustomerPrice) || 0, // Save total customer price to project
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    return response.data
  }

  // Save scope of work to the database
  const saveScopeOfWork = async () => {
    const token = await getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    const docType = contractData.documentType || 'contract'

    const scopeToSave = scopeOfWork
      .filter(item => item.title.trim()) // Only save items with a title
      .map(item => ({
        title: item.title,
        description: item.description || '',
      }))

    const response = await axios.put(
      `/api/projects/${contractData.project.id}/scope-of-work`,
      { 
        scopeOfWork: scopeToSave,
        document_type: docType,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    return response.data
  }

  // Save all data (milestones and scope of work)
  const handleSaveOnly = async () => {
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert(`Milestone percentages must add up to 100%. Currently at ${totalPercentage.toFixed(2)}%`)
      return
    }
    
    setSaving(true)
    try {
      await Promise.all([saveMilestones(), saveScopeOfWork()])
    } catch (error) {
      console.error('Error saving:', error)
      alert('Failed to save: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // Generate PDF with customer prices - now shows upload dialog
  const handleGeneratePdf = async () => {
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert(`Milestone percentages must add up to 100%. Currently at ${totalPercentage.toFixed(2)}%`)
      return
    }

    setGenerating(true)
    setSaving(true)
    setUploadError('')
    try {
      // Save milestones and scope of work to database first
      await Promise.all([saveMilestones(), saveScopeOfWork()])
      setSaving(false)

      // Build the customer payment schedule from milestones in the preview
      const customerPaymentSchedule = milestones
        .filter(m => m.name && parseFloat(m.percentage) > 0)
        .map(m => ({
          description: m.name,
          amount: calculateAmount(m.percentage),
        }))

      // Build scope of work items for the PDF
      const scopeOfWorkItems = scopeOfWork
        .filter(item => item.title.trim())
        .map(item => ({
          item: item.title,
          description: item.description || '',
        }))

      // Create modified contract data with customer prices and scope of work
      const modifiedContractData = {
        ...contractData,
        customerPaymentSchedule,
        customerGrandTotal: customerTotal,
        // Override change order items / scope of work with our custom entries
        changeOrderItems: scopeOfWorkItems,
        customScopeOfWork: scopeOfWorkItems,
      }

      // Generate the PDF blob
      const blob = await getContractPdfBlob(modifiedContractData)
      setPdfBlob(blob)
      
      // Set default document name and type based on document type
      const docType = contractData.documentType || 'contract'
      const docNum = contractData.documentNumber || 'DOC'
      const projectAddress = contractData.project?.address?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'Project'
      const typeLabel = docType === 'change_order' ? 'Change_Order' : docType.charAt(0).toUpperCase() + docType.slice(1)
      
      setUploadDocName(`${typeLabel}_${docNum}_${projectAddress}`)
      setUploadDocType(docType)
      setShowUploadDialog(true)
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF: ' + error.message)
    } finally {
      setGenerating(false)
      setSaving(false)
    }
  }

  // Handle the actual upload after user confirms file info
  const handleUploadDocument = async () => {
    if (!pdfBlob || !uploadDocName.trim() || !uploadDocType) {
      setUploadError('Please fill in all required fields')
      return
    }

    setUploading(true)
    setUploadError('')
    
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const companyID = user?.user_metadata?.companyID
      if (!companyID) {
        throw new Error('No company ID found')
      }

      // Create a File object from the blob
      const fileName = `${uploadDocName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

      // Use FormData for multipart/form-data upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', uploadDocName.trim())
      formData.append('document_type', uploadDocType)

      const response = await fetch(
        `/api/documents/projects/${contractData.project.id}/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      // Close dialog and notify parent
      setShowUploadDialog(false)
      setPdfBlob(null)
      setUploadDocName('')
      setUploadDocType('')
      
      // Refresh the documents list
      if (onDocumentUploaded) {
        onDocumentUploaded()
      }
      
      // Call onGenerate for any additional handling
      if (onGenerate) {
        onGenerate({
          ...contractData,
          documentNumber: contractData.documentNumber,
        })
      }
      
    } catch (error) {
      console.error('Error uploading document:', error)
      setUploadError(error.message || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  // Cancel upload and close dialog
  const handleCancelUpload = () => {
    setShowUploadDialog(false)
    setPdfBlob(null)
    setUploadDocName('')
    setUploadDocType('')
    setUploadError('')
  }

  if (!contractData) {
    return null
  }

  const docType = contractData.documentType || 'contract'

  // Mobile card component for milestones
  const MilestoneCard = ({ milestone, index }) => (
    <div className={`p-4 rounded-lg border ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Milestone {index + 1}</span>
        {milestones.length > 1 && (
          <button
            onClick={() => removeMilestone(milestone.id)}
            className="text-red-600 hover:text-red-800 text-sm font-medium p-1"
            title="Remove milestone"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
      <div className="space-y-3">
        <input
          type="text"
          value={milestone.name}
          onChange={(e) => updateMilestone(milestone.id, 'name', e.target.value)}
          placeholder="Milestone name"
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Percentage</label>
            <div className="relative">
              <input
                type="number"
                value={milestone.percentage}
                onChange={(e) => updateMilestonePercentage(milestone.id, e.target.value)}
                placeholder="0"
                className="w-full pr-8 pl-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                step="0.01"
                min="0"
                max="100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
              <input
                type="number"
                value={calculateAmount(milestone.percentage).toFixed(2)}
                onChange={(e) => updateMilestoneByAmount(milestone.id, e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Mobile card component for scope of work
  const ScopeCard = ({ item, index }) => (
    <div className={`p-4 rounded-lg border ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Work Item {index + 1}</span>
        {scopeOfWork.length > 1 && (
          <button
            onClick={() => removeScopeItem(item.id)}
            className="text-red-600 hover:text-red-800 text-sm font-medium p-1"
            title="Remove item"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
      <div className="space-y-3">
        <input
          type="text"
          value={item.title}
          onChange={(e) => updateScopeItem(item.id, 'title', e.target.value)}
          placeholder="Work title (e.g., Pool Excavation)"
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <textarea
          value={item.description}
          onChange={(e) => updateScopeItem(item.id, 'description', e.target.value)}
          placeholder="Description of work to be performed..."
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 sm:rounded-lg shadow-xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white leading-tight">
                {docType === 'proposal' ? 'Proposal' :
                 docType === 'change_order' ? 'Change Order' :
                 'Contract'} Preview
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                #{contractData.documentNumber} • {contractData.project?.address || 'Project'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 -mr-1 flex-shrink-0"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          {/* Total Customer Price Input */}
          <div className="mb-6 p-4 sm:p-6 bg-gradient-to-r from-pool-blue to-pool-dark rounded-lg text-white">
            <label className="block text-sm font-medium text-white/90 mb-2">
              Total Customer Price
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 text-xl">$</span>
              <input
                type="number"
                value={totalCustomerPrice}
                onChange={(e) => setTotalCustomerPrice(e.target.value)}
                placeholder="Enter total price"
                className="w-full pl-10 pr-4 py-4 bg-white/20 border border-white/30 rounded-lg text-2xl font-bold text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent"
                step="0.01"
                min="0"
              />
            </div>
            <p className="text-xs text-white/70 mt-2">
              Your total cost: {formatCurrency(totalCost)} • Profit: {formatCurrency(customerTotal - totalCost)}
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('scope')}
                className={`flex-1 sm:flex-none py-3 px-4 sm:px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'scope'
                    ? 'border-pool-blue text-pool-blue'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Scope of Work
                </span>
              </button>
              <button
                onClick={() => setActiveTab('milestones')}
                className={`flex-1 sm:flex-none py-3 px-4 sm:px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'milestones'
                    ? 'border-pool-blue text-pool-blue'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Milestones
                  {totalPercentage !== 100 && milestones.length > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${Math.abs(totalPercentage - 100) < 0.01 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {totalPercentage.toFixed(0)}%
                    </span>
                  )}
                </span>
              </button>
            </nav>
          </div>

          {/* Scope of Work Tab */}
          {activeTab === 'scope' && (
            <>
              {/* Info Banner */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                  <strong>Scope of Work:</strong> Define the work items that will be performed. Each item should have a title and optional description.
                </p>
              </div>

              {/* Mobile Card Layout */}
              <div className="sm:hidden space-y-3">
                {scopeOfWork.map((item, index) => (
                  <ScopeCard key={item.id} item={item} index={index} />
                ))}
                
                {/* Add Scope Item Button - Mobile */}
                <button
                  onClick={addScopeItem}
                  className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-pool-blue hover:text-pool-dark hover:border-pool-blue text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Work Item
                </button>
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-1/3">Work Title</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Description</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopeOfWork.map((item, index) => (
                      <tr key={item.id} className={`border-b border-gray-100 dark:border-gray-700 ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}>
                        <td className="py-3 px-4 align-top">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateScopeItem(item.id, 'title', e.target.value)}
                            placeholder="Enter work title"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-3 px-4 align-top">
                          <textarea
                            value={item.description}
                            onChange={(e) => updateScopeItem(item.id, 'description', e.target.value)}
                            placeholder="Description of work..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-3 px-4 text-right align-top">
                          {scopeOfWork.length > 1 && (
                            <button
                              onClick={() => removeScopeItem(item.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                              title="Remove item"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Add Scope Item Row */}
                    <tr>
                      <td colSpan={3} className="py-3 px-4">
                        <button
                          onClick={addScopeItem}
                          className="text-pool-blue hover:text-pool-dark text-sm font-medium flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Work Item
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Milestones Tab */}
          {activeTab === 'milestones' && (
            <>
              {/* Info Banner */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                  <strong>Payment Milestones:</strong> Add milestones and set what percentage of the total price is due at each stage.
                </p>
              </div>

              {/* Percentage Warning */}
              {totalPercentage !== 100 && milestones.length > 0 && (
                <div className={`mb-4 p-3 rounded-lg border ${Math.abs(totalPercentage - 100) < 0.01 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <p className="text-sm font-medium">
                    Total: {totalPercentage.toFixed(2)}% 
                    {Math.abs(totalPercentage - 100) > 0.01 && (
                      <span> — {totalPercentage < 100 ? `Add ${(100 - totalPercentage).toFixed(2)}% more` : `Remove ${(totalPercentage - 100).toFixed(2)}%`}</span>
                    )}
                  </p>
                </div>
              )}

              {/* Mobile Card Layout */}
              <div className="sm:hidden space-y-3">
                {milestones.map((milestone, index) => (
                  <MilestoneCard key={milestone.id} milestone={milestone} index={index} />
                ))}
                
                {/* Add Milestone Button - Mobile */}
                <button
                  onClick={addMilestone}
                  className="w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-pool-blue hover:text-pool-dark hover:border-pool-blue text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Milestone
                </button>

                {/* Mobile Total Card */}
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-gray-300 dark:border-gray-600 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900 dark:text-white">TOTAL</span>
                    <span className="font-bold text-gray-900 dark:text-white text-xl">{formatCurrency(customerTotal)}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {totalPercentage.toFixed(2)}% allocated
                  </div>
                </div>
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Milestone Name</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-32">Percentage</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-40">Amount</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((milestone, index) => (
                      <tr key={milestone.id} className={`border-b border-gray-100 dark:border-gray-700 ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={milestone.name}
                            onChange={(e) => updateMilestone(milestone.id, 'name', e.target.value)}
                            placeholder="Enter milestone name"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="relative inline-flex items-center">
                            <input
                              type="number"
                              value={milestone.percentage}
                              onChange={(e) => updateMilestonePercentage(milestone.id, e.target.value)}
                              placeholder="0"
                              className="w-24 pr-7 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              step="0.01"
                              min="0"
                              max="100"
                            />
                            <span className="absolute right-3 text-gray-500 dark:text-gray-400">%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="relative inline-flex items-center">
                            <span className="absolute left-3 text-gray-500 dark:text-gray-400">$</span>
                            <input
                              type="number"
                              value={calculateAmount(milestone.percentage).toFixed(2)}
                              onChange={(e) => updateMilestoneByAmount(milestone.id, e.target.value)}
                              placeholder="0.00"
                              className="w-32 pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {milestones.length > 1 && (
                            <button
                              onClick={() => removeMilestone(milestone.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                              title="Remove milestone"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Add Milestone Row */}
                    <tr>
                      <td colSpan={4} className="py-3 px-4">
                        <button
                          onClick={addMilestone}
                          className="text-pool-blue hover:text-pool-dark text-sm font-medium flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Milestone
                        </button>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                      <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">TOTAL</td>
                      <td className="py-4 px-4 text-right font-semibold">
                        <span className={totalPercentage === 100 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                          {totalPercentage.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white text-lg">
                        {formatCurrency(customerTotal)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {/* Profit Summary */}
          <div className="mt-4 sm:mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3 text-sm sm:text-base">Summary</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase">Total Cost</p>
                <p className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(totalCost)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase">Customer Total</p>
                <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(customerTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase">Profit</p>
                <p className={`text-base sm:text-lg font-semibold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(profit)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                  {totalCost > 0 ? ((profit / totalCost) * 100).toFixed(1) : (customerTotal > 0 ? '100' : '0')}% margin
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 active:bg-gray-400 text-gray-800 dark:text-white font-medium rounded-lg sm:rounded-md transition-colors text-base sm:text-sm order-3 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveOnly}
              disabled={generating || saving}
              className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-2 bg-pool-blue hover:bg-pool-dark active:bg-pool-dark text-white font-medium rounded-lg sm:rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base sm:text-sm order-2"
            >
              {saving && !generating ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                </>
              )}
            </button>
            <button
              onClick={handleGeneratePdf}
              disabled={generating || saving || !totalCustomerPrice}
              className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium rounded-lg sm:rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base sm:text-sm order-1 sm:order-3"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : generating ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="sm:hidden">Generate PDF</span>
                  <span className="hidden sm:inline">Save & Generate PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Upload Document Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={handleCancelUpload}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Dialog Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Save Document
                </h3>
                <button
                  onClick={handleCancelUpload}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Enter the document details to save it to your project files.
              </p>
            </div>

            {/* Dialog Body */}
            <div className="p-4 sm:p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm">
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Name *
                </label>
                <input
                  type="text"
                  value={uploadDocName}
                  onChange={(e) => setUploadDocName(e.target.value)}
                  placeholder="Enter document name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Document Type *
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select type...</option>
                  <option value="contract">Contract</option>
                  <option value="proposal">Proposal</option>
                  <option value="change_order">Change Order</option>
                  <option value="invoice">Invoice</option>
                  <option value="permit">Permit</option>
                  <option value="insurance">Insurance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>PDF generated and ready to upload</span>
                </div>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3">
              <button
                onClick={handleCancelUpload}
                disabled={uploading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-medium rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadDocument}
                disabled={uploading || !uploadDocName.trim() || !uploadDocType}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Save Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContractPreview
