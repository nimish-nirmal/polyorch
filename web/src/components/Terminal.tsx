import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useWebSocket } from '../hooks/useWebSocket'
import { wsBase } from '../services/api'
import { api, endpoints } from '../services/api'

interface TerminalProps {
  runId: string
}

export default function Terminal({ runId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsBaseUrl = typeof window !== 'undefined'
    ? `${wsBase || (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host}/api/v1/ws/logs/${runId}`
    : null

  const handleMessage = useCallback((data: string) => {
    if (terminalRef.current) {
      const sanitized = data.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
      terminalRef.current.writeln(sanitized)
    }
  }, [])

  const { connected } = useWebSocket(wsBaseUrl, {
    onMessage: handleMessage,
    reconnectInterval: 1000,
    maxReconnectAttempts: 10,
  })

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new XTerm({
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        black: '#0f172a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f1f5f9',
        brightBlack: '#334155',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const container = containerRef.current
    terminal.open(container)

    let frameId: number | null = null
    const fitTerminal = () => {
      if (
        terminalRef.current !== terminal ||
        !container.isConnected ||
        container.clientWidth === 0 ||
        container.clientHeight === 0
      ) return

      try {
        fitAddon.fit()
      } catch (error) {
        // xterm can briefly have no renderer dimensions during remounts.
        console.debug('Terminal resize skipped during remount', error)
      }
    }

    const scheduleFit = () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        frameId = null
        fitTerminal()
      })
    }

    scheduleFit()

    terminal.writeln(`\x1b[1;36m[PolyOrch]\x1b[0m Connecting to run ${runId}...`)

    const resizeObserver = new ResizeObserver(scheduleFit)
    resizeObserver.observe(container)
    window.addEventListener('resize', scheduleFit)

    return () => {
      window.removeEventListener('resize', scheduleFit)
      resizeObserver.disconnect()
      if (frameId !== null) cancelAnimationFrame(frameId)
      terminalRef.current = null
      fitAddonRef.current = null
      terminal.dispose()
    }
  }, [runId])

  useEffect(() => {
    if (!runId) return
    api.get(endpoints.runLogs(runId)).then((res) => {
      const logs = res.data.data || []
      if (terminalRef.current && logs.length > 0) {
        logs.forEach((log: any) => {
          const sanitized = log.message.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
          terminalRef.current?.writeln(sanitized)
        })
      }
    }).catch(() => {})
  }, [runId])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-dark-300">Live Logs</h3>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`}
          />
          <span className="text-xs text-dark-400">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 bg-dark-900 rounded-lg border border-dark-700 overflow-hidden"
      />
    </div>
  )
}
