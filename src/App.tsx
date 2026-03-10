import { useState, useCallback, useEffect, useRef } from 'react'
import TileGrid from './components/TileGrid'
import ConfigModal from './components/ConfigModal'
import NewSessionModal from './components/NewSessionModal'
import HowToPage from './components/HowToPage'
import NotepadWindow from './components/NotepadWindow'
import NotepadPage from './components/NotepadPage'
import { streamMessage } from './anthropic'
import type { Session, Config } from './types'

const DEFAULT_CONFIG: Config = {
  apiKey: '',
  defaultModel: 'claude-sonnet-4-6',
  hotkeys: {
    right: 'Alt+ArrowRight',
    left: 'Alt+ArrowLeft',
    up: 'Alt+ArrowUp',
    down: 'Alt+ArrowDown',
    selectRight: 'Shift+ArrowRight',
    selectLeft: 'Shift+ArrowLeft',
    selectUp: 'Shift+ArrowUp',
    selectDown: 'Shift+ArrowDown',
    focus: 'Shift+F',
    newSession: 'Ctrl+Shift+N',
    expandTile: 'Shift+Ctrl+F',
    toggleNotepad: 'Shift+Ctrl+X',
  },
}

function loadConfig(): Config {
  try {
    const raw = localStorage.getItem('pancake_config')
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_CONFIG, ...parsed, hotkeys: { ...DEFAULT_CONFIG.hotkeys, ...parsed.hotkeys } }
    }
  } catch {}
  return DEFAULT_CONFIG
}

function saveConfig(config: Config) {
  localStorage.setItem('pancake_config', JSON.stringify(config))
}

function eventMatchesHotkey(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+')
  const key = parts[parts.length - 1]
  const needsShift = parts.includes('Shift')
  const needsCtrl = parts.includes('Ctrl')
  const needsAlt = parts.includes('Alt')
  const needsMeta = parts.includes('Meta')
  return (
    e.key === key &&
    e.shiftKey === needsShift &&
    e.ctrlKey === needsCtrl &&
    e.altKey === needsAlt &&
    e.metaKey === needsMeta
  )
}

let nextId = 1
function newSession(model: string, name: string): Session {
  return {
    id: String(nextId++),
    name: name || `Session ${nextId - 1}`,
    model,
    messages: [],
    status: 'Idle',
    isStreaming: false,
  }
}

type Page = 'sessions' | 'how-to' | 'notepad'

export default function App() {
  const [config, setConfig] = useState<Config>(loadConfig)
  const [showConfig, setShowConfig] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [streamingContents, setStreamingContents] = useState<Record<string, string>>({})
  const [activeTileIndex, setActiveTileIndex] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeInputValue, setActiveInputValue] = useState('')
  const [page, setPage] = useState<Page>('sessions')
  const [notepadContent, setNotepadContent] = useState('')
  const [showNotepadWindow, setShowNotepadWindow] = useState(false)
  const [notepadPos, setNotepadPos] = useState({ x: 80, y: 80 })
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  const activeTileIndexRef = useRef(activeTileIndex)
  activeTileIndexRef.current = activeTileIndex
  const configRef = useRef(config)
  configRef.current = config
  const notepadRef = useRef(notepadContent)
  notepadRef.current = notepadContent

  function handleSaveConfig(c: Config) {
    setConfig(c)
    saveConfig(c)
  }

  function addSession(model: string, name: string) {
    setSessions(prev => [...prev, newSession(model, name)])
  }

  function removeSession(id: string) {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      setActiveTileIndex(i => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  function renameSession(id: string, name: string) {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s))
  }

  function reorderSessions(updated: Session[]) {
    setSessions(updated)
  }

  // Hotkeys: navigate and select sessions
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire hotkeys when typing in an input/textarea (except chat-input which we allow)
      const tag = (e.target as HTMLElement).tagName
      const isChatInput = (e.target as HTMLElement).classList.contains('chat-input')
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && !isChatInput) return

      const { hotkeys } = configRef.current
      const sessions = sessionsRef.current
      const count = sessions.length

      // These hotkeys work globally regardless of session count
      if (eventMatchesHotkey(e, hotkeys.newSession)) {
        e.preventDefault()
        setShowNewSession(true)
        return
      }
      if (eventMatchesHotkey(e, hotkeys.toggleNotepad)) {
        e.preventDefault()
        setShowNotepadWindow(prev => !prev)
        return
      }

      if (count === 0) return

      const COLS = 4

      // Navigation: move active tile index (selection unchanged)
      if (eventMatchesHotkey(e, hotkeys.right)) {
        e.preventDefault()
        setActiveTileIndex(i => (i + 1) % count)
      } else if (eventMatchesHotkey(e, hotkeys.left)) {
        e.preventDefault()
        setActiveTileIndex(i => (i - 1 + count) % count)
      } else if (eventMatchesHotkey(e, hotkeys.down)) {
        e.preventDefault()
        setActiveTileIndex(i => Math.min(i + COLS, count - 1))
      } else if (eventMatchesHotkey(e, hotkeys.up)) {
        e.preventDefault()
        setActiveTileIndex(i => Math.max(i - COLS, 0))

      // Selection: add origin + destination tile to selected set
      } else if (eventMatchesHotkey(e, hotkeys.selectRight)) {
        e.preventDefault()
        setActiveTileIndex(i => {
          const next = (i + 1) % count
          setSelectedIds(s => { const n = new Set(s); n.add(sessions[i].id); n.add(sessions[next].id); return n })
          return next
        })
      } else if (eventMatchesHotkey(e, hotkeys.selectLeft)) {
        e.preventDefault()
        setActiveTileIndex(i => {
          const next = (i - 1 + count) % count
          setSelectedIds(s => { const n = new Set(s); n.add(sessions[i].id); n.add(sessions[next].id); return n })
          return next
        })
      } else if (eventMatchesHotkey(e, hotkeys.selectDown)) {
        e.preventDefault()
        setActiveTileIndex(i => {
          const next = Math.min(i + COLS, count - 1)
          setSelectedIds(s => { const n = new Set(s); n.add(sessions[i].id); n.add(sessions[next].id); return n })
          return next
        })
      } else if (eventMatchesHotkey(e, hotkeys.selectUp)) {
        e.preventDefault()
        setActiveTileIndex(i => {
          const next = Math.max(i - COLS, 0)
          setSelectedIds(s => { const n = new Set(s); n.add(sessions[i].id); n.add(sessions[next].id); return n })
          return next
        })

      // Focus: clear selection (deselect all)
      } else if (eventMatchesHotkey(e, hotkeys.focus)) {
        const active = sessions[activeTileIndexRef.current]
        if (active) {
          e.preventDefault()
          setSelectedIds(new Set())
        }

      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Focus active tile's input when index changes, and clear typed text
  useEffect(() => {
    setActiveInputValue('')
    const inputs = document.querySelectorAll<HTMLInputElement>('.chat-input')
    inputs[activeTileIndex]?.focus()
  }, [activeTileIndex])

  const doSend = useCallback(async (sessionId: string, text: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s
      return {
        ...s,
        messages: [...s.messages, { role: 'user', content: text }],
        isStreaming: true,
        status: 'Thinking...',
      }
    }))
    setStreamingContents(prev => ({ ...prev, [sessionId]: '' }))

    const session = sessionsRef.current.find(s => s.id === sessionId)!
    const messagesWithNew = [...session.messages, { role: 'user' as const, content: text }]

    await streamMessage(
      configRef.current.apiKey,
      session.model,
      messagesWithNew,
      (partial) => {
        setStreamingContents(prev => ({ ...prev, [sessionId]: partial }))
        const preview = partial.slice(0, 80) + (partial.length > 80 ? '...' : '')
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: preview } : s))
      },
      (fullText) => {
        setStreamingContents(prev => ({ ...prev, [sessionId]: '' }))
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s
          return {
            ...s,
            messages: [...messagesWithNew, { role: 'assistant', content: fullText }],
            isStreaming: false,
            status: 'Done',
          }
        }))
      },
      (err) => {
        setStreamingContents(prev => ({ ...prev, [sessionId]: '' }))
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s
          return { ...s, isStreaming: false, status: `Error: ${err}` }
        }))
      },
      () => notepadRef.current,
      (s) => setNotepadContent(s),
      (toolName) => {
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, status: `Using tool: ${toolName}...` } : s
        ))
      },
    )
  }, [])

  const sendMessage = useCallback(async (sessionId: string, text: string) => {
    if (!configRef.current.apiKey) {
      setShowConfig(true)
      return
    }
    setActiveInputValue('')
    // If a selection exists, broadcast to all selected + the active (focused) session
    const targets = selectedIds.size > 0
      ? Array.from(new Set([...selectedIds, sessionId]))
      : [sessionId]
    for (const id of targets) {
      doSend(id, text)
    }
  }, [selectedIds, doSend])

  function focusTile(index: number) {
    setActiveTileIndex(index)
  }

  function handleReset() {
    if (!window.confirm('Reset everything? This will clear all sessions, notes, and settings.')) return
    localStorage.removeItem('pancake_config')
    setConfig(DEFAULT_CONFIG)
    setSessions([])
    setStreamingContents({})
    setActiveTileIndex(0)
    setSelectedIds(new Set())
    setActiveInputValue('')
    setNotepadContent('')
    setShowNotepadWindow(false)
    setNotepadPos({ x: 80, y: 80 })
    setPage('sessions')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-title">Pancake</span>
          <nav className="app-nav">
            <button
              className={`nav-btn${page === 'sessions' ? ' nav-btn-active' : ''}`}
              onClick={() => setPage('sessions')}
            >Sessions</button>
            <button
              className={`nav-btn${page === 'how-to' ? ' nav-btn-active' : ''}`}
              onClick={() => setPage('how-to')}
            >How To Use</button>
            <button
              className={`nav-btn${page === 'notepad' ? ' nav-btn-active' : ''}`}
              onClick={() => setPage('notepad')}
            >Notepad</button>
          </nav>
        </div>
        <div className="app-header-right">
          <button className="reset-btn" onClick={handleReset} title="Reset everything">↺</button>
          <button className="cog-btn" onClick={() => setShowConfig(true)} title="Config (⚙)">⚙</button>
        </div>
      </header>

      <main className="app-main">
        {page === 'how-to' ? (
          <HowToPage />
        ) : page === 'notepad' ? (
          <NotepadPage content={notepadContent} onChange={setNotepadContent} toggleHotkey={config.hotkeys.toggleNotepad} />
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            No sessions yet. Click + or press {config.hotkeys.newSession} to start one.
          </div>
        ) : (
          <TileGrid
            sessions={sessions}
            streamingContents={streamingContents}
            activeTileIndex={activeTileIndex}
            selectedIds={selectedIds}
            activeInputValue={activeInputValue}
            expandHotkey={config.hotkeys.expandTile}
            onSendMessage={sendMessage}
            onRemove={removeSession}
            onRename={renameSession}
            onReorder={reorderSessions}
            onFocusTile={focusTile}
            onActiveInputChange={setActiveInputValue}
          />
        )}
      </main>

      {page === 'sessions' && (
        <button className="add-btn" onClick={() => setShowNewSession(true)} title="New session">+</button>
      )}

      {showNewSession && (
        <NewSessionModal
          defaultModel={config.defaultModel}
          onConfirm={addSession}
          onClose={() => setShowNewSession(false)}
        />
      )}

      {showConfig && (
        <ConfigModal
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}

      {showNotepadWindow && (
        <NotepadWindow
          content={notepadContent}
          onChange={setNotepadContent}
          pos={notepadPos}
          onPosChange={setNotepadPos}
          onClose={() => setShowNotepadWindow(false)}
        />
      )}
    </div>
  )
}
