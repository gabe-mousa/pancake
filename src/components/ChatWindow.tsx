import { useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Message } from '../types'

interface Props {
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  // null = this tile is not active and not mirrored
  activeInputValue: string | null
  mirroredInputValue: string | null
  onSendMessage: (text: string) => void
  onFocus: () => void
  onActiveInputChange: (value: string) => void
}

export default function ChatWindow({ messages, isStreaming, streamingContent, activeInputValue, mirroredInputValue, onSendMessage, onFocus, onActiveInputChange }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Active tile: controlled input, user types here
  function handleActiveKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
      const text = (activeInputValue ?? '').trim()
      if (text) {
        onSendMessage(text)
      }
    }
  }

  // Mirrored tile: send on Enter (fires broadcast via parent)
  function handleMirroredKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
      const text = (mirroredInputValue ?? '').trim()
      if (text) {
        onSendMessage(text)
      }
    }
  }

  const isActive = activeInputValue !== null
  const isMirrored = mirroredInputValue !== null

  // Determine display value and mode
  const inputValue = isActive ? activeInputValue! : isMirrored ? mirroredInputValue! : ''
  const isReadOnlyMirrored = !isActive && isMirrored

  return (
    <div className="chat-window">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <span className="message-role">
              {msg.role === 'user' ? 'You' : 'Agent'}
            </span>
            {msg.fromAgent && (
              <span className="message-from-agent">sent by "{msg.fromAgent}"</span>
            )}
            <div className="message-content">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isStreaming && streamingContent && (
          <div className="message message-assistant">
            <span className="message-role">Agent</span>
            <div className="message-content">
              <ReactMarkdown>{streamingContent}</ReactMarkdown>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <input
        className={`chat-input${isReadOnlyMirrored ? ' chat-input-mirrored' : ''}`}
        placeholder={isStreaming ? 'Agent is responding...' : 'Send a message...'}
        disabled={isStreaming}
        value={isActive || isMirrored ? inputValue : undefined}
        onChange={isActive ? e => onActiveInputChange(e.target.value) : undefined}
        onKeyDown={isActive ? handleActiveKeyDown : isMirrored ? handleMirroredKeyDown : undefined}
        onFocus={onFocus}
        readOnly={isReadOnlyMirrored}
      />
    </div>
  )
}
