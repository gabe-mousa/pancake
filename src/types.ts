export type Role = 'user' | 'assistant'

export interface Message {
  role: Role
  content: string
  fromAgent?: string  // name of the agent session that injected this message, if any
}

export interface AgentMeta {
  id: string
  name: string
  model: string
  status: string
  isStreaming: boolean
  messageCount: number
}

export type FsAccess = 'none' | 'read' | 'read-write' | 'read-write-delete'

export type SessionType = 'chat' | 'claude-code'

export interface Session {
  id: string
  name: string
  model: string
  messages: Message[]
  status: string
  isStreaming: boolean
  fsAccess: FsAccess
  pancakeEnabled: boolean
  localEnabled: boolean
  agentInteropEnabled: boolean | null  // null = inherit from global default
  unread: boolean
  sessionType: SessionType
  ccSessionCwd?: string
}

export interface VirtualFile {
  name: string       // original filename
  size: number       // bytes
  type: string       // MIME type from File API (may be empty string)
  content: string    // text content; binary files stored as base64
  isBinary: boolean  // true if not valid UTF-8 text
  addedAt: number    // Date.now() at time of upload
}

export interface Hotkeys {
  right: string
  left: string
  up: string
  down: string
  selectRight: string
  selectLeft: string
  selectUp: string
  selectDown: string
  focus: string
  newSession: string
  expandTile: string
  toggleNotepad: string
}

export type AuthMode = 'api-key' | 'cybertron'

export interface Config {
  apiKey: string
  authMode: AuthMode
  defaultModel: string
  hotkeys: Hotkeys
  defaultAgentInteropEnabled: boolean
}
