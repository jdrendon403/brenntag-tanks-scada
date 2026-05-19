export interface TankState {
  tank_id: number
  name: string
  product: string
  height: number
  percentage: number
  volume: number
  weight: number
  overflow_limit: number
  switch_active: boolean
  alarm: boolean
  timestamp: string
}

export interface ModbusConfig {
  height_register: number
  overflow_register: number
  switch_register: number
}

export interface TankConfig {
  tank_id: number
  name: string
  product: string
  density: number
  diameter: number
  max_height: number
  alarm_height: number | null
  modbus: ModbusConfig
}

export interface AlarmRecord {
  id: string
  tank_id: number
  origin: 'height' | 'switch'
  start_time: string
  ack_time: string | null
  end_time: string | null
  active: boolean
}

export interface HistoryRecord {
  tank_id: number
  timestamp: string
  height: number
  percentage: number
  weight: number
  volume: number
  switch_active: boolean
}

export interface AuditRecord {
  timestamp: string
  tank_id: number
  changes: Record<string, unknown>
}

export interface WSMessage {
  timestamp: string
  tanks: TankState[]
}
