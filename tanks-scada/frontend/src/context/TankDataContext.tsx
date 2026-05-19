import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import type { TankState } from '../types'

interface TankDataCtx {
  tanks: TankState[]
  wsConnected: boolean
}

const TankDataContext = createContext<TankDataCtx>({ tanks: [], wsConnected: false })

export function TankDataProvider({ children }: { children: ReactNode }) {
  const { data, connected } = useWebSocket()
  const [tanks, setTanks]   = useState<TankState[]>([])

  useEffect(() => { if (data) setTanks(data.tanks) }, [data])

  return (
    <TankDataContext.Provider value={{ tanks, wsConnected: connected }}>
      {children}
    </TankDataContext.Provider>
  )
}

export const useTankData = () => useContext(TankDataContext)
