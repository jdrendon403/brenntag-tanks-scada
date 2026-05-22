import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'

interface AuthCtx {
  token: string | null
  isAuthenticated: boolean
  showLoginModal: boolean
  setShowLoginModal: (v: boolean) => void
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => sessionStorage.getItem('scada_token')
  )
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    const reqId = api.interceptors.request.use(cfg => {
      const t = sessionStorage.getItem('scada_token')
      if (t) cfg.headers.Authorization = `Bearer ${t}`
      return cfg
    })

    const resId = api.interceptors.response.use(
      r => r,
      err => {
        if (err.response?.status === 401) setShowLoginModal(true)
        return Promise.reject(err)
      }
    )

    return () => {
      api.interceptors.request.eject(reqId)
      api.interceptors.response.eject(resId)
    }
  }, [])

  async function login(username: string, password: string) {
    const res = await api.post('/api/auth/login', { username, password })
    const t: string = res.data.access_token
    sessionStorage.setItem('scada_token', t)
    setToken(t)
    setShowLoginModal(false)
  }

  function logout() {
    sessionStorage.removeItem('scada_token')
    setToken(null)
  }

  return (
    <Ctx.Provider value={{
      token,
      isAuthenticated: !!token,
      showLoginModal,
      setShowLoginModal,
      login,
      logout,
    }}>
      {children}
    </Ctx.Provider>
  )
}
