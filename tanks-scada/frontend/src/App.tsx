import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { TankDataProvider, useTankData } from './context/TankDataContext'
import { AlarmBanner } from './components/AlarmBanner'
import GeneralView   from './pages/GeneralView'
import TankDetail    from './pages/TankDetail'
import Configuration from './pages/Configuration'
import History       from './pages/History'
import Alarms        from './pages/Alarms'

function Nav() {
  const { wsConnected } = useTankData()
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
    }`

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-4">
      <span className="font-bold text-blue-400 text-sm tracking-wide mr-2">
        ⚗ SCADA Tanques
      </span>
      <NavLink to="/"             className={link}>Vista General</NavLink>
      <NavLink to="/history"      className={link}>Histórico</NavLink>
      <NavLink to="/alarms"       className={link}>Alarmas</NavLink>
      <NavLink to="/config"       className={link}>Configuración</NavLink>
      <span className="ml-auto flex items-center gap-1.5 text-xs">
        <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`} />
        <span className={wsConnected ? 'text-green-400' : 'text-red-400'}>
          {wsConnected ? 'En línea' : 'Sin conexión'}
        </span>
      </span>
    </nav>
  )
}

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

export default function App() {
  return (
    <BrowserRouter>
      <TankDataProvider>
        <Layout />
      </TankDataProvider>
    </BrowserRouter>
  )
}
