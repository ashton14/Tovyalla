import { useState, useEffect } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import 'react-big-calendar/lib/css/react-big-calendar.css'

// Create localizer using date-fns
const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

function Calendar() {
  const { user, supabase } = useAuth()
  
  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')
  const [googleEvents, setGoogleEvents] = useState([])
  const [googleLoading, setGoogleLoading] = useState(true)
  const [googleError, setGoogleError] = useState('')
  const [googleSuccess, setGoogleSuccess] = useState('')
  const [showGoogleForm, setShowGoogleForm] = useState(false)
  const [editingGoogleEvent, setEditingGoogleEvent] = useState(null)
  const [googleFormData, setGoogleFormData] = useState({
    name: '',
    date: '',
    time: '',
    description: '',
  })

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  useEffect(() => {
    if (user) {
      checkGoogleCalendarStatus()
    }
  }, [user])

  // Check for OAuth callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const error = urlParams.get('error')
    const email = urlParams.get('email')

    if (success === 'true') {
      setGoogleSuccess(`Successfully connected to Google Calendar${email ? ` (${email})` : ''}`)
      checkGoogleCalendarStatus()
      // Clean up URL parameters
      const newParams = new URLSearchParams(urlParams)
      newParams.delete('success')
      newParams.delete('email')
      const newUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '')
      window.history.replaceState({}, document.title, newUrl)
    } else if (error) {
      setGoogleError(decodeURIComponent(error))
      // Clean up URL parameters
      const newParams = new URLSearchParams(urlParams)
      newParams.delete('error')
      const newUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '')
      window.history.replaceState({}, document.title, newUrl)
    }
  }, [])

  // Fetch Google Calendar events when connected
  useEffect(() => {
    if (user && googleConnected) {
      fetchGoogleEvents()
    }
  }, [user, googleConnected])

  // ==================== Google Calendar Functions ====================

  // Check Google Calendar connection status
  const checkGoogleCalendarStatus = async () => {
    setGoogleLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) return

      const response = await axios.get('/api/google/calendar/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setGoogleConnected(response.data.connected)
      setGoogleEmail(response.data.email || '')
    } catch (err) {
      console.error('Error checking Google Calendar status:', err)
      setGoogleConnected(false)
    } finally {
      setGoogleLoading(false)
    }
  }

  // Initiate Google OAuth flow
  const handleGoogleSignIn = async () => {
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get('/api/google/oauth/authorize', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // Redirect to Google OAuth
      window.location.href = response.data.authUrl
    } catch (err) {
      setGoogleError(err.response?.data?.error || err.message || 'Failed to initiate Google sign-in')
    }
  }

  // Disconnect Google Calendar
  const handleGoogleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar?')) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.post('/api/google/calendar/disconnect', {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // Clear all Google Calendar state immediately
      setGoogleConnected(false)
      setGoogleEmail('')
      setGoogleEvents([])
      setGoogleError('')
      setGoogleSuccess('Google Calendar disconnected successfully')
      
      // Don't re-check status after disconnect - stay disconnected
    } catch (err) {
      setGoogleError(err.response?.data?.error || err.message || 'Failed to disconnect')
    }
  }

  // Fetch Google Calendar events
  const fetchGoogleEvents = async () => {
    setGoogleLoading(true)
    setGoogleError('')
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Get events for the next 3 months
      const timeMin = new Date().toISOString()
      const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

      const response = await axios.get('/api/google/calendar/events', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          timeMin,
          timeMax,
        },
      })

      // Transform Google Calendar events for react-big-calendar
      const transformedEvents = (response.data.events || []).map((event) => {
        const start = event.start?.dateTime || event.start?.date
        const end = event.end?.dateTime || event.end?.date

        return {
          id: event.id,
          title: event.summary || 'No Title',
          start: new Date(start),
          end: new Date(end),
          resource: {
            googleEvent: true,
            description: event.description || '',
            location: event.location || '',
          },
        }
      })

      setGoogleEvents(transformedEvents)
    } catch (err) {
      console.error('Error fetching Google Calendar events:', err)
      setGoogleError(err.response?.data?.error || err.message || 'Failed to load Google Calendar events')
      setGoogleEvents([])
    } finally {
      setGoogleLoading(false)
    }
  }

  // Handle Google Calendar form submit
  const handleGoogleFormSubmit = async (e) => {
    e.preventDefault()
    setGoogleError('')
    setGoogleSuccess('')

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Combine date and time into ISO string
      const dateTime = new Date(`${googleFormData.date}T${googleFormData.time}`)
      const endDateTime = new Date(dateTime.getTime() + 60 * 60 * 1000) // Default 1 hour

      const payload = {
        name: googleFormData.name,
        startDateTime: dateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        description: googleFormData.description || '',
      }

      if (editingGoogleEvent) {
        await axios.put(`/api/google/calendar/events/${editingGoogleEvent.id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setGoogleSuccess('Event updated successfully!')
      } else {
        await axios.post('/api/google/calendar/events', payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setGoogleSuccess('Event added successfully!')
      }

      setShowGoogleForm(false)
      setEditingGoogleEvent(null)
      resetGoogleForm()
      setTimeout(() => {
        fetchGoogleEvents()
      }, 100)
    } catch (err) {
      setGoogleError(err.response?.data?.error || err.message || 'Failed to save event')
    }
  }

  // Handle Google Calendar event delete
  const handleGoogleEventDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.delete(`/api/google/calendar/events/${eventId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setGoogleSuccess('Event deleted successfully!')
      setShowGoogleForm(false)
      setEditingGoogleEvent(null)
      resetGoogleForm()
      fetchGoogleEvents()
    } catch (err) {
      setGoogleError(err.response?.data?.error || err.message || 'Failed to delete event')
    }
  }

  // Handle Google Calendar event edit
  const handleGoogleEventEdit = (event) => {
    const googleEvent = googleEvents.find((e) => e.id === event.id)
    if (!googleEvent) return

    const eventDate = new Date(googleEvent.start)
    const dateStr = eventDate.toISOString().split('T')[0]
    const timeStr = `${String(eventDate.getHours()).padStart(2, '0')}:${String(eventDate.getMinutes()).padStart(2, '0')}`

    setEditingGoogleEvent({ id: googleEvent.id })
    setGoogleFormData({
      name: googleEvent.title,
      date: dateStr,
      time: timeStr,
      description: googleEvent.resource?.description || '',
    })
    setShowGoogleForm(true)
  }

  // Handle Google Calendar slot selection
  const handleGoogleSelectSlot = ({ start }) => {
    if (!googleConnected) return
    
    const dateStr = start.toISOString().split('T')[0]
    const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    
    setGoogleFormData({
      name: '',
      date: dateStr,
      time: timeStr,
      description: '',
    })
    setEditingGoogleEvent(null)
    setShowGoogleForm(true)
  }

  // Reset Google Calendar form
  const resetGoogleForm = () => {
    setGoogleFormData({
      name: '',
      date: '',
      time: '',
      description: '',
    })
  }

  if (googleLoading && !googleConnected) {
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Calendar</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your Google Calendar events</p>
        </div>
        {googleConnected && (
          <button
            onClick={() => {
              resetGoogleForm()
              setEditingGoogleEvent(null)
              setShowGoogleForm(true)
            }}
            className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
          >
            + Add Event
          </button>
        )}
      </div>

      {/* Google Calendar Connection Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Google Calendar</h3>
            {googleConnected && googleEmail && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Connected as {googleEmail}</p>
            )}
          </div>
          {googleConnected ? (
            <button
              onClick={handleGoogleDisconnect}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          )}
        </div>

        {googleError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm mb-4">
            {googleError}
          </div>
        )}

        {googleSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm mb-4">
            {googleSuccess}
          </div>
        )}
      </div>

      {/* Google Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {!googleConnected ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Connect Your Calendar</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Connect your Google Calendar to view and manage your events</p>
            <button
              onClick={handleGoogleSignIn}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect Google Calendar
            </button>
          </div>
        ) : googleLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pool-blue"></div>
          </div>
        ) : (
          <BigCalendar
            localizer={localizer}
            events={googleEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            onSelectSlot={handleGoogleSelectSlot}
            onSelectEvent={handleGoogleEventEdit}
            selectable
            defaultView="month"
            views={['month', 'week', 'day', 'agenda']}
            eventPropGetter={(event) => {
              return {
                style: {
                  backgroundColor: '#4285F4',
                  borderColor: '#4285F4',
                  color: 'white',
                },
              }
            }}
          />
        )}
      </div>

      {/* Google Calendar Event Form Modal */}
      {showGoogleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowGoogleForm(false); setEditingGoogleEvent(null); resetGoogleForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingGoogleEvent ? 'Edit Event' : 'Add Event'}
                </h3>
                <button
                  onClick={() => {
                    setShowGoogleForm(false)
                    setEditingGoogleEvent(null)
                    resetGoogleForm()
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleGoogleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    value={googleFormData.name}
                    onChange={(e) => setGoogleFormData({ ...googleFormData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={googleFormData.date}
                      onChange={(e) => setGoogleFormData({ ...googleFormData, date: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time *
                    </label>
                    <input
                      type="time"
                      value={googleFormData.time}
                      onChange={(e) => setGoogleFormData({ ...googleFormData, time: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={googleFormData.description}
                    onChange={(e) => setGoogleFormData({ ...googleFormData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGoogleForm(false)
                      setEditingGoogleEvent(null)
                      resetGoogleForm()
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md"
                  >
                    {editingGoogleEvent ? 'Update Event' : 'Add Event'}
                  </button>
                  {editingGoogleEvent && (
                    <button
                      type="button"
                      onClick={() => handleGoogleEventDelete(editingGoogleEvent.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Calendar
