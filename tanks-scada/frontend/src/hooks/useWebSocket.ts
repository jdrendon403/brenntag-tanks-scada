import { useCallback, useEffect, useRef, useState } from 'react'
import type { WSMessage } from '../types'

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/live`
}

export function useWebSocket() {
  const [data, setData]           = useState<WSMessage | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef    = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    const ws = new WebSocket(wsUrl())
    wsRef.current = ws

    ws.onopen    = () => { setConnected(true); clearTimeout(timerRef.current) }
    ws.onclose   = () => { setConnected(false); timerRef.current = setTimeout(connect, 3000) }
    ws.onerror   = () => ws.close()
    ws.onmessage = ({ data }) => { try { setData(JSON.parse(data)) } catch {} }
  }, []) // eslint-disable-line

  useEffect(() => {
    connect()
    return () => { clearTimeout(timerRef.current); wsRef.current?.close() }
  }, []) // eslint-disable-line

  return { data, connected }
}
