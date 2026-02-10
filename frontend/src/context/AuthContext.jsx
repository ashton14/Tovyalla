import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only create Supabase client if both URL and key are provided
let supabase = null
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
}

const AuthContext = createContext(null)
const CURRENT_COMPANY_KEY = 'tovyalla_current_company_id'

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Inactivity timeout: 6 hours in milliseconds
const INACTIVITY_TIMEOUT = 6 * 60 * 60 * 1000

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [currentCompanyID, setCurrentCompanyIDState] = useState(() => {
    try {
      return localStorage.getItem(CURRENT_COMPANY_KEY) || ''
    } catch {
      return ''
    }
  })
  const [loading, setLoading] = useState(true)
  const [inactivityMessage, setInactivityMessage] = useState('')
  const inactivityTimerRef = useRef(null)

  const setCurrentCompanyID = useCallback((id) => {
    const value = typeof id === 'string' ? id : ''
    setCurrentCompanyIDState(value)
    try {
      if (value) localStorage.setItem(CURRENT_COMPANY_KEY, value)
      else localStorage.removeItem(CURRENT_COMPANY_KEY)
    } catch {}
  }, [])

  // Function to handle logout due to inactivity
  const logoutDueToInactivity = useCallback(async () => {
    if (supabase && user) {
      await supabase.auth.signOut()
      setUser(null)
      setInactivityMessage('You have been logged out due to inactivity.')
    }
  }, [user])

  // Function to reset the inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    // Only set timer if user is logged in
    if (user) {
      inactivityTimerRef.current = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT)
    }
  }, [user, logoutDueToInactivity])

  // Set up activity listeners for inactivity timeout
  useEffect(() => {
    if (!user) {
      // Clear timer if user is not logged in
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
      return
    }

    // Activity events to listen for
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

    // Start the inactivity timer
    resetInactivityTimer()

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer, { passive: true })
    })

    // Cleanup
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer)
      })
    }
  }, [user, resetInactivityTimer])

  useEffect(() => {
    if (supabase && supabaseUrl && supabaseAnonKey) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        const stored = localStorage.getItem(CURRENT_COMPANY_KEY)
        if (stored) setCurrentCompanyIDState(stored)
        setLoading(false)
      }).catch((error) => {
        console.error('Error getting session:', error)
        setLoading(false)
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null)
      })
      return () => subscription.unsubscribe()
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (companyID, username, password) => {
    try {
      if (!supabase || !supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env file.')
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password,
      })

      if (error) throw error

      // Verify user is an employee of this company and set current company context (multi-company)
      const verifyRes = await fetch('/api/auth/verify-company', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyID }),
      })
      const verifyResult = await verifyRes.json().catch(() => ({}))
      if (!verifyRes.ok) {
        await supabase.auth.signOut()
        throw new Error(verifyResult.error || 'You are not an employee of this company.')
      }
      const session = data.session
      const userData = data.user
      if (verifyResult.companyID) setCurrentCompanyID(verifyResult.companyID)

      // Check if employee is active via backend (bypasses RLS)
      try {
        const checkResponse = await fetch('/api/auth/check-active', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'X-Company-ID': verifyResult.companyID || currentCompanyID || '',
          },
        })
        const checkResult = await checkResponse.json()
        
        if (checkResult.active === false) {
          await supabase.auth.signOut()
          throw new Error('Your account has been deactivated. Please contact an administrator.')
        }
      } catch (checkError) {
        // If it's our deactivation error, rethrow it
        if (checkError.message.includes('deactivated')) {
          throw checkError
        }
        // Otherwise log and continue (don't block login due to check errors)
        console.error('Error checking active status:', checkError)
      }

      // Update last logon timestamp
      const cid = verifyResult.companyID || currentCompanyID
      try {
        if (session?.access_token && cid) {
          await fetch('/api/auth/update-last-logon', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'X-Company-ID': cid,
            },
          })
        }
      } catch (logonError) {
        console.error('Error updating last logon:', logonError)
      }

      return { user: userData, session, companyID: cid }
    } catch (error) {
      throw error
    }
  }

  const register = async (companyID, email, password, name) => {
    try {
      if (!supabase || !supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env file.')
      }

      // Call backend API which checks whitelist before registration
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyID, email, password, name }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      if (result.session) {
        await supabase.auth.setSession(result.session)
        if (result.companyID) setCurrentCompanyID(result.companyID)
        return { user: result.user, session: result.session, companyID: result.companyID }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Verify your email address then log in with your company ID')
        }
        throw error
      }

      if (result.companyID) setCurrentCompanyID(result.companyID)
      return { user: data.user, session: data.session, companyID: result.companyID }
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setCurrentCompanyID('')
  }

  const getAuthHeaders = useCallback((token) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(currentCompanyID && { 'X-Company-ID': currentCompanyID }),
    }
    return headers
  }, [currentCompanyID])

  const clearInactivityMessage = () => {
    setInactivityMessage('')
  }

  const value = {
    user,
    currentCompanyID,
    setCurrentCompanyID,
    getAuthHeaders,
    login,
    register,
    logout,
    loading,
    supabase,
    inactivityMessage,
    clearInactivityMessage,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

