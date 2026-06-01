import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import type { TankState } from '../types'

interface TankDataCtx {
  tanks: TankState[]
  wsConnected: boolean
  modbusConnected: boolean
}

const TankDataContext = createContext<TankDataCtx>({ tanks: [], wsConnected: false, modbusConnected: false })

export function TankDataProvider({ children }: { children: ReactNode }) {
  const { data, connected } = useWebSocket()
  const [tanks, setTanks]               = useState<TankState[]>([])
  const [modbusConnected, setModbus]    = useState(false)

  useEffect(() => {
    if (data) {
      setTanks(data.tanks)
      if (data.modbus_connected !== undefined) setModbus(data.modbus_connected)
    }
    if (!connected) setModbus(false)
  }, [data, connected])

  return (
    <TankDataContext.Provider value={{ tanks, wsConnected: connected, modbusConnected }}>
      {children}
    </TankDataContext.Provider>
  )
}

export const useTankData = () => useContext(TankDataContext)
