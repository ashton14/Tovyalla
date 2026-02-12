import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import CompanyInfo from '../components/CompanyInfo'
import Customers from '../components/Customers'
import Projects from '../components/Projects'
import Templates from '../components/Templates'
import Inventory from '../components/Inventory'
import Subcontractors from '../components/Subcontractors'
import Employees from '../components/Employees'
import Calendar from '../components/Calendar'
import Goals from '../components/Goals'
import Settings from '../components/Settings'
import Subscription from '../components/Subscription'
import Messages from '../components/Messages'
import BirthdayPopup, { getBirthdayEmployees, wasBirthdayDismissedToday, dismissBirthdayToday } from '../components/BirthdayPopup'
import { useEmployees, useProjects, useStatistics, useMonthlyStatistics, useUnreadMessageCount } from '../hooks/useApi'

const CHART_METRICS = [
  { value: 'value', label: 'Value', color: '#0ea5e9', format: 'currency' },
  { value: 'revenue', label: 'Revenue', color: '#3b82f6', format: 'currency' },
  { value: 'profit', label: 'Profit', color: '#22c55e', format: 'currency' },
  { value: 'leads', label: 'Leads', color: '#f59e0b', format: 'number' },
  { value: 'customersSigned', label: 'Customers Signed', color: '#06b6d4', format: 'number' },
  { value: 'sold', label: 'Sold Projects', color: '#8b5cf6', format: 'number' },
  { value: 'totalCustomers', label: 'Total Customers', color: '#ec4899', format: 'number' },
  { value: 'completedProjects', label: 'Completed Projects', color: '#14b8a6', format: 'number' },
]

function Dashboard() {
  const { user, currentCompanyID, logout, loading } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('overview')
  const [timePeriod, setTimePeriod] = useState('total')
  const [chartYear, setChartYear] = useState(new Date().getFullYear())
  const [chartMetric, setChartMetric] = useState('value')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showBirthdayPopup, setShowBirthdayPopup] = useState(false)

  // Use cached queries
  const { data: employees = [] } = useEmployees()
  const { data: projects = [] } = useProjects()
  const { data: statistics = { totalEstValue: 0, totalProfit: 0, totalExpenses: 0, projectCount: 0 }, isLoading: loadingStats } = useStatistics(timePeriod)
  const { data: monthlyData, isLoading: loadingMonthly } = useMonthlyStatistics(chartYear)
  const { data: unreadMessageCount = 0 } = useUnreadMessageCount()

  // Get year options (current year and 4 years back)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let i = 0; i <= 4; i++) {
      years.push(currentYear - i)
    }
    return years
  }, [])

  // Get the selected metric config
  const selectedMetric = CHART_METRICS.find(m => m.value === chartMetric) || CHART_METRICS[0]

  // Derive employee name from cached data
  const employeeName = employees.find(
    (emp) => emp.email_address?.toLowerCase() === user?.email?.toLowerCase()
  )?.name || null

  // Calculate projects in progress from cached data
  const projectsInProgress = {
    contractSent: projects.filter((p) => p.status === 'contract_sent').length,
    proposalSent: projects.filter((p) => p.status === 'proposal_sent').length,
    sold: projects.filter((p) => p.status === 'sold').length,
    total: projects.filter((p) => ['contract_sent', 'proposal_sent', 'sold'].includes(p.status)).length,
  }

  useEffect(() => {
    if (!loading && !user) {
      navigate('/')
    }
  }, [user, loading, navigate])

  // Show birthday popup once per day when employees have birthdays today
  useEffect(() => {
    const birthdayEmps = getBirthdayEmployees(employees)
    if (birthdayEmps.length > 0 && !wasBirthdayDismissedToday()) {
      setShowBirthdayPopup(true)
    }
  }, [employees])

  // Handle URL query parameters for section navigation (e.g., from OAuth redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const section = urlParams.get('section')
    if (section && ['overview', 'projects', 'templates', 'customers', 'employees', 'inventory', 'subcontractors', 'calendar', 'goals', 'messages', 'subscription', 'settings'].includes(section)) {
      setActiveSection(section)
      // Clean up URL
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString().replace(/section=[^&]*&?/g, '').replace(/&$/, '') : '')
      if (newUrl !== window.location.pathname + window.location.search) {
        window.history.replaceState({}, '', newUrl || window.location.pathname)
      }
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      const formattedValue = selectedMetric.format === 'currency'
        ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : value.toLocaleString('en-US')

      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{label} {chartYear}</p>
          <p style={{ color: selectedMetric.color }} className="font-medium">
            {selectedMetric.label}: {formattedValue}
          </p>
        </div>
      )
    }
    return null
  }

  // Format Y-axis values
  const formatYAxis = (value) => {
    if (selectedMetric.format === 'currency') {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`
      }
      if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`
      }
      return `$${value}`
    }
    return value
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pool-blue mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Helper to handle nav clicks on mobile
  const handleNavClick = (section) => {
    setActiveSection(section)
    setSidebarOpen(false)
  }

  const birthdayEmployees = getBirthdayEmployees(employees)
  const handleCloseBirthday = () => {
    dismissBirthdayToday()
    setShowBirthdayPopup(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Birthday popup - shows once per day when employees have birthdays */}
      {showBirthdayPopup && birthdayEmployees.length > 0 && (
        <BirthdayPopup employees={birthdayEmployees} onClose={handleCloseBirthday} />
      )}

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo/Header */}
        <div className="p-4 lg:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <img src="/tovyalla_logo.png" alt="Tovyalla CRM" className="h-10 lg:h-12 w-auto" />
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => handleNavClick('overview')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'overview'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Dashboard</span>
          </button>
          <button
            onClick={() => handleNavClick('company')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'company'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Company Info</span>
          </button>
          <button
            onClick={() => handleNavClick('customers')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'customers'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Customers</span>
          </button>
          <button
            onClick={() => handleNavClick('projects')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'projects'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Projects</span>
          </button>
          <button
            onClick={() => handleNavClick('templates')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'templates'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Templates</span>
          </button>
          <button
            onClick={() => handleNavClick('inventory')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'inventory'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Inventory</span>
          </button>
          <button
            onClick={() => handleNavClick('subcontractors')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'subcontractors'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Subcontractors</span>
          </button>
          <button
            onClick={() => handleNavClick('employees')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'employees'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Employees</span>
          </button>
          <button
            onClick={() => handleNavClick('calendar')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'calendar'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Calendar</span>
          </button>
          <button
            onClick={() => handleNavClick('goals')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'goals'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium">Goals</span>
          </button>
          <button
            onClick={() => handleNavClick('messages')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'messages'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium flex items-center justify-between">
              <span>Messages</span>
              {unreadMessageCount > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                  activeSection === 'messages'
                    ? 'bg-white text-pool-blue'
                    : 'bg-pool-blue text-white'
                }`}>
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </span>
              )}
            </span>
          </button>

          {/* Divider */}
          <div className="my-1.5 border-t border-gray-200 dark:border-gray-700"></div>

          <button
            onClick={() => handleNavClick('subscription')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'subscription'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Subscription
            </span>
          </button>
          <button
            onClick={() => handleNavClick('settings')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
              activeSection === 'settings'
                ? 'bg-pool-blue text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </span>
          </button>
        </nav>

        {/* User Info & Logout - always visible at bottom */}
        <div className="p-3 lg:p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
          <div className="mb-2">
            <p className="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Logged in as</p>
            <p className="text-xs lg:text-sm font-medium text-gray-900 dark:text-white truncate">{user.email}</p>
            {currentCompanyID && (
              <p className="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400">{currentCompanyID}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:ml-64">
        {/* Mobile Header */}
        <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/tovyalla_logo.png" alt="Tovyalla CRM" className="h-8 w-auto ml-3" />
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                  Welcome, {employeeName?.split(' ')[0] || user.email}!
                </h2>
              </div>

              {/* Project Statistics */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Project Statistics</h3>
                  <select
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-pool-blue">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Est. Value</p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                            ${statistics.totalEstValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {statistics.projectCount} {statistics.projectCount === 1 ? 'project' : 'projects'}
                      </p>
                    </div>

                    {/* Total Profit */}
                    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 ${statistics.totalProfit >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Profit</p>
                            <div className="relative group">
                              <svg 
                                className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50 shadow-lg">
                                <p className="font-semibold mb-1">How Profit is Calculated</p>
                                <p className="text-gray-300 mb-2">Profit = Revenue − Expenses</p>
                                <p className="text-gray-300 text-[11px] leading-relaxed">
                                  <span className="font-medium text-white">Revenue:</span> Closing price (or milestones, or est. value)<br/>
                                  <span className="font-medium text-white">Expenses:</span> Subcontractor fees + Materials + Equipment + Additional expenses
                                </p>
                                <p className="text-gray-400 text-[10px] mt-1.5 italic">Only includes sold/completed projects</p>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                              </div>
                            </div>
                          </div>
                          <p className={`text-3xl font-bold mt-1 ${statistics.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${statistics.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Revenue: ${(statistics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Expenses: ${statistics.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {(statistics.totalRevenue || 0) > 0 && (
                        <p className={`text-xs font-medium mt-1 ${statistics.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          Margin: {((statistics.totalProfit / (statistics.totalRevenue || 1)) * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Monthly Chart */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Monthly Overview</h3>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <select
                      value={chartYear}
                      onChange={(e) => setChartYear(parseInt(e.target.value))}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <select
                      value={chartMetric}
                      onChange={(e) => setChartMetric(e.target.value)}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pool-blue text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {CHART_METRICS.map((metric) => (
                        <option key={metric.value} value={metric.value}>
                          {metric.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  {loadingMonthly ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pool-blue"></div>
                    </div>
                  ) : monthlyData?.monthlyData ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={monthlyData.monthlyData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            axisLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis
                            tickFormatter={formatYAxis}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            axisLine={{ stroke: '#d1d5db' }}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey={chartMetric}
                            fill={selectedMetric.color}
                            radius={[4, 4, 0, 0]}
                            name={selectedMetric.label}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                      No data available for {chartYear}
                    </div>
                  )}

                  {/* Chart Legend / Summary */}
                  {monthlyData?.monthlyData && !loadingMonthly && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          <span
                            className="inline-block w-3 h-3 rounded mr-2"
                            style={{ backgroundColor: selectedMetric.color }}
                          ></span>
                          {selectedMetric.label} for {chartYear}
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-white">
                          {selectedMetric.format === 'currency' ? (
                            <>Total: ${monthlyData.monthlyData.reduce((sum, m) => sum + (m[chartMetric] || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                          ) : (
                            <>Total: {monthlyData.monthlyData.reduce((sum, m) => sum + (m[chartMetric] || 0), 0).toLocaleString('en-US')}</>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Projects In Progress */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Projects In Progress</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-gray-400">
                    <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Contract Sent</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{projectsInProgress.contractSent}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
                    <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Proposal Sent</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{projectsInProgress.proposalSent}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
                    <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Sold</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{projectsInProgress.sold}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-pool-blue">
                    <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{projectsInProgress.total}</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeSection === 'company' && <CompanyInfo />}
          {activeSection === 'customers' && <Customers />}
          {activeSection === 'projects' && <Projects />}
          {activeSection === 'templates' && <Templates />}
          {activeSection === 'inventory' && <Inventory />}
          {activeSection === 'subcontractors' && <Subcontractors />}
          {activeSection === 'employees' && <Employees />}
          {activeSection === 'calendar' && <Calendar />}
          {activeSection === 'goals' && <Goals />}
          {activeSection === 'messages' && <Messages />}
          {activeSection === 'subscription' && <Subscription />}
          {activeSection === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  )
}

export default Dashboard
