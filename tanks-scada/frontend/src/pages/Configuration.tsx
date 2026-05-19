import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getConfig, getConfigs, updateConfig, getAuditLog } from '../api/client'
import type { TankConfig, AuditRecord } from '../types'

const EMPTY: Partial<TankConfig> = {}

export default function Configuration() {
  const [params, setParams] = useSearchParams()
  const [tankId, setTankId]         = useState(Number(params.get('tank')) || 1)
  const [cfg, setCfg]               = useState<TankConfig | null>(null)
  const [form, setForm]             = useState<Partial<TankConfig>>(EMPTY)
  const [alarmOverride, setAlarmOverride] = useState(false)
  const [audit, setAudit]           = useState<AuditRecord[]>([])
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState<{ ok: boolean; text: string } | null>(null)

  // Tank selector list
  const [ids] = useState(() => Array.from({ length: 13 }, (_, i) => i + 1))

  useEffect(() => {
    setParams({ tank: String(tankId) }, { replace: true })
    loadConfig()
    loadAudit()
  }, [tankId]) // eslint-disable-line

  async function loadConfig() {
    const data: TankConfig = await getConfig(tankId)
    setCfg(data)
    setForm({ ...data })
    setAlarmOverride(data.alarm_height !== null && data.alarm_height !== undefined)
  }

  async function loadAudit() {
    const data = await getAuditLog(tankId, 20)
    setAudit(data)
  }

  function field(key: keyof TankConfig) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))
  }

  function modbusField(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, modbus: { ...f.modbus!, [key]: Number(e.target.value) } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      const payload = {
        name:       form.name,
        product:    form.product,
        density:    form.density,
        diameter:   form.diameter,
        max_height: form.max_height,
        alarm_height: alarmOverride ? (form.alarm_height ?? null) : null,
        modbus:     form.modbus,
      }
      const updated = await updateConfig(tankId, payload)
      setCfg(updated); setForm({ ...updated })
      setMsg({ ok: true, text: 'Configuración guardada correctamente' })
      loadAudit()
    } catch {
      setMsg({ ok: false, text: 'Error al guardar. Verifique los datos.' })
    } finally {
      setSaving(false)
    }
  }

  if (!form.modbus) return <div className="text-slate-400">Cargando…</div>

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Configuración de Tanque</h1>
        <select
          value={tankId}
          onChange={e => setTankId(Number(e.target.value))}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
        >
          {ids.map(i => <option key={i} value={i}>TK{i}</option>)}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-5 border border-slate-700 space-y-5">
        {/* Producto */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Producto</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del tanque"  value={form.name ?? ''}    onChange={field('name')} />
            <Field label="Producto"           value={form.product ?? ''}  onChange={field('product')} />
          </div>
        </section>

        {/* Dimensiones */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Dimensiones y Densidad</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Diámetro (m)"    type="number" value={form.diameter ?? 5}    onChange={field('diameter')} step="0.01" />
            <Field label="Altura máx. (m)" type="number" value={form.max_height ?? 8}  onChange={field('max_height')} step="0.01" />
            <Field label="Densidad (kg/L)" type="number" value={form.density ?? 1}     onChange={field('density')} step="0.001" />
          </div>
        </section>

        {/* Alarma */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Alarma de Sobrellenado</h2>
          <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
            <input type="checkbox" checked={alarmOverride} onChange={e => setAlarmOverride(e.target.checked)}
              className="accent-blue-500 w-4 h-4" />
            Usar umbral personalizado (override valor del PLC)
          </label>
          {alarmOverride && (
            <Field label="Altura de alarma (m)" type="number" value={form.alarm_height ?? ''}
              onChange={e => setForm(f => ({ ...f, alarm_height: Number(e.target.value) }))} step="0.01" />
          )}
        </section>

        {/* Modbus */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Registros Modbus</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Reg. Altura"       type="number" value={form.modbus.height_register}   onChange={modbusField('height_register')} />
            <Field label="Reg. Sobrellenado" type="number" value={form.modbus.overflow_register}  onChange={modbusField('overflow_register')} />
            <Field label="Reg. Suiche"       type="number" value={form.modbus.switch_register}    onChange={modbusField('switch_register')} />
          </div>
        </section>

        {msg && (
          <p className={`text-sm font-medium ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
        )}

        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded font-medium">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      {/* Audit log */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Historial de cambios</h2>
        {audit.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin cambios registrados</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-1 pr-3">Fecha / Hora</th>
                <th className="text-left py-1">Cambios</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-1 pr-3 font-mono text-slate-300 whitespace-nowrap">
                    {new Date(a.timestamp).toLocaleString('es-CO')}
                  </td>
                  <td className="py-1 text-slate-300 font-mono">
                    {JSON.stringify(a.changes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', step }: {
  label: string; value: string | number; onChange: React.ChangeEventHandler<HTMLInputElement>;
  type?: string; step?: string
}) {
  return (
    <label className="block">
      <span className="text-slate-400 text-xs mb-1 block">{label}</span>
      <input type={type} value={value} onChange={onChange} step={step}
        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm
                   text-white focus:outline-none focus:border-blue-500" />
    </label>
  )
}
