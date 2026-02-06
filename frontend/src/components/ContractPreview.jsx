import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { getContractPdfBlob } from '../utils/contractPdfGenerator'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Helper to format currency
const formatCurrency = (amount) => {
  if (!amount || isNaN(amount)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// Drag handle icon component
const DragHandle = ({ listeners, attributes }) => (
  <button
    {...listeners}
    {...attributes}
    className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none"
    title="Drag to reorder"
  >
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
  </button>
)

// Sortable mobile card component for milestones - defined outside to prevent recreation on render
const SortableMilestoneCard = ({ milestone, index, milestonesLength, removeMilestone, updateMilestone, formatCurrency, calculatedFeePrice }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: milestone.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isFeeMilestone = milestone.milestoneType === 'initial_fee' || milestone.milestoneType === 'final_inspection'
  const cost = milestone.cost || 0
  
  // For fee milestones, use the calculated fee price; otherwise use markup calculation
  let customerPrice
  if (isFeeMilestone) {
    customerPrice = milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== ''
      ? parseFloat(milestone.flatPrice) || 0
      : calculatedFeePrice || 0
  } else {
    customerPrice = milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== ''
      ? parseFloat(milestone.flatPrice) || 0
      : cost * (1 + (parseFloat(milestone.markupPercent) || 0) / 100)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-lg border ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'} ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <DragHandle listeners={listeners} attributes={attributes} />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Milestone {index + 1}</span>
        </div>
        {milestonesLength > 1 && (
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
        {/* Cost display - hide for fee milestones */}
        {!isFeeMilestone && (
          <div className="flex justify-between items-center py-2 px-3 bg-gray-100 dark:bg-gray-600 rounded-lg">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cost</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatCurrency(cost)}</span>
          </div>
        )}
        {isFeeMilestone ? (
          /* Fee milestone - just show price */
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
              <input
                type="number"
                value={milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== '' ? milestone.flatPrice : customerPrice.toFixed(2)}
                onChange={(e) => updateMilestone(milestone.id, 'flatPrice', e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                step="0.01"
                min="0"
              />
            </div>
            {milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== '' && (
              <button
                onClick={() => updateMilestone(milestone.id, 'flatPrice', null)}
                className="text-xs text-pool-blue hover:text-pool-dark mt-1"
              >
                Use default
              </button>
            )}
          </div>
        ) : (
          /* Regular milestone - show markup and price */
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Markup %</label>
              <div className="relative">
                <input
                  type="number"
                  value={milestone.markupPercent || ''}
                  onChange={(e) => updateMilestone(milestone.id, 'markupPercent', e.target.value)}
                  placeholder="0"
                  className="w-full pr-8 pl-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  step="1"
                  min="0"
                  disabled={milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== ''}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                <input
                  type="number"
                  value={milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== '' ? milestone.flatPrice : customerPrice.toFixed(2)}
                  onChange={(e) => updateMilestone(milestone.id, 'flatPrice', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  step="0.01"
                  min="0"
                />
              </div>
              {milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== '' && (
                <button
                  onClick={() => updateMilestone(milestone.id, 'flatPrice', null)}
                  className="text-xs text-pool-blue hover:text-pool-dark mt-1"
                >
                  Use markup instead
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Sortable mobile card component for scope of work - defined outside to prevent recreation on render
const SortableScopeCard = ({ item, index, scopeLength, removeScopeItem, updateScopeItem }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-lg border ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'} ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <DragHandle listeners={listeners} attributes={attributes} />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Work Item {index + 1}</span>
        </div>
        {scopeLength > 1 && (
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
}

// Sortable table row for milestones (desktop) - defined outside to prevent recreation on render
const SortableMilestoneRow = ({ milestone, index, milestonesLength, removeMilestone, updateMilestone, formatCurrency, calculatedFeePrice }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: milestone.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isFeeMilestone = milestone.milestoneType === 'initial_fee' || milestone.milestoneType === 'final_inspection'
  const cost = milestone.cost || 0
  
  // For fee milestones, use the calculated fee price; otherwise use markup calculation
  let customerPrice
  if (isFeeMilestone) {
    customerPrice = milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== ''
      ? parseFloat(milestone.flatPrice) || 0
      : calculatedFeePrice || 0
  } else {
    customerPrice = milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== ''
      ? parseFloat(milestone.flatPrice) || 0
      : cost * (1 + (parseFloat(milestone.markupPercent) || 0) / 100)
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-100 dark:border-gray-700 ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/50' : ''} ${isDragging ? 'shadow-lg bg-white dark:bg-gray-700' : ''}`}
    >
      <td className="py-3 px-2 w-10">
        <DragHandle listeners={listeners} attributes={attributes} />
      </td>
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
        {isFeeMilestone ? (
          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
        ) : (
          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(cost)}</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        {isFeeMilestone ? (
          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
        ) : (
          <div className="relative inline-flex items-center">
            <input
              type="number"
              value={milestone.markupPercent || ''}
              onChange={(e) => updateMilestone(milestone.id, 'markupPercent', e.target.value)}
              placeholder="0"
              className="w-20 pr-7 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              step="1"
              min="0"
              disabled={milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== ''}
            />
            <span className="absolute right-3 text-gray-500">%</span>
          </div>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <div className="relative inline-flex items-center">
            <span className="absolute left-3 text-gray-500 dark:text-gray-400">$</span>
            <input
              type="number"
              value={milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== '' ? milestone.flatPrice : customerPrice.toFixed(2)}
              onChange={(e) => updateMilestone(milestone.id, 'flatPrice', e.target.value)}
              className="w-28 pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              step="0.01"
              min="0"
            />
          </div>
          {milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== '' && (
            <button
              onClick={() => updateMilestone(milestone.id, 'flatPrice', null)}
              className="text-pool-blue hover:text-pool-dark p-1"
              title={isFeeMilestone ? "Use default" : "Use markup instead"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        {milestonesLength > 1 && (
          <button
            onClick={() => removeMilestone(milestone.id)}
            className="text-red-600 hover:text-red-800 p-1"
            title="Remove milestone"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  )
}

// Sortable table row for scope of work (desktop) - defined outside to prevent recreation on render
const SortableScopeRow = ({ item, index, scopeLength, removeScopeItem, updateScopeItem }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-100 dark:border-gray-700 ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/50' : ''} ${isDragging ? 'shadow-lg bg-white dark:bg-gray-700' : ''}`}
    >
      <td className="py-3 px-2 w-10 align-top">
        <DragHandle listeners={listeners} attributes={attributes} />
      </td>
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
        {scopeLength > 1 && (
          <button
            onClick={() => removeScopeItem(item.id)}
            className="text-red-600 hover:text-red-800 p-1"
            title="Remove item"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  )
}

function ContractPreview({ contractData, onClose, onGenerate, onDocumentUploaded }) {
  const { supabase, user } = useAuth()
  const [activeTab, setActiveTab] = useState('scope') // 'scope' or 'milestones'
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
  
  // Import from project state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importType, setImportType] = useState('scope') // 'scope' or 'milestones'
  const [projectsList, setProjectsList] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [selectedImportProject, setSelectedImportProject] = useState(null)
  const [importableScopeItems, setImportableScopeItems] = useState([])
  const [importableMilestoneItems, setImportableMilestoneItems] = useState([])
  const [selectedImportScopeItems, setSelectedImportScopeItems] = useState([])
  const [selectedImportMilestoneItems, setSelectedImportMilestoneItems] = useState([])
  const [loadingImportItems, setLoadingImportItems] = useState(false)

  // DnD sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for scope of work
  const handleScopeDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      setScopeOfWork((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  // Handle drag end for milestones
  const handleMilestoneDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      setMilestones((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

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
        lines.push(`• ${name} (${quantity} ${unit}${quantity !== 1 && !unit.endsWith('s') ? 's' : ''})`)
      })
    }
    
    // Add materials items
    if (expenses.materials && expenses.materials.length > 0) {
      expenses.materials.forEach((mat) => {
        const name = mat.inventory?.name || mat.name || 'Unknown Material'
        const quantity = mat.quantity || 1
        const unit = mat.inventory?.unit || 'unit'
        lines.push(`• ${name} (${quantity} ${unit}${quantity !== 1 && !unit.endsWith('s') ? 's' : ''})`)
      })
    }
    
    return lines.join('\n')
  }

  // Generate Subcontractor Work description from expenses
  const generateSubcontractorsDescription = () => {
    if (!contractData?.expenses) return ''
    
    const { expenses } = contractData
    const lines = []
    
    if (expenses.subcontractorFees && expenses.subcontractorFees.length > 0) {
      expenses.subcontractorFees.forEach((fee) => {
        const jobDesc = fee.job_description || 'Work'
        lines.push(`• ${jobDesc}`)
      })
    }
    
    return lines.join('\n')
  }

  // Generate Additional Services description from expenses
  const generateAdditionalExpensesDescription = () => {
    if (!contractData?.expenses) return ''
    
    const { expenses } = contractData
    const lines = []
    
    if (expenses.additionalExpenses && expenses.additionalExpenses.length > 0) {
      expenses.additionalExpenses.forEach((exp) => {
        const description = exp.description || 'Additional service'
        const category = exp.category ? ` [${exp.category}]` : ''
        lines.push(`• ${description}${category}`)
      })
    }
    
    return lines.join('\n')
  }

  // Helper function to calculate cost for a milestone based on its type and linked expense
  const calculateMilestoneCost = (milestoneType, subcontractorFeeId = null, additionalExpenseId = null) => {
    const expenses = contractData?.expenses || {}
    
    switch (milestoneType) {
      case 'subcontractor': {
        if (subcontractorFeeId && expenses.subcontractorFees) {
          const fee = expenses.subcontractorFees.find(f => f.id === subcontractorFeeId)
          if (fee) return parseFloat(fee.flat_fee || fee.expected_value || 0)
        }
        return 0
      }
      case 'equipment_materials': {
        let total = 0
        if (expenses.equipment && Array.isArray(expenses.equipment)) {
          expenses.equipment.forEach(eq => {
            total += parseFloat(eq.actual_price || eq.expected_price || 0)
          })
        }
        if (expenses.materials) {
          expenses.materials.forEach(mat => {
            total += parseFloat(mat.actual_price || mat.expected_price || 0)
          })
        }
        return total
      }
      case 'additional': {
        if (additionalExpenseId && expenses.additionalExpenses) {
          const exp = expenses.additionalExpenses.find(e => e.id === additionalExpenseId)
          if (exp) return parseFloat(exp.amount || exp.expected_value || 0)
        }
        return 0
      }
      case 'initial_fee':
      case 'final_inspection':
      case 'custom':
      default:
        return 0
    }
  }

  // Initialize from saved data if available
  useEffect(() => {
    if (!contractData) return

    const { savedMilestones, savedScopeOfWork } = contractData
    const expenses = contractData?.expenses || {}
    const defaultMarkup = contractData.company?.default_markup_percent ?? 30

    // Load milestones
    if (savedMilestones && savedMilestones.length > 0) {
      // Convert saved milestones to our new format with cost and markupPercent
      const loadedMilestones = savedMilestones.map((m, idx) => {
        const cost = m.cost ?? calculateMilestoneCost(m.milestone_type, m.subcontractor_fee_id, m.additional_expense_id)
        return {
          id: `milestone-${idx + 1}`,
          name: m.name || '',
          cost: cost,
          markupPercent: m.markup_percent ?? defaultMarkup,
          flatPrice: m.flat_price ?? null,
          milestoneType: m.milestone_type || 'custom',
          subcontractorFeeId: m.subcontractor_fee_id || null,
          additionalExpenseId: m.additional_expense_id || null,
        }
      })
      setMilestones(loadedMilestones)
      setNextMilestoneId(loadedMilestones.length + 1)
    } else {
      // Set default milestones for new documents using company defaults
      const docType = contractData.documentType || 'contract'
      const company = contractData.company || {}
      
      // Get auto-include preferences (default to true if not set)
      const autoIncludeInitial = company.auto_include_initial_payment !== false
      const autoIncludeFinal = company.auto_include_final_payment !== false
      const autoIncludeSubcontractor = company.auto_include_subcontractor !== false
      const autoIncludeEquipmentMaterials = company.auto_include_equipment_materials !== false
      const autoIncludeAdditional = company.auto_include_additional_expenses !== false
      
      const defaultMilestones = []
      let milestoneId = 1

      // Start with initial fee (no cost, just markup-based fee) - if enabled
      if (autoIncludeInitial) {
        defaultMilestones.push({
          id: `milestone-${milestoneId}`,
          name: docType === 'proposal' ? 'Initial Sign Fee' : 'Initial Contract Fee',
          cost: 0,
          markupPercent: defaultMarkup,
          flatPrice: null,
          milestoneType: 'initial_fee',
        })
        milestoneId++
      }

      // Add individual milestone for each subcontractor fee - if enabled
      if (autoIncludeSubcontractor && expenses.subcontractorFees && expenses.subcontractorFees.length > 0) {
        expenses.subcontractorFees.forEach((fee) => {
          const jobDesc = fee.job_description || 'Work'
          const cost = parseFloat(fee.flat_fee || fee.expected_value || 0)
          defaultMilestones.push({
            id: `milestone-${milestoneId}`,
            name: `${jobDesc}`,
            cost: cost,
            markupPercent: defaultMarkup,
            flatPrice: null,
            milestoneType: 'subcontractor',
            subcontractorFeeId: fee.id || null,
          })
          milestoneId++
        })
      }

      // Add single combined milestone for Equipment & Materials - if enabled
      if (autoIncludeEquipmentMaterials) {
        const hasEquipment = expenses.equipment && Array.isArray(expenses.equipment) && expenses.equipment.length > 0
        const hasMaterials = expenses.materials && expenses.materials.length > 0
        if (hasEquipment || hasMaterials) {
          let equipmentMaterialsCost = 0
          if (expenses.equipment && Array.isArray(expenses.equipment)) {
            expenses.equipment.forEach(eq => {
              equipmentMaterialsCost += parseFloat(eq.actual_price || eq.expected_price || 0)
            })
          }
          if (expenses.materials) {
            expenses.materials.forEach(mat => {
              equipmentMaterialsCost += parseFloat(mat.actual_price || mat.expected_price || 0)
            })
          }
          defaultMilestones.push({
            id: `milestone-${milestoneId}`,
            name: 'Equipment & Materials',
            cost: equipmentMaterialsCost,
            markupPercent: defaultMarkup,
            flatPrice: null,
            milestoneType: 'equipment_materials',
          })
          milestoneId++
        }
      }

      // Add individual milestone for each additional expense - if enabled
      if (autoIncludeAdditional && expenses.additionalExpenses && expenses.additionalExpenses.length > 0) {
        expenses.additionalExpenses.forEach((exp) => {
          const description = exp.description || 'Additional Service'
          const cost = parseFloat(exp.amount || exp.expected_value || 0)
          defaultMilestones.push({
            id: `milestone-${milestoneId}`,
            name: description,
            cost: cost,
            markupPercent: defaultMarkup,
            flatPrice: null,
            milestoneType: 'additional',
            additionalExpenseId: exp.id || null,
          })
          milestoneId++
        })
      }

      // Add final payment at the end (no cost, just markup-based fee) - if enabled
      if (autoIncludeFinal) {
        defaultMilestones.push({
          id: `milestone-${milestoneId}`,
          name: 'Final Payment',
          cost: 0,
          markupPercent: defaultMarkup,
          flatPrice: null,
          milestoneType: 'final_inspection',
        })
        milestoneId++
      }

      setMilestones(defaultMilestones)
      setNextMilestoneId(milestoneId)
    }

    // Generate auto-generated scope items from expenses
    const equipmentMaterialsDescription = generateEquipmentMaterialsDescription()
    const subcontractorsDescription = generateSubcontractorsDescription()
    const additionalExpensesDescription = generateAdditionalExpensesDescription()

    // Get auto-include preferences for scope (default to true if not set)
    const company = contractData.company || {}
    const autoIncludeSubcontractorScope = company.auto_include_subcontractor !== false
    const autoIncludeEquipmentMaterialsScope = company.auto_include_equipment_materials !== false
    const autoIncludeAdditionalScope = company.auto_include_additional_expenses !== false

    // Define auto-generated scope items - only include if preference is enabled
    const autoGeneratedItems = [
      { title: 'Subcontractor Work', description: subcontractorsDescription, hasContent: autoIncludeSubcontractorScope && subcontractorsDescription.length > 0 },
      { title: 'Equipment & Materials', description: equipmentMaterialsDescription, hasContent: autoIncludeEquipmentMaterialsScope && equipmentMaterialsDescription.length > 0 },
      { title: 'Additional Services', description: additionalExpensesDescription, hasContent: autoIncludeAdditionalScope && additionalExpensesDescription.length > 0 },
    ].filter(item => item.hasContent)

    // Load scope of work items
    if (savedScopeOfWork && savedScopeOfWork.length > 0) {
      let loadedScope = savedScopeOfWork.map((item, idx) => ({
        id: `scope-${idx + 1}`,
        title: item.title || '',
        description: item.description || '',
      }))
      
      // Process each auto-generated item
      autoGeneratedItems.forEach((autoItem) => {
        const existingIndex = loadedScope.findIndex(item => item.title === autoItem.title)
        
        if (existingIndex >= 0) {
          // Update existing item with fresh data
          loadedScope[existingIndex] = {
            ...loadedScope[existingIndex],
            description: autoItem.description,
            isAutoGenerated: true,
          }
        } else {
          // Add new auto-generated item at the end
          loadedScope.push({
            id: `scope-${loadedScope.length + 1}`,
            title: autoItem.title,
            description: autoItem.description,
            isAutoGenerated: true,
          })
        }
      })

      setScopeOfWork(loadedScope)
      setNextScopeId(loadedScope.length + 1)
    } else {
      // Set default scope of work with only auto-generated items (no blank item)
      const defaultScope = autoGeneratedItems.map((autoItem, idx) => ({
        id: `scope-${idx + 1}`,
        title: autoItem.title,
        description: autoItem.description,
        isAutoGenerated: true,
      }))

      setScopeOfWork(defaultScope)
      setNextScopeId(defaultScope.length + 1)
    }
  }, [contractData])

  // ==================== MILESTONE FUNCTIONS ====================

  // Add a new milestone
  const addMilestone = () => {
    const defaultMarkup = contractData?.company?.default_markup_percent ?? 30
    const newMilestone = {
      id: `milestone-${nextMilestoneId}`,
      name: '',
      cost: 0,
      markupPercent: defaultMarkup,
      flatPrice: null,
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

  // Calculate fee price for initial/final milestones based on company settings
  // Uses the sum of milestone costs (before markup) as the base
  const calculateFeePrice = (milestoneType) => {
    const company = contractData?.company || {}
    
    // Calculate total milestone costs (excluding fee milestones which have no cost)
    const milestoneCostTotal = milestones.reduce((sum, m) => {
      if (m.milestoneType === 'initial_fee' || m.milestoneType === 'final_inspection') {
        return sum
      }
      return sum + (m.cost || 0)
    }, 0)
    
    if (milestoneType === 'initial_fee') {
      const percent = parseFloat(company.default_initial_fee_percent) || 20
      const min = parseFloat(company.default_initial_fee_min) || 0
      const max = parseFloat(company.default_initial_fee_max) || Infinity
      
      let amount = (milestoneCostTotal * percent) / 100
      if (min > 0 && amount < min) amount = min
      if (max < Infinity && amount > max) amount = max
      return amount
    }
    
    if (milestoneType === 'final_inspection') {
      const percent = parseFloat(company.default_final_fee_percent) || 80
      const min = parseFloat(company.default_final_fee_min) || 0
      const max = parseFloat(company.default_final_fee_max) || Infinity
      
      let amount = (milestoneCostTotal * percent) / 100
      if (min > 0 && amount < min) amount = min
      if (max < Infinity && amount > max) amount = max
      return amount
    }
    
    return 0
  }

  // Calculate customer price for a milestone
  const getMilestonePrice = (milestone) => {
    // If flat price is set, use it
    if (milestone.flatPrice !== null && milestone.flatPrice !== undefined && milestone.flatPrice !== '') {
      return parseFloat(milestone.flatPrice) || 0
    }
    
    // For fee milestones, use the calculated fee price
    if (milestone.milestoneType === 'initial_fee' || milestone.milestoneType === 'final_inspection') {
      return calculateFeePrice(milestone.milestoneType)
    }
    
    // For regular milestones, use cost + markup
    const cost = milestone.cost || 0
    return cost * (1 + (parseFloat(milestone.markupPercent) || 0) / 100)
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
  const totalMilestoneCost = milestones.reduce((sum, m) => sum + (m.cost || 0), 0)
  const customerTotal = milestones.reduce((sum, m) => sum + getMilestonePrice(m), 0)
  const profit = customerTotal - totalCost
  const profitMargin = customerTotal > 0 ? (profit / customerTotal) * 100 : 0
  const markupPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0

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
      cost: m.cost || 0,
      markup_percent: m.markupPercent || 0,
      flat_price: m.flatPrice || null,
      customer_price: getMilestonePrice(m),
      subcontractor_fee_id: m.subcontractorFeeId || null,
      additional_expense_id: m.additionalExpenseId || null,
    }))

    // Calculate the actual total (sum of milestone amounts)
    const actualTotalPrice = milestonesToSave.reduce((sum, m) => sum + m.customer_price, 0)

    const response = await axios.put(
      `/api/projects/${contractData.project.id}/milestones`,
      { 
        milestones: milestonesToSave,
        document_type: docType,
        customer_price: actualTotalPrice, // Save actual total with min/max applied to project
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
    if (milestones.length === 0) {
      alert('Please add at least one milestone')
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
    if (milestones.length === 0 || customerTotal <= 0) {
      alert('Please add at least one milestone with a price')
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
        .filter(m => m.name && getMilestonePrice(m) > 0)
        .map(m => ({
          description: m.name,
          amount: getMilestonePrice(m),
        }))

      // Build scope of work items for the PDF
      const scopeOfWorkItems = scopeOfWork
        .filter(item => item.title.trim())
        .map(item => ({
          item: item.title,
          description: item.description || '',
        }))

      // Calculate the actual grand total (sum of all milestone amounts)
      const actualGrandTotal = customerPaymentSchedule.reduce((sum, item) => sum + item.amount, 0)

      // Create modified contract data with customer prices and scope of work
      const modifiedContractData = {
        ...contractData,
        customerPaymentSchedule,
        customerGrandTotal: actualGrandTotal,
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

  // ==================== IMPORT FROM PROJECT FUNCTIONS ====================

  // Open import modal
  const openImportModal = (type) => {
    setImportType(type)
    setShowImportModal(true)
    setSelectedImportProject(null)
    setImportableScopeItems([])
    setImportableMilestoneItems([])
    setSelectedImportScopeItems([])
    setSelectedImportMilestoneItems([])
    setProjectSearch('')
    fetchProjects()
  }

  // Fetch all projects for import
  const fetchProjects = async () => {
    setProjectsLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) return

      const response = await axios.get('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      })

      // Filter out the current project
      const otherProjects = (response.data.projects || []).filter(
        (p) => p.id !== contractData.project.id
      )
      setProjectsList(otherProjects)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setProjectsLoading(false)
    }
  }

  // Fetch scope of work and milestones for a selected project (all document types)
  const fetchProjectItems = async (projectId) => {
    setLoadingImportItems(true)
    setSelectedImportScopeItems([])
    setSelectedImportMilestoneItems([])
    try {
      const token = await getAuthToken()
      if (!token) return

      const documentTypes = ['proposal', 'contract', 'change_order']
      const allScopeItems = []
      const allMilestoneItems = []

      // Fetch scope of work for all document types
      const scopeResponses = await Promise.all(
        documentTypes.map((docType) =>
          axios.get(`/api/projects/${projectId}/scope-of-work?document_type=${docType}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => ({ data: { scopeOfWork: [] } }))
        )
      )

      documentTypes.forEach((docType, typeIdx) => {
        const items = scopeResponses[typeIdx].data.scopeOfWork || []
        items.forEach((item, idx) => {
          allScopeItems.push({
            id: `import-scope-${docType}-${idx}`,
            title: item.title,
            description: item.description || '',
            documentType: docType,
          })
        })
      })

      // Fetch milestones for all document types
      const milestoneResponses = await Promise.all(
        documentTypes.map((docType) =>
          axios.get(`/api/projects/${projectId}/milestones?document_type=${docType}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => ({ data: { milestones: [] } }))
        )
      )

      documentTypes.forEach((docType, typeIdx) => {
        const items = milestoneResponses[typeIdx].data.milestones || []
        items.forEach((item, idx) => {
          allMilestoneItems.push({
            id: `import-milestone-${docType}-${idx}`,
            name: item.name,
            milestoneType: item.milestone_type || 'custom',
            cost: item.cost || 0,
            documentType: docType,
          })
        })
      })

      setImportableScopeItems(allScopeItems)
      setImportableMilestoneItems(allMilestoneItems)
    } catch (error) {
      console.error('Error fetching project items:', error)
      setImportableScopeItems([])
      setImportableMilestoneItems([])
    } finally {
      setLoadingImportItems(false)
    }
  }

  // Handle project selection
  const handleSelectImportProject = (project) => {
    setSelectedImportProject(project)
    fetchProjectItems(project.id)
  }

  // Toggle scope item selection
  const toggleImportScopeItemSelection = (itemId) => {
    setSelectedImportScopeItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    )
  }

  // Toggle milestone item selection
  const toggleImportMilestoneItemSelection = (itemId) => {
    setSelectedImportMilestoneItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    )
  }

  // Select all scope items
  const selectAllImportScopeItems = () => {
    if (selectedImportScopeItems.length === importableScopeItems.length) {
      setSelectedImportScopeItems([])
    } else {
      setSelectedImportScopeItems(importableScopeItems.map((item) => item.id))
    }
  }

  // Select all milestone items
  const selectAllImportMilestoneItems = () => {
    if (selectedImportMilestoneItems.length === importableMilestoneItems.length) {
      setSelectedImportMilestoneItems([])
    } else {
      setSelectedImportMilestoneItems(importableMilestoneItems.map((item) => item.id))
    }
  }

  // Import selected items
  const handleImportItems = () => {
    if (importType === 'scope') {
      // Import selected scope items
      const scopeItemsToImport = importableScopeItems.filter((item) =>
        selectedImportScopeItems.includes(item.id)
      )
      if (scopeItemsToImport.length > 0) {
        const newScopeItems = scopeItemsToImport.map((item, idx) => ({
          id: `scope-${nextScopeId + idx}`,
          title: item.title,
          description: item.description || '',
        }))
        setScopeOfWork((prev) => [...prev, ...newScopeItems])
        setNextScopeId((prev) => prev + scopeItemsToImport.length)
      }
    } else {
      // Import selected milestone items
      const milestoneItemsToImport = importableMilestoneItems.filter((item) =>
        selectedImportMilestoneItems.includes(item.id)
      )
      if (milestoneItemsToImport.length > 0) {
        const defaultMarkup = contractData?.company?.default_markup_percent ?? 30
        
        const newMilestones = milestoneItemsToImport.map((item, idx) => ({
          id: `milestone-${nextMilestoneId + idx}`,
          name: item.name,
          cost: item.cost || 0,
          markupPercent: defaultMarkup,
          flatPrice: null,
          milestoneType: item.milestoneType || 'custom',
        }))
        setMilestones((prev) => [...prev, ...newMilestones])
        setNextMilestoneId((prev) => prev + milestoneItemsToImport.length)
      }
    }

    // Close modal
    setShowImportModal(false)
    setSelectedImportProject(null)
    setImportableScopeItems([])
    setImportableMilestoneItems([])
    setSelectedImportScopeItems([])
    setSelectedImportMilestoneItems([])
  }

  // Filter projects by search
  const filteredProjects = projectsList.filter((project) => {
    if (!projectSearch.trim()) return true
    const search = projectSearch.toLowerCase()
    const projectName = (project.project_name || '').toLowerCase()
    const address = (project.address || '').toLowerCase()
    const customerName = project.customers
      ? `${project.customers.first_name || ''} ${project.customers.last_name || ''}`.toLowerCase()
      : ''
    return (
      projectName.includes(search) ||
      address.includes(search) ||
      customerName.includes(search)
    )
  })

  if (!contractData) {
    return null
  }

  const docType = contractData.documentType || 'contract'

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
                  {scopeOfWork.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {scopeOfWork.length}
                    </span>
                  )}
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
                  {milestones.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {milestones.length}
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
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                  <strong>Scope of Work:</strong> Define the work items that will be performed. Each item should have a title and optional description.
                </p>
                <button
                  onClick={() => openImportModal('scope')}
                  className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Import from Project
                </button>
              </div>

              {/* Mobile Card Layout */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleScopeDragEnd}>
                <SortableContext items={scopeOfWork.map(item => item.id)} strategy={verticalListSortingStrategy}>
                  <div className="sm:hidden space-y-3">
                    {scopeOfWork.map((item, index) => (
                      <SortableScopeCard 
                        key={item.id} 
                        item={item} 
                        index={index} 
                        scopeLength={scopeOfWork.length}
                        removeScopeItem={removeScopeItem}
                        updateScopeItem={updateScopeItem}
                      />
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
                </SortableContext>
              </DndContext>

              {/* Desktop Table Layout */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleScopeDragEnd}>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="w-10"></th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-1/3">Work Title</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Description</th>
                        <th className="w-20"></th>
                      </tr>
                    </thead>
                    <SortableContext items={scopeOfWork.map(item => item.id)} strategy={verticalListSortingStrategy}>
                      <tbody>
                        {scopeOfWork.map((item, index) => (
                          <SortableScopeRow 
                            key={item.id} 
                            item={item} 
                            index={index}
                            scopeLength={scopeOfWork.length}
                            removeScopeItem={removeScopeItem}
                            updateScopeItem={updateScopeItem}
                          />
                        ))}
                        {/* Add Scope Item Row */}
                        <tr>
                          <td colSpan={4} className="py-3 px-4">
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
                    </SortableContext>
                  </table>
                </div>
              </DndContext>
            </>
          )}

          {/* Milestones Tab */}
          {activeTab === 'milestones' && (
            <>
              {/* Info Banner */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                  <strong>Payment Milestones:</strong> Add milestones and set what percentage of the total price is due at each stage.
                </p>
                <button
                  onClick={() => openImportModal('milestones')}
                  className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Import from Project
                </button>
              </div>

              {/* Mobile Card Layout */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMilestoneDragEnd}>
                <SortableContext items={milestones.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="sm:hidden space-y-3">
                    {milestones.map((milestone, index) => (
                      <SortableMilestoneCard 
                        key={milestone.id} 
                        milestone={milestone} 
                        index={index}
                        milestonesLength={milestones.length}
                        removeMilestone={removeMilestone}
                        updateMilestone={updateMilestone}
                        formatCurrency={formatCurrency}
                        calculatedFeePrice={calculateFeePrice(milestone.milestoneType)}
                      />
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
                        Cost: {formatCurrency(totalCost)} • Profit: {formatCurrency(profit)}
                      </div>
                    </div>
                  </div>
                </SortableContext>
              </DndContext>

              {/* Desktop Table Layout */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMilestoneDragEnd}>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="w-10"></th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Milestone Name</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-24">Cost</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-24">Markup %</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 w-36">Price</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <SortableContext items={milestones.map(m => m.id)} strategy={verticalListSortingStrategy}>
                      <tbody>
                        {milestones.map((milestone, index) => (
                          <SortableMilestoneRow 
                            key={milestone.id} 
                            milestone={milestone} 
                            index={index}
                            milestonesLength={milestones.length}
                            removeMilestone={removeMilestone}
                            updateMilestone={updateMilestone}
                            formatCurrency={formatCurrency}
                            calculatedFeePrice={calculateFeePrice(milestone.milestoneType)}
                          />
                        ))}
                        {/* Add Milestone Row */}
                        <tr>
                          <td colSpan={6} className="py-3 px-4">
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
                    </SortableContext>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                        <td></td>
                        <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">TOTAL</td>
                        <td className="py-4 px-4 text-right font-semibold text-gray-700 dark:text-gray-300">
                          {formatCurrency(totalCost)}
                        </td>
                        <td></td>
                        <td className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white text-lg">
                          {formatCurrency(customerTotal)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </DndContext>
            </>
          )}

          {/* Profit Summary */}
          <div className="mt-4 sm:mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3 text-sm sm:text-base">Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase">Total Cost</p>
                <p className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(totalCost)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase">Customer Price</p>
                <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(customerTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase">Profit</p>
                <p className={`text-base sm:text-lg font-semibold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(profit)}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase">Margin</p>
                <p className={`text-base sm:text-lg font-semibold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {profitMargin.toFixed(1)}%
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                  ({markupPercent.toFixed(1)}% markup)
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
              disabled={generating || saving || customerTotal <= 0}
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

      {/* Import from Project Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Import {importType === 'scope' ? 'Scope of Work' : 'Milestones'} from Project
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">
              {/* Project List Panel */}
              <div className="w-full sm:w-2/5 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-[150px] sm:min-h-0">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Search projects..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {projectsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pool-blue"></div>
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                      {projectSearch ? 'No projects match your search' : 'No other projects found'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => handleSelectImportProject(project)}
                          className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedImportProject?.id === project.id
                              ? 'bg-pool-blue/10 dark:bg-pool-blue/20 border-l-4 border-pool-blue'
                              : ''
                          }`}
                        >
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {project.project_name || project.address || 'Unnamed Project'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {project.address || 'No address'}
                          </p>
                          {project.customers && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {project.customers.first_name} {project.customers.last_name}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Panel */}
              <div className="w-full sm:w-3/5 flex flex-col min-h-[200px] sm:min-h-0">
                {!selectedImportProject ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm p-4 text-center">
                    <div>
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Select a project to see its {importType === 'scope' ? 'scope of work' : 'milestones'}
                    </div>
                  </div>
                ) : loadingImportItems ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pool-blue"></div>
                  </div>
                ) : (importType === 'scope' ? importableScopeItems.length === 0 : importableMilestoneItems.length === 0) ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm p-4 text-center">
                    No {importType === 'scope' ? 'scope of work items' : 'milestones'} found in this project
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    {/* Scope of Work Section */}
                    {importType === 'scope' && importableScopeItems.length > 0 && (
                      <div>
                        <div className="sticky top-0 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            <span className="font-medium text-blue-800 dark:text-blue-200 text-sm">Scope of Work</span>
                            <span className="text-xs text-blue-600 dark:text-blue-400">({importableScopeItems.length})</span>
                          </div>
                          <button
                            onClick={selectAllImportScopeItems}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                          >
                            {selectedImportScopeItems.length === importableScopeItems.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {importableScopeItems.map((item) => (
                            <label
                              key={item.id}
                              className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedImportScopeItems.includes(item.id)}
                                onChange={() => toggleImportScopeItemSelection(item.id)}
                                className="mt-1 h-4 w-4 text-pool-blue border-gray-300 rounded focus:ring-pool-blue"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</p>
                                {item.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Milestones Section */}
                    {importType === 'milestones' && importableMilestoneItems.length > 0 && (
                      <div>
                        <div className="sticky top-0 px-3 py-2 bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium text-green-800 dark:text-green-200 text-sm">Milestones</span>
                            <span className="text-xs text-green-600 dark:text-green-400">({importableMilestoneItems.length})</span>
                          </div>
                          <button
                            onClick={selectAllImportMilestoneItems}
                            className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 font-medium"
                          >
                            {selectedImportMilestoneItems.length === importableMilestoneItems.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {importableMilestoneItems.map((item) => (
                            <label
                              key={item.id}
                              className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedImportMilestoneItems.includes(item.id)}
                                onChange={() => toggleImportMilestoneItemSelection(item.id)}
                                className="mt-1 h-4 w-4 text-pool-blue border-gray-300 rounded focus:ring-pool-blue"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    {formatCurrency(item.cost || 0)}
                                  </span>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center flex-shrink-0">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {importType === 'scope' 
                  ? `${selectedImportScopeItems.length} item${selectedImportScopeItems.length !== 1 ? 's' : ''} selected`
                  : `${selectedImportMilestoneItems.length} item${selectedImportMilestoneItems.length !== 1 ? 's' : ''} selected`
                }
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-medium rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportItems}
                  disabled={importType === 'scope' ? selectedImportScopeItems.length === 0 : selectedImportMilestoneItems.length === 0}
                  className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContractPreview
