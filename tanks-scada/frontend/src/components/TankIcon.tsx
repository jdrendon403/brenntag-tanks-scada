import { useNavigate } from 'react-router-dom'
import type { TankState } from '../types'

function fmt(n: number, dec = 0) {
  return n.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function levelColor(pct: number, alarm: boolean) {
  if (alarm)    return '#ef4444'
  if (pct > 85) return '#f59e0b'
  if (pct > 60) return '#3b82f6'
  return '#22c55e'
}

interface Props { tank: TankState }

export function TankIcon({ tank }: Props) {
  const nav = useNavigate()
  const { tank_id, name, product, height, percentage, volume, weight, alarm } = tank
  const clampedPct = Math.min(100, Math.max(0, percentage))
  const color = levelColor(clampedPct, alarm)

  return (
    <div
      onClick={() => nav(`/tank/${tank_id}`)}
      className={`bg-slate-800 rounded-lg p-3 cursor-pointer border-2 transition-all
        hover:scale-[1.02] hover:border-blue-500
        ${alarm ? 'border-red-500 animate-flash' : 'border-slate-600'}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-1">
        <span className="font-bold text-white text-sm">{name}</span>
        {alarm && <span className="text-red-400 text-xs font-bold">⚠ ALARMA</span>}
      </div>
      <p className="text-slate-400 text-xs mb-3 truncate" title={product}>
        {product || <span className="italic">Sin producto</span>}
      </p>

      {/* Tank visual + stats */}
      <div className="flex gap-3 items-end">
        {/* Tank body */}
        <div className="relative w-12 h-28 border-2 border-slate-500 rounded-b bg-slate-900 overflow-hidden flex-shrink-0">
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-700"
            style={{ height: `${clampedPct}%`, background: color, opacity: 0.85 }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white text-xs font-bold drop-shadow">{clampedPct.toFixed(0)}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-0.5 text-xs min-w-0">
          <div className="flex justify-between">
            <span className="text-slate-400">Altura</span>
            <span className="text-white font-mono">{height.toFixed(2)} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Volumen</span>
            <span className="text-white font-mono">{fmt(volume)} L</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Peso</span>
            <span className="text-white font-mono">{fmt(weight)} kg</span>
          </div>
        </div>
      </div>
    </div>
  )
}
