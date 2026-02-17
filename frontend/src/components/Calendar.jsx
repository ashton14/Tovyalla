import { useState, useEffect, useRef } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import AddressAutocomplete from './AddressAutocomplete'
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

function Calendar({ isActive = true }) {
  const { user, supabase, getAuthHeaders } = useAuth()
  
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
    duration: 60,
    description: '',
    location: '',
    reminderMinutes: '',
    reminderType: 'popup', // 'popup' | 'email' | 'both'
    repeat: 'none',
    repeatEndType: 'date',
    repeatEndDate: '',
    repeatCount: 5,
  })
  const [initialFormData, setInitialFormData] = useState(null)
  const [reminderModalEvent, setReminderModalEvent] = useState(null)
  const shownReminderIdsRef = useRef(new Set())

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

  // Clear status messages when switching away from Calendar tab
  useEffect(() => {
    if (!isActive) {
      setGoogleError('')
      setGoogleSuccess('')
    }
  }, [isActive])

  // Fetch Google Calendar events when connected
  useEffect(() => {
    if (user && googleConnected) {
      fetchGoogleEvents()
    }
  }, [user, googleConnected])

  // Poll for popup reminders - show in-app modal when reminder time arrives
  useEffect(() => {
    if (!googleConnected || googleEvents.length === 0) return

    const checkReminders = () => {
      const now = Date.now()
      const oneMin = 60 * 1000

      for (const evt of googleEvents) {
        const overrides = evt.resource?.reminders?.overrides || []
        const popup = overrides.find((o) => o.method === 'popup')
        if (!popup) continue

        const startMs = new Date(evt.start).getTime()
        const reminderMs = startMs - popup.minutes * 60 * 1000
        const key = `${evt.id}-${reminderMs}`

        if (shownReminderIdsRef.current.has(key)) continue
        if (now >= reminderMs - oneMin && now <= reminderMs + 2 * oneMin) {
          shownReminderIdsRef.current.add(key)
          setReminderModalEvent(evt)
          break
        }
      }
    }

    checkReminders()
    const interval = setInterval(checkReminders, 60 * 1000)
    return () => clearInterval(interval)
  }, [googleConnected, googleEvents])

  // ==================== Google Calendar Functions ====================

  // Check Google Calendar connection status
  const checkGoogleCalendarStatus = async () => {
    setGoogleLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) return

      const response = await axios.get('/api/google/calendar/status', {
        headers: {
          ...getAuthHeaders(token),
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
          ...getAuthHeaders(token),
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
          ...getAuthHeaders(token),
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

      // Get events from 3 months ago to 3 months in the future
      const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

      const response = await axios.get('/api/google/calendar/events', {
        headers: {
          ...getAuthHeaders(token),
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
            reminders: event.reminders,
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

  // Build reminder overrides for Google Calendar (popup, email, or both)
  const buildReminderOverrides = () => {
    const mins = googleFormData.reminderMinutes
    if (!mins) return undefined

    const type = googleFormData.reminderType || 'popup'
    const overrides = []

    if (type === 'popup' || type === 'both') {
      overrides.push({ method: 'popup', minutes: Number(mins) })
    }
    if (type === 'email' || type === 'both') {
      overrides.push({ method: 'email', minutes: Number(mins) })
    }

    return overrides.length ? { useDefault: false, overrides } : undefined
  }

  // Build RRULE for recurring events
  const buildRecurrenceRule = () => {
    const { repeat, repeatEndType, repeatEndDate, repeatCount } = googleFormData
    if (!repeat || repeat === 'none') return null

    const freq = repeat.toUpperCase()
    let rrule = `RRULE:FREQ=${freq}`

    if (repeatEndType === 'date' && repeatEndDate) {
      // UNTIL = last occurrence at same time as first event (in UTC)
      const lastOccurrence = new Date(`${repeatEndDate}T${googleFormData.time}`)
      const untilStr = lastOccurrence.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      rrule += `;UNTIL=${untilStr}`
    } else if (repeatEndType === 'count' && repeatCount > 0) {
      rrule += `;COUNT=${Math.min(Math.max(1, repeatCount), 365)}`
    }
    // If neither end condition, recurrence continues indefinitely (Google allows this)

    return [rrule]
  }

  // Handle Google Calendar form submit
  const handleGoogleFormSubmit = async (e) => {
    e.preventDefault()
    setGoogleError('')
    setGoogleSuccess('')

    // Validate recurring event end condition
    if (!editingGoogleEvent && googleFormData.repeat !== 'none' && googleFormData.repeatEndType === 'date' && !googleFormData.repeatEndDate) {
      setGoogleError('Please select an end date for the recurring event')
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Use date/time from form directly (avoid toISOString() which converts to UTC and shifts dates)
      const timeWithSeconds = googleFormData.time.length === 5 ? `${googleFormData.time}:00` : googleFormData.time
      const startDateTimeStr = `${googleFormData.date}T${timeWithSeconds}`
      const durationMinutes = Number(googleFormData.duration) || 60
      const startMs = new Date(`${googleFormData.date}T${googleFormData.time}`).getTime()
      const endDate = new Date(startMs + durationMinutes * 60 * 1000)
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
      const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:${String(endDate.getSeconds()).padStart(2, '0')}`
      const endDateTimeStr = `${endDateStr}T${endTimeStr}`

      const payload = {
        name: googleFormData.name,
        startDateTime: startDateTimeStr,
        endDateTime: endDateTimeStr,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
        description: googleFormData.description || '',
        location: googleFormData.location?.trim() || undefined,
        recurrence: !editingGoogleEvent ? buildRecurrenceRule() : undefined,
        reminders: buildReminderOverrides(),
      }

      if (editingGoogleEvent) {
        await axios.put(`/api/google/calendar/events/${editingGoogleEvent.id}`, payload, {
          headers: {
            ...getAuthHeaders(token),
          },
        })
        setGoogleSuccess('Event updated successfully!')
      } else {
        await axios.post('/api/google/calendar/events', payload, {
          headers: {
            ...getAuthHeaders(token),
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
          ...getAuthHeaders(token),
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

  // Derive reminder type and minutes from event's reminders
  const parseRemindersFromEvent = (resource) => {
    const overrides = resource?.reminders?.overrides || []
    if (overrides.length === 0) return { reminderMinutes: '', reminderType: 'popup' }

    const popup = overrides.find((o) => o.method === 'popup')
    const email = overrides.find((o) => o.method === 'email')
    const mins = (popup || email)?.minutes
    let type = 'popup'
    if (popup && email) type = 'both'
    else if (email) type = 'email'

    return { reminderMinutes: mins ? String(mins) : '', reminderType: type }
  }

  // Handle Google Calendar event edit
  const handleGoogleEventEdit = (event) => {
    const googleEvent = googleEvents.find((e) => e.id === event.id)
    if (!googleEvent) return

    const eventDate = new Date(googleEvent.start)
    const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`
    const timeStr = `${String(eventDate.getHours()).padStart(2, '0')}:${String(eventDate.getMinutes()).padStart(2, '0')}`
    const duration = googleEvent.end
      ? Math.round((new Date(googleEvent.end) - eventDate) / (60 * 1000))
      : 60

    const { reminderMinutes, reminderType } = parseRemindersFromEvent(googleEvent.resource)

    const formData = {
      name: googleEvent.title,
      date: dateStr,
      time: timeStr,
      duration,
      description: googleEvent.resource?.description || '',
      location: googleEvent.resource?.location || '',
      reminderMinutes,
      reminderType,
      repeat: 'none',
      repeatEndType: 'date',
      repeatEndDate: '',
      repeatCount: 5,
    }

    setEditingGoogleEvent({ id: googleEvent.id })
    setGoogleFormData(formData)
    setInitialFormData(formData)
    setShowGoogleForm(true)
  }

  // Handle Google Calendar slot selection
  const handleGoogleSelectSlot = ({ start }) => {
    if (!googleConnected) return

    const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`

    setGoogleFormData({
      name: '',
      date: dateStr,
      time: timeStr,
      duration: 60,
      description: '',
      location: '',
      reminderMinutes: '',
      reminderType: 'popup',
      repeat: 'none',
      repeatEndType: 'date',
      repeatEndDate: '',
      repeatCount: 5,
    })
    setEditingGoogleEvent(null)
    setInitialFormData(null)
    setShowGoogleForm(true)
  }

  // Reset Google Calendar form
  const resetGoogleForm = () => {
    const empty = {
      name: '',
      date: '',
      time: '',
      duration: 60,
      description: '',
      location: '',
      reminderMinutes: '',
      reminderType: 'popup',
      repeat: 'none',
      repeatEndType: 'date',
      repeatEndDate: '',
      repeatCount: 5,
    }
    setGoogleFormData(empty)
    setInitialFormData(null)
  }

  // Check if form has changes (for disabling Update button when editing)
  const hasChanges = initialFormData != null && JSON.stringify(googleFormData) !== JSON.stringify(initialFormData)

  if (googleLoading && !googleConnected) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pool-blue"></div>
      </div>
    )
  }

  // When not active, render only reminder modal (keeps component mounted so reminders persist)
  if (!isActive) {
    return (
      <>
        {reminderModalEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-sm w-full p-6 border-2 border-pool-blue">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pool-blue/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-pool-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Reminder</h3>
                  <p className="mt-1 text-gray-700 dark:text-gray-300 font-medium">{reminderModalEvent.title}</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(reminderModalEvent.start), 'MMM d, yyyy \'at\' h:mm a')}
                  </p>
                  {reminderModalEvent.resource?.location && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">{reminderModalEvent.resource.location}</p>
                  )}
                  {reminderModalEvent.resource?.description && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{reminderModalEvent.resource.description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setReminderModalEvent(null)}
                className="mt-4 w-full px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </>
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
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm mb-4">
            {googleError}
          </div>
        )}

        {googleSuccess && (
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-md text-sm mb-4">
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

      {/* In-app reminder popup modal */}
      {reminderModalEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-sm w-full p-6 border-2 border-pool-blue">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pool-blue/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-pool-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white">Reminder</h3>
                <p className="mt-1 text-gray-700 dark:text-gray-300 font-medium">{reminderModalEvent.title}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {format(new Date(reminderModalEvent.start), 'MMM d, yyyy \'at\' h:mm a')}
                </p>
                {reminderModalEvent.resource?.location && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">{reminderModalEvent.resource.location}</p>
                )}
                {reminderModalEvent.resource?.description && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{reminderModalEvent.resource.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setReminderModalEvent(null)}
              className="mt-4 w-full px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Google Calendar Event Form Modal */}
      {showGoogleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowGoogleForm(false); setEditingGoogleEvent(null); resetGoogleForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    value={googleFormData.name}
                    onChange={(e) => setGoogleFormData({ ...googleFormData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={googleFormData.date}
                      onChange={(e) => setGoogleFormData({ ...googleFormData, date: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Time *
                    </label>
                    <input
                      type="time"
                      value={googleFormData.time}
                      onChange={(e) => setGoogleFormData({ ...googleFormData, time: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={googleFormData.description}
                    onChange={(e) => setGoogleFormData({ ...googleFormData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <AddressAutocomplete
                    value={googleFormData.location}
                    onChange={(e) => setGoogleFormData({ ...googleFormData, location: e.target.value })}
                    onSelect={(parsed) => setGoogleFormData((prev) => ({ ...prev, location: parsed.full_address }))}
                    placeholder="Start typing an address..."
                    mode="full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Duration
                  </label>
                  <select
                    value={googleFormData.duration}
                    onChange={(e) => setGoogleFormData({ ...googleFormData, duration: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>4 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reminder
                  </label>
                  <select
                    value={googleFormData.reminderMinutes}
                    onChange={(e) => setGoogleFormData({ ...googleFormData, reminderMinutes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">None</option>
                    <option value={5}>5 minutes before</option>
                    <option value={10}>10 minutes before</option>
                    <option value={15}>15 minutes before</option>
                    <option value={30}>30 minutes before</option>
                    <option value={60}>1 hour before</option>
                    <option value={1440}>1 day before</option>
                  </select>
                  {googleFormData.reminderMinutes && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reminderType"
                          checked={googleFormData.reminderType === 'popup'}
                          onChange={() => setGoogleFormData({ ...googleFormData, reminderType: 'popup' })}
                          className="text-pool-blue focus:ring-pool-blue"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Popup (in app)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reminderType"
                          checked={googleFormData.reminderType === 'email'}
                          onChange={() => setGoogleFormData({ ...googleFormData, reminderType: 'email' })}
                          className="text-pool-blue focus:ring-pool-blue"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reminderType"
                          checked={googleFormData.reminderType === 'both'}
                          onChange={() => setGoogleFormData({ ...googleFormData, reminderType: 'both' })}
                          className="text-pool-blue focus:ring-pool-blue"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Both</span>
                      </label>
                    </div>
                  )}
                </div>

                {!editingGoogleEvent && (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Repeat
                    </label>
                    <select
                      value={googleFormData.repeat}
                      onChange={(e) => setGoogleFormData({ ...googleFormData, repeat: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                    {googleFormData.repeat !== 'none' && (
                      <div className="space-y-2 pl-2">
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="repeatEnd"
                              checked={googleFormData.repeatEndType === 'date'}
                              onChange={() => setGoogleFormData({ ...googleFormData, repeatEndType: 'date' })}
                              className="text-pool-blue focus:ring-pool-blue"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">End by date</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="repeatEnd"
                              checked={googleFormData.repeatEndType === 'count'}
                              onChange={() => setGoogleFormData({ ...googleFormData, repeatEndType: 'count' })}
                              className="text-pool-blue focus:ring-pool-blue"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">End after</span>
                          </label>
                        </div>
                        {googleFormData.repeatEndType === 'date' ? (
                          <input
                            type="date"
                            value={googleFormData.repeatEndDate}
                            onChange={(e) => setGoogleFormData({ ...googleFormData, repeatEndDate: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={googleFormData.repeatCount}
                              onChange={(e) => setGoogleFormData({ ...googleFormData, repeatCount: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-24 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">occurrences</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                    disabled={editingGoogleEvent && !hasChanges}
                    className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
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
