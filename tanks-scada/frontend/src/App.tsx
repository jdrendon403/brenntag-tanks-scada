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
      <div className="mb-6">
        <BrenntakLogo height={48} />
      </div>
      <h1 className="text-white text-2xl font-bold mb-1">SCADA Tanques</h1>
      <p className="text-slate-400 text-sm mb-10">Barranquilla</p>
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
// Brenntag logo (inline SVG — texto en blanco para fondo oscuro)
// ---------------------------------------------------------------------------
function BrenntakLogo({ height = 22 }: { height?: number }) {
  const aspect = 212 / 40
  return (
    <svg
      width={Math.round(height * aspect)}
      height={height}
      viewBox="0 0 212 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Brenntag"
    >
      {/* Wordmark — blanco en navbar oscura */}
      <path d="M210.826 18.2691C210.906 18.7216 211 19.9358 211 20.4683C211 26.1333 206.943 30.3341 201.218 30.3341C195.493 30.3341 190.833 25.5725 190.833 19.9333C190.833 14.2683 195.493 9.66748 201.272 9.66748C204.407 9.66748 207.259 11.09 209.144 13.3216L206.642 15.275C205.324 13.76 203.398 12.8333 201.272 12.8333C197.304 12.8333 194.162 15.9983 194.162 19.9341C194.162 23.8708 197.304 27.0066 201.218 27.0066C204.483 27.0066 206.549 25.3783 207.368 22.4575C207.404 22.3291 207.499 21.8758 207.498 21.5983H200.83V18.27L210.826 18.2691ZM189.167 29.9891L180.833 9.99998H177.5L169.167 30H172.5L175 24.1666H183.333L185.833 29.9891H189.167ZM179.167 14.1666L182.125 21.25H176.208L179.167 14.1666ZM151.667 9.99998V13.3333H159.167V30H162.5V13.3333H170V9.99998H151.667ZM144.167 25.1141L134.167 9.99998H130V30H133.333V15L143.426 29.9891H147.5V10.0108H144.167V25.1141ZM120.833 25.1141L110.833 9.99998H106.667V30H110V15L120.093 29.9891H124.167V10.0108H120.833V25.1141ZM100.833 9.99998H87.5V30H100.833V26.6666H90.8125V21.6666H99.1667V18.3333H90.8125V13.3333H100.833V9.99998ZM60 19.5833C61.1725 18.7091 61.6667 17.3391 61.6667 15.8333C61.6667 12.6866 59.1667 9.99998 55.9734 9.99998H46.6667V30H56.48C60 30 62.5 27.3133 62.5 24.1666C62.5 22.0416 61.3334 20.2725 60 19.5833ZM58.3334 15.8333C58.3334 17.38 57.3342 18.3333 55.8409 18.3333H50V13.3333H55.8409C57.3342 13.3333 58.3334 14.2866 58.3334 15.8333ZM50 26.6666V21.6666H56.3734C57.8667 21.6666 59.1667 22.6391 59.1667 24.1858C59.1667 25.7325 57.8667 26.6666 56.3734 26.6666H50ZM83.3334 30L77.5 22.0833C80.5059 21.1141 81.6667 18.705 81.6667 16.1641C81.6667 12.7541 79.2934 9.99998 75.6167 9.99998H66.6667V30H70V22.5H73.5417L79.1667 30H83.3334ZM75.4842 13.3333C77.4017 13.3333 78.3334 14.4325 78.3334 16.1641C78.3334 17.9225 77.4017 19.1666 75.4842 19.1666H70V13.3333H75.4842Z" fill="white"/>
      {/* Símbolo B con gradiente */}
      <path d="M28.7175 20.0167C27.4375 21.615 25.5525 23.1458 23.26 24.0517C24.64 25.7517 25.3367 27.645 24.8342 29.6133C24.355 31.4925 22.5583 33.3267 20.0008 33.3267H6.66667V23.3283H18.3333C24.7667 23.3283 30 18.0958 30 11.6642C30 5.2325 24.7667 0 18.3333 0H0V14.9967H6.66667V6.665H18.3333C21.0917 6.665 23.3333 8.90583 23.3333 11.6642C23.3333 14.4225 21.0917 16.6633 18.3333 16.6633H0V40H20C26.4333 40 31.6667 34.7675 31.6667 28.3358C31.6667 25.4825 30.8642 22.2792 28.7175 20.0167Z" fill="url(#nav_b_grad)"/>
      <defs>
        <linearGradient id="nav_b_grad" x1="-3.79358" y1="36.2064" x2="27.7859" y2="4.62691" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#C815E0"/>
          <stop offset="0.8" stopColor="#0C72ED"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function Nav() {
  const { wsConnected, modbusConnected } = useTankData()
  const { isAuthenticated, logout } = useAuth()
  const { isFullscreen, toggle } = useFullscreen()
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
    }`

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-4">
      <BrenntakLogo height={24} />
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
        <span className="flex items-center gap-2">
          {/* WebSocket (backend) */}
          <span className="flex items-center gap-1" title={wsConnected ? 'Servidor conectado' : 'Servidor desconectado'}>
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`} />
            <span className={wsConnected ? 'text-green-400' : 'text-red-400'}>
              {wsConnected ? 'En línea' : 'Sin conexión'}
            </span>
          </span>
          {/* Modbus (PLC) — solo cuando el WS está activo */}
          {wsConnected && (
            <>
              <span className="text-slate-600 select-none">·</span>
              <span className="flex items-center gap-1" title={modbusConnected ? 'PLC Modbus conectado' : 'PLC Modbus sin comunicación'}>
                <span className={`w-2 h-2 rounded-full ${modbusConnected ? 'bg-green-400' : 'bg-orange-400 animate-pulse'}`} />
                <span className={modbusConnected ? 'text-green-400' : 'text-orange-400'}>
                  {modbusConnected ? 'PLC' : 'PLC sin señal'}
                </span>
              </span>
            </>
          )}
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
