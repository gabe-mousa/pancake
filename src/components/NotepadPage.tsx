import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface Props {
  content: string
  onChange: (value: string) => void
  toggleHotkey: string
}

export default function NotepadPage({ content, onChange, toggleHotkey }: Props) {
  const [preview, setPreview] = useState(false)

  return (
    <div className="notepad-page">
      <div className="notepad-page-header">
        <h1>Notepad</h1>
        <button className="notepad-page-toggle" onClick={() => setPreview(p => !p)}>
          {preview ? 'Edit' : 'Preview'}
        </button>
        <span className="notepad-page-hint">
          Press <kbd>{toggleHotkey}</kbd> to open as a floating window on other pages
        </span>
      </div>
      <div className="notepad-page-body">
        {preview ? (
          <div className="notepad-page-preview">
            {content ? <ReactMarkdown>{content}</ReactMarkdown> : <span className="notepad-empty">Nothing here yet.</span>}
          </div>
        ) : (
          <textarea
            className="notepad-page-textarea"
            value={content}
            onChange={e => onChange(e.target.value)}
            placeholder="Type your notes here... (supports markdown)"
            spellCheck={false}
            autoFocus
          />
        )}
      </div>
    </div>
  )
}
