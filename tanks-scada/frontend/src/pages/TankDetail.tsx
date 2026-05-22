import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTankData } from '../context/TankDataContext'
import { useUnits } from '../context/UnitContext'
import { convertHeight, convertVolume } from '../utils/units'
import { LevelBar } from '../components/LevelBar'
import { getHistory } from '../api/client'
import type { HistoryRecord } from '../types'

type Variable = 'height' | 'percentage' | 'volume' | 'weight'

const fmtTime = (ts: string) =>
  new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

export default function TankDetail() {
  const { id } = useParams<{ id: string }>()
  const tankId  = Number(id)
  const nav     = useNavigate()
  const { tanks } = useTankData()
  const { units } = useUnits()
  const tank    = tanks.find(t => t.tank_id === tankId)

  const [history, setHistory]   = useState<HistoryRecord[]>([])
  const [variable, setVariable] = useState<Variable>('height')
  const [density, setDensity]   = useState<number | null>(null)

  // Meta dinámica según unidades seleccionadas
  const varMeta: Record<Variable, { label: string; unit: string; color: string }> = {
    height:     { label: 'Altura',   unit: units.height, color: '#3b82f6' },
    percentage: { label: 'Nivel',    unit: '%',          color: '#22c55e' },
    volume:     { label: 'Volumen',  unit: units.volume, color: '#8b5cf6' },
    weight:     { label: 'Peso',     unit: 'kg',         color: '#f59e0b' },
  }

  useEffect(() => {
    getHistory({ tank_id: tankId, limit: 1440 })
      .then(data => setHistory([...data].reverse()))
      .catch(() => {})
    import('../api/client').then(({ getConfig }) =>
      getConfig(tankId).then(cfg => setDensity(cfg.density)).catch(() => {})
    )
  }, [tankId])

  if (!tank) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-400">Conectando o tanque no encontrado…</p>
        <button onClick={() => nav('/')} className="text-blue-400 text-sm hover:underline">← Volver</button>
      </div>
    )
  }

  const { name, product, height, percentage, volume, weight, overflow_limit, alarm } = tank

  // Valores convertidos para las barras de nivel
  const dispHeight   = convertHeight(height, units.height)
  const dispOverflow = convertHeight(overflow_limit, units.height)
  const dispVolume   = convertVolume(volume, units.volume)
  const dispMaxVol   = convertVolume(volume / Math.max(percentage, 0.01) * 100, units.volume)
  const dispWeight   = weight
  const dispMaxWt    = weight / Math.max(percentage, 0.01) * 100

  // Datos históricos convertidos para el gráfico
  const displayHistory = history.map(r => ({
    ...r,
    height: convertHeight(r.height, units.height),
    volume: convertVolume(r.volume, units.volume),
  }))

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => nav('/')} className="text-slate-400 text-sm hover:text-white mb-1 inline-block">
            ← Vista General
          </button>
          <h1 className="text-2xl font-bold text-white">{name}</h1>
          <p className="text-slate-400">{product || 'Sin producto'}</p>
        </div>
        <div className="flex gap-2">
          {alarm && (
            <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse">
              ⚠ ALARMA
            </span>
          )}
          <button
            onClick={() => nav(`/config?tank=${tankId}`)}
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-1 rounded"
          >
            ⚙ Configurar
          </button>
        </div>
      </div>

      {/* Level bars */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex justify-around flex-wrap gap-6">
          <LevelBar label="Altura"  value={dispHeight}  unit={units.height} max={dispOverflow}  color={alarm ? '#ef4444' : '#3b82f6'} />
          <LevelBar label="Volumen" value={dispVolume}   unit={units.volume} max={dispMaxVol}    color="#8b5cf6" />
          <LevelBar label="Peso"    value={dispWeight}   unit="kg"           max={dispMaxWt}     color="#f59e0b" />
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <Info label="Nivel"           value={`${percentage.toFixed(1)}%`} />
          <Info label="Sobrellenado"    value={`${dispOverflow.toFixed(2)} ${units.height}`} color={alarm ? 'text-red-400' : undefined} />
          <Info label="Suiche activo"   value={tank.switch_active ? 'Sí' : 'No'} color={tank.switch_active ? 'text-red-400' : undefined} />
          <Info label="Densidad"  value={density !== null ? `${density.toFixed(3)} kg/L` : '…'} />
        </div>
      </div>

      {/* Historical chart */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300">Tendencia histórica</h2>
          <div className="flex gap-1">
            {(Object.keys(varMeta) as Variable[]).map(v => (
              <button
                key={v}
                onClick={() => setVariable(v)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  variable === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                {varMeta[v].label}
              </button>
            ))}
          </div>
        </div>

        {displayHistory.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">Sin datos históricos aún</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={displayHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" tickFormatter={fmtTime}
                tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#475569" interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#475569" width={55}
                tickFormatter={v => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0', fontSize: 12 }}
                labelFormatter={ts => new Date(ts).toLocaleString('es-CO')}
                formatter={(v: number) => [`${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${varMeta[variable].unit}`, varMeta[variable].label]}
              />
              <Line type="monotone" dataKey={variable} stroke={varMeta[variable].color}
                dot={false} strokeWidth={2} name={varMeta[variable].label} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function Info({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-900 rounded p-2">
      <p className="text-slate-500 mb-0.5">{label}</p>
      <p className={`font-mono font-bold ${color ?? 'text-white'}`}>{value}</p>
    </div>
  )
}
