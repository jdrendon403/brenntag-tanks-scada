interface Props {
  label: string
  value: number
  unit: string
  max: number
  color?: string
}

export function LevelBar({ label, value, unit, max, color = '#3b82f6' }: Props) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</span>

      {/* Vertical bar */}
      <div className="relative w-16 h-48 bg-slate-900 border-2 border-slate-600 rounded-b overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-700"
          style={{ height: `${pct}%`, background: color, opacity: 0.85 }}
        />
        {/* Tick marks */}
        {[25, 50, 75].map(t => (
          <div key={t} className="absolute left-0 right-0 border-t border-slate-500 border-dashed opacity-40"
            style={{ bottom: `${t}%` }} />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-xs font-bold drop-shadow">{pct.toFixed(0)}%</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-white font-mono font-bold">{value.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p>
        <p className="text-slate-400 text-xs">{unit}</p>
      </div>
    </div>
  )
}
