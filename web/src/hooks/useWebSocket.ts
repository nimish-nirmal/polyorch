import { useState, useEffect, useCallback, useRef } from 'react'

interface UseWebSocketOptions {
  onMessage: (data: string) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useWebSocket(url: string | null, options: UseWebSocketOptions) {
  const { onMessage, onOpen, onClose, onError, reconnectInterval = 1000, maxReconnectAttempts = 10 } = options
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!url || !mountedRef.current) return

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnected(true)
      reconnectCountRef.current = 0
      onOpen?.()
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      onMessage(event.data)
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setConnected(false)
      onClose?.()

      if (reconnectCountRef.current < maxReconnectAttempts && mountedRef.current) {
        reconnectCountRef.current += 1
        const delay = reconnectInterval * Math.pow(2, reconnectCountRef.current - 1)
        reconnectTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) connect()
        }, Math.min(delay, 30000))
      }
    }

    ws.onerror = (error) => {
      if (!mountedRef.current) return
      onError?.(error)
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnectInterval, maxReconnectAttempts])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }, [])

  return { connected, send, reconnect: connect }
}
