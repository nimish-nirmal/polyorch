import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useWebSocket } from '../hooks/useWebSocket'
import { wsBase } from '../services/api'

interface TerminalProps {
  runId: string
}

export default function Terminal({ runId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsBaseUrl = typeof window !== 'undefined'
    ? `${wsBase}/ws/logs/${runId}`
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
    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.writeln(`\x1b[1;36m[PolyOrch]\x1b[0m Connecting to run ${runId}...`)

    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
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
