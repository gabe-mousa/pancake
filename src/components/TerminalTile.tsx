import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { Hotkeys } from '../types'

interface Props {
  sessionId: string
  cwd?: string
  expanded: boolean
  isActive: boolean
  hotkeys: Hotkeys
  pageVisible: boolean
  onCwdChange?: (cwd: string) => void
  isDragging?: boolean
}

function matchesHotkey(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+')
  const key = parts[parts.length - 1]
  return (
    e.key === key &&
    e.shiftKey === parts.includes('Shift') &&
    e.ctrlKey === parts.includes('Ctrl') &&
    e.altKey === parts.includes('Alt') &&
    e.metaKey === parts.includes('Meta')
  )
}

export default function TerminalTile({ sessionId, cwd, expanded, isActive, hotkeys, pageVisible, onCwdChange, isDragging }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const isDraggingRef = useRef(false)
  isDraggingRef.current = !!isDragging

  useEffect(() => {
    const term = new Terminal({
      theme: {
        background: '#1c0f07',
        foreground: '#e8ddd4',
        cursor: '#c4a882',
        selectionBackground: 'rgba(196,168,130,0.3)',
      },
      fontFamily: "'Menlo', 'Consolas', monospace",
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    termRef.current = term
    fitAddonRef.current = fitAddon

    if (containerRef.current) {
      term.open(containerRef.current)
      fitAddon.fit()
    }

    // Prevent Pancake hotkeys from being forwarded to the PTY
    const hotkeyCombos = Object.values(hotkeys)
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (hotkeyCombos.some(combo => matchesHotkey(e, combo))) return false
      return true
    })

    const ws = new WebSocket('ws://127.0.0.1:4174/ws/terminal')
    wsRef.current = ws

    // Guard against callbacks firing after this effect is torn down
    let active = true

    // Send the current terminal dimensions to the PTY so it knows the real
    // size. Called after the session is established (reconnect or new create),
    // using rAF so the browser has finished layout before we measure.
    function syncSize() {
      requestAnimationFrame(() => {
        if (!active || ws.readyState !== WebSocket.OPEN) return
        fitAddon.fit()
        ws.send(JSON.stringify({ type: 'resize', sessionId, cols: term.cols, rows: term.rows }))
      })
    }

    ws.onopen = () => {
      // Try reconnecting to an existing PTY first
      ws.send(JSON.stringify({ type: 'reconnect', sessionId }))
    }

    let connected = false

    ws.onmessage = (event) => {
      // Handle JSON control messages from server
      if (!connected && typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'reconnect_ok') {
            connected = true
            // Sync terminal dimensions with the PTY right after reconnect.
            // The fitAddon.fit() earlier ran before the WebSocket was open,
            // so the PTY still thinks it's 80×24.
            syncSize()
            return
          }
          if (msg.type === 'reconnect_failed') {
            // No existing PTY — create a new one
            ws.send(JSON.stringify({ type: 'create', sessionId, cwd }))
            connected = true
            // Same size-sync needed for newly created sessions
            syncSize()
            return
          }
        } catch {
          // Not JSON — it's terminal data (e.g. buffered replay), write it
        }
      }
      term.write(event.data)
    }

    ws.onerror = () => {
      term.write('\r\n\x1b[31m[Pancake] WebSocket error — is the server running?]\x1b[0m\r\n')
    }

    ws.onclose = () => {
      term.write('\r\n\x1b[33m[Pancake] Terminal session ended.]\x1b[0m\r\n')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', sessionId, data }))
      }
    })

    // Debounce resize events so rapid size changes (e.g. during fullscreen
    // expand or window resize) collapse into a single fit+resize. Without this,
    // each intermediate size fires a PTY resize → SIGWINCH → Claude Code UI
    // redraw, and two concurrent redraws interleave their ANSI sequences in
    // xterm, producing clipped or repeated text.
    let resizeTimer: ReturnType<typeof setTimeout> | null = null

    const observer = new ResizeObserver(() => {
      if (isDraggingRef.current) return
      if (resizeTimer !== null) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        if (!active) return
        fitAddon.fit()
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', sessionId, cols: term.cols, rows: term.rows }))
        }
      }, 50)
    })
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    // Re-fit after sleep/minimize/tab switch
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !isDraggingRef.current) {
        setTimeout(() => {
          if (!active || isDraggingRef.current) return
          fitAddon.fit()
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', sessionId, cols: term.cols, rows: term.rows }))
          }
        }, 100)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Poll CWD periodically
    const cwdInterval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:4174/terminal/cwd?sessionId=${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.cwd && onCwdChange) onCwdChange(data.cwd)
        }
      } catch {}
    }, 3000)

    return () => {
      active = false
      if (resizeTimer !== null) clearTimeout(resizeTimer)
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(cwdInterval)
      ws.close()
      term.dispose()
    }
  }, [sessionId])

  useEffect(() => {
    // Use rAF so the browser finishes layout at the new tile size before we
    // measure the container. Without this, fitAddon.fit() can read stale
    // dimensions and send the wrong cols/rows to the PTY.
    requestAnimationFrame(() => {
      if (!fitAddonRef.current || !termRef.current || !wsRef.current) return
      fitAddonRef.current.fit()
      if (wsRef.current.readyState === WebSocket.OPEN) {
        const term = termRef.current
        wsRef.current.send(JSON.stringify({ type: 'resize', sessionId, cols: term.cols, rows: term.rows }))
      }
    })
  }, [expanded])

  // Re-fit terminal when returning to sessions page
  useEffect(() => {
    if (pageVisible && fitAddonRef.current && termRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit()
        if (wsRef.current?.readyState === WebSocket.OPEN && termRef.current) {
          const term = termRef.current
          wsRef.current.send(JSON.stringify({ type: 'resize', sessionId, cols: term.cols, rows: term.rows }))
        }
      }, 50)
    }
  }, [pageVisible])

  useEffect(() => {
    if (isActive) {
      termRef.current?.focus()
    } else {
      termRef.current?.blur()
    }
  }, [isActive])

  // Re-fit terminal after drag ends
  const prevDragging = useRef(false)
  useEffect(() => {
    if (prevDragging.current && !isDragging) {
      setTimeout(() => {
        fitAddonRef.current?.fit()
        if (wsRef.current?.readyState === WebSocket.OPEN && termRef.current) {
          const term = termRef.current
          wsRef.current.send(JSON.stringify({ type: 'resize', sessionId, cols: term.cols, rows: term.rows }))
        }
      }, 50)
    }
    prevDragging.current = !!isDragging
  }, [isDragging])

  return (
    <div className="terminal-window">
      <div ref={containerRef} className={`terminal-container${isDragging ? ' terminal-dragging' : ''}`} />
    </div>
  )
}
