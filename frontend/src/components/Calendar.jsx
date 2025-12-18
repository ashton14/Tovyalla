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
  const [events, setEvents] = useState([])
  const [employees, setEmployees] = useState([])
  const [employeesMap, setEmployeesMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  
  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')
  const [googleEvents, setGoogleEvents] = useState([])
  const [googleLoading, setGoogleLoading] = useState(false)
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

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    time: '',
    employee_id: '',
  })

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  // Fetch events
  const fetchEvents = async (employeeColorMap = employeesMap) => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await axios.get('/api/events', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // Transform events for react-big-calendar
      const transformedEvents = (response.data.events || []).map((event) => {
        const eventDate = new Date(event.date)
        const [hours, minutes] = event.time.split(':')
        eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)

        // Get employee color - prioritize API response, then employeesMap, then default
        let employeeColor = '#0ea5e9' // default
        if (event.employee_color) {
          employeeColor = event.employee_color
        } else if (event.employee_id && employeeColorMap[event.employee_id]) {
          employeeColor = employeeColorMap[event.employee_id].color || '#0ea5e9'
        }

        return {
          id: event.id,
          title: event.name,
          start: eventDate,
          end: new Date(eventDate.getTime() + 60 * 60 * 1000), // Default 1 hour duration
          resource: {
            employee_id: event.employee_id,
            employee_name: event.employee_name,
            employee_color: employeeColor,
          },
        }
      })
      setEvents(transformedEvents)
    } catch (err) {
      console.error('Error fetching events:', err)
      setError(err.response?.data?.error || err.message || 'Failed to load events')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch employees for dropdown
  const fetchEmployees = async () => {
    try {
      const token = await getAuthToken()
      if (!token) return

      const response = await axios.get('/api/employees', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const employeesList = response.data.employees || []
      setEmployees(employeesList)

      // Create a map for quick employee lookup by ID
      const map = {}
      employeesList.forEach((emp) => {
        map[emp.id] = {
          name: emp.name,
          color: emp.color || '#0ea5e9',
        }
      })
      setEmployeesMap(map)
    } catch (err) {
      console.error('Error fetching employees:', err)
    }
  }

  useEffect(() => {
    if (user) {
      fetchEmployees()
      checkGoogleCalendarStatus()
    }
  }, [user])

  // Fetch events when employeesMap is populated or changes
  useEffect(() => {
    if (user) {
      fetchEvents(employeesMap)
    }
  }, [user, employeesMap])

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

      const payload = {
        name: formData.name,
        date: formData.date,
        time: formData.time,
        employee_id: formData.employee_id || null,
      }

      if (editingEvent) {
        await axios.put(`/api/events/${editingEvent.id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setSuccess('Event updated successfully!')
      } else {
        await axios.post('/api/events', payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setSuccess('Event added successfully!')
      }

      setShowForm(false)
      setEditingEvent(null)
      resetForm()
      // Refetch events with current employeesMap
      setTimeout(() => {
        fetchEvents(employeesMap)
        // Dispatch custom event to notify Dashboard of calendar update
        window.dispatchEvent(new CustomEvent('calendar-events-updated'))
      }, 100)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save event')
    }
  }

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      await axios.delete(`/api/events/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSuccess('Event deleted successfully!')
      setShowForm(false)
      setEditingEvent(null)
      resetForm()
      fetchEvents(employeesMap)
      // Dispatch custom event to notify Dashboard of calendar update
      window.dispatchEvent(new CustomEvent('calendar-events-updated'))
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete event')
    }
  }

  // Handle edit
  const handleEdit = (event) => {
    const originalEvent = events.find((e) => e.id === event.id)
    if (!originalEvent) return

    // Find the original event data from the API
    fetchEvents(employeesMap).then(() => {
      // We'll need to get the full event data, but for now use what we have
      const eventDate = new Date(originalEvent.start)
      const dateStr = eventDate.toISOString().split('T')[0]
      const timeStr = `${String(eventDate.getHours()).padStart(2, '0')}:${String(eventDate.getMinutes()).padStart(2, '0')}`

      setEditingEvent({ id: originalEvent.id })
      setFormData({
        name: originalEvent.title,
        date: dateStr,
        time: timeStr,
        employee_id: originalEvent.resource?.employee_id || '',
      })
      setShowForm(true)
    })
  }

  // Handle slot selection
  const handleSelectSlot = ({ start }) => {
    const dateStr = start.toISOString().split('T')[0]
    const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    
    setFormData({
      name: '',
      date: dateStr,
      time: timeStr,
      employee_id: '',
    })
    setEditingEvent(null)
    setSelectedSlot(start)
    setShowForm(true)
  }

  // Handle event click
  const handleSelectEvent = (event) => {
    handleEdit(event)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      time: '',
      employee_id: '',
    })
    setSelectedSlot(null)
  }

  // ==================== Google Calendar Functions ====================

  // Check Google Calendar connection status
  const checkGoogleCalendarStatus = async () => {
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
          <h2 className="text-2xl font-bold text-gray-800">Calendar</h2>
          <p className="text-gray-600 mt-1">Manage events and schedule</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setEditingEvent(null)
            setShowForm(true)
          }}
          className="px-4 py-2 bg-pool-blue hover:bg-pool-dark text-white font-semibold rounded-md transition-colors"
        >
          + Add Event
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

      {/* Google Calendar OAuth Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Google Calendar</h3>
            {googleConnected && googleEmail && (
              <p className="text-sm text-gray-600 mt-1">Connected as {googleEmail}</p>
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

      {/* React Big Calendar (Original) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Local Calendar</h3>
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          defaultView="month"
          views={['month', 'week', 'day', 'agenda']}
          eventPropGetter={(event) => {
            const eventColor = event.resource?.employee_color || '#0ea5e9'
            const borderColor = eventColor
            
            return {
              style: {
                backgroundColor: eventColor,
                borderColor: borderColor,
                color: 'white',
              },
            }
          }}
        />
      </div>

      {/* Google Calendar */}
      {googleConnected && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Google Calendar</h3>
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
          </div>
          {googleLoading ? (
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
      )}

      {/* Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingEvent(null); resetForm(); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingEvent ? 'Edit Event' : 'Add New Event'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingEvent(null)
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
                    Event Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee
                  </label>
                  <select
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue"
                  >
                    <option value="">Select an employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingEvent(null)
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
                    {editingEvent ? 'Update Event' : 'Add Event'}
                  </button>
                  {editingEvent && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingEvent.id)}
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

      {/* Google Calendar Event Form Modal */}
      {showGoogleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => { setShowGoogleForm(false); setEditingGoogleEvent(null); resetGoogleForm(); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {editingGoogleEvent ? 'Edit Google Calendar Event' : 'Add Google Calendar Event'}
                </h3>
                <button
                  onClick={() => {
                    setShowGoogleForm(false)
                    setEditingGoogleEvent(null)
                    resetGoogleForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
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
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
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

