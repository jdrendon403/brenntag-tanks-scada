import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import type { TankState } from '../types'

type SystemAlarms = { alarm1: boolean; alarm2: boolean }

interface TankDataCtx {
  tanks: TankState[]
  wsConnected: boolean
  modbusConnected: boolean
  systemAlarms: SystemAlarms
}

const TankDataContext = createContext<TankDataCtx>({
  tanks: [], wsConnected: false, modbusConnected: false,
  systemAlarms: { alarm1: false, alarm2: false },
})

export function TankDataProvider({ children }: { children: ReactNode }) {
  const { data, connected } = useWebSocket()
  const [tanks, setTanks]               = useState<TankState[]>([])
  const [modbusConnected, setModbus]    = useState(false)
  const [systemAlarms, setSystemAlarms] = useState<SystemAlarms>({ alarm1: false, alarm2: false })

  useEffect(() => {
    if (data) {
      setTanks(data.tanks)
      if (data.modbus_connected !== undefined) setModbus(data.modbus_connected)
      if (data.system_alarms !== undefined) setSystemAlarms(data.system_alarms)
    }
    if (!connected) { setModbus(false); setSystemAlarms({ alarm1: false, alarm2: false }) }
  }, [data, connected])

  return (
    <TankDataContext.Provider value={{ tanks, wsConnected: connected, modbusConnected, systemAlarms }}>
      {children}
    </TankDataContext.Provider>
  )
}

export const useTankData = () => useContext(TankDataContext)
