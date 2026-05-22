import { createContext, useContext, useState, type ReactNode } from 'react'
import { DEFAULT_UNITS, type DisplayUnits, type HeightUnit, type VolumeUnit } from '../utils/units'

const STORAGE_KEY = 'scada_display_units'

function loadUnits(): DisplayUnits {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as DisplayUnits
  } catch { /* ignore */ }
  return DEFAULT_UNITS
}

interface UnitContextValue {
  units: DisplayUnits
  setHeightUnit: (u: HeightUnit) => void
  setVolumeUnit: (u: VolumeUnit) => void
}

const UnitContext = createContext<UnitContextValue>({
  units: DEFAULT_UNITS,
  setHeightUnit: () => {},
  setVolumeUnit: () => {},
})

export function UnitProvider({ children }: { children: ReactNode }) {
  const [units, setUnits] = useState<DisplayUnits>(loadUnits)

  function setHeightUnit(height: HeightUnit) {
    const next = { ...units, height }
    setUnits(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function setVolumeUnit(volume: VolumeUnit) {
    const next = { ...units, volume }
    setUnits(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <UnitContext.Provider value={{ units, setHeightUnit, setVolumeUnit }}>
      {children}
    </UnitContext.Provider>
  )
}

export const useUnits = () => useContext(UnitContext)
