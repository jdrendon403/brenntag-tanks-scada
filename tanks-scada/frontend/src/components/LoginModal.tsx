import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function LoginModal() {
  const { showLoginModal, login } = useAuth()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!showLoginModal) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(user, pass)
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 border border-slate-600 rounded-lg p-6 w-80 space-y-4 shadow-xl"
      >
        <div>
          <h2 className="text-white font-semibold text-lg">Acceso requerido</h2>
          <p className="text-slate-400 text-sm mt-1">
            Esta acción requiere autenticación de operador.
          </p>
        </div>
        <input
          type="text"
          placeholder="Usuario"
          value={user}
          onChange={e => setUser(e.target.value)}
          required
          autoFocus
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2
                     text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={e => setPass(e.target.value)}
          required
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2
                     text-white text-sm focus:outline-none focus:border-blue-500"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                     text-white py-2 rounded font-medium"
        >
          {loading ? 'Verificando…' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}
