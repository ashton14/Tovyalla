import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

function Subscription() {
  const { user, logout, supabase, getAuthHeaders } = useAuth()
  const navigate = useNavigate()
  const getAuthToken = useCallback(async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [supabase])

  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState({ status: null, plan: null, currentPeriodEnd: null })
  const [invoices, setInvoices] = useState([])
  const [hasMoreInvoices, setHasMoreInvoices] = useState(false)
  const [loadingMoreInvoices, setLoadingMoreInvoices] = useState(false)
  const [canCancelSubscription, setCanCancelSubscription] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetch = async () => {
      try {
        const token = await getAuthToken()
        if (!token) return
        const [companyRes, billingRes] = await Promise.all([
          axios.get('/api/company', { headers: getAuthHeaders(token) }),
          axios.get('/api/billing/subscription', { headers: getAuthHeaders(token) }).catch(() => ({ data: { subscription: {}, invoices: [] } })),
        ])
        setCanCancelSubscription(companyRes.data.can_cancel_subscription === true)
        if (billingRes.data.subscription) setSubscription(billingRes.data.subscription)
        if (Array.isArray(billingRes.data.invoices)) setInvoices(billingRes.data.invoices)
        setHasMoreInvoices(!!billingRes.data.has_more)
      } catch (err) {
        console.error('Subscription fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [getAuthToken])

  const handleCancelSubscription = async () => {
    setCancelling(true)
    setErrorMessage('')
    try {
      const token = await getAuthToken()
      if (!token) return
      await axios.post('/api/billing/cancel-subscription', {}, {
        headers: getAuthHeaders(token),
      })
      await logout()
      navigate('/')
    } catch (error) {
      console.error('Cancel subscription error:', error)
      setErrorMessage(error.response?.data?.error || 'Failed to cancel subscription')
      setShowCancelModal(false)
    } finally {
      setCancelling(false)
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pool-blue" />
      </div>
    )
  }

  const nextPaymentDate = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const loadMoreInvoices = async () => {
    if (loadingMoreInvoices || invoices.length === 0) return
    setLoadingMoreInvoices(true)
    try {
      const token = await getAuthToken()
      if (!token) return
      const lastId = invoices[invoices.length - 1]?.id
      const { data } = await axios.get('/api/billing/subscription', {
        headers: getAuthHeaders(token),
        params: { starting_after: lastId },
      })
      if (Array.isArray(data.invoices) && data.invoices.length > 0) {
        setInvoices((prev) => [...prev, ...data.invoices])
      }
      setHasMoreInvoices(!!data.has_more)
    } catch (err) {
      console.error('Load more invoices error:', err)
    } finally {
      setLoadingMoreInvoices(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Subscription</h2>

      {/* Plan & next payment */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Current plan</h3>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Plan</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {subscription.plan || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {subscription.status || '—'}
            </p>
          </div>
          {nextPaymentDate && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Next payment date</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{nextPaymentDate}</p>
            </div>
          )}
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Payment history & invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoice</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {inv.date ? new Date(inv.date).toLocaleDateString('en-US') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{inv.number || inv.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {inv.amount_paid != null ? `$${Number(inv.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-700 dark:text-gray-300">{inv.status || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {(inv.invoice_pdf || inv.hosted_invoice_url) && (
                        <a
                          href={inv.invoice_pdf || inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pool-blue hover:underline text-sm font-medium"
                        >
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMoreInvoices && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={loadMoreInvoices}
              disabled={loadingMoreInvoices}
              className="px-4 py-2 text-sm font-medium text-pool-blue hover:bg-pool-light dark:hover:bg-pool-blue/20 rounded-md transition-colors disabled:opacity-50"
            >
              {loadingMoreInvoices ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-pool-blue" />
                  Loading...
                </span>
              ) : (
                'Load more'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-red-200 dark:border-red-900/50">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Danger Zone
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {canCancelSubscription
            ? 'Permanently cancel your subscription and delete all company data. This cannot be undone.'
            : 'Only admins can cancel the subscription and delete the company.'}
        </p>
        {errorMessage && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{errorMessage}</p>
        )}
        {canCancelSubscription && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors"
          >
            Cancel Subscription
          </button>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {showCancelModal && canCancelSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Cancel Subscription?
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You will lose access to your company dashboard. All company data will be permanently deleted. Your Stripe billing will be stopped. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {cancelling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel My Subscription'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Subscription
