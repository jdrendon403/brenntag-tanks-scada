import { useCallback, useEffect, useRef, useState } from 'react'
import type { WSMessage } from '../types'

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/live`
}

// Si no llega ningún mensaje en este tiempo → conexión muerta → reconectar.
// El servidor emite cada 1 s, así que 8 s de silencio es señal clara de falla.
const HEARTBEAT_MS = 8000
const RECONNECT_MS = 3000

export function useWebSocket() {
  const [data, setData]       = useState<WSMessage | null>(null)
  const [connected, setConnected] = useState(false)

  const wsRef        = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()
  const heartbeatRef = useRef<ReturnType<typeof setTimeout>>()

  // Watchdog: si no llega mensaje en HEARTBEAT_MS, fuerza cierre → onclose → reconexión
  const resetHeartbeat = useCallback(() => {
    clearTimeout(heartbeatRef.current)
    heartbeatRef.current = setTimeout(() => {
      wsRef.current?.close()
    }, HEARTBEAT_MS)
  }, [])

  const connect = useCallback(() => {
    clearTimeout(reconnectRef.current)

    // Cerrar la conexión anterior sin disparar onclose doble
    const prev = wsRef.current
    if (prev && prev.readyState !== WebSocket.CLOSED) {
      prev.onclose = null
      prev.close()
    }

    const ws = new WebSocket(wsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      resetHeartbeat()
    }

    ws.onclose = () => {
      setConnected(false)
      clearTimeout(heartbeatRef.current)
      reconnectRef.current = setTimeout(connect, RECONNECT_MS)
    }

    ws.onerror = () => ws.close()

    ws.onmessage = ({ data: raw }) => {
      try {
        setData(JSON.parse(raw))
        resetHeartbeat()   // mensaje recibido → conexión viva, reiniciar watchdog
      } catch {}
    }
  }, [resetHeartbeat])

  useEffect(() => {
    connect()

    // Reconectar cuando el tab vuelve a primer plano tras suspensión del navegador
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current
        if (!ws || ws.readyState !== WebSocket.OPEN) connect()
      }
    }

    // Reconectar cuando el navegador recupera conectividad de red
    const onOnline = () => connect()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)

    return () => {
      clearTimeout(reconnectRef.current)
      clearTimeout(heartbeatRef.current)
      wsRef.current?.close()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [connect])

  return { data, connected }
}
