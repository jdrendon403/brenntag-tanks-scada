import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { TankDataProvider, useTankData } from './context/TankDataContext'
import { UnitProvider } from './context/UnitContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AlarmBanner } from './components/AlarmBanner'
import { LoginModal } from './components/LoginModal'
import GeneralView   from './pages/GeneralView'
import TankDetail    from './pages/TankDetail'
import Configuration from './pages/Configuration'
import History       from './pages/History'
import Alarms        from './pages/Alarms'

// ---------------------------------------------------------------------------
// Fullscreen hook
// ---------------------------------------------------------------------------
function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  function toggle() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  return { isFullscreen, toggle }
}

// ---------------------------------------------------------------------------
// Splash screen
// ---------------------------------------------------------------------------
function SplashScreen({ onEnter, onSkip }: { onEnter: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-[100]">
      <span className="text-blue-400 text-5xl mb-4">⚗</span>
      <h1 className="text-white text-2xl font-bold mb-1">SCADA Tanques</h1>
      <p className="text-slate-400 text-sm mb-10">Brenntag Barranquilla</p>
      <button
        onClick={onEnter}
        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg
                   font-medium text-base mb-4 transition-colors"
      >
        ⛶ Entrar en pantalla completa
      </button>
      <button
        onClick={onSkip}
        className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
      >
        Continuar sin pantalla completa
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function Nav() {
  const { wsConnected } = useTankData()
  const { isAuthenticated, logout } = useAuth()
  const { isFullscreen, toggle } = useFullscreen()
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
    }`

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-4">
      <span className="font-bold text-blue-400 text-sm tracking-wide mr-2">
        ⚗ SCADA Tanques
      </span>
      <NavLink to="/"        className={link}>Vista General</NavLink>
      <NavLink to="/history" className={link}>Histórico</NavLink>
      <NavLink to="/alarms"  className={link}>Alarmas</NavLink>
      <NavLink to="/config"  className={link}>Configuración</NavLink>
      <span className="ml-auto flex items-center gap-3 text-xs">
        {isAuthenticated && (
          <button
            onClick={logout}
            className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"
          >
            Cerrar sesión
          </button>
        )}
        <button
          onClick={toggle}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          className="text-slate-400 hover:text-white text-base px-1.5 py-0.5 rounded
                     hover:bg-slate-700 transition-colors"
        >
          {isFullscreen ? '⊠' : '⛶'}
        </button>
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`} />
          <span className={wsConnected ? 'text-green-400' : 'text-red-400'}>
            {wsConnected ? 'En línea' : 'Sin conexión'}
          </span>
        </span>
      </span>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <AlarmBanner />
      <main className="flex-1 p-4 overflow-auto">
        <Routes>
          <Route path="/"          element={<GeneralView />} />
          <Route path="/tank/:id"  element={<TankDetail />} />
          <Route path="/history"   element={<History />} />
          <Route path="/alarms"    element={<Alarms />} />
          <Route path="/config"    element={<Configuration />} />
        </Routes>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [showSplash, setShowSplash] = useState(true)

  function handleEnterFullscreen() {
    document.documentElement.requestFullscreen().catch(() => {})
    setShowSplash(false)
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <UnitProvider>
          <TankDataProvider>
            {showSplash && (
              <SplashScreen
                onEnter={handleEnterFullscreen}
                onSkip={() => setShowSplash(false)}
              />
            )}
            <Layout />
            <LoginModal />
          </TankDataProvider>
        </UnitProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
