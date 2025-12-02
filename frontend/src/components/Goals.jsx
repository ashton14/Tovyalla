import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

function Goals() {
  const { user, supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [goals, setGoals] = useState([])
  const [dataPoints, setDataPoints] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [formData, setFormData] = useState({
    goal_name: '',
    data_point_type: '',
    target_value: '',
    start_date: '',
    target_date: '',
  })

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Fetch available data points
  const fetchDataPoints = async () => {
    try {
      const token = await getAuthToken()
      if (!token) return

      const response = await axios.get('/api/goals/data-points', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setDataPoints(response.data.dataPoints || [])
    } catch (err) {
      // Error fetching data points
    }
  }

  // Fetch goals
  const fetchGoals = async () => {
    setLoading(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get('/api/goals', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setGoals(response.data.goals || [])
    } catch (err) {
      setError('Failed to load goals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchDataPoints()
      fetchGoals()
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

      if (editingGoal) {
        await axios.put(
          `/api/goals/${editingGoal.id}`,
          {
            goal_name: formData.goal_name,
            data_point_type: formData.data_point_type,
            target_value: parseFloat(formData.target_value),
            start_date: formData.start_date || null,
            target_date: formData.target_date || null,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
        setSuccess('Goal updated successfully!')
      } else {
        await axios.post(
          '/api/goals',
          {
            goal_name: formData.goal_name,
            data_point_type: formData.data_point_type,
            target_value: parseFloat(formData.target_value),
            start_date: formData.start_date || null,
            target_date: formData.target_date || null,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
        setSuccess('Goal created successfully!')
      }

      setShowForm(false)
      setEditingGoal(null)
      resetForm()
      fetchGoals()
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
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.delete(`/api/goals/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSuccess('Goal deleted successfully!')
      fetchGoals()
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
          <h2 className="text-2xl font-bold text-gray-800">Goals</h2>
          <p className="text-gray-600 mt-1">Track your business goals and progress</p>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingGoal ? 'Edit Goal' : 'Create New Goal'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingGoal(null)
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
                    Goal Name *
                  </label>
                  <input
                    type="text"
                    value={formData.goal_name}
                    onChange={(e) => setFormData({ ...formData, goal_name: e.target.value })}
                    required
                    placeholder="e.g., Q1 Profit Target"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Point *
                  </label>
                  <select
                    value={formData.data_point_type}
                    onChange={(e) => setFormData({ ...formData, data_point_type: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  >
                    <option value="">Select a data point...</option>
                    {dataPoints.map((dp) => (
                      <option key={dp.value} value={dp.value}>
                        {dp.icon} {dp.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Value *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.target_value}
                    onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                    required
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                  <p className="text-xs text-gray-500 mt-1">Only count data from this date forward (leave empty for Total/all time)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                  <p className="text-xs text-gray-500 mt-1">When you want to achieve this goal</p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingGoal(null)
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
                    {editingGoal ? 'Update Goal' : 'Create Goal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">No goals yet</p>
          <p className="text-gray-400 mb-6">Create your first goal to start tracking progress</p>
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
                className={`bg-white rounded-lg shadow-lg border-l-4 ${colors.border} p-6`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{dataPointInfo.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{goal.goal_name}</h3>
                      <p className="text-sm text-gray-500">{dataPointInfo.label}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {goal.start_date 
                          ? `From: ${new Date(goal.start_date).toLocaleDateString()}`
                          : 'Period: Total (All Time)'
                        }
                      </p>
                      {goal.target_date && (
                        <p className={`text-xs mt-1 ${goal.is_overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
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
                      className="text-gray-400 hover:text-red-600 transition-colors"
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
                  <p className="text-sm text-gray-500 mt-1">
                    Target: {formatValue(goal.target_value)}
                  </p>
                  {isOverGoal ? (
                    <p className="text-sm text-green-600 font-medium mt-1">
                      {formatValue(goal.current_value - goal.target_value)} over goal! 🎉
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">
                      {formatValue(goal.target_value - goal.current_value)} remaining
                    </p>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className={`font-semibold ${colors.text}`}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
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
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden -mt-4 opacity-30">
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
