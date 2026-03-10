export type Role = 'user' | 'assistant'

export interface Message {
  role: Role
  content: string
}

export interface Session {
  id: string
  name: string
  model: string
  messages: Message[]
  status: string
  isStreaming: boolean
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

export interface Config {
  apiKey: string
  defaultModel: string
  hotkeys: Hotkeys
}
