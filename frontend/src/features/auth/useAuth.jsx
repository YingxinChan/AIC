import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from './authApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = (userData) => setUser(userData)
  const logout = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
