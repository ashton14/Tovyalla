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

function Dashboard() {
  const { user, logout, loading } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('overview')

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
                  Welcome to Tovyalla Dashboard
                </h2>
                <p className="text-gray-600">
                  Manage your pool construction business with ease.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Quick Stats Cards */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Company ID</h3>
                  <p className="text-2xl font-bold text-pool-dark">
                    {user.user_metadata?.companyID || 'N/A'}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Your Email</h3>
                  <p className="text-2xl font-bold text-gray-800 truncate">{user.email}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Account Status</h3>
                  <p className="text-2xl font-bold text-green-600">Active</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setActiveSection('company')}
                    className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-pool-blue hover:bg-pool-light transition-colors text-left"
                  >
                    <h4 className="font-semibold text-gray-800 mb-1">Manage Company</h4>
                    <p className="text-sm text-gray-600">View company info and manage email whitelist</p>
                  </button>
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
        </div>
      </main>
    </div>
  )
}

export default Dashboard

