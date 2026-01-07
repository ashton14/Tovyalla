import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { openContractPdf } from '../utils/contractPdfGenerator'

// Helper to format currency
const formatCurrency = (amount) => {
  if (!amount || isNaN(amount)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function ContractPreview({ contractData, onClose, onGenerate }) {
  const { supabase } = useAuth()
  const [milestones, setMilestones] = useState([])
  const [customRows, setCustomRows] = useState([]) // For change orders
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nextCustomRowId, setNextCustomRowId] = useState(1)

  // Helper to find saved customer price by milestone type and optional subcontractor fee id
  const findSavedPrice = (savedMilestones, milestoneType, subcontractorFeeId = null) => {
    if (!savedMilestones || savedMilestones.length === 0) return null
    
    const match = savedMilestones.find(m => {
      if (m.milestone_type !== milestoneType) return false
      // For subcontractor milestones, also match by subcontractor_fee_id
      if (milestoneType === 'subcontractor' && subcontractorFeeId) {
        return m.subcontractor_fee_id === subcontractorFeeId
      }
      return true
    })
    
    return match ? parseFloat(match.customer_price) || null : null
  }

  // Initialize milestones from expenses, using saved customer prices if available
  useEffect(() => {
    if (!contractData) return

    const { expenses, savedMilestones, documentType } = contractData
    const docType = documentType || 'contract'

    // For change orders, only show initial fee and custom rows
    if (docType === 'change_order') {
      const initialPrice = findSavedPrice(savedMilestones, 'initial_fee')
      const generatedMilestones = [{
        id: `new-initial-fee`,
        name: 'Initial Fee',
        costAmount: 0,
        customerPrice: initialPrice ?? 0,
        milestoneType: 'initial_fee',
        sortOrder: 0,
      }]
      setMilestones(generatedMilestones)
      
      // Initialize custom rows if any exist in saved milestones (change_order type)
      const savedCustomRows = savedMilestones?.filter(m => m.milestone_type === 'change_order_item') || []
      if (savedCustomRows.length > 0) {
        const rows = savedCustomRows.map((m, idx) => ({
          id: `custom-${idx + 1}`,
          name: m.name || '',
          description: m.description || '',
          costAmount: parseFloat(m.cost || 0),
          customerPrice: parseFloat(m.customer_price || 0),
        }))
        setCustomRows(rows)
        setNextCustomRowId(savedCustomRows.length + 1)
      } else {
        setCustomRows([])
        setNextCustomRowId(1)
      }
      return
    }

    // For both proposals and contracts, include all milestones in preview
    // (Proposals will filter them when building PDF payment schedule)

    // 1. Initial Contract/Sign Fee (use different names for proposals vs contracts)
    const generatedMilestones = []
    let sortOrder = 0
    const initialPrice = findSavedPrice(savedMilestones, 'initial_fee')
    generatedMilestones.push({
      id: `new-initial-fee`,
      name: docType === 'proposal' ? 'Initial Sign Fee' : 'Initial Contract Fee',
      costAmount: 0,
      customerPrice: initialPrice ?? 1000,
      milestoneType: 'initial_fee',
      sortOrder: sortOrder++,
    })

    // 2. Subcontractor Jobs
    if (expenses.subcontractorFees && expenses.subcontractorFees.length > 0) {
      expenses.subcontractorFees.forEach((fee) => {
        const costAmount = parseFloat(fee.expected_value || fee.flat_fee || 0)
        const prevPrice = findSavedPrice(savedMilestones, 'subcontractor', fee.id)
        generatedMilestones.push({
          id: `new-subcontractor-${fee.id}`,
          name: fee.job_description || 'Work',
          costAmount,
          customerPrice: prevPrice ?? costAmount, // Use previous price or default to cost
          milestoneType: 'subcontractor',
          subcontractorFeeId: fee.id,
          sortOrder: sortOrder++,
        })
      })
    }

    // 3. Equipment Order (always include if there are equipment items)
    if (expenses.equipment && Array.isArray(expenses.equipment) && expenses.equipment.length > 0) {
      let equipmentCost = 0
      expenses.equipment.forEach((eq) => {
        // Match expenses endpoint: prices are totals, not per-unit (no quantity multiplication)
        equipmentCost += parseFloat(eq.expected_price || eq.actual_price || 0)
      })
      const prevPrice = findSavedPrice(savedMilestones, 'equipment')
      generatedMilestones.push({
        id: `new-equipment`,
        name: 'Equipment Order',
        costAmount: equipmentCost,
        customerPrice: prevPrice ?? equipmentCost,
        milestoneType: 'equipment',
        sortOrder: sortOrder++,
      })
    }

    // 4. Material Order (always include if there are material items)
    let materialsCost = 0
    if (expenses.materials && expenses.materials.length > 0) {
      expenses.materials.forEach((mat) => {
        materialsCost += parseFloat(mat.expected_price || mat.actual_price || 0)
      })
      const prevPrice = findSavedPrice(savedMilestones, 'materials')
      generatedMilestones.push({
        id: `new-materials`,
        name: 'Material Order',
        costAmount: materialsCost,
        customerPrice: prevPrice ?? materialsCost,
        milestoneType: 'materials',
        sortOrder: sortOrder++,
      })
    }

    // 5. Additional Fees
    let additionalCost = 0
    if (expenses.additionalExpenses && expenses.additionalExpenses.length > 0) {
      expenses.additionalExpenses.forEach((exp) => {
        additionalCost += parseFloat(exp.expected_value || exp.amount || 0)
      })
    }
    if (additionalCost > 0) {
      const prevPrice = findSavedPrice(savedMilestones, 'additional')
      generatedMilestones.push({
        id: `new-additional`,
        name: 'Additional Fees',
        costAmount: additionalCost,
        customerPrice: prevPrice ?? additionalCost,
        milestoneType: 'additional',
        sortOrder: sortOrder++,
      })
    }

    // 6. Final Inspection Fee
    const finalPrice = findSavedPrice(savedMilestones, 'final_inspection')
    generatedMilestones.push({
      id: `new-final-inspection`,
      name: 'Final Inspection',
      costAmount: 0,
      customerPrice: finalPrice ?? 1000,
      milestoneType: 'final_inspection',
      sortOrder: sortOrder++,
    })

    setMilestones(generatedMilestones)
  }, [contractData])

  // Update a milestone's customer price
  const updateCustomerPrice = (id, value) => {
    setMilestones(prev => prev.map(m => 
      m.id === id ? { ...m, customerPrice: parseFloat(value) || 0 } : m
    ))
  }

  // Handle custom rows for change orders
  const addCustomRow = () => {
    const newRow = {
      id: `custom-${nextCustomRowId}`,
      name: '',
      description: '',
      costAmount: 0,
      customerPrice: 0,
    }
    setCustomRows(prev => [...prev, newRow])
    setNextCustomRowId(prev => prev + 1)
  }

  const removeCustomRow = (id) => {
    setCustomRows(prev => prev.filter(row => row.id !== id))
  }

  const updateCustomRow = (id, field, value) => {
    setCustomRows(prev => prev.map(row => 
      row.id === id ? { 
        ...row, 
        [field]: (field === 'name' || field === 'description') ? value : parseFloat(value) || 0 
      } : row
    ))
  }

  // Calculate totals
  const docType = contractData?.documentType || 'contract'
  const isChangeOrder = docType === 'change_order'
  
  let totalCost, totalCustomerPrice, profit
  if (isChangeOrder) {
    const initialFee = milestones.find(m => m.milestoneType === 'initial_fee')
    const initialFeePrice = initialFee?.customerPrice || 0
    const customRowsTotal = customRows.reduce((sum, row) => sum + (row.customerPrice || 0), 0)
    totalCustomerPrice = initialFeePrice + customRowsTotal
    totalCost = (initialFee?.costAmount || 0) + customRows.reduce((sum, row) => sum + (row.costAmount || 0), 0)
    profit = totalCustomerPrice - totalCost
  } else {
    totalCost = milestones.reduce((sum, m) => sum + m.costAmount, 0)
    totalCustomerPrice = milestones.reduce((sum, m) => sum + m.customerPrice, 0)
    profit = totalCustomerPrice - totalCost
  }

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Save milestones to the database
  const saveMilestones = async () => {
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      let milestonesToSave = []
      
      if (isChangeOrder) {
        // For change orders, save initial fee and custom rows
        const initialFee = milestones.find(m => m.milestoneType === 'initial_fee')
        if (initialFee) {
          milestonesToSave.push({
            name: initialFee.name,
            milestone_type: initialFee.milestoneType,
            cost: initialFee.costAmount,
            customer_price: initialFee.customerPrice,
            subcontractor_fee_id: null,
          })
        }
        
        // Save custom rows as change_order_item type
        customRows.forEach((row) => {
          milestonesToSave.push({
            name: row.name || 'Change Order Item',
            description: row.description || '',
            milestone_type: 'change_order_item',
            cost: row.costAmount,
            customer_price: row.customerPrice,
            subcontractor_fee_id: null,
          })
        })
      } else {
        // For contracts/proposals, save all milestones
        milestonesToSave = milestones.map((m, index) => ({
          name: m.name,
          milestone_type: m.milestoneType,
          cost: m.costAmount,
          customer_price: m.customerPrice,
          subcontractor_fee_id: m.subcontractorFeeId || null,
        }))
      }

      const response = await axios.put(
        `/api/projects/${contractData.project.id}/milestones`,
        { milestones: milestonesToSave },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      return response.data
    } catch (error) {
      console.error('Error saving milestones:', error)
      throw error
    }
  }

  // Save milestones only (without generating PDF)
  const handleSaveOnly = async () => {
    setSaving(true)
    try {
      await saveMilestones()
    } catch (error) {
      console.error('Error saving:', error)
      alert('Failed to save: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // Generate PDF with customer prices
  const handleGeneratePdf = async () => {
    setGenerating(true)
    setSaving(true)
    try {
      // Save milestones to database first
      await saveMilestones()
      setSaving(false)

      // Build the customer price schedule
      // For proposals, only include initial sign fee + balance message in PDF
      // For contracts, include all milestones
      const docType = contractData.documentType || 'contract'
      let customerPaymentSchedule
      
      if (docType === 'proposal') {
        // For proposals, only include initial sign fee (and balance message)
        const initialFee = milestones.find(m => m.milestoneType === 'initial_fee')
        customerPaymentSchedule = []
        if (initialFee) {
          customerPaymentSchedule.push({
            description: initialFee.name,
            amount: initialFee.customerPrice,
          })
        }
        customerPaymentSchedule.push({
          description: 'Balance of schedule will be provided with contract',
          amount: 0,
        })
      } else if (docType === 'change_order') {
        // For change orders, include initial fee, custom rows, and balance message
        const initialFee = milestones.find(m => m.milestoneType === 'initial_fee')
        customerPaymentSchedule = []
        if (initialFee) {
          customerPaymentSchedule.push({
            description: initialFee.name,
            amount: initialFee.customerPrice,
          })
        }
        // Add custom rows
        customRows.forEach((row) => {
          if (row.name && row.customerPrice) {
            customerPaymentSchedule.push({
              description: row.name,
              amount: row.customerPrice,
            })
          }
        })
        customerPaymentSchedule.push({
          description: 'Balance of schedule will be provided with contract',
          amount: 0,
        })
      } else {
        // For contracts, include all milestones
        customerPaymentSchedule = milestones.map(m => ({
          description: m.name,
          amount: m.customerPrice,
        }))
      }

      // Create modified contract data with customer prices
      // Grand total calculation
      const grandTotal = docType === 'change_order' 
        ? (milestones.find(m => m.milestoneType === 'initial_fee')?.customerPrice || 0) + 
          customRows.reduce((sum, row) => sum + (row.customerPrice || 0), 0)
        : totalCustomerPrice
      
      // For change orders, pass custom rows to PDF generator
      const modifiedContractData = {
        ...contractData,
        customerPaymentSchedule,
        customerGrandTotal: grandTotal,
        ...(docType === 'change_order' && { changeOrderItems: customRows }),
      }

      await openContractPdf(modifiedContractData)
      
      if (onGenerate) {
        onGenerate(modifiedContractData)
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF: ' + error.message)
    } finally {
      setGenerating(false)
      setSaving(false)
    }
  }

  if (!contractData) {
    return null
  }

  // Mobile card component for milestones
  const MilestoneCard = ({ milestone, index }) => (
    <div className={`p-4 rounded-lg border ${index % 2 === 0 ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-medium text-gray-900 text-base flex-1 pr-2">{milestone.name}</h4>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          <span className="text-xs uppercase tracking-wide">Cost:</span>
          <span className="ml-1 font-medium">{formatCurrency(milestone.costAmount)}</span>
        </div>
        {milestone.milestoneType === 'balance_message' ? (
          <span className="text-gray-500 italic text-sm">N/A</span>
        ) : (
          <div className="relative flex items-center">
            <span className="absolute left-3 text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={milestone.customerPrice || ''}
              onChange={(e) => updateCustomerPrice(milestone.id, e.target.value)}
              className="w-32 pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-right text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
              step="0.01"
              min="0"
              inputMode="decimal"
            />
          </div>
        )}
      </div>
    </div>
  )

  // Mobile card component for custom rows (change orders)
  const CustomRowCard = ({ row, index }) => (
    <div className={`p-4 rounded-lg border ${index % 2 === 0 ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Change Order Item</span>
        <button
          onClick={() => removeCustomRow(row.id)}
          className="text-red-600 hover:text-red-800 text-sm font-medium p-1"
          title="Remove row"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <div className="space-y-3">
        <input
          type="text"
          value={row.name}
          onChange={(e) => updateCustomRow(row.id, 'name', e.target.value)}
          placeholder="Enter item name"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
        />
        <textarea
          value={row.description || ''}
          onChange={(e) => updateCustomRow(row.id, 'description', e.target.value)}
          placeholder="Enter description"
          rows={2}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent resize-none"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Cost</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                value={row.costAmount || ''}
                onChange={(e) => updateCustomRow(row.id, 'costAmount', e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-right text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                step="0.01"
                min="0"
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Customer Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                value={row.customerPrice || ''}
                onChange={(e) => updateCustomRow(row.id, 'customerPrice', e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-right text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                step="0.01"
                min="0"
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-lg shadow-xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800 leading-tight">
                {(contractData.documentType || 'contract') === 'proposal' ? 'Proposal' :
                 (contractData.documentType || 'contract') === 'change_order' ? 'Change Order' :
                 'Contract'} Preview
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">
                #{contractData.documentNumber} • {contractData.project?.address || 'Project'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 -mr-1 flex-shrink-0"
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
          {/* Info Banner */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
              <strong>Set Customer Prices:</strong> <span className="hidden sm:inline">The "Cost" column shows your internal costs. </span>
              Enter prices you want to charge<span className="hidden sm:inline"> the customer</span>. 
              Only customer prices appear on the PDF.
            </p>
          </div>

          {/* Mobile Card Layout */}
          <div className="sm:hidden space-y-3">
            {(isChangeOrder 
              ? milestones.filter(m => m.milestoneType === 'initial_fee')
              : milestones
            ).map((milestone, index) => (
              <MilestoneCard key={milestone.id} milestone={milestone} index={index} />
            ))}
            
            {/* Custom Rows for Change Orders - Mobile */}
            {isChangeOrder && customRows.map((row, index) => (
              <CustomRowCard key={row.id} row={row} index={index} />
            ))}
            
            {/* Add Row Button for Change Orders - Mobile */}
            {isChangeOrder && (
              <button
                onClick={addCustomRow}
                className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-pool-blue hover:text-pool-dark hover:border-pool-blue text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Milestone
              </button>
            )}

            {/* Mobile Total Card */}
            <div className="p-4 bg-gray-100 rounded-lg border-2 border-gray-300 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">TOTAL</span>
                <span className="font-bold text-gray-900 text-xl">{formatCurrency(totalCustomerPrice)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Cost: {formatCurrency(totalCost)}
              </div>
            </div>
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    {isChangeOrder ? 'Milestone / Description' : 'Milestone'}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-500">Cost</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Customer Price</th>
                  {isChangeOrder && <th className="text-right py-3 px-4 font-semibold text-gray-700 w-20"></th>}
                </tr>
              </thead>
              <tbody>
                {/* All Milestones - filter based on document type */}
                {(isChangeOrder 
                  ? milestones.filter(m => m.milestoneType === 'initial_fee')
                  : milestones
                ).map((milestone, index) => (
                  <tr key={milestone.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{milestone.name}</div>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">
                      {formatCurrency(milestone.costAmount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {milestone.milestoneType === 'balance_message' ? (
                        <span className="text-gray-500 italic">N/A</span>
                      ) : (
                        <div className="relative inline-flex items-center">
                          <span className="absolute left-3 text-gray-500">$</span>
                          <input
                            type="number"
                            value={milestone.customerPrice || ''}
                            onChange={(e) => updateCustomerPrice(milestone.id, e.target.value)}
                            className="w-32 pl-7 pr-3 py-2 border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      )}
                    </td>
                    {isChangeOrder && <td></td>}
                  </tr>
                ))}
                {/* Custom Rows for Change Orders */}
                {isChangeOrder && customRows.map((row, index) => (
                  <tr key={row.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : ''}`}>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateCustomRow(row.id, 'name', e.target.value)}
                        placeholder="Enter item name"
                        className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                      />
                      <textarea
                        value={row.description || ''}
                        onChange={(e) => updateCustomRow(row.id, 'description', e.target.value)}
                        placeholder="Enter description"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent text-sm"
                      />
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">
                      <div className="relative inline-flex items-center">
                        <span className="absolute left-3 text-gray-500">$</span>
                        <input
                          type="number"
                          value={row.costAmount || ''}
                          onChange={(e) => updateCustomRow(row.id, 'costAmount', e.target.value)}
                          className="w-28 pl-7 pr-3 py-2 border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="relative inline-flex items-center">
                        <span className="absolute left-3 text-gray-500">$</span>
                        <input
                          type="number"
                          value={row.customerPrice || ''}
                          onChange={(e) => updateCustomRow(row.id, 'customerPrice', e.target.value)}
                          className="w-32 pl-7 pr-3 py-2 border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => removeCustomRow(row.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                        title="Remove row"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Add Row Button for Change Orders */}
                {isChangeOrder && (
                  <tr>
                    <td colSpan={4} className="py-3 px-4">
                      <button
                        onClick={addCustomRow}
                        className="text-pool-blue hover:text-pool-dark text-sm font-medium flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Milestone
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-100">
                  <td className="py-4 px-4 font-bold text-gray-900">TOTAL</td>
                  <td className="py-4 px-4 text-right font-semibold text-gray-500">
                    {formatCurrency(totalCost)}
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-gray-900 text-lg">
                    {formatCurrency(totalCustomerPrice)}
                  </td>
                  {isChangeOrder && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Profit Summary */}
          <div className="mt-4 sm:mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Summary</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase">Total Cost</p>
                <p className="text-base sm:text-lg font-semibold text-gray-700">{formatCurrency(totalCost)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase">Customer Total</p>
                <p className="text-base sm:text-lg font-semibold text-gray-900">{formatCurrency(totalCustomerPrice)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase">Profit</p>
                <p className={`text-base sm:text-lg font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(profit)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">
                  {totalCost > 0 ? ((profit / totalCost) * 100).toFixed(1) : 0}% margin
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-2 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-800 font-medium rounded-lg sm:rounded-md transition-colors text-base sm:text-sm order-3 sm:order-1"
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
              disabled={generating || saving}
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
    </div>
  )
}

export default ContractPreview
