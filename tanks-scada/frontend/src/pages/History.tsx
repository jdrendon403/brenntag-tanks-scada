import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getHistory } from '../api/client'
import type { HistoryRecord } from '../types'

type Variable = 'height' | 'percentage' | 'volume' | 'weight'

const VAR_META: Record<Variable, { label: string; unit: string; color: string }> = {
  height:     { label: 'Altura (m)',   unit: 'm',  color: '#3b82f6' },
  percentage: { label: 'Nivel (%)',    unit: '%',  color: '#22c55e' },
  volume:     { label: 'Volumen (L)',  unit: 'L',  color: '#8b5cf6' },
  weight:     { label: 'Peso (kg)',    unit: 'kg', color: '#f59e0b' },
}

function isoLocal(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function History() {
  const now  = new Date()
  const ago  = new Date(now.getTime() - 24 * 3600 * 1000)

  const [tankId,   setTankId]   = useState(1)
  const [variable, setVariable] = useState<Variable>('height')
  const [from,     setFrom]     = useState(isoLocal(ago))
  const [to,       setTo]       = useState(isoLocal(now))
  const [data,     setData]     = useState<HistoryRecord[]>([])
  const [loading,  setLoading]  = useState(false)

  const ids = Array.from({ length: 13 }, (_, i) => i + 1)

  async function load() {
    setLoading(true)
    try {
      const rows = await getHistory({
        tank_id: tankId,
        from: new Date(from).toISOString(),
        to:   new Date(to).toISOString(),
        limit: 1440,
      })
      setData([...rows].reverse())
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const { label, unit, color } = VAR_META[variable]

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Consulta Histórica</h1>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-wrap gap-4 items-end">
        <label className="block">
          <span className="text-slate-400 text-xs mb-1 block">Tanque</span>
          <select value={tankId} onChange={e => setTankId(Number(e.target.value))}
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white">
            {ids.map(i => <option key={i} value={i}>TK{i}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-slate-400 text-xs mb-1 block">Variable</span>
          <select value={variable} onChange={e => setVariable(e.target.value as Variable)}
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white">
            {(Object.keys(VAR_META) as Variable[]).map(v =>
              <option key={v} value={v}>{VAR_META[v].label}</option>
            )}
          </select>
        </label>

        <label className="block">
          <span className="text-slate-400 text-xs mb-1 block">Desde</span>
          <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
        </label>

        <label className="block">
          <span className="text-slate-400 text-xs mb-1 block">Hasta</span>
          <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" />
        </label>

        <button onClick={load} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm">
          {loading ? 'Cargando…' : 'Consultar'}
        </button>
      </div>

      {/* Chart */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          TK{tankId} — {label}
          <span className="text-slate-500 ml-2 font-normal">({data.length} registros)</span>
        </h2>
        {data.length === 0 ? (
          <p className="text-center text-slate-500 py-16">Sin registros en el rango seleccionado</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp"
                tickFormatter={ts => new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#475569" interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#475569" width={60}
                tickFormatter={v => v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0', fontSize: 11 }}
                labelFormatter={ts => new Date(ts).toLocaleString('es-CO')}
                formatter={(v: number) => [`${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${unit}`, label]}
              />
              <Line type="monotone" dataKey={variable} stroke={color} dot={false} strokeWidth={2} name={label} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Table */}
      {data.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800 border-b border-slate-700">
              <tr className="text-slate-400">
                <th className="text-left px-3 py-2">Fecha / Hora</th>
                <th className="text-right px-3 py-2">{label}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((r, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-3 py-1.5 font-mono text-slate-300">
                    {new Date(r.timestamp).toLocaleString('es-CO')}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-white text-right">
                    {r[variable].toLocaleString('es-CO', { maximumFractionDigits: 3 })} {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
