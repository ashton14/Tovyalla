import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CompanyInfo from '../components/CompanyInfo'
import Customers from '../components/Customers'
import Projects from '../components/Projects'
import Inventory from '../components/Inventory'
import Subcontractors from '../components/Subcontractors'
import Employees from '../components/Employees'
import Calendar from '../components/Calendar'
import Goals from '../components/Goals'
import { useEmployees, useProjects, useEvents, useStatistics } from '../hooks/useApi'

function Dashboard() {
  const { user, logout, loading } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('overview')
  const [timePeriod, setTimePeriod] = useState('total')

  // Use cached queries
  const { data: employees = [] } = useEmployees()
  const { data: projects = [] } = useProjects()
  const { data: events = [] } = useEvents()
  const { data: statistics = { totalEstValue: 0, totalProfit: 0, totalExpenses: 0, projectCount: 0 }, isLoading: loadingStats } = useStatistics(timePeriod)

  // Derive employee name from cached data
  const employeeName = employees.find(
    (emp) => emp.email_address?.toLowerCase() === user?.email?.toLowerCase()
  )?.name || null

  // Calculate projects in progress from cached data
  const projectsInProgress = {
    proposalRequest: projects.filter((p) => p.status === 'proposal_request').length,
    proposalSent: projects.filter((p) => p.status === 'proposal_sent').length,
    sold: projects.filter((p) => p.status === 'sold').length,
    total: projects.filter((p) => ['proposal_request', 'proposal_sent', 'sold'].includes(p.status)).length,
  }

  // Get today's events from cached data
  const todayEvents = (() => {
    const today = new Date()
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    return events
      .filter((event) => {
        if (!event.date) return false
        const eventDate = event.date.split('T')[0]
        return eventDate === todayString
      })
      .sort((a, b) => {
        if (!a.time) return 1
        if (!b.time) return -1
        return a.time.localeCompare(b.time)
      })
  })()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/')
    }
  }, [user, loading, navigate])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pool-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <img src="/tovyalla_logo.png" alt="Tovyalla CRM" className="h-14 w-auto" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveSection('overview')}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeSection === 'overview'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium">Dashboard</span>
          </button>
          <button
            onClick={() => setActiveSection('company')}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeSection === 'company'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium">Company Info</span>
          </button>
          <button
            onClick={() => setActiveSection('customers')}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeSection === 'customers'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium">Customers</span>
          </button>
          <button
            onClick={() => setActiveSection('projects')}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeSection === 'projects'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium">Projects</span>
          </button>
          <button
            onClick={() => setActiveSection('inventory')}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeSection === 'inventory'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium">Inventory</span>
          </button>
          <button
            onClick={() => setActiveSection('subcontractors')}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeSection === 'subcontractors'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium">Subcontractors</span>
          </button>
          <button
            onClick={() => setActiveSection('employees')}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeSection === 'employees'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium">Employees</span>
          </button>
          <button
            onClick={() => setActiveSection('calendar')}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeSection === 'calendar'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium">Calendar</span>
          </button>
          <button
            onClick={() => setActiveSection('goals')}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeSection === 'goals'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="font-medium">Goals</span>
          </button>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200">
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Logged in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
            {user.user_metadata?.companyID && (
              <p className="text-xs text-gray-500 mt-1">{user.user_metadata.companyID}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  Welcome, {employeeName?.split(' ')[0] || user.email}!
                </h2>
              </div>

              {/* Project Statistics */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-800">Project Statistics</h3>
                  <select
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm"
                  >
                    <option value="day">Last Day</option>
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                    <option value="6mo">Last 6 Months</option>
                    <option value="year">Last Year</option>
                    <option value="total">Total</option>
                  </select>
                </div>

                {loadingStats ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pool-blue"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Total Estimated Value */}
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-pool-blue">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-gray-500 uppercase tracking-wide">Total Est. Value</p>
                          <p className="text-3xl font-bold text-gray-900 mt-1">
                            ${statistics.totalEstValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {statistics.projectCount} {statistics.projectCount === 1 ? 'project' : 'projects'}
                      </p>
                    </div>

                    {/* Total Profit */}
                    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${statistics.totalProfit >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-gray-500 uppercase tracking-wide">Total Profit</p>
                          <p className={`text-3xl font-bold mt-1 ${statistics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${statistics.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Est. Value: ${statistics.totalEstValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500">
                        Expenses: ${statistics.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {statistics.totalEstValue > 0 && (
                        <p className={`text-xs font-medium mt-1 ${statistics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Margin: {((statistics.totalProfit / statistics.totalEstValue) * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Projects In Progress */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">Projects In Progress</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-400">
                    <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Proposal Request</p>
                    <p className="text-3xl font-bold text-gray-900">{projectsInProgress.proposalRequest}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                    <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Proposal Sent</p>
                    <p className="text-3xl font-bold text-gray-900">{projectsInProgress.proposalSent}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                    <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Sold</p>
                    <p className="text-3xl font-bold text-gray-900">{projectsInProgress.sold}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-pool-blue">
                    <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Total</p>
                    <p className="text-3xl font-bold text-gray-900">{projectsInProgress.total}</p>
                  </div>
                </div>
              </div>

              {/* Today's Tasks */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">Today's Tasks</h3>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  {todayEvents.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <p>No tasks scheduled for today</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {todayEvents.map((event) => (
                        <div key={event.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">{event.name}</h4>
                              {event.time && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {(() => {
                                    const [hours, minutes] = event.time.split(':')
                                    const hour12 = parseInt(hours) % 12 || 12
                                    const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM'
                                    return `${hour12}:${minutes} ${ampm}`
                                  })()}
                                </p>
                              )}
                              {event.employee_name && (
                                <p className="text-xs text-gray-400 mt-1">Assigned to: {event.employee_name}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'company' && <CompanyInfo />}
          {activeSection === 'customers' && <Customers />}
          {activeSection === 'projects' && <Projects />}
          {activeSection === 'inventory' && <Inventory />}
          {activeSection === 'subcontractors' && <Subcontractors />}
          {activeSection === 'employees' && <Employees />}
          {activeSection === 'calendar' && <Calendar />}
          {activeSection === 'goals' && <Goals />}
        </div>
      </main>
    </div>
  )
}

export default Dashboard
