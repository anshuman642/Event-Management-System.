import { useEffect, useMemo, useState } from 'react'
import api from './api'
import AuthContext from './authContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setUser(data.user)).catch((error) => {
      if (error.response?.status !== 401) console.error('Unable to restore the current session:', error)
    }).finally(() => setReady(true))
  }, [])

  const value = useMemo(() => ({
    user,
    ready,
    login: setUser,
    logout: async () => {
      try { await api.post('/auth/logout') } catch (error) {
        console.error('Could not invalidate the current session on the server:', error)
      } finally { setUser(null) }
    },
  }), [user, ready])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
