import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  useGoals,
  useGoalDataPoints,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
} from '../hooks/useApi'

function Goals() {
  const { user } = useAuth()
  
  // Use cached queries
  const { data: goals = [], isLoading: loading } = useGoals()
  const { data: dataPoints = [] } = useGoalDataPoints()
  
  // Mutations
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [formData, setFormData] = useState({
    goal_name: '',
    data_point_type: '',
    target_value: '',
    start_date: '',
    target_date: '',
  })

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      goal_name: formData.goal_name,
      data_point_type: formData.data_point_type,
      target_value: parseFloat(formData.target_value),
      start_date: formData.start_date || null,
      target_date: formData.target_date || null,
    }

    try {
      if (editingGoal) {
        await updateGoal.mutateAsync({ id: editingGoal.id, data: payload })
        setSuccess('Goal updated successfully!')
      } else {
        await createGoal.mutateAsync(payload)
        setSuccess('Goal created successfully!')
      }

      setShowForm(false)
      setEditingGoal(null)
      resetForm()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save goal')
      setTimeout(() => setError(''), 5000)
    }
  }

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) {
      return
    }

    try {
      await deleteGoal.mutateAsync(id)
      setSuccess('Goal deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete goal')
      setTimeout(() => setError(''), 5000)
    }
  }

  // Handle edit
  const handleEdit = (goal) => {
    setEditingGoal(goal)
    // Format dates for input (YYYY-MM-DD)
    const startDate = goal.start_date 
      ? new Date(goal.start_date).toISOString().split('T')[0]
      : ''
    const targetDate = goal.target_date 
      ? new Date(goal.target_date).toISOString().split('T')[0]
      : ''
    setFormData({
      goal_name: goal.goal_name,
      data_point_type: goal.data_point_type,
      target_value: goal.target_value,
      start_date: startDate,
      target_date: targetDate,
    })
    setShowForm(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      goal_name: '',
      data_point_type: '',
      target_value: '',
      start_date: '',
      target_date: '',
    })
  }

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Format number
  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  // Get data point info
  const getDataPointInfo = (dataPointType) => {
    return dataPoints.find((dp) => dp.value === dataPointType) || {
      label: dataPointType,
      icon: '📊',
      format: 'number',
    }
  }

  // Get color based on progress
  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'green'
    if (percentage >= 75) return 'blue'
    if (percentage >= 50) return 'purple'
    if (percentage >= 25) return 'orange'
    return 'gray'
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Goals</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track your business goals and progress</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setEditingGoal(null)
            setShowForm(true)
          }}
          className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
        >
          + Add Goal
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

      {/* Goal Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingGoal(null); resetForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-pool-blue to-pool-dark px-6 py-4 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {editingGoal ? 'Edit Goal' : 'New Goal'}
                  </h3>
                  <p className="text-pool-light text-sm mt-0.5">
                    {editingGoal ? 'Update your goal parameters' : 'Set a new target to track'}
                  </p>
                </div>
                <button
                  onClick={() => { setShowForm(false); setEditingGoal(null); resetForm(); }}
                  className="text-white/70 hover:text-white transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Goal Details */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Goal Details
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Goal Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.goal_name}
                      onChange={(e) => setFormData({ ...formData, goal_name: e.target.value })}
                      required
                      placeholder="e.g., Q1 Profit Target"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Data Point <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.data_point_type}
                        onChange={(e) => setFormData({ ...formData, data_point_type: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      >
                        <option value="">Select metric...</option>
                        {dataPoints.map((dp) => (
                          <option key={dp.value} value={dp.value}>
                            {dp.icon} {dp.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Target Value <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.target_value}
                        onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                        required
                        placeholder="0"
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Period */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Time Period
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave empty for all-time</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date</label>
                      <input
                        type="date"
                        value={formData.target_date}
                        onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">When to achieve this goal</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingGoal(null); resetForm(); }}
                  className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGoal.isPending || updateGoal.isPending}
                  className="px-6 py-2.5 bg-gradient-to-r from-pool-blue to-pool-dark hover:from-pool-dark hover:to-pool-blue text-white font-semibold rounded-lg disabled:opacity-50 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  {(createGoal.isPending || updateGoal.isPending) ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {editingGoal ? 'Update Goal' : 'Create Goal'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">No goals yet</p>
          <p className="text-gray-400 dark:text-gray-500 mb-6">Create your first goal to start tracking progress</p>
          <button
            onClick={() => {
              resetForm()
              setEditingGoal(null)
              setShowForm(true)
            }}
            className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
          >
            + Create Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const dataPointInfo = getDataPointInfo(goal.data_point_type)
            const formatValue = dataPointInfo.format === 'currency' ? formatCurrency : formatNumber
            const percentage = goal.progress_percentage || 0
            const isOverGoal = goal.current_value > goal.target_value
            const color = getProgressColor(percentage)

            const colorClasses = {
              green: {
                border: 'border-green-500',
                text: 'text-green-600',
                progress: 'bg-green-500',
                bg: 'bg-green-50',
              },
              blue: {
                border: 'border-blue-500',
                text: 'text-blue-600',
                progress: 'bg-blue-500',
                bg: 'bg-blue-50',
              },
              purple: {
                border: 'border-purple-500',
                text: 'text-purple-600',
                progress: 'bg-purple-500',
                bg: 'bg-purple-50',
              },
              orange: {
                border: 'border-orange-500',
                text: 'text-orange-600',
                progress: 'bg-orange-500',
                bg: 'bg-orange-50',
              },
              gray: {
                border: 'border-gray-500',
                text: 'text-gray-600',
                progress: 'bg-gray-500',
                bg: 'bg-gray-50',
              },
            }
            const colors = colorClasses[color]

            return (
              <div
                key={goal.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 ${colors.border} p-6`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{dataPointInfo.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{goal.goal_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{dataPointInfo.label}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {goal.start_date 
                          ? `From: ${new Date(goal.start_date).toLocaleDateString()}`
                          : 'Period: Total (All Time)'
                        }
                      </p>
                      {goal.target_date && (
                        <p className={`text-xs mt-1 ${goal.is_overdue ? 'text-red-600 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                          Target: {new Date(goal.target_date).toLocaleDateString()}
                          {goal.is_overdue && ' (Overdue)'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="text-gray-400 hover:text-pool-blue transition-colors"
                      title="Edit goal"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      disabled={deleteGoal.isPending}
                      className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Delete goal"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Current Value */}
                <div className="mb-4">
                  <p className={`text-3xl font-bold ${colors.text}`}>
                    {formatValue(goal.current_value || 0)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Target: {formatValue(goal.target_value)}
                  </p>
                  {isOverGoal ? (
                    <p className="text-sm text-green-600 font-medium mt-1">
                      {formatValue(goal.current_value - goal.target_value)} over goal! 🎉
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatValue(goal.target_value - goal.current_value)} remaining
                    </p>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Progress</span>
                    <span className={`font-semibold ${colors.text}`}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full ${colors.progress} transition-all duration-500 ease-out rounded-full ${
                        isOverGoal ? 'bg-gradient-to-r from-green-400 to-green-600' : ''
                      }`}
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                      }}
                    >
                      {isOverGoal && (
                        <div className="h-full w-full bg-gradient-to-r from-green-400 to-green-600 animate-pulse"></div>
                      )}
                    </div>
                  </div>
                  {isOverGoal && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden -mt-4 opacity-30">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: '100%' }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Goals
