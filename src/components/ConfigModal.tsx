import { useState, useRef, useEffect } from 'react'
import type { Config, Hotkeys } from '../types'

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
  const [defaultModel, setDefaultModel] = useState(config.defaultModel)
  const [hotkeys, setHotkeys] = useState<Hotkeys>({ ...config.hotkeys })
  const [recording, setRecording] = useState<HotkeyField | null>(null)
  const inputRefs = useRef<Partial<Record<HotkeyField, HTMLInputElement>>>({})
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  function handleSave() {
    onSave({ apiKey, defaultModel, hotkeys })
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
        <label>
          Anthropic API Key
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
        </label>
        <label>
          Default Model
          <select value={defaultModel} onChange={e => setDefaultModel(e.target.value)}>
            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

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
