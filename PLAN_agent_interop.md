# Feature Plan: Agent-to-Agent Interoperability

**Status: APPROVED — ready for implementation**

---

## Overview

Enable agents (sessions) to directly interact with other agents through Claude tool calls. Each agent tile will gain tools that let it:

1. **List** all other sessions (name, id, model, status)
2. **Read** another session's full conversation history
3. **Send** a message to another session (fire-and-forget, or optionally await response)
4. **Create / Delete** sessions programmatically

This is a pure-frontend feature — no backend changes required. All operations go through React state already managed in `App.tsx`.

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Await response in v1? | Fire-and-forget by default. `await_response: boolean` parameter (default `false`) available optionally. |
| 2 | Can agents message themselves? | Disallowed — returns error. |
| 3 | Visual indicator for agent-injected messages? | Yes. Text-only badge (no emojis). e.g. `sent by "Researcher"` |
| 4 | Confirmation dialog for `delete_agent`? | Yes. Modal with "Don't ask me again this session" checkbox that suppresses future confirmations for the rest of the session. |
| 5 | Access controls on `read_agent_chat`? | Fully unrestricted. |
| 6 | Always-on or behind a toggle? | Global default toggle (in Config/settings) + per-session override, mirroring the LFS r/w/d pattern. |

---

## Current State

- Agents are isolated. Each session has its own `messages[]`, `id`, `name`, `model`, and `status`.
- The only cross-agent communication today is the shared Notepad and shared filesystems.
- Agents have no knowledge of each other or any way to trigger actions on each other.
- `streamMessage()` in `anthropic.ts` accepts a `ctx: StreamContext` that is used to inject tool-callable callbacks (notepad read/write, FS ops, virtual file ops). The same pattern will be used for agent interop tools.

---

## Architecture Decision

### How tool callbacks reach `streamMessage()`

`streamMessage()` already receives a `ctx: StreamContext` object containing callbacks for all tool execution. The agent interop tools will be injected the same way — as new callbacks on `StreamContext`.

Since `App.tsx` owns session state, the callbacks will be closures over `sessionsRef`, `sendMessage`, `addSession`, and `removeSession`. These callbacks always have fresh state via refs, matching the existing notepad/FS pattern.

### Concurrency model

When Agent A calls `send_message_to_agent(targetId, text)`:
- **Default (fire-and-forget)**: Tool returns immediately with `{ queued: true, agentName }`. Target begins streaming independently.
- **`await_response: true`**: Tool blocks (via a Promise) until the target session finishes streaming, then returns `{ response: string }` — the last assistant message from the target. This uses a polling or callback mechanism watching `isStreaming` on the target session.

### No circular message loops

`isStreaming` already exists on sessions. `send_message_to_agent` refuses to send to a streaming session, returning an error. Agents are told this in their system prompt and should use `list_agents` to check status first.

---

## Data Model Changes

### `types.ts`

```typescript
// Add to Message interface
interface Message {
  role: Role
  content: string
  fromAgent?: string  // name of the agent session that injected this message, if any
                      // (stored as name not id so it's human-readable in chat)
}

// New type
interface AgentMeta {
  id: string
  name: string
  model: string
  status: string
  isStreaming: boolean
  messageCount: number
}
```

`fromAgent` is ignored by the Claude API (unknown fields are stripped before API calls, or simply passed through harmlessly — will confirm when reading `anthropic.ts` during implementation).

### `Session` type

Two new fields to support the toggle pattern:

```typescript
interface Session {
  // ...existing fields...
  agentInteropEnabled: boolean | null
  // null = inherit from global default
  // true = enabled for this session regardless of global
  // false = disabled for this session regardless of global
}
```

### `Config` type

```typescript
interface Config {
  // ...existing fields...
  defaultAgentInteropEnabled: boolean  // global default, default value: true
}
```

### `App.tsx` state

```typescript
// New state for delete confirmation suppression (session-scoped, not persisted)
const [suppressDeleteConfirm, setSuppressDeleteConfirm] = useState(false)
```

---

## Toggle System (mirrors LFS pattern)

### Global default
- Stored in `Config.defaultAgentInteropEnabled` (persisted in `localStorage` via existing `pancake_config`)
- Configurable in `ConfigModal.tsx` — a simple checkbox/toggle

### Per-session override
- `session.agentInteropEnabled: boolean | null`
- `null` = defer to global default
- `true` / `false` = explicit override
- Exposed in the `Tile.tsx` header or FS menu area — a small badge/button similar to how FS access level is toggled per-tile

### Resolution logic (in `App.tsx` callback builder)
```typescript
function isInteropEnabled(session: Session, config: Config): boolean {
  if (session.agentInteropEnabled !== null) return session.agentInteropEnabled
  return config.defaultAgentInteropEnabled
}
```

Tools are only injected into `streamMessage()` when `isInteropEnabled` is `true` for that session.

---

## New Tools (from an agent's perspective)

All tools defined in `anthropic.ts` alongside existing tools.

### 1. `list_agents`
```
Description: List all currently active agent sessions in this Pancake workspace.
Parameters: none
Returns: Array of AgentMeta { id, name, model, status, isStreaming, messageCount }
Note: Excludes the calling agent itself.
```

### 2. `read_agent_chat`
```
Description: Read the full conversation history of another agent session.
Parameters:
  - agent_id: string (required)
Returns: Array of { role, content } messages, or { error: string } if not found.
Access controls: none — fully unrestricted.
```

### 3. `send_message_to_agent`
```
Description: Send a message to another agent session, triggering a response from it.
Parameters:
  - agent_id: string (required)
  - message: string (required)
  - await_response: boolean (optional, default false)
Returns (fire-and-forget): { queued: true, agentName: string }
Returns (await_response=true): { response: string, agentName: string }
  where response is the full text of the target agent's reply.
Returns on error: { error: string }
Constraints:
  - Cannot send to self (returns error)
  - Cannot send to a currently streaming session (returns error)
  - Target session must have agentInteropEnabled (receiving messages is allowed
    regardless — interop flag only gates tool availability on the caller side)
```

**Implementation note for `await_response`:** The callback will return a Promise that resolves when `sessionsRef.current.find(s => s.id === targetId).isStreaming` transitions from `true` back to `false`. This requires a short polling loop (e.g. `setInterval` checking `sessionsRef` every 100ms, max timeout 60s). The tool execution in `anthropic.ts` is already async, so this is compatible with the existing loop.

### 4. `create_agent`
```
Description: Create a new agent session in the workspace.
Parameters:
  - name: string (optional, default "Session N")
  - model: string (optional, default config.defaultModel)
Returns: { id, name, model } of the new session, or { error: string }
```

### 5. `delete_agent`
```
Description: Delete (close) another agent session and its chat history.
Parameters:
  - agent_id: string (required)
Returns: { success: true } or { error: string }
Constraints:
  - Cannot delete self
  - Cannot delete a streaming session
UI behavior: Shows a confirmation modal (unless user has checked "Don't ask me again
  this session" in a prior confirmation for this session).
```

---

## Delete Confirmation Modal

A small modal (not a new component file — can be conditionally rendered inline in `App.tsx` or `Tile.tsx`) with:

```
Delete agent "Researcher"?
This will permanently close the session and erase its chat history.

[ ] Don't ask me again this session

[Cancel]  [Delete]
```

- `suppressDeleteConfirm` state in `App.tsx` (boolean, default `false`, not persisted)
- When checked + Delete clicked: sets `suppressDeleteConfirm = true`, proceeds with deletion
- While `suppressDeleteConfirm === true`: all subsequent `delete_agent` tool calls skip the modal and delete immediately
- Resets to `false` on page reload (session-scoped, intentionally not persisted)

The tool callback in `App.tsx` must handle this async confirmation. Pattern:
- Tool callback returns a Promise
- Sets a pending deletion request in state (e.g. `pendingDeleteRequest: { agentId, resolve, reject }`)
- Modal renders when `pendingDeleteRequest` is set
- Cancel → `reject()` → tool gets `{ error: 'User cancelled deletion' }`
- Delete → `resolve()` → `removeSession()` → tool gets `{ success: true }`

---

## Changes to `StreamContext` (`anthropic.ts`)

```typescript
interface StreamContext {
  notepad: { read: () => string; write: (s: string) => void }
  virtualFs: { ... }          // unchanged
  localFs: { ... }            // unchanged
  // NEW
  agentInterop: {
    listAgents: () => AgentMeta[]
    readAgentChat: (agentId: string) => Message[] | { error: string }
    sendMessageToAgent: (
      agentId: string,
      message: string,
      awaitResponse: boolean
    ) => Promise<{ queued: true; agentName: string } | { response: string; agentName: string } | { error: string }>
    createAgent: (name?: string, model?: string) => Promise<AgentMeta | { error: string }>
    deleteAgent: (agentId: string) => Promise<{ success: true } | { error: string }>
  } | null  // null when interop is disabled for this session
}
```

When `agentInterop` is `null`, the tool definitions are simply not included in the tools array passed to the API for that session.

---

## Changes to `App.tsx`

### New state
```typescript
const [suppressDeleteConfirm, setSuppressDeleteConfirm] = useState(false)
const [pendingDeleteRequest, setPendingDeleteRequest] = useState<{
  agentId: string
  agentName: string
  resolve: () => void
  reject: () => void
} | null>(null)
```

### Callback factory
Built once, using refs for fresh state access:

```typescript
const agentInteropCallbacks = {
  listAgents: () =>
    sessionsRef.current
      .filter(s => s.id !== callerSessionId)  // caller id passed at call site
      .map(s => ({ id: s.id, name: s.name, model: s.model,
                   status: s.status, isStreaming: s.isStreaming,
                   messageCount: s.messages.length })),

  readAgentChat: (agentId: string) => {
    const s = sessionsRef.current.find(s => s.id === agentId)
    return s ? s.messages : { error: `No session with id ${agentId}` }
  },

  sendMessageToAgent: async (agentId, message, callerSessionId, awaitResponse) => {
    if (agentId === callerSessionId) return { error: 'Cannot message self' }
    const target = sessionsRef.current.find(s => s.id === agentId)
    if (!target) return { error: `No session with id ${agentId}` }
    if (target.isStreaming) return { error: `Agent "${target.name}" is currently busy` }
    sendMessage(agentId, message, callerSessionId)  // tags fromAgent on the injected message
    if (!awaitResponse) return { queued: true, agentName: target.name }
    // Poll until target finishes streaming
    return new Promise((resolve) => {
      // small delay to allow isStreaming to flip to true first
      setTimeout(() => {
        const poll = setInterval(() => {
          const t = sessionsRef.current.find(s => s.id === agentId)
          if (!t || !t.isStreaming) {
            clearInterval(poll)
            const lastMsg = t?.messages.at(-1)
            resolve({ response: lastMsg?.content ?? '', agentName: t?.name ?? agentId })
          }
        }, 100)
        // 60s timeout safety
        setTimeout(() => { clearInterval(poll); resolve({ error: 'Timeout waiting for response' }) }, 60000)
      }, 200)
    })
  },

  createAgent: async (name?, model?) => {
    // calls existing addSession logic, returns the new session's AgentMeta
  },

  deleteAgent: async (agentId, callerSessionId) => {
    if (agentId === callerSessionId) return { error: 'Cannot delete self' }
    const target = sessionsRef.current.find(s => s.id === agentId)
    if (!target) return { error: `No session with id ${agentId}` }
    if (target.isStreaming) return { error: `Agent "${target.name}" is streaming` }
    if (suppressDeleteConfirmRef.current) {
      removeSession(agentId)
      return { success: true }
    }
    return new Promise((resolve, reject) => {
      setPendingDeleteRequest({ agentId, agentName: target.name, resolve: () => {
        removeSession(agentId); resolve({ success: true })
      }, reject: () => reject({ error: 'User cancelled deletion' }) })
    })
  }
}
```

### `sendMessage` signature update
```typescript
// Add optional fromAgent parameter
function sendMessage(sessionId: string, text: string, fromAgent?: string)
// When fromAgent is provided, the injected user Message gets fromAgent set to the
// name (looked up from sessionsRef) of the calling agent.
```

### Wiring into `streamMessage()` call sites
At each `doSend()` / `streamMessage()` invocation, build ctx with `agentInterop` set to the callbacks (with caller session id bound) if `isInteropEnabled(session, config)`, else `null`.

---

## Changes to `anthropic.ts`

### Tool definitions (added to the conditional tool-building logic)
Five new tool objects (following existing `Anthropic.Tool` shape):
- `list_agents`
- `read_agent_chat`
- `send_message_to_agent` (with `await_response` input property)
- `create_agent`
- `delete_agent`

Only included in the tools array when `ctx.agentInterop !== null`.

### `executeTool` additions
New cases for each tool name, calling `ctx.agentInterop.*`. Each is `async` since some callbacks return Promises.

### `buildSystemPrompt()` addition
New section appended when interop is enabled:

```
## Agent Interoperability
You can interact with other agent sessions running in this Pancake workspace.

- list_agents — see all available agents and their status
- read_agent_chat — read another agent's full conversation history
- send_message_to_agent — send a message to another agent (set await_response: true
  to wait for their reply before continuing; default is fire-and-forget)
- create_agent — spawn a new agent session
- delete_agent — close and remove an agent session

Important constraints:
- You cannot message or delete yourself.
- You cannot message an agent that is currently streaming (isStreaming: true).
  Use list_agents to check status first, then retry.
- delete_agent may trigger a user confirmation prompt; if the user cancels,
  the tool will return an error.
```

---

## Changes to `Tile.tsx`

### Per-session interop toggle
A new indicator in the tile header (similar to the FS access badge). Displays current effective state:
- Shows "Interop: On" / "Interop: Off" (or inheriting from global)
- Clicking cycles: `null` (global) → `true` (force on) → `false` (force off) → `null`
- Visual style matches the FS badge pattern

---

## Changes to `ChatWindow.tsx`

### `fromAgent` badge on messages
When a `message.fromAgent` is set (i.e. this user-role message was injected by another agent), render a small annotation above or below the message bubble:

```
sent by "Researcher"
[message content...]
```

Styled as muted/secondary text (small, italic or lighter color). No emojis.

---

## Changes to `ConfigModal.tsx`

### Global default toggle
A new row in the config modal:

```
Agent Interoperability  [toggle: On / Off]
Allow agents to list, read, message, create, and delete other agents by default.
Per-session overrides are available on each tile.
```

Saved to `config.defaultAgentInteropEnabled` in localStorage.

---

## File Change Summary

| File | Change |
|------|--------|
| `src/types.ts` | Add `fromAgent?` to `Message`; add `AgentMeta` type; add `agentInteropEnabled` to `Session`; add `defaultAgentInteropEnabled` to `Config` |
| `src/anthropic.ts` | Add 5 tool definitions; 5 `executeTool` cases; update `StreamContext` type; update `buildSystemPrompt()` |
| `src/App.tsx` | Add interop callbacks; wire into `streamMessage()` ctx; add delete confirmation state + modal; update `sendMessage` to accept `fromAgent`; add `suppressDeleteConfirm` state |
| `src/components/Tile.tsx` | Add per-session interop toggle badge |
| `src/components/ChatWindow.tsx` | Render `fromAgent` annotation on injected messages |
| `src/components/ConfigModal.tsx` | Add global default interop toggle |

No backend changes. No new component files.

---

## Implementation Order

1. Update `src/types.ts` — `Message.fromAgent`, `AgentMeta`, `Session.agentInteropEnabled`, `Config.defaultAgentInteropEnabled`
2. Update `src/anthropic.ts` — extend `StreamContext` type, add 5 tool definitions, add 5 `executeTool` cases, update `buildSystemPrompt()`
3. Update `src/App.tsx` — interop callbacks, delete confirmation modal + state, wire ctx, `sendMessage` `fromAgent` tagging
4. Update `src/components/ConfigModal.tsx` — global default toggle
5. Update `src/components/Tile.tsx` — per-session override badge
6. Update `src/components/ChatWindow.tsx` — `fromAgent` annotation rendering
7. Test: spawn 2 agents → list → read chat → send message (fire-and-forget) → send message (await) → create → delete (with and without confirm suppression)
