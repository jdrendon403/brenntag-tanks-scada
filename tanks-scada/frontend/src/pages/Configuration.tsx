import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getConfig, updateConfig, getAuditLog,
  uploadCalibration, writeSensorRange, writeOverflowLimit,
} from '../api/client'
import { useUnits } from '../context/UnitContext'
import type { HeightUnit, VolumeUnit } from '../utils/units'
import type { TankConfig, AuditRecord, CalibrationPoint, SensorRange } from '../types'

// ---------------------------------------------------------------------------
// Tipos de estado local
// ---------------------------------------------------------------------------
type Msg = { ok: boolean; text: string }

const EMPTY_SR: SensorRange = { min_value: 0, max_value: 10000, min_register: 0, max_register: 0 }

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function Configuration() {
  const [params, setParams] = useSearchParams()
  const [tankId, setTankId] = useState(Number(params.get('tank')) || 1)
  const [cfg, setCfg]       = useState<TankConfig | null>(null)

  // -- Formulario principal (producto, densidad, alarma, modbus, sensor_range)
  const [form, setForm]               = useState<Partial<TankConfig>>({})
  const [alarmOverride, setAlarmOverride] = useState(false)
  const [srForm, setSrForm]           = useState<SensorRange>(EMPTY_SR)
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState<Msg | null>(null)

  // -- Escritura al PLC — rango sensor
  const [writingPLC, setWritingPLC]   = useState(false)
  const [plcMsg, setPlcMsg]           = useState<Msg | null>(null)

  // -- Escritura al PLC — límite sobrellenado
  const [writingOverflow, setWritingOverflow] = useState(false)
  const [overflowMsg, setOverflowMsg]         = useState<Msg | null>(null)

  // -- Tabla de aforo — editor
  const [tableEdits, setTableEdits]   = useState<CalibrationPoint[]>([])
  const [editingIdx, setEditingIdx]   = useState<number | null>(null)
  const [editRow, setEditRow]         = useState<CalibrationPoint>({ height_mm: 0, volume_l: 0 })
  const [tableChanged, setTableChanged] = useState(false)
  const [savingTable, setSavingTable] = useState(false)
  const [tableMsg, setTableMsg]       = useState<Msg | null>(null)
  const [tableFilter, setTableFilter] = useState('')

  // -- Carga CSV
  const [calibFile, setCalibFile]     = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [calibMsg, setCalibMsg]       = useState<Msg | null>(null)

  // -- Audit log
  const [audit, setAudit]             = useState<AuditRecord[]>([])

  // -- Unidades
  const { units, setHeightUnit, setVolumeUnit } = useUnits()

  const ids = Array.from({ length: 13 }, (_, i) => i + 1)

  // ---------------------------------------------------------------------------
  // Carga
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setParams({ tank: String(tankId) }, { replace: true })
    loadConfig()
    loadAudit()
    // Resetear estado de tabla y mensajes al cambiar de tanque
    setEditingIdx(null)
    setTableChanged(false)
    setTableMsg(null)
    setCalibMsg(null)
    setPlcMsg(null)
    setOverflowMsg(null)
    setMsg(null)
  }, [tankId]) // eslint-disable-line

  async function loadConfig() {
    const data: TankConfig = await getConfig(tankId)
    setCfg(data)
    setForm({
      ...data,
      alarm_height: data.alarm_height != null ? data.alarm_height * 1000 : null,
    })
    setAlarmOverride(data.alarm_height !== null && data.alarm_height !== undefined)
    const sr = data.sensor_range ?? EMPTY_SR
    setSrForm({ ...sr, min_value: sr.min_value * 1000, max_value: sr.max_value * 1000 })
    setTableEdits([...(data.calibration_table ?? [])])
    setTableChanged(false)
  }

  async function loadAudit() {
    const data = await getAuditLog(tankId, 20)
    setAudit(data)
  }

  // ---------------------------------------------------------------------------
  // Formulario principal
  // ---------------------------------------------------------------------------
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
      const payload: Partial<TankConfig> = {
        name:         form.name,
        product:      form.product,
        density:      form.density,
        alarm_height: alarmOverride ? ((form.alarm_height ?? 0) / 1000) : null,
        modbus:       form.modbus,
        sensor_range: { ...srForm, min_value: srForm.min_value / 1000, max_value: srForm.max_value / 1000 },
      }
      const updated = await updateConfig(tankId, payload)
      setCfg(updated); setForm({ ...updated })
      setSrForm(updated.sensor_range ?? EMPTY_SR)
      setMsg({ ok: true, text: 'Configuración guardada correctamente' })
      loadAudit()
    } catch {
      setMsg({ ok: false, text: 'Error al guardar. Verifique los datos.' })
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Límite de sobrellenado → PLC
  // ---------------------------------------------------------------------------
  async function handleWriteOverflow() {
    setWritingOverflow(true); setOverflowMsg(null)
    try {
      await writeOverflowLimit(tankId)
      setOverflowMsg({ ok: true, text: 'Límite enviado al PLC correctamente' })
      loadAudit()
    } catch {
      setOverflowMsg({ ok: false, text: 'Error al comunicar con el PLC' })
    } finally {
      setWritingOverflow(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Rango del sensor → PLC
  // ---------------------------------------------------------------------------
  async function handleWritePLC() {
    setWritingPLC(true); setPlcMsg(null)
    try {
      await writeSensorRange(tankId)
      setPlcMsg({ ok: true, text: 'Valores enviados al PLC correctamente' })
      loadAudit()
    } catch {
      setPlcMsg({ ok: false, text: 'Error al comunicar con el PLC. Verifique la conexión.' })
    } finally {
      setWritingPLC(false) }
  }

  // ---------------------------------------------------------------------------
  // Editor de tabla de aforo
  // ---------------------------------------------------------------------------
  function startEdit(idx: number) {
    setEditingIdx(idx)
    setEditRow({ ...tableEdits[idx] })
  }

  function commitEdit() {
    if (editingIdx === null) return
    const next = tableEdits.map((r, i) => i === editingIdx ? { ...editRow } : r)
    setTableEdits(next)
    setEditingIdx(null)
    setTableChanged(true)
  }

  function cancelEdit() { setEditingIdx(null) }

  function deleteRow(idx: number) {
    setTableEdits(t => t.filter((_, i) => i !== idx))
    if (editingIdx === idx) setEditingIdx(null)
    setTableChanged(true)
  }

  function addRow() {
    const lastH = tableEdits.length > 0 ? tableEdits[tableEdits.length - 1].height_mm : 0
    const newRow: CalibrationPoint = { height_mm: lastH + 10, volume_l: 0 }
    setTableEdits(t => [...t, newRow])
    setEditingIdx(tableEdits.length)
    setEditRow(newRow)
    setTableChanged(true)
  }

  async function saveTable() {
    // Validar orden ascendente
    for (let i = 1; i < tableEdits.length; i++) {
      if (tableEdits[i].height_mm <= tableEdits[i - 1].height_mm) {
        setTableMsg({ ok: false, text: `Error: la altura en fila ${i + 1} (${tableEdits[i].height_mm} mm) no es mayor que la anterior.` })
        return
      }
    }
    setSavingTable(true); setTableMsg(null)
    try {
      const updated = await updateConfig(tankId, { calibration_table: tableEdits })
      setCfg(updated)
      setTableEdits([...(updated.calibration_table ?? [])])
      setTableChanged(false)
      setTableMsg({ ok: true, text: `Tabla guardada (${tableEdits.length} puntos)` })
      loadAudit()
    } catch {
      setTableMsg({ ok: false, text: 'Error al guardar la tabla.' })
    } finally {
      setSavingTable(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Carga CSV
  // ---------------------------------------------------------------------------
  async function handleUploadCalib() {
    if (!calibFile) return
    setUploading(true); setCalibMsg(null)
    try {
      const res = await uploadCalibration(tankId, calibFile)
      setCalibMsg({ ok: true, text: `${res.points_loaded} puntos cargados correctamente` })
      await loadConfig()
      loadAudit()
    } catch {
      setCalibMsg({ ok: false, text: 'Error al cargar el CSV. Verifique el formato.' })
    } finally {
      setUploading(false)
      setCalibFile(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  if (!form.modbus) return <div className="text-slate-400">Cargando…</div>

  // Filtrado por índice para preservar la relación índice ↔ fila original
  const filteredIndices: number[] = tableFilter.trim()
    ? tableEdits.reduce<number[]>((acc, r, i) => {
        if (String(r.height_mm).includes(tableFilter) || String(r.volume_l).includes(tableFilter))
          acc.push(i)
        return acc
      }, [])
    : tableEdits.map((_, i) => i)

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* ── Unidades de visualización ─────────────────────────────────── */}
      <div className="bg-slate-800 rounded-lg p-5 border border-indigo-700 space-y-3">
        <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
          Unidades de Visualización (globales)
        </h2>
        <div className="flex flex-wrap gap-6">
          <label className="block">
            <span className="text-slate-400 text-xs mb-1 block">Nivel / Altura</span>
            <select value={units.height} onChange={e => setHeightUnit(e.target.value as HeightUnit)}
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white">
              <option value="cm">cm — centímetros</option>
              <option value="m">m — metros</option>
              <option value="mm">mm — milímetros</option>
            </select>
          </label>
          <label className="block">
            <span className="text-slate-400 text-xs mb-1 block">Volumen</span>
            <select value={units.volume} onChange={e => setVolumeUnit(e.target.value as VolumeUnit)}
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white">
              <option value="L">L — litros</option>
              <option value="gal">gal — galones US</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">Peso siempre en kg. Aplica en todas las pantallas.</p>
      </div>

      {/* ── Selector de tanque ────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Configuración de Tanque</h1>
        <select value={tankId} onChange={e => setTankId(Number(e.target.value))}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm">
          {ids.map(i => <option key={i} value={i}>TK{i}</option>)}
        </select>
      </div>

      {/* ── Formulario principal ──────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-5 border border-slate-700 space-y-5">

        {/* Producto */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Producto</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del tanque" value={form.name ?? ''} onChange={field('name')} />
            <Field label="Producto"          value={form.product ?? ''} onChange={field('product')} />
          </div>
        </section>

        {/* Densidad */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Propiedades del producto</h2>
          <div className="max-w-xs">
            <Field label="Densidad (kg/L)" type="number" value={form.density ?? 1} onChange={field('density')} step="0.001" />
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
            <div className="space-y-2">
              <div className="max-w-xs">
                <Field label="Altura de alarma (mm)" type="number" value={form.alarm_height ?? ''}
                  onChange={e => setForm(f => ({ ...f, alarm_height: Number(e.target.value) }))} step="1" />
              </div>
              <div className="flex items-center gap-3">
                <button type="button" disabled={writingOverflow} onClick={handleWriteOverflow}
                  className="px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded font-medium">
                  {writingOverflow ? 'Enviando…' : 'Enviar al PLC'}
                </button>
                {overflowMsg && (
                  <span className={`text-sm ${overflowMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {overflowMsg.text}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Registros Modbus de lectura */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Registros Modbus — Lectura</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Reg. Altura"       type="number" value={form.modbus.height_register}   onChange={modbusField('height_register')} />
            <Field label="Reg. Sobrellenado" type="number" value={form.modbus.overflow_register} onChange={modbusField('overflow_register')} />
            <Field label="Reg. Suiche"       type="number" value={form.modbus.switch_register}   onChange={modbusField('switch_register')} />
          </div>
        </section>

        {/* Rango del sensor */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Rango del Sensor de Nivel</h2>
          <p className="text-xs text-slate-500 mb-3">
            Rango de la señal analógica del sensor. Guardar actualiza la base de datos;
            "Enviar al PLC" escribe los valores a los registros holding configurados.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Field label="Valor mín. (mm)" type="number" step="1"
              value={srForm.min_value}
              onChange={e => setSrForm(f => ({ ...f, min_value: Number(e.target.value) }))} />
            <Field label="Reg. Modbus mín." type="number"
              value={srForm.min_register}
              onChange={e => setSrForm(f => ({ ...f, min_register: Number(e.target.value) }))} />
            <Field label="Valor máx. (mm)" type="number" step="1"
              value={srForm.max_value}
              onChange={e => setSrForm(f => ({ ...f, max_value: Number(e.target.value) }))} />
            <Field label="Reg. Modbus máx." type="number"
              value={srForm.max_register}
              onChange={e => setSrForm(f => ({ ...f, max_register: Number(e.target.value) }))} />
          </div>
          <button type="button" disabled={writingPLC}
            onClick={handleWritePLC}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-medium">
            {writingPLC ? 'Enviando…' : 'Enviar al PLC'}
          </button>
          {plcMsg && (
            <p className={`text-sm font-medium mt-2 ${plcMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{plcMsg.text}</p>
          )}
        </section>

        {msg && (
          <p className={`text-sm font-medium ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
        )}

        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded font-medium">
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>

      {/* ── Tabla de Aforo ────────────────────────────────────────────── */}
      <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Tabla de Aforo (Calibración SGS)
            {tableEdits.length > 0 && (
              <span className="ml-2 text-slate-500 normal-case font-normal">— {tableEdits.length} puntos</span>
            )}
          </h2>
          <div className="flex gap-2">
            <button type="button" onClick={addRow}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded">
              + Agregar fila
            </button>
            {tableChanged && (
              <button type="button" onClick={saveTable} disabled={savingTable}
                className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1 rounded font-medium">
                {savingTable ? 'Guardando…' : 'Guardar cambios'}
              </button>
            )}
          </div>
        </div>

        {tableEdits.length === 0 ? (
          <p className="text-sm text-amber-400">Sin tabla — calculando volumen con fórmula cilíndrica</p>
        ) : (
          <>
            <input
              type="text" placeholder="Buscar por altura o volumen…"
              value={tableFilter} onChange={e => setTableFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white
                         focus:outline-none focus:border-blue-500"
            />
            <div className="overflow-auto max-h-80 rounded border border-slate-700">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800 border-b border-slate-700">
                  <tr className="text-slate-400">
                    <th className="text-right px-3 py-2 w-10">#</th>
                    <th className="text-right px-3 py-2">Altura (mm)</th>
                    <th className="text-right px-3 py-2">Volumen (L)</th>
                    <th className="px-3 py-2 w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndices.map((realIdx, visualIdx) => {
                    const row = tableEdits[realIdx]
                    const isEditing = editingIdx === realIdx
                    return (
                      <tr key={realIdx}
                        className={`border-b border-slate-700/50 ${isEditing ? 'bg-slate-700' : 'hover:bg-slate-700/30'}`}>
                        <td className="px-3 py-1 text-slate-500 text-right">{visualIdx + 1}</td>

                        {isEditing ? (
                          <>
                            <td className="px-2 py-1">
                              <input type="number" step="0.1"
                                value={editRow.height_mm}
                                onChange={e => setEditRow(r => ({ ...r, height_mm: Number(e.target.value) }))}
                                className="w-full bg-slate-900 border border-blue-500 rounded px-1 py-0.5 text-white text-right" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="number" step="0.001"
                                value={editRow.volume_l}
                                onChange={e => setEditRow(r => ({ ...r, volume_l: Number(e.target.value) }))}
                                className="w-full bg-slate-900 border border-blue-500 rounded px-1 py-0.5 text-white text-right" />
                            </td>
                            <td className="px-2 py-1 flex gap-1 justify-end">
                              <button onClick={commitEdit}
                                className="bg-green-700 hover:bg-green-600 text-white px-2 py-0.5 rounded text-xs">✓</button>
                              <button onClick={cancelEdit}
                                className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-0.5 rounded text-xs">✕</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-1 font-mono text-white text-right">
                              {row.height_mm.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
                            </td>
                            <td className="px-3 py-1 font-mono text-white text-right">
                              {row.volume_l.toLocaleString('es-CO', { maximumFractionDigits: 3 })}
                            </td>
                            <td className="px-2 py-1">
                              <div className="flex gap-1 justify-end">
                                <button onClick={() => startEdit(realIdx)}
                                  className="text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded hover:bg-slate-700 text-xs">
                                  Editar
                                </button>
                                <button onClick={() => deleteRow(realIdx)}
                                  className="text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-slate-700 text-xs">
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tableMsg && (
          <p className={`text-sm font-medium ${tableMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{tableMsg.text}</p>
        )}

        {/* Carga CSV */}
        <div className="pt-2 border-t border-slate-700 space-y-2">
          <p className="text-xs text-slate-500 font-medium">Reemplazar tabla completa desde CSV</p>
          <div className="flex items-center gap-3 flex-wrap">
            <input type="file" accept=".csv"
              key={calibFile ? 'has-file' : 'empty'}
              onChange={e => setCalibFile(e.target.files?.[0] ?? null)}
              className="text-xs text-slate-300
                file:mr-2 file:bg-slate-700 file:border-0 file:rounded
                file:px-3 file:py-1 file:text-slate-200 file:cursor-pointer
                file:hover:bg-slate-600" />
            <button type="button" disabled={!calibFile || uploading} onClick={handleUploadCalib}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                         text-white px-4 py-1.5 rounded text-xs font-medium">
              {uploading ? 'Subiendo…' : 'Cargar CSV'}
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Formato: columnas <code className="bg-slate-700 px-1 rounded">height_mm</code> y{' '}
            <code className="bg-slate-700 px-1 rounded">volume_l</code>, alturas ascendentes.
          </p>
          {calibMsg && (
            <p className={`text-xs font-medium ${calibMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{calibMsg.text}</p>
          )}
        </div>
      </div>

      {/* ── Historial de cambios ──────────────────────────────────────── */}
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
                  <td className="py-1 text-slate-300 font-mono break-all">
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

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------
function Field({ label, value, onChange, type = 'text', step }: {
  label: string
  value: string | number
  onChange: React.ChangeEventHandler<HTMLInputElement>
  type?: string
  step?: string
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
