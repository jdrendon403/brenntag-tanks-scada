import { useTankData } from '../context/TankDataContext'
import { TankIcon } from '../components/TankIcon'

export default function GeneralView() {
  const { tanks, wsConnected } = useTankData()
  const alarmed = tanks.filter(t => t.alarm).length
  const sorted  = [...tanks].sort((a, b) => a.tank_id - b.tank_id)

  return (
    <div>
      {/* Stats bar */}
      <div className="flex gap-4 mb-4">
        <Stat label="Tanques" value={tanks.length} />
        <Stat label="En Alarma" value={alarmed} color={alarmed > 0 ? 'text-red-400' : 'text-green-400'} />
        <Stat label="Conexión" value={wsConnected ? 'En línea' : 'Sin conexión'}
          color={wsConnected ? 'text-green-400' : 'text-red-400'} />
      </div>

      {tanks.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          Conectando al servidor…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {sorted.map(t => <TankIcon key={t.tank_id} tank={t} />)}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-slate-800 rounded-lg px-4 py-2 border border-slate-700">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className={`font-bold text-lg ${color}`}>{value}</p>
    </div>
  )
}
