import { useState, useRef, useEffect } from 'react'

interface Props {
  defaultModel: string
  onConfirm: (model: string, name: string) => void
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
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  function handleConfirm() {
    onConfirm(model, name.trim())
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h2>New Session</h2>
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
        <label>
          Model
          <select value={model} onChange={e => setModel(e.target.value)}>
            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm}>Create</button>
        </div>
      </div>
    </div>
  )
}
