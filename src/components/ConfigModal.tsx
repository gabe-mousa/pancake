import { useState, useRef, useEffect } from 'react'
import type { AuthMode, Config, Hotkeys } from '../types'

interface Props {
  config: Config
  onSave: (config: Config) => void
  onClose: () => void
}

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
]

type HotkeyField = keyof Hotkeys

const HOTKEY_LABELS: Record<HotkeyField, string> = {
  right: 'Focus right',
  left: 'Focus left',
  up: 'Focus up',
  down: 'Focus down',
  selectRight: 'Select right',
  selectLeft: 'Select left',
  selectUp: 'Select up',
  selectDown: 'Select down',
  focus: 'Deselect all tiles',
  newSession: 'New session',
  expandTile: 'Expand / minimize tile',
  toggleNotepad: 'Toggle Notepad window',
}

function buildCombo(e: KeyboardEvent | React.KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (e.metaKey) parts.push('Meta')
  const key = e.key
  if (!['Shift', 'Control', 'Alt', 'Meta'].includes(key)) parts.push(key)
  return parts.join('+')
}

export default function ConfigModal({ config, onSave, onClose }: Props) {
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [authMode, setAuthMode] = useState<AuthMode>(config.authMode ?? 'api-key')
  const [defaultModel, setDefaultModel] = useState(config.defaultModel)
  const [defaultAgentInteropEnabled, setDefaultAgentInteropEnabled] = useState(config.defaultAgentInteropEnabled)
  const [hotkeys, setHotkeys] = useState<Hotkeys>({ ...config.hotkeys })
  const [recording, setRecording] = useState<HotkeyField | null>(null)
  const inputRefs = useRef<Partial<Record<HotkeyField, HTMLInputElement>>>({})
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  function handleSave() {
    onSave({ apiKey, authMode, defaultModel, defaultAgentInteropEnabled, hotkeys })
    onClose()
  }

  function startRecording(field: HotkeyField) {
    setRecording(field)
    inputRefs.current[field]?.focus()
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLInputElement>, field: HotkeyField) {
    if (!recording || recording !== field) return
    e.preventDefault()
    if (e.key === 'Escape') { setRecording(null); return }
    const combo = buildCombo(e)
    if (combo) {
      setHotkeys(prev => ({ ...prev, [field]: combo }))
    }
    setRecording(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (recording) e.preventDefault()
  }

  function handleModalKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && !recording) onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={modalRef} className="modal modal-wide" onClick={e => e.stopPropagation()} onKeyDown={handleModalKeyDown} tabIndex={-1}>
        <h2>Config</h2>

        <label as="div">
          Auth Mode
          <div style={{ display: 'flex', borderRadius: '5px', border: '1px solid var(--brown-border)', overflow: 'hidden' }}>
            {(['api-key', 'cybertron'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAuthMode(mode)}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  border: 'none',
                  borderRight: mode === 'api-key' ? '1px solid var(--brown-border)' : 'none',
                  background: authMode === mode ? 'var(--brown)' : 'var(--cream)',
                  color: authMode === mode ? 'var(--cream)' : 'var(--brown-light)',
                  fontSize: '0.85rem',
                  fontWeight: authMode === mode ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {mode === 'api-key' ? 'API Key' : 'Cybertron'}
              </button>
            ))}
          </div>
          {authMode === 'cybertron' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400, lineHeight: 1.5 }}>
              Routes through Cybertron using your devbox credentials. Requires the Pancake server to be running in a devbox shell.
            </span>
          )}
        </label>

        {authMode === 'api-key' && (
          <label>
            Anthropic API Key
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
          </label>
        )}
        <label>
          Default Model
          <select value={defaultModel} onChange={e => setDefaultModel(e.target.value)}>
            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={defaultAgentInteropEnabled}
            onChange={e => setDefaultAgentInteropEnabled(e.target.checked)}
          />
          Agent Interoperability (default for new sessions)
        </label>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '-0.5rem 0 0.5rem', lineHeight: 1.5 }}>
          Allow agents to list, read, message, create, and delete other agents. Can be overridden per session on each tile.
        </p>

        <div className="config-section-title">Hotkeys</div>
        <div className="hotkey-grid">
          {(Object.keys(HOTKEY_LABELS) as HotkeyField[]).map(field => (
            <label key={field}>
              {HOTKEY_LABELS[field]}
              <input
                ref={el => { if (el) inputRefs.current[field] = el }}
                className={recording === field ? 'hotkey-input recording' : 'hotkey-input'}
                value={recording === field ? 'Press keys, then release...' : (hotkeys[field] || 'None')}
                readOnly
                onClick={() => startRecording(field)}
                onKeyDown={handleKeyDown}
                onKeyUp={e => handleKeyUp(e, field)}
              />
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
