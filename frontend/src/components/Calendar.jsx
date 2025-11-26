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
    }
  }, [user])

  // Fetch events when employeesMap is populated or changes
  useEffect(() => {
    if (user) {
      fetchEvents(employeesMap)
    }
  }, [user, employeesMap])

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
      setTimeout(() => fetchEvents(employeesMap), 100)
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
      fetchEvents(employeesMap)
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

      {/* Calendar */}
      <div className="bg-white rounded-lg shadow p-6">
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

      {/* Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
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
    </div>
  )
}

export default Calendar

