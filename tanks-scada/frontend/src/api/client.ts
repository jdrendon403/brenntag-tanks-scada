import axios from 'axios'
import type { TankConfig, AlarmRecord, HistoryRecord, AuditRecord } from '../types'

export const api = axios.create({ baseURL: '/' })

// Tanks
export const getTanks = () => api.get('/api/tanks/').then(r => r.data)
export const getTank  = (id: number) => api.get(`/api/tanks/${id}`).then(r => r.data)

// Config
export const getConfigs    = () => api.get('/api/config/tanks').then(r => r.data as TankConfig[])
export const getConfig     = (id: number) => api.get(`/api/config/tanks/${id}`).then(r => r.data as TankConfig)
export const updateConfig  = (id: number, data: Partial<TankConfig>) =>
  api.put(`/api/config/tanks/${id}`, data).then(r => r.data as TankConfig)
export const getAuditLog   = (tankId?: number, limit = 100) =>
  api.get('/api/config/audit', { params: { tank_id: tankId, limit } }).then(r => r.data as AuditRecord[])

// Alarms
export const getAlarms  = (params?: { active_only?: boolean; tank_id?: number; limit?: number }) =>
  api.get('/api/alarms/', { params }).then(r => r.data as AlarmRecord[])
export const ackAlarm   = (id: string) => api.patch(`/api/alarms/${id}/ack`).then(r => r.data)
export const resetAlarm = () => api.post('/api/alarms/reset').then(r => r.data)

// History
export const getHistory = (params: { tank_id?: number; from?: string; to?: string; limit?: number }) =>
  api.get('/api/history/', { params }).then(r => r.data as HistoryRecord[])

// Sensor range write to PLC
export const writeSensorRange = (id: number) =>
  api.post(`/api/config/tanks/${id}/sensor-range/write`).then(r => r.data as { ok: boolean })

// Overflow limit write to PLC
export const writeOverflowLimit = (id: number) =>
  api.post(`/api/config/tanks/${id}/overflow-limit/write`).then(r => r.data as { ok: boolean; register: number; value_written: number })

// Calibration table upload
export const uploadCalibration = (id: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/api/config/tanks/${id}/calibration`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data as { tank_id: number; points_loaded: number })
}
