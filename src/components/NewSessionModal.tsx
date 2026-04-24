import { useState, useRef, useEffect } from 'react'
import type { SessionType } from '../types'

interface Props {
  defaultModel: string
  onConfirm: (model: string, name: string, sessionType: SessionType, cwd?: string) => void
  onClose: () => void
}

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
]

export default function NewSessionModal({ defaultModel, onConfirm, onClose }: Props) {
  const [model, setModel] = useState(defaultModel)
  const [name, setName] = useState('')
  const [sessionType, setSessionType] = useState<SessionType>('chat')
  const [cwd, setCwd] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  function handleConfirm() {
    const effectiveModel = sessionType === 'claude-code' ? 'claude code' : model
    onConfirm(effectiveModel, name.trim(), sessionType, sessionType === 'claude-code' ? (cwd.trim() || undefined) : undefined)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onClose()
    if (e.key === 'N' && e.ctrlKey && e.shiftKey) {
      e.preventDefault()
      setSessionType(prev => prev === 'chat' ? 'claude-code' : 'chat')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h2>New Session</h2>

        <label>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            Session Type
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>Ctrl+Shift+N to toggle</span>
          </span>
          <div style={{ display: 'flex', borderRadius: '5px', border: '1px solid var(--brown-border)', overflow: 'hidden' }}>
            {(['chat', 'claude-code'] as const).map((type) => (
              <button
                key={type}
                type="button"
                tabIndex={-1}
                onClick={() => setSessionType(type)}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  border: 'none',
                  borderRight: type === 'chat' ? '1px solid var(--brown-border)' : 'none',
                  background: sessionType === type ? 'var(--brown)' : 'var(--cream)',
                  color: sessionType === type ? 'var(--cream)' : 'var(--brown-light)',
                  fontSize: '0.85rem',
                  fontWeight: sessionType === type ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {type === 'chat' ? 'Chat' : 'Claude Code'}
              </button>
            ))}
          </div>
          {sessionType === 'claude-code' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400, lineHeight: 1.5 }}>
              Opens a real Claude Code terminal session via PTY.
            </span>
          )}
        </label>

        <label>
          Name (optional)
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Session name..."
          />
        </label>

        {sessionType === 'chat' && (
          <label>
            Model
            <select value={model} onChange={e => setModel(e.target.value)}>
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        )}

        {sessionType === 'claude-code' && (
          <label>
            Working Directory (optional)
            <input
              type="text"
              value={cwd}
              onChange={e => setCwd(e.target.value)}
              placeholder="~/Projects/my-project"
              style={{ fontFamily: "'Menlo', 'Consolas', monospace", fontSize: '0.82rem' }}
            />
          </label>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm}>Create</button>
        </div>
      </div>
    </div>
  )
}
