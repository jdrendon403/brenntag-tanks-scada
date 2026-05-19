import { useTankData } from '../context/TankDataContext'
import { resetAlarm } from '../api/client'

export function AlarmBanner() {
  const { tanks } = useTankData()
  const alarmed = tanks.filter(t => t.alarm)
  if (alarmed.length === 0) return null

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault()
    resetAlarm().catch(() => {})
  }

  return (
    <div
      onContextMenu={handleRightClick}
      className="bg-red-700 text-white px-4 py-2 flex items-center justify-between
                 animate-flash cursor-default select-none border-b border-red-900"
      title="Click derecho para silenciar alarma"
    >
      <span className="font-bold tracking-wide text-sm">
        ⚠ ALARMA ACTIVA — {alarmed.map(t => t.name).join(' · ')}
      </span>
      <span className="text-red-200 text-xs">Clic derecho para silenciar</span>
    </div>
  )
}
