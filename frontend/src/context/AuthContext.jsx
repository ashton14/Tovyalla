import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only create Supabase client if both URL and key are provided
let supabase = null
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
}

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Helper function to update last logon
    const updateLastLogon = async (session) => {
      if (session?.access_token) {
        try {
          await fetch('/api/auth/update-last-logon', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          })
        } catch (error) {
          // Don't fail if last_logon update fails
          console.error('Error updating last logon:', error)
        }
      }
    }

    // Check active sessions and sets the user
    if (supabase && supabaseUrl && supabaseAnonKey) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        // Update last logon when session is restored (e.g., page refresh)
        if (session) {
          updateLastLogon(session)
        }
        setLoading(false)
      }).catch((error) => {
        console.error('Error getting session:', error)
        setLoading(false)
      })

      // Listen for changes on auth state
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        setUser(session?.user ?? null)
        // Update last logon on SIGNED_IN event
        if (event === 'SIGNED_IN' && session) {
          updateLastLogon(session)
        }
      })

      return () => subscription.unsubscribe()
    } else {
      // If Supabase is not configured, just set loading to false
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

      // Verify companyID
      const userCompanyID = data.user?.user_metadata?.companyID
      if (userCompanyID !== companyID) {
        await supabase.auth.signOut()
        throw new Error('Invalid company ID')
      }

      // Update last logon timestamp
      try {
        const session = data.session
        if (session?.access_token) {
          await fetch('/api/auth/update-last-logon', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          })
        }
      } catch (logonError) {
        // Don't fail login if last_logon update fails
        console.error('Error updating last logon:', logonError)
      }

      return { user: data.user, session: data.session }
    } catch (error) {
      throw error
    }
  }

  const register = async (companyID, email, password) => {
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
        body: JSON.stringify({ companyID, email, password }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      // If registration was successful, the backend returns user data
      // But we need to sign in to get a session
      // Note: If email confirmation is enabled in Supabase, user might need to confirm first
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // If sign in fails, it might be because email confirmation is required
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and confirm your account before signing in.')
        }
        throw error
      }

      return { user: data.user, session: data.session }
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
  }

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    supabase,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

