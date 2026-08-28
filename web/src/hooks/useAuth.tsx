import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { api, isDemo } from '../services/api'

interface User {
  username: string
  must_reset: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  resetPassword: (newPassword: string) => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('polyorch_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isDemo) {
      const mockToken = 'demo-token'
      localStorage.setItem('polyorch_token', mockToken)
      setToken(mockToken)
      setUser({ username: 'admin', must_reset: false })
      setLoading(false)
      return
    }
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data)
        })
        .catch(() => {
          localStorage.removeItem('polyorch_token')
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (username: string, password: string) => {
    if (isDemo) {
      const mockToken = 'demo-token'
      localStorage.setItem('polyorch_token', mockToken)
      setToken(mockToken)
      setUser({ username, must_reset: false })
      return
    }
    const res = await api.post('/auth/login', { username, password })
    const { token: newToken, must_reset } = res.data
    localStorage.setItem('polyorch_token', newToken)
    setToken(newToken)
    setUser({ username, must_reset: must_reset })
  }

  const logout = () => {
    localStorage.removeItem('polyorch_token')
    setToken(null)
    setUser(null)
  }

  const changePassword = async (oldPassword: string, newPassword: string) => {
    await api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword })
  }

  const resetPassword = async (newPassword: string) => {
    await api.post('/auth/reset', { new_password: newPassword })
    setUser(prev => prev ? Object.assign({}, prev, { must_reset: false }) : null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, changePassword, resetPassword, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
