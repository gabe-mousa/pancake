import { useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ChatWindow from './ChatWindow'
import type { Session, FsAccess } from '../types'

interface Props {
  session: Session
  streamingContent: string
  isActive: boolean
  isSelected: boolean
  activeInputValue: string | null
  mirroredInputValue: string | null
  expandHotkey: string
  onSendMessage: (sessionId: string, text: string) => void
  onRemove: (sessionId: string) => void
  onRename: (sessionId: string, name: string) => void
  onFocus: () => void
  onActiveInputChange: (value: string) => void
  onFsAccessChange: (sessionId: string, level: FsAccess) => void
}

const FS_LEVELS: FsAccess[] = ['none', 'read', 'read-write', 'read-write-delete']
const FS_LABELS: Record<FsAccess, string> = {
  'none': 'FS: off',
  'read': 'FS: read',
  'read-write': 'FS: r/w',
  'read-write-delete': 'FS: r/w/d',
}

function hotkeyMatches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+')
  const needsShift = parts.includes('Shift')
  const needsCtrl = parts.includes('Ctrl')
  const needsAlt = parts.includes('Alt')
  const needsMeta = parts.includes('Meta')
  const keyPart = parts[parts.length - 1]
  const codeMatch = keyPart.length === 1
    ? e.code === `Key${keyPart.toUpperCase()}`
    : e.key === keyPart
  return (
    codeMatch &&
    e.shiftKey === needsShift &&
    e.ctrlKey === needsCtrl &&
    e.altKey === needsAlt &&
    e.metaKey === needsMeta
  )
}

export default function Tile({ session, streamingContent, isActive, isSelected, activeInputValue, mirroredInputValue, expandHotkey, onSendMessage, onRemove, onRename, onFocus, onActiveInputChange, onFsAccessChange }: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(session.name)
  const [expanded, setExpanded] = useState(false)
  const [showFsMenu, setShowFsMenu] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: session.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function commitName() {
    const trimmed = nameInput.trim()
    if (trimmed) onRename(session.id, trimmed)
    setEditingName(false)
  }

  const tileClass = [
    'tile',
    expanded ? 'tile-expanded' : '',
    isActive ? 'tile-active' : '',
    isSelected ? 'tile-selected' : '',
    isActive && isSelected ? 'tile-active-selected' : '',
  ].filter(Boolean).join(' ')

  function handleExpand() {
    const next = !expanded
    setExpanded(next)
    if (next) {
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('.tile-expanded .chat-input')
        inputs[0]?.focus()
      }, 50)
    } else {
      setTimeout(() => {
        const container = document.querySelector<HTMLElement>(`[data-session-id="${session.id}"] .chat-messages`)
        if (container) container.scrollTop = container.scrollHeight
      }, 50)
    }
  }

  useEffect(() => {
    if (!isActive) return
    function onKeyDown(e: KeyboardEvent) {
      if (hotkeyMatches(e, expandHotkey)) {
        e.preventDefault()
        setExpanded(prev => {
          const next = !prev
          if (next) {
            setTimeout(() => {
              const inputs = document.querySelectorAll<HTMLInputElement>('.tile-expanded .chat-input')
              inputs[0]?.focus()
            }, 50)
          } else {
            setTimeout(() => {
              const container = document.querySelector<HTMLElement>(`[data-session-id="${session.id}"] .chat-messages`)
              if (container) container.scrollTop = container.scrollHeight
            }, 50)
          }
          return next
        })
      } else if (e.key === 'Escape' && expanded) {
        e.preventDefault()
        setExpanded(false)
        setTimeout(() => {
          const container = document.querySelector<HTMLElement>(`[data-session-id="${session.id}"] .chat-messages`)
          if (container) container.scrollTop = container.scrollHeight
        }, 50)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActive, expanded, expandHotkey])

  // Close FS menu on outside click
  useEffect(() => {
    if (!showFsMenu) return
    function onClickOutside() { setShowFsMenu(false) }
    window.addEventListener('click', onClickOutside)
    return () => window.removeEventListener('click', onClickOutside)
  }, [showFsMenu])

  const fsAccess = session.fsAccess
  const fsBadgeClass = `fs-badge fs-badge-${fsAccess}`

  return (
    <div ref={setNodeRef} style={style} className={tileClass} data-session-id={session.id} onClick={onFocus}>
      <div className="tile-header">
        <div className="drag-handle" {...attributes} {...listeners}>⠿</div>
        {editingName ? (
          <input
            className="tile-name-input"
            value={nameInput}
            autoFocus
            onChange={e => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => e.key === 'Enter' && commitName()}
          />
        ) : (
          <span className="tile-name" onDoubleClick={() => setEditingName(true)}>
            {session.name}
            <span className="tile-model-inline">{session.model}</span>
          </span>
        )}
        <div className="tile-fs-indicators">
          {session.pancakeEnabled && (
            <span className="tile-fs-dot tile-fs-dot-pfs" title="Pancake's Filesystem was enabled when this session was created" />
          )}
          {session.localEnabled && (
            <span className="tile-fs-dot tile-fs-dot-lfs" title="Local Filesystem was enabled when this session was created" />
          )}
        </div>
        <div className="fs-badge-wrapper" onClick={e => e.stopPropagation()}>
          <button
            className={fsBadgeClass}
            onClick={() => setShowFsMenu(prev => !prev)}
            title="Set filesystem access level"
          >
            {FS_LABELS[fsAccess]}
          </button>
          {showFsMenu && (
            <div className="fs-menu">
              {FS_LEVELS.map(level => (
                <button
                  key={level}
                  className={`fs-menu-item${level === fsAccess ? ' fs-menu-item-active' : ''}`}
                  onClick={() => { onFsAccessChange(session.id, level); setShowFsMenu(false) }}
                >
                  {FS_LABELS[level]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="tile-expand" onClick={e => { e.stopPropagation(); handleExpand() }} title={expanded ? 'Minimize' : 'Expand'}>
          {expanded ? '⊡' : '⊞'}
        </button>
        <button className="tile-remove" onClick={e => { e.stopPropagation(); onRemove(session.id) }}>✕</button>
      </div>
      <div className="tile-status">{session.status || 'Idle'}</div>
      <ChatWindow
        messages={session.messages}
        isStreaming={session.isStreaming}
        streamingContent={streamingContent}
        activeInputValue={activeInputValue}
        mirroredInputValue={mirroredInputValue}
        onSendMessage={text => onSendMessage(session.id, text)}
        onFocus={onFocus}
        onActiveInputChange={onActiveInputChange}
      />
    </div>
  )
}
