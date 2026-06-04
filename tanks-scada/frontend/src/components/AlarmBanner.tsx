import { useState } from 'react'
import { useTankData } from '../context/TankDataContext'
import { resetAlarm } from '../api/client'

export function AlarmBanner() {
  const { tanks, systemAlarms } = useTankData()
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const alarmed = tanks.filter(t => t.alarm)
  const sysLabels: string[] = [
    ...(systemAlarms.alarm1 ? ['Alarma DPS'] : []),
    ...(systemAlarms.alarm2 ? ['Alarma Monitor de Fase'] : []),
  ]
  if (alarmed.length === 0 && sysLabels.length === 0) return null

  const allLabels = [...alarmed.map(t => t.name), ...sysLabels]

  async function handleReset(e?: React.MouseEvent) {
    e?.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    try {
      const res = await resetAlarm()
      setStatus(res?.success ? 'ok' : 'error')
    } catch {
      setStatus('error')
    } finally {
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <div
      onContextMenu={handleReset}
      className="bg-red-700 text-white px-4 py-2 flex items-center justify-between
                 animate-flash cursor-default select-none border-b border-red-900"
      title="Click derecho para silenciar alarma"
    >
      <span className="font-bold tracking-wide text-sm">
        ⚠ ALARMA ACTIVA — {allLabels.join(' · ')}
      </span>
      <button
        onClick={handleReset}
        disabled={status === 'sending'}
        className="text-xs px-3 py-1 rounded border border-red-300/50 hover:bg-red-600
                   disabled:opacity-60 transition-colors"
      >
        {status === 'sending' && 'Enviando…'}
        {status === 'ok'      && '✓ Reset enviado'}
        {status === 'error'   && '✗ Error al resetear'}
        {status === 'idle'    && 'Silenciar'}
      </button>
    </div>
  )
}
