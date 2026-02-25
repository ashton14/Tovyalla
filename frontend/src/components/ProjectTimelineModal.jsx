/**
 * Modal showing project status timeline.
 * Excludes 'cancelled' from the timeline. Completed statuses show a check; future ones are unchecked.
 * Construction step has sub-dots for each subcontractor expense.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { useUpdateProject } from '../hooks/useApi'

const TIMELINE_STATUSES = [
  { value: 'contacted', label: 'Contacted' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'proposal_signed', label: 'Proposal Signed' },
  { value: 'contract_sent', label: 'Contract Sent' },
  { value: 'sold', label: 'Sold' },
]

const PROJECT_STATUSES = [
  { value: 'contacted', label: 'Contacted' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'proposal_signed', label: 'Proposal Signed' },
  { value: 'contract_sent', label: 'Contract Sent' },
  { value: 'sold', label: 'Sold' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
]

function ProjectTimelineModal({ project, onClose, onProjectUpdated }) {
  const { supabase, getAuthHeaders } = useAuth()
  const updateProject = useUpdateProject()
  const [expenses, setExpenses] = useState(null)
  const [loadingExpenses, setLoadingExpenses] = useState(true)
  const [displayProject, setDisplayProject] = useState(project)

  useEffect(() => {
    setDisplayProject(project)
  }, [project])

  const status = displayProject?.status || 'contacted'
  const isCancelled = status === 'cancelled'

  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!project?.id) {
        setLoadingExpenses(false)
        return
      }
      setLoadingExpenses(true)
      try {
        const token = await getAuthToken()
        if (!token) throw new Error('Not authenticated')
        const response = await axios.get(`/api/projects/${project.id}/expenses`, {
          headers: getAuthHeaders(token),
        })
        setExpenses(response.data)
      } catch (err) {
        console.error('Error fetching expenses:', err)
        setExpenses(null)
      } finally {
        setLoadingExpenses(false)
      }
    }
    fetchExpenses()
  }, [project?.id])

  const subcontractorFees = expenses?.subcontractorFees || []
  const statusSteps = TIMELINE_STATUSES

  const currentIndex = isCancelled ? -1 : statusSteps.findIndex((s) => s.value === status)
  const completedIndex = status === 'complete' ? 4 : (currentIndex >= 0 ? currentIndex : -1)

  const constructionCompleted = status === 'complete'
  const constructionReached = completedIndex >= 4

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value
    if (!displayProject?.id || newStatus === status) return
    try {
      const res = await updateProject.mutateAsync({
        id: displayProject.id,
        data: { status: newStatus },
      })
      const updated = res?.project || { ...displayProject, status: newStatus }
      setDisplayProject(updated)
      onProjectUpdated?.(updated)
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update status'
      console.error('Error updating status:', msg, err)
      alert(msg)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-pool-blue to-pool-dark px-6 py-4 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-white">
                Timeline - {displayProject?.project_name || 'Project'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isCancelled && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                This project was cancelled.
              </p>
            </div>
          )}

          <div className="mb-6 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Update status
            </label>
            <select
              value={status}
              onChange={handleStatusChange}
              disabled={updateProject.isPending}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {updateProject.isPending && (
              <svg className="animate-spin h-5 w-5 text-pool-blue" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
          </div>

          <div className="relative">
            <div className="space-y-0">
              {statusSteps.map((step, index) => {
                const isCompleted = index <= completedIndex

                return (
                  <div key={step.value} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                          isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                        }`}
                      >
                        {isCompleted ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-xs font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div
                        className={`w-0.5 flex-1 min-h-[24px] ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      />
                    </div>
                    <div className="pb-8">
                      <p
                        className={`font-medium ${
                          isCompleted
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  </div>
                )
              })}

              {/* Construction step with sub-dots */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      constructionCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : constructionReached
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                    }`}
                  >
                    {constructionCompleted ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : constructionReached ? (
                      <span className="text-xs font-medium">…</span>
                    ) : (
                      <span className="text-xs font-medium">{statusSteps.length + 1}</span>
                    )}
                  </div>
                  <div
                    className={`w-0.5 flex-1 min-h-[24px] ${
                      constructionCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  />
                </div>
                <div className="pb-2">
                  <p
                    className={`font-medium ${
                      constructionCompleted
                        ? 'text-gray-900 dark:text-white'
                        : constructionReached
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Construction
                  </p>
                  {constructionReached && (
                    <div className="mt-3 ml-4 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                      {loadingExpenses ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                      ) : subcontractorFees.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No subcontractors added</p>
                      ) : (
                        subcontractorFees.map((fee, idx) => {
                          const subCompleted = fee.status === 'complete'
                          const subLabel = fee.job_description || fee.subcontractors?.name || `Subcontractor ${idx + 1}`
                          return (
                            <div key={fee.id || idx} className="flex items-center gap-2">
                              <div
                                className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border ${
                                  subCompleted
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                                }`}
                              >
                                {subCompleted && (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span
                                className={`text-sm ${
                                  subCompleted ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {subLabel}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Complete step */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      constructionCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                    }`}
                  >
                    {constructionCompleted ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-xs font-medium">{statusSteps.length + 2}</span>
                    )}
                  </div>
                </div>
                <div className="pb-0">
                  <p
                    className={`font-medium ${
                      constructionCompleted
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Complete
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectTimelineModal
