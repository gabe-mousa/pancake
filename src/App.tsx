import { useState, useCallback, useEffect, useRef } from 'react'
import TileGrid from './components/TileGrid'
import ConfigModal from './components/ConfigModal'
import NewSessionModal from './components/NewSessionModal'
import HowToPage from './components/HowToPage'
import AboutPage from './components/AboutPage'
import NotepadWindow from './components/NotepadWindow'
import NotepadPage from './components/NotepadPage'
import FilesystemPage from './pages/FilesystemPage'
import { streamMessage } from './anthropic'
import type { Session, SessionGroup, Config, FsAccess, VirtualFile, AgentMeta, SessionType } from './types'

const DEFAULT_CONFIG: Config = {
  apiKey: '',
  authMode: 'api-key',
  defaultModel: 'claude-sonnet-4-6',
  defaultAgentInteropEnabled: true,
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

function createSession(model: string, name: string, displayNumber: number, fsAccess: FsAccess, pancakeEnabled: boolean, localEnabled: boolean, sessionType: SessionType = 'chat', ccSessionCwd?: string): Session {
  return {
    id: crypto.randomUUID(),
    name: name || `Session ${displayNumber}`,
    model,
    messages: [],
    status: 'Idle',
    isStreaming: false,
    fsAccess,
    pancakeEnabled,
    localEnabled,
    agentInteropEnabled: null,
    unread: false,
    sessionType,
    ccSessionCwd,
  }
}

type Page = 'sessions' | 'how-to' | 'notepad' | 'filesystem' | 'about'
type Layout = 'wide' | 'tall'

const FS_LEVELS: FsAccess[] = ['none', 'read', 'read-write', 'read-write-delete']
const FS_LABELS: Record<FsAccess, string> = {
  'none': 'FS: off',
  'read': 'FS: read',
  'read-write': 'FS: r/w',
  'read-write-delete': 'FS: r/w/d',
}

function DefaultFsSelector({ value, onChange }: { value: FsAccess; onChange: (v: FsAccess) => void }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function close() { setOpen(false) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <div className="default-fs-selector" onClick={e => e.stopPropagation()}>
      <button
        className={`fs-badge fs-badge-${value} default-fs-btn`}
        onClick={() => setOpen(prev => !prev)}
        title="Default local filesystem access level for new sessions"
      >
        LFS default: {FS_LABELS[value].replace('FS: ', '')}
      </button>
      {open && (
        <div className="fs-menu default-fs-menu">
          <div className="fs-menu-label">Default LFS access for new sessions</div>
          {FS_LEVELS.map(level => (
            <button
              key={level}
              className={`fs-menu-item${level === value ? ' fs-menu-item-active' : ''}`}
              onClick={() => { onChange(level); setOpen(false) }}
            >
              {FS_LABELS[level]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Poll the FS server on startup to get the current root
async function fetchFsRoot(): Promise<string> {
  try {
    const res = await fetch('http://127.0.0.1:4174/health')
    if (res.ok) {
      const data = await res.json()
      return data.root ?? ''
    }
  } catch {}
  return ''
}

export default function App() {
  const [config, setConfig] = useState<Config>(loadConfig)
  const [showConfig, setShowConfig] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [sessions, setSessions] = useState<Session[]>(() => {
    if (localStorage.getItem('pancake_persist_sessions') !== 'false') {
      try {
        const raw = localStorage.getItem('pancake_sessions_data')
        if (raw) {
          const parsed = JSON.parse(raw) as Session[]
          return parsed.map(s => ({ ...s, isStreaming: false, status: 'Idle', unread: false }))
        }
      } catch {}
    }
    return []
  })
  const [streamingContents, setStreamingContents] = useState<Record<string, string>>({})
  const [activeTileIndex, setActiveTileIndex] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeInputValue, setActiveInputValue] = useState('')
  const [page, setPage] = useState<Page>('sessions')
  const [layout, setLayout] = useState<Layout>(() => {
    if (localStorage.getItem('pancake_persist_sessions') !== 'false') {
      const saved = localStorage.getItem('pancake_layout')
      if (saved === 'wide' || saved === 'tall') return saved
    }
    return 'wide'
  })
  const [notepadContent, setNotepadContent] = useState(() => {
    if (localStorage.getItem('pancake_persist_sessions') !== 'false') {
      return localStorage.getItem('pancake_notepad') || ''
    }
    return ''
  })
  const [showNotepadWindow, setShowNotepadWindow] = useState(false)
  const [notepadPos, setNotepadPos] = useState({ x: 80, y: 80 })
  const [virtualFsFiles, setVirtualFsFiles] = useState<VirtualFile[]>([])
  const [fsRoot, setFsRoot] = useState<string>('')
  const [virtualDeleteConfirm, setVirtualDeleteConfirm] = useState<{ name: string; resolve: (ok: boolean) => void } | null>(null)
  const [agentDeleteConfirm, setAgentDeleteConfirm] = useState<{ agentId: string; agentName: string; resolve: () => void; reject: (e: { error: string }) => void } | null>(null)
  const [suppressDeleteConfirm, setSuppressDeleteConfirm] = useState(false)
  const [defaultFsAccess, setDefaultFsAccess] = useState<FsAccess>(() => (localStorage.getItem('pancake_default_fs_access') as FsAccess) || 'none')
  const [pancakeEnabled, setPancakeEnabled] = useState(() => localStorage.getItem('pancake_virtual_fs_enabled') === 'true')
  const [localEnabled, setLocalEnabled] = useState(() => localStorage.getItem('pancake_fs_local_enabled') === 'true')
  const [persistSessions, setPersistSessions] = useState(() => localStorage.getItem('pancake_persist_sessions') !== 'false')
  const [groups, setGroups] = useState<SessionGroup[]>(() => {
    if (localStorage.getItem('pancake_persist_sessions') !== 'false') {
      try {
        const raw = localStorage.getItem('pancake_groups')
        if (raw) return JSON.parse(raw) as SessionGroup[]
      } catch {}
    }
    return []
  })
  const [showHeaderHelp, setShowHeaderHelp] = useState(false)

  useEffect(() => {
    if (!showHeaderHelp) return
    const close = () => setShowHeaderHelp(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showHeaderHelp])

  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  const activeTileIndexRef = useRef(activeTileIndex)
  activeTileIndexRef.current = activeTileIndex
  const configRef = useRef(config)
  configRef.current = config
  const groupsRef = useRef(groups)
  groupsRef.current = groups
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const notepadRef = useRef(notepadContent)
  notepadRef.current = notepadContent
  const virtualFsFilesRef = useRef(virtualFsFiles)
  virtualFsFilesRef.current = virtualFsFiles
  const fsRootRef = useRef(fsRoot)
  fsRootRef.current = fsRoot
  const suppressDeleteConfirmRef = useRef(suppressDeleteConfirm)
  suppressDeleteConfirmRef.current = suppressDeleteConfirm

  // Per-session abort controllers for kill-all
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const controlWsRef = useRef<WebSocket | null>(null)
  const doSendRef = useRef<((sessionId: string, text: string, fromAgent?: string) => Promise<void>) | null>(null)
  // Sessions that have requested self-deletion; removed from UI after stream finishes
  const selfDeleteSetRef = useRef<Set<string>>(new Set())

  // On mount: restore local FS root from localStorage if enabled
  useEffect(() => {
    const enabled = localStorage.getItem('pancake_fs_local_enabled') === 'true'
    const savedRoot = localStorage.getItem('pancake_fs_root')
    if (enabled && savedRoot) {
      fetch('http://127.0.0.1:4174/fs/set-root', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: savedRoot }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.resolved) setFsRoot(data.resolved) })
        .catch(() => {})
    } else {
      fetchFsRoot().then(root => { if (root) setFsRoot(root) })
    }
  }, [])

  // --- AIO Control WebSocket ---
  useEffect(() => {
    function connect() {
      const ws = new WebSocket('ws://127.0.0.1:4174/ws/control')
      controlWsRef.current = ws

      ws.onmessage = (event) => {
        let msg: { type: string; requestId: string; operation: string; params: Record<string, unknown> }
        try { msg = JSON.parse(event.data) } catch { return }
        if (msg.type !== 'aio_request' || !msg.requestId) return

        const respond = (result: unknown) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'aio_response', requestId: msg.requestId, result }))
          }
        }

        if (msg.operation === 'list_agents') {
          const list = sessionsRef.current.map(s => ({
            id: s.id,
            name: s.name,
            model: s.model,
            status: s.status,
            sessionType: s.sessionType,
            isStreaming: s.isStreaming,
            messageCount: s.messages.length,
          }))
          respond(list)
        } else if (msg.operation === 'create_agent') {
          const { name, sessionType, cwd } = msg.params as { name?: string; sessionType?: SessionType; cwd?: string }
          const st = sessionType ?? 'chat'
          const displayNumber = sessionsRef.current.length + 1
          const effectiveModel = st === 'claude-code' ? 'claude code' : configRef.current.defaultModel
          const session = createSession(
            effectiveModel,
            name ?? '',
            displayNumber,
            defaultFsAccess,
            pancakeEnabled,
            localEnabled,
            st,
            cwd,
          )
          setSessions(prev => [...prev, session])
          respond({ id: session.id, name: session.name, model: session.model, sessionType: st })
        } else if (msg.operation === 'read_agent') {
          const { agentId } = msg.params as { agentId: string }
          const target = sessionsRef.current.find(s => s.id === agentId)
          if (!target) {
            respond({ error: `No session with id "${agentId}"` })
          } else if (target.sessionType === 'claude-code') {
            respond({ note: 'Claude Code terminal buffer is returned by the server directly.' })
          } else {
            respond({ sessionType: 'chat', messages: target.messages })
          }
        } else if (msg.operation === 'send_message') {
          const { agentId, message } = msg.params as { agentId: string; message: string }
          const target = sessionsRef.current.find(s => s.id === agentId)
          if (!target) {
            respond({ error: `No session with id "${agentId}"` })
          } else if (target.sessionType === 'claude-code') {
            // CC targets are handled server-side; shouldn't arrive here, but handle gracefully
            respond({ error: 'Claude Code targets are handled server-side via PTY injection' })
          } else {
            if (doSendRef.current) {
              doSendRef.current(agentId, message as string, 'AIO endpoint')
            }
            respond({ queued: true, agentId, agentName: target.name })
          }
        } else if (msg.operation === 'read_notepad') {
          respond({ content: notepadRef.current || '' })
        } else if (msg.operation === 'write_notepad') {
          const { content } = msg.params as { content: string }
          setNotepadContent(content ?? '')
          respond({ ok: true })
        } else if (msg.operation === 'delete_notepad') {
          setNotepadContent('')
          respond({ ok: true })
        } else if (msg.operation === 'delete_self') {
          const { sessionId: targetId } = msg.params as { sessionId: string }
          const target = sessionsRef.current.find(s => s.id === targetId)
          if (!target) {
            respond({ error: `No session with id "${targetId}"` })
          } else {
            removeSession(targetId)
            respond({ ok: true })
          }
        } else {
          respond({ error: `Unknown operation: ${msg.operation}` })
        }
      }

      ws.onclose = () => {
        controlWsRef.current = null
        // Reconnect after a delay
        setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        // onclose will fire after this, triggering reconnect
      }
    }

    connect()
    return () => {
      const ws = controlWsRef.current
      if (ws) {
        ws.onclose = null  // prevent reconnect on intentional close
        ws.close()
        controlWsRef.current = null
      }
    }
  }, [])

  function handleSaveConfig(c: Config) {
    setConfig(c)
    saveConfig(c)
  }

  function handleDefaultFsChange(level: FsAccess) {
    setDefaultFsAccess(level)
    localStorage.setItem('pancake_default_fs_access', level)
  }

  function togglePancakeEnabled() {
    setPancakeEnabled(prev => {
      const next = !prev
      localStorage.setItem('pancake_virtual_fs_enabled', String(next))
      return next
    })
  }

  function toggleLocalEnabled() {
    setLocalEnabled(prev => {
      const next = !prev
      localStorage.setItem('pancake_fs_local_enabled', String(next))
      return next
    })
  }

  function togglePersistSessions() {
    setPersistSessions(prev => {
      const next = !prev
      localStorage.setItem('pancake_persist_sessions', String(next))
      if (next) {
        try {
          localStorage.setItem('pancake_sessions_data', JSON.stringify(sessionsRef.current))
          localStorage.setItem('pancake_layout', layout)
          localStorage.setItem('pancake_notepad', notepadRef.current)
          localStorage.setItem('pancake_groups', JSON.stringify(groups))
        } catch (e) {
          console.warn('[Pancake] Failed to save sessions:', e)
        }
      } else {
        localStorage.removeItem('pancake_sessions_data')
        localStorage.removeItem('pancake_layout')
        localStorage.removeItem('pancake_notepad')
        localStorage.removeItem('pancake_groups')
      }
      return next
    })
  }

  // Persist sessions to localStorage when enabled
  const persistRef = useRef(persistSessions)
  persistRef.current = persistSessions
  useEffect(() => {
    if (!persistRef.current) return
    try {
      localStorage.setItem('pancake_sessions_data', JSON.stringify(sessions))
    } catch (e) {
      console.warn('[Pancake] Failed to save sessions (localStorage may be full):', e)
    }
  }, [sessions])

  useEffect(() => {
    if (!persistRef.current) return
    localStorage.setItem('pancake_layout', layout)
  }, [layout])

  useEffect(() => {
    if (!persistRef.current) return
    localStorage.setItem('pancake_notepad', notepadContent)
  }, [notepadContent])

  useEffect(() => {
    if (!persistRef.current) return
    localStorage.setItem('pancake_groups', JSON.stringify(groups))
  }, [groups])

  function killAllAgents() {
    abortControllersRef.current.forEach(ctrl => ctrl.abort())
    abortControllersRef.current.clear()
    setSessions(prev => prev.map(s => s.isStreaming ? { ...s, isStreaming: false, status: 'Stopped' } : s))
  }

  function toggleDefaultAgentInterop() {
    setConfig(prev => {
      const next = { ...prev, defaultAgentInteropEnabled: !prev.defaultAgentInteropEnabled }
      saveConfig(next)
      return next
    })
  }

  function addSession(model: string, name: string, sessionType: SessionType = 'chat', cwd?: string) {
    const session = createSession(model, name, sessions.length + 1, defaultFsAccess, pancakeEnabled, localEnabled, sessionType, cwd)
    setSessions(prev => [...prev, session])
    setActiveTileIndex(sessions.length)
    // For chat sessions, also focus directly in case activeTileIndex didn't change (e.g. first session)
    if (sessionType !== 'claude-code') {
      setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-session-id="${session.id}"] .chat-input`)?.focus()
      }, 50)
    }
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
    // Preserve active session across reorder
    const activeId = sessions[activeTileIndex]?.id
    setSessions(updated)
    if (activeId) {
      const newIndex = updated.findIndex(s => s.id === activeId)
      if (newIndex !== -1) setActiveTileIndex(newIndex)
    }
  }

  function setFsAccess(id: string, level: FsAccess) {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, fsAccess: level } : s))
  }

  function setAgentInteropEnabled(id: string, value: boolean | null) {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, agentInteropEnabled: value } : s))
  }

  function updateCcCwd(id: string, cwd: string) {
    setSessions(prev => prev.map(s => s.id === id && s.ccSessionCwd !== cwd ? { ...s, ccSessionCwd: cwd } : s))
  }

  function addGroup(name: string) {
    setGroups(prev => [...prev, { id: crypto.randomUUID(), name, collapsed: false }])
  }

  function removeGroup(groupId: string) {
    setGroups(prev => prev.filter(g => g.id !== groupId))
    setSessions(prev => prev.map(s => s.groupId === groupId ? { ...s, groupId: undefined } : s))
  }

  function toggleGroupCollapsed(groupId: string) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, collapsed: !g.collapsed } : g))
  }

  function setSessionGroup(sessionId: string, groupId: string | undefined) {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, groupId } : s))
  }

  function isInteropEnabled(session: Session): boolean {
    if (session.agentInteropEnabled !== null) return session.agentInteropEnabled
    return configRef.current.defaultAgentInteropEnabled
  }

  function buildAgentInteropCallbacks(callerSessionId: string): import('./anthropic').AgentInteropContext {
    return {
      listAgents: () =>
        sessionsRef.current
          .filter(s => s.id !== callerSessionId)
          .map((s): AgentMeta => ({
            id: s.id,
            name: s.name,
            model: s.model,
            status: s.status,
            isStreaming: s.isStreaming,
            messageCount: s.messages.length,
          })),

      readAgentChat: (agentId) => {
        const s = sessionsRef.current.find(s => s.id === agentId)
        if (!s) return { error: `No session with id "${agentId}"` }
        if (s.sessionType === 'claude-code') return { note: `"${s.name}" is a Claude Code terminal session. Use send_message_to_agent to inject input into its terminal.` }
        return s.messages
      },

      sendMessageToAgent: async (agentId, message, awaitResponse) => {
        if (agentId === callerSessionId) return { error: 'Cannot message yourself' }
        const target = sessionsRef.current.find(s => s.id === agentId)
        if (!target) return { error: `No session with id "${agentId}"` }
        const agentName = target.name

        // Claude Code terminal sessions: type directly into the PTY via server endpoint
        if (target.sessionType === 'claude-code') {
          try {
            await fetch('http://127.0.0.1:4174/terminal/type', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: agentId, message }),
            })
          } catch {}
          return { queued: true, agentName }
        }

        if (target.isStreaming) return { error: `Agent "${target.name}" is currently busy (streaming). Check list_agents and retry when isStreaming is false.` }
        const callerName = sessionsRef.current.find(s => s.id === callerSessionId)?.name ?? 'Another agent'
        doSend(agentId, message, callerName)
        if (!awaitResponse) return { queued: true, agentName }
        // Two-phase poll: wait for isStreaming→true, then wait for isStreaming→false
        return new Promise((resolve) => {
          let seenStreaming = false
          const poll = setInterval(() => {
            const t = sessionsRef.current.find(s => s.id === agentId)
            if (!seenStreaming) {
              if (t?.isStreaming) seenStreaming = true
            } else {
              if (!t || !t.isStreaming) {
                clearInterval(poll)
                const msgs = t?.messages ?? []
                const lastMsg = msgs[msgs.length - 1]
                resolve({ response: lastMsg?.content ?? '', agentName: t?.name ?? agentName })
              }
            }
          }, 100)
          setTimeout(() => { clearInterval(poll); resolve({ error: 'Timeout waiting for agent response' }) }, 60000)
        })
      },

      createAgent: async (name?, model?, sessionType = 'chat', cwd?) => {
        const displayNumber = sessionsRef.current.length + 1
        const effectiveModel = sessionType === 'claude-code' ? 'claude code' : (model ?? configRef.current.defaultModel)
        const session = createSession(
          effectiveModel,
          name ?? '',
          displayNumber,
          defaultFsAccess,
          pancakeEnabled,
          localEnabled,
          sessionType,
          cwd,
        )
        setSessions(prev => [...prev, session])
        return { id: session.id, name: session.name, model: session.model, status: session.status, isStreaming: false, messageCount: 0 }
      },

      deleteAgent: async (agentId) => {
        if (agentId === callerSessionId) return { error: 'Cannot delete yourself' }
        const target = sessionsRef.current.find(s => s.id === agentId)
        if (!target) return { error: `No session with id "${agentId}"` }
        if (target.isStreaming) return { error: `Agent "${target.name}" is currently streaming` }
        if (suppressDeleteConfirmRef.current) {
          removeSession(agentId)
          return { success: true }
        }
        return new Promise((resolve, reject) => {
          setAgentDeleteConfirm({
            agentId,
            agentName: target.name,
            resolve: () => { removeSession(agentId); resolve({ success: true }) },
            reject: () => reject({ error: 'User cancelled deletion' }),
          })
        })
      },

      deleteSelf: async () => {
        selfDeleteSetRef.current.add(callerSessionId)
        return { success: true }
      },
    }
  }

  function addVirtualFiles(files: VirtualFile[]) {
    setVirtualFsFiles(prev => {
      const existing = new Map(prev.map(f => [`${f.name}:${f.size}`, f]))
      const toAdd: VirtualFile[] = []
      const duplicates: string[] = []
      for (const f of files) {
        if (existing.has(`${f.name}:${f.size}`)) {
          duplicates.push(f.name)
        } else {
          toAdd.push(f)
        }
      }
      if (duplicates.length > 0) {
        // Non-blocking notification — FilesystemPage handles its own UI
        console.warn('Duplicate files skipped:', duplicates)
      }
      return [...prev, ...toAdd]
    })
  }

  function removeVirtualFile(name: string) {
    setVirtualFsFiles(prev => prev.filter(f => f.name !== name))
  }


  // Compute the visual display order of sessions (matching TileGrid's render order).
  // When groups exist: grouped sessions per group, then ungrouped. Otherwise: array order.
  function getVisualOrder(sessions: Session[], groups: SessionGroup[]): Session[] {
    if (groups.length === 0) return sessions
    const order: Session[] = []
    for (const g of groups) {
      if (!g.collapsed) {
        sessions.filter(s => s.groupId === g.id).forEach(s => order.push(s))
      }
    }
    sessions.filter(s => !s.groupId || !groups.find(g => g.id === s.groupId)).forEach(s => order.push(s))
    return order
  }

  // Hotkeys: navigate and select sessions
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const isChatInput = (e.target as HTMLElement).classList.contains('chat-input')
      const isXtermHelper = (e.target as HTMLElement).classList.contains('xterm-helper-textarea')
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && !isChatInput && !isXtermHelper) return

      const { hotkeys } = configRef.current
      const sessions = sessionsRef.current
      const count = sessions.length

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

      const COLS = layoutRef.current === 'tall' ? 2 : 4
      const visual = getVisualOrder(sessions, groupsRef.current)

      // Navigate using visual order: find active session's position in visual order,
      // compute the target visual position, then set activeTileIndex to the target's
      // position in the original sessions array.
      function navigateVisual(dirFn: (visualIdx: number, visualCount: number) => number, select?: boolean) {
        setActiveTileIndex(i => {
          const activeSession = sessions[i]
          if (!activeSession) return i
          const visualIdx = visual.findIndex(s => s.id === activeSession.id)
          if (visualIdx === -1) return i
          const nextVisualIdx = dirFn(visualIdx, visual.length)
          const nextSession = visual[nextVisualIdx]
          if (!nextSession) return i
          const nextArrayIdx = sessions.findIndex(s => s.id === nextSession.id)
          if (select) {
            setSelectedIds(s => { const n = new Set(s); n.add(activeSession.id); n.add(nextSession.id); return n })
          }
          return nextArrayIdx !== -1 ? nextArrayIdx : i
        })
      }

      if (eventMatchesHotkey(e, hotkeys.right)) {
        e.preventDefault()
        navigateVisual((vi, vc) => (vi + 1) % vc)
      } else if (eventMatchesHotkey(e, hotkeys.left)) {
        e.preventDefault()
        navigateVisual((vi, vc) => (vi - 1 + vc) % vc)
      } else if (eventMatchesHotkey(e, hotkeys.down)) {
        e.preventDefault()
        navigateVisual((vi, vc) => Math.min(vi + COLS, vc - 1))
      } else if (eventMatchesHotkey(e, hotkeys.up)) {
        e.preventDefault()
        navigateVisual((vi) => Math.max(vi - COLS, 0))
      } else if (eventMatchesHotkey(e, hotkeys.selectRight)) {
        e.preventDefault()
        navigateVisual((vi, vc) => (vi + 1) % vc, true)
      } else if (eventMatchesHotkey(e, hotkeys.selectLeft)) {
        e.preventDefault()
        navigateVisual((vi, vc) => (vi - 1 + vc) % vc, true)
      } else if (eventMatchesHotkey(e, hotkeys.selectDown)) {
        e.preventDefault()
        navigateVisual((vi, vc) => Math.min(vi + COLS, vc - 1), true)
      } else if (eventMatchesHotkey(e, hotkeys.selectUp)) {
        e.preventDefault()
        navigateVisual((vi) => Math.max(vi - COLS, 0), true)
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

  useEffect(() => {
    setActiveInputValue('')
    const activeSession = sessionsRef.current[activeTileIndex]
    if (activeSession && activeSession.sessionType !== 'claude-code') {
      const tile = document.querySelector<HTMLElement>(`[data-session-id="${activeSession.id}"]`)
      tile?.querySelector<HTMLInputElement>('.chat-input')?.focus()
    }
  }, [activeTileIndex])

  const doSend = useCallback(async (sessionId: string, text: string, fromAgent?: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s
      return {
        ...s,
        messages: [...s.messages, { role: 'user', content: text, fromAgent }],
        isStreaming: true,
        status: 'Thinking...',
        // mark unread if message is injected by another agent (human-sent messages clear unread via focusTile)
        unread: fromAgent ? true : s.unread,
      }
    }))
    setStreamingContents(prev => ({ ...prev, [sessionId]: '' }))

    const session = sessionsRef.current.find(s => s.id === sessionId)!
    const messagesWithNew = [...session.messages, { role: 'user' as const, content: text, fromAgent }]

    const interopEnabled = isInteropEnabled(session)

    const abort = new AbortController()
    abortControllersRef.current.set(sessionId, abort)

    await streamMessage(
      configRef.current.apiKey,
      configRef.current.authMode ?? 'api-key',
      session.model,
      messagesWithNew,
      (partial) => {
        setStreamingContents(prev => ({ ...prev, [sessionId]: partial }))
        const preview = partial.slice(0, 80) + (partial.length > 80 ? '...' : '')
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: preview } : s))
      },
      (fullText) => {
        abortControllersRef.current.delete(sessionId)
        setStreamingContents(prev => ({ ...prev, [sessionId]: '' }))
        if (selfDeleteSetRef.current.has(sessionId)) {
          selfDeleteSetRef.current.delete(sessionId)
          removeSession(sessionId)
          return
        }
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s
          const isActive = sessionsRef.current.indexOf(s) === activeTileIndexRef.current
          return {
            ...s,
            messages: [...messagesWithNew, { role: 'assistant', content: fullText }],
            isStreaming: false,
            status: 'Done',
            unread: !isActive,
          }
        }))
      },
      (err) => {
        abortControllersRef.current.delete(sessionId)
        setStreamingContents(prev => ({ ...prev, [sessionId]: '' }))
        if (selfDeleteSetRef.current.has(sessionId)) {
          selfDeleteSetRef.current.delete(sessionId)
          removeSession(sessionId)
          return
        }
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s
          return { ...s, isStreaming: false, status: `Error: ${err}` }
        }))
      },
      {
        getNotepad: () => notepadRef.current,
        setNotepad: (s) => setNotepadContent(s),
        fsAccess: session.fsAccess,
        localEnabled: session.localEnabled,
        fsRoot: fsRootRef.current,
        pancakeEnabled: session.pancakeEnabled,
        virtualFsFiles: virtualFsFilesRef.current,
        removeVirtualFile: (name) => setVirtualFsFiles(prev => prev.filter(f => f.name !== name)),
        renameVirtualFile: (from, to) => setVirtualFsFiles(prev => prev.map(f => f.name === from ? { ...f, name: to } : f)),
        confirmVirtualDelete: (name) => new Promise<boolean>(resolve => {
          setVirtualDeleteConfirm({ name, resolve })
        }),
        onToolCall: (toolName) => {
          setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, status: `Using tool: ${toolName}...` } : s
          ))
        },
        agentInterop: interopEnabled ? buildAgentInteropCallbacks(sessionId) : null,
        signal: abort.signal,
      },
    )
  }, [])

  // Keep doSendRef in sync for the control WS handler
  doSendRef.current = doSend

  const sendMessage = useCallback(async (sessionId: string, text: string) => {
    const targetSession = sessionsRef.current.find(s => s.id === sessionId)
    if (targetSession?.sessionType === 'claude-code') return
    if (configRef.current.authMode !== 'cybertron' && !configRef.current.apiKey) {
      setShowConfig(true)
      return
    }
    setActiveInputValue('')
    const targets = selectedIds.size > 0
      ? Array.from(new Set([...selectedIds, sessionId]))
      : [sessionId]
    setSessions(prev => prev.map(s => targets.includes(s.id) ? { ...s, unread: false } : s))
    for (const id of targets) {
      doSend(id, text)
    }
  }, [selectedIds, doSend])

  function focusTile(index: number) {
    setActiveTileIndex(index)
    setSessions(prev => prev.map((s, i) => i === index && s.unread ? { ...s, unread: false } : s))
  }

  function handleReset() {
    if (!window.confirm('Reset everything? This will clear all sessions, notes, and settings.')) return
    localStorage.removeItem('pancake_config')
    localStorage.removeItem('pancake_sessions_data')
    localStorage.removeItem('pancake_persist_sessions')
    localStorage.removeItem('pancake_layout')
    localStorage.removeItem('pancake_notepad')
    localStorage.removeItem('pancake_groups')
    setConfig(DEFAULT_CONFIG)
    setSessions([])
    setStreamingContents({})
    setActiveTileIndex(0)
    setSelectedIds(new Set())
    setActiveInputValue('')
    setNotepadContent('')
    setShowNotepadWindow(false)
    setNotepadPos({ x: 80, y: 80 })
    setVirtualFsFiles([])
    setPersistSessions(false)
    setGroups([])
    setPage('sessions')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <img src="/pancakemainicon.png" alt="Pancake" style={{ height: 28, width: 'auto', display: 'block' }} />
          <span className="app-title">Pancake</span>
          <nav className="app-nav">
            <button
              className={`nav-btn${page === 'sessions' ? ' nav-btn-active' : ''}`}
              onClick={() => setPage('sessions')}
            >Sessions</button>
            <button
              className={`nav-btn${page === 'notepad' ? ' nav-btn-active' : ''}`}
              onClick={() => setPage('notepad')}
            >Notepad</button>
            <button
              className={`nav-btn${page === 'filesystem' ? ' nav-btn-active' : ''}`}
              onClick={() => setPage('filesystem')}
            >Filesystem</button>
            <button
              className={`nav-btn${page === 'how-to' ? ' nav-btn-active' : ''}`}
              onClick={() => setPage('how-to')}
            >Docs</button>
            <button
              className={`nav-btn${page === 'about' ? ' nav-btn-active' : ''}`}
              onClick={() => setPage('about')}
            >About</button>
          </nav>
        </div>
        {page === 'sessions' && (
          <div className="layout-toggle" title="Switch layout">
            <button
              className={`layout-btn${layout === 'wide' ? ' layout-btn-active' : ''}`}
              onClick={() => setLayout('wide')}
              title="Wide layout: 4 columns"
            >
              <span className="layout-icon layout-icon-wide">
                <span/><span/><span/><span/>
              </span>
            </button>
            <button
              className={`layout-btn${layout === 'tall' ? ' layout-btn-active' : ''}`}
              onClick={() => setLayout('tall')}
              title="Tall layout: 2 columns"
            >
              <span className="layout-icon layout-icon-tall">
                <span/><span/>
              </span>
            </button>
          </div>
        )}
        <div className="app-header-right">
          <div className="header-help-wrap" onClick={e => e.stopPropagation()}>
            <button
              className="header-help-btn"
              onClick={() => setShowHeaderHelp(prev => !prev)}
              title="What do these buttons do?"
            >?</button>
            {showHeaderHelp && (
              <div className="header-help-popover">
                <div className="header-help-title">Toolbar Guide</div>
                <dl className="header-help-list">
                  <dt className="fs-quick-toggle fs-quick-toggle-on-pfs" style={{ pointerEvents: 'none' }}>PFS</dt>
                  <dd>Pancake Filesystem — virtual in-browser file storage for sessions</dd>
                  <dt className="fs-quick-toggle fs-quick-toggle-on-lfs" style={{ pointerEvents: 'none' }}>LFS</dt>
                  <dd>Local Filesystem — lets sessions read/write real files on disk</dd>
                  <dt className="fs-quick-toggle fs-quick-toggle-on-aio" style={{ pointerEvents: 'none' }}>AIO</dt>
                  <dd>Agent Interop — lets sessions see, message, and create other sessions</dd>
                  <dt className="fs-quick-toggle fs-quick-toggle-on-sto" style={{ pointerEvents: 'none' }}>STO</dt>
                  <dd>Storage — persist sessions across page refreshes</dd>
                  <dt style={{ pointerEvents: 'none', fontSize: '0.7rem' }}>LFS default</dt>
                  <dd>Default local filesystem access level for new sessions (off / read / r+w / r+w+d)</dd>
                  <dt style={{ pointerEvents: 'none' }}>■</dt>
                  <dd>Stop — abort all currently streaming sessions</dd>
                  <dt style={{ pointerEvents: 'none' }}>↺</dt>
                  <dd>Reset — clear all sessions, notes, and settings</dd>
                  <dt style={{ pointerEvents: 'none' }}>⚙</dt>
                  <dd>Config — API key, auth mode, default model, hotkeys</dd>
                </dl>
              </div>
            )}
          </div>
          <button
            className={`fs-quick-toggle${pancakeEnabled ? ' fs-quick-toggle-on-pfs' : ''}`}
            onClick={togglePancakeEnabled}
            title={`Pancake's Filesystem: ${pancakeEnabled ? 'enabled' : 'disabled'}`}
          >
            PFS
          </button>
          <button
            className={`fs-quick-toggle${localEnabled ? ' fs-quick-toggle-on-lfs' : ''}`}
            onClick={toggleLocalEnabled}
            title={`Local Filesystem: ${localEnabled ? 'enabled' : 'disabled'}`}
          >
            LFS
          </button>
          <button
            className={`fs-quick-toggle${config.defaultAgentInteropEnabled ? ' fs-quick-toggle-on-aio' : ''}`}
            onClick={toggleDefaultAgentInterop}
            title={`Agent Interoperability (default): ${config.defaultAgentInteropEnabled ? 'enabled' : 'disabled'}`}
          >
            AIO
          </button>
          <button
            className={`fs-quick-toggle${persistSessions ? ' fs-quick-toggle-on-sto' : ''}`}
            onClick={togglePersistSessions}
            title={`Session persistence: ${persistSessions ? 'enabled — sessions survive page refresh' : 'disabled'}`}
          >
            STO
          </button>
          <DefaultFsSelector value={defaultFsAccess} onChange={handleDefaultFsChange} />
          <button
            className="kill-btn"
            onClick={killAllAgents}
            title="Stop all streaming agents"
            disabled={!sessions.some(s => s.isStreaming)}
          >
            ■
          </button>
          <button className="reset-btn" onClick={handleReset} title="Reset everything">↺</button>
          <button className="cog-btn" onClick={() => setShowConfig(true)} title="Config (⚙)">⚙</button>
        </div>
      </header>

      <main className="app-main">
        {page === 'about' && <AboutPage />}
        {page === 'how-to' && <HowToPage />}
        {page === 'notepad' && (
          <NotepadPage content={notepadContent} onChange={setNotepadContent} toggleHotkey={config.hotkeys.toggleNotepad} />
        )}
        {page === 'filesystem' && (
          <FilesystemPage
            virtualFsFiles={virtualFsFiles}
            onAddFiles={addVirtualFiles}
            onRemoveFile={removeVirtualFile}
            fsRoot={fsRoot}
            onFsRootChange={setFsRoot}
            pancakeEnabled={pancakeEnabled}
            onPancakeToggle={togglePancakeEnabled}
            localEnabled={localEnabled}
            onLocalToggle={toggleLocalEnabled}
          />
        )}
        {/* TileGrid stays mounted (hidden via CSS) to preserve terminal instances */}
        <div className={`sessions-page${page !== 'sessions' ? ' sessions-page-hidden' : ''}`}>
          {sessions.length === 0 ? (
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
              layout={layout}
              hotkeys={config.hotkeys}
              groups={groups}
              pageVisible={page === 'sessions'}
              onSendMessage={sendMessage}
              onRemove={removeSession}
              onRename={renameSession}
              onReorder={reorderSessions}
              onFocusTile={focusTile}
              onActiveInputChange={setActiveInputValue}
              onFsAccessChange={setFsAccess}
              onAgentInteropChange={setAgentInteropEnabled}
              onCcCwdChange={updateCcCwd}
              onAddGroup={addGroup}
              onRemoveGroup={removeGroup}
              onToggleGroupCollapsed={toggleGroupCollapsed}
              onSetSessionGroup={setSessionGroup}
              defaultAgentInteropEnabled={config.defaultAgentInteropEnabled}
            />
          )}
        </div>
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

      {virtualDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Delete file from Pancake's Filesystem?</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.6 }}>
              The agent is requesting to delete <strong>{virtualDeleteConfirm.name}</strong> from Pancake's virtual filesystem. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button onClick={() => { virtualDeleteConfirm.resolve(false); setVirtualDeleteConfirm(null) }}>Cancel</button>
              <button className="btn-primary" onClick={() => { virtualDeleteConfirm.resolve(true); setVirtualDeleteConfirm(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {agentDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Delete agent "{agentDeleteConfirm.agentName}"?</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.6 }}>
              An agent is requesting to close this session. This will permanently erase its chat history and cannot be undone.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                onChange={e => setSuppressDeleteConfirm(e.target.checked)}
              />
              Don't ask me again this session
            </label>
            <div className="modal-actions">
              <button onClick={() => { agentDeleteConfirm.reject({ error: 'User cancelled deletion' }); setAgentDeleteConfirm(null) }}>Cancel</button>
              <button className="btn-primary" onClick={() => { agentDeleteConfirm.resolve(); setAgentDeleteConfirm(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
