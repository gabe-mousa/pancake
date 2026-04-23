import { useRef, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

interface Props {
  content: string
  onChange: (value: string) => void
  pos: { x: number; y: number }
  onPosChange: (pos: { x: number; y: number }) => void
  onClose: () => void
}

type ResizeEdge = 'e' | 's' | 'se' | 'sw' | 'w' | 'ne' | 'nw' | 'n' | null

export default function NotepadWindow({ content, onChange, pos, onPosChange, onClose }: Props) {
  const [preview, setPreview] = useState(false)
  const [size, setSize] = useState({ width: 340, height: 320 })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const resizing = useRef<ResizeEdge>(null)
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, width: 0, height: 0, posX: 0, posY: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (dragging.current) {
        onPosChange({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
        return
      }
      if (!resizing.current) return
      const edge = resizing.current
      const dx = e.clientX - resizeStart.current.mouseX
      const dy = e.clientY - resizeStart.current.mouseY
      const minW = 220, minH = 180

      let newWidth = resizeStart.current.width
      let newHeight = resizeStart.current.height
      let newX = resizeStart.current.posX
      let newY = resizeStart.current.posY

      if (edge.includes('e')) newWidth = Math.max(minW, resizeStart.current.width + dx)
      if (edge.includes('s')) newHeight = Math.max(minH, resizeStart.current.height + dy)
      if (edge.includes('w')) {
        newWidth = Math.max(minW, resizeStart.current.width - dx)
        newX = resizeStart.current.posX + resizeStart.current.width - newWidth
      }
      if (edge.includes('n')) {
        newHeight = Math.max(minH, resizeStart.current.height - dy)
        newY = resizeStart.current.posY + resizeStart.current.height - newHeight
      }

      setSize({ width: newWidth, height: newHeight })
      if (edge.includes('w') || edge.includes('n')) onPosChange({ x: newX, y: newY })
    }
    function onMouseUp() {
      dragging.current = false
      resizing.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
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

  function startResize(edge: ResizeEdge) {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizing.current = edge
      const rect = windowRef.current!.getBoundingClientRect()
      resizeStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        width: rect.width,
        height: rect.height,
        posX: pos.x,
        posY: pos.y,
      }
      document.body.style.cursor = getCursor(edge)
      document.body.style.userSelect = 'none'
    }
  }

  function getCursor(edge: ResizeEdge) {
    switch (edge) {
      case 'e': case 'w': return 'ew-resize'
      case 'n': case 's': return 'ns-resize'
      case 'se': case 'nw': return 'nwse-resize'
      case 'ne': case 'sw': return 'nesw-resize'
      default: return ''
    }
  }

  return (
    <div
      ref={windowRef}
      className="notepad-window"
      style={{ left: pos.x, top: pos.y, width: size.width, height: size.height }}
    >
      {/* Resize handles */}
      <div className="notepad-resize notepad-resize-e"  onMouseDown={startResize('e')} />
      <div className="notepad-resize notepad-resize-s"  onMouseDown={startResize('s')} />
      <div className="notepad-resize notepad-resize-w"  onMouseDown={startResize('w')} />
      <div className="notepad-resize notepad-resize-n"  onMouseDown={startResize('n')} />
      <div className="notepad-resize notepad-resize-se" onMouseDown={startResize('se')} />
      <div className="notepad-resize notepad-resize-sw" onMouseDown={startResize('sw')} />
      <div className="notepad-resize notepad-resize-ne" onMouseDown={startResize('ne')} />
      <div className="notepad-resize notepad-resize-nw" onMouseDown={startResize('nw')} />

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
