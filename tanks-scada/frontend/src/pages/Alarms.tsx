import { useEffect, useState } from 'react'
import { getAlarms, ackAlarm, resetAlarm } from '../api/client'
import { useTankData } from '../context/TankDataContext'
import type { AlarmRecord } from '../types'

const fmtDt = (s: string | null) =>
  s ? new Date(s).toLocaleString('es-CO') : '—'

function Badge({ active, ack }: { active: boolean; ack: string | null }) {
  if (active && !ack) return <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">ACTIVA</span>
  if (active && ack)  return <span className="bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full">RECONOCIDA</span>
  return <span className="bg-slate-600 text-slate-300 text-xs px-2 py-0.5 rounded-full">FINALIZADA</span>
}

export default function Alarms() {
  const { tanks } = useTankData()
  const [alarms,     setAlarms]     = useState<AlarmRecord[]>([])
  const [activeOnly, setActiveOnly] = useState(false)
  const [tankFilter, setTankFilter] = useState<number | ''>('')
  const [loading,    setLoading]    = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await getAlarms({
        active_only: activeOnly,
        tank_id: tankFilter !== '' ? tankFilter : undefined,
        limit: 200,
      })
      setAlarms(data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [activeOnly, tankFilter]) // eslint-disable-line

  // Reload when live alarm state changes
  useEffect(() => { load() }, [tanks.map(t => t.alarm).join()]) // eslint-disable-line

  async function doAck(id: string) {
    await ackAlarm(id)
    load()
  }

  async function doReset() {
    await resetAlarm()
  }

  const ids = Array.from({ length: 13 }, (_, i) => i + 1)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Registro de Alarmas</h1>
        <button onClick={doReset}
          className="bg-red-700 hover:bg-red-600 text-white px-4 py-1.5 rounded text-sm font-medium">
          Silenciar (Reset PLC)
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex gap-4 flex-wrap items-center">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)}
            className="accent-red-500 w-4 h-4" />
          Solo activas
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Tanque:</span>
          <select value={tankFilter} onChange={e => setTankFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white">
            <option value="">Todos</option>
            {ids.map(i => <option key={i} value={i}>TK{i}</option>)}
          </select>
        </label>
        <button onClick={load} disabled={loading}
          className="ml-auto bg-slate-700 hover:bg-slate-600 text-sm px-3 py-1 rounded">
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-slate-700 text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Tanque</th>
              <th className="text-left px-3 py-2">Origen</th>
              <th className="text-left px-3 py-2">Inicio</th>
              <th className="text-left px-3 py-2">Reconocimiento</th>
              <th className="text-left px-3 py-2">Finalización</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {alarms.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500 py-10">
                  {loading ? 'Cargando…' : 'Sin alarmas en el período'}
                </td>
              </tr>
            )}
            {alarms.map(a => (
              <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-3 py-2 font-bold text-white">TK{a.tank_id}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    a.origin === 'height' ? 'bg-orange-900 text-orange-200' : 'bg-purple-900 text-purple-200'
                  }`}>
                    {a.origin === 'height' ? 'Altura' : 'Suiche'}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-slate-300">{fmtDt(a.start_time)}</td>
                <td className="px-3 py-2 font-mono text-slate-300">{fmtDt(a.ack_time)}</td>
                <td className="px-3 py-2 font-mono text-slate-300">{fmtDt(a.end_time)}</td>
                <td className="px-3 py-2"><Badge active={a.active} ack={a.ack_time} /></td>
                <td className="px-3 py-2">
                  {a.active && !a.ack_time && (
                    <button onClick={() => doAck(a.id)}
                      className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs px-2 py-0.5 rounded">
                      ACK
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
