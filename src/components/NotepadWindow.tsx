import { useRef, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface Props {
  content: string
  onChange: (value: string) => void
  pos: { x: number; y: number }
  onPosChange: (pos: { x: number; y: number }) => void
  onClose: () => void
}

export default function NotepadWindow({ content, onChange, pos, onPosChange, onClose }: Props) {
  const [preview, setPreview] = useState(false)
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      onPosChange({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
    }
    function onMouseUp() { dragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onPosChange])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function startDrag(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    const rect = windowRef.current!.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    e.preventDefault()
  }

  return (
    <div
      ref={windowRef}
      className="notepad-window"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="notepad-header" onMouseDown={startDrag}>
        <span className="notepad-title">Notepad</span>
        <button className="notepad-toggle" onClick={() => setPreview(p => !p)}>
          {preview ? 'Edit' : 'Preview'}
        </button>
        <button className="notepad-close" onClick={onClose}>✕</button>
      </div>
      <div className="notepad-body">
        {preview ? (
          <div className="notepad-preview">
            {content ? <ReactMarkdown>{content}</ReactMarkdown> : <span className="notepad-empty">Nothing here yet.</span>}
          </div>
        ) : (
          <textarea
            className="notepad-textarea"
            value={content}
            onChange={e => onChange(e.target.value)}
            placeholder="Type your notes here... (supports markdown)"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  )
}
