# Pancake — Coding Agent Project Guide

## What is Pancake?

A browser-based multi-session AI workbench. Run multiple chat, Claude Code, and Codex terminal sessions side by side in a tile grid, with agent interoperability, shared notepad, and virtual/local filesystems.

## Architecture

```
pancake/
├── bin/pancake.js           # CLI entry point (npm start)
├── server/index.js          # Express + WebSocket backend (port 4174)
│                              - Local filesystem bridge (LFS)
│                              - PTY management for Claude Code and Codex sessions
│                              - WebSocket server for terminal I/O (path: /ws/terminal)
│                              - Control WebSocket for AIO relay (path: /ws/control)
│                              - AIO REST endpoints (/aio/*) for terminal agent sessions
├── src/
│   ├── App.tsx              # Main app: state, routing, agent interop, layout
│   ├── anthropic.ts         # Anthropic API streaming client
│   ├── types.ts             # All TypeScript interfaces and types
│   ├── index.css            # All styles (single file, ~1800 lines)
│   ├── components/
│   │   ├── TileGrid.tsx     # Sortable grid of session tiles (dnd-kit)
│   │   ├── Tile.tsx         # Single tile wrapper — renders ChatWindow or TerminalTile
│   │   ├── ChatWindow.tsx   # Chat UI for API-based sessions
│   │   ├── TerminalTile.tsx # xterm.js terminal for coding-agent sessions
│   │   ├── NewSessionModal.tsx  # Session creation (chat, claude-code, or codex)
│   │   ├── ConfigModal.tsx  # Settings: API key, auth mode, hotkeys
│   │   ├── NotepadWindow.tsx    # Floating resizable notepad
│   │   ├── NotepadPage.tsx  # Full-page notepad editor
│   │   ├── HowToPage.tsx    # Documentation/help page
│   │   └── AboutPage.tsx    # About page
│   └── pages/
│       └── FilesystemPage.tsx   # PFS/LFS management UI
├── index.html               # Vite entry point
├── vite.config.ts           # Vite config with React plugin
└── tsconfig.json            # TypeScript config
```

## Key concepts

### Session types (`SessionType` in types.ts)
- **`chat`** — API-based conversation via `anthropic.ts` streaming client
- **`claude-code`** — Full PTY terminal running the `claude` CLI binary via `node-pty`, rendered with xterm.js, connected over WebSocket
- **`codex`** — Full PTY terminal running the `codex` CLI binary through the same transport and inherited local authentication

### Layout modes (`Layout` in App.tsx)
- **`wide`** — 4 tiles per row (default)
- **`tall`** — 2 tiles per row with larger tile height
- Toggled from the header bar; CSS class `tile-grid--tall` on the grid

### Data flow for terminal agent sessions
```
TerminalTile.tsx → WebSocket (ws://127.0.0.1:4174/ws/terminal) → server/index.js → pty.spawn(claude | codex)
```
- Binary path: `process.env.CLAUDE_PATH || 'claude'` (resolved from PATH)
- Codex binary path: `process.env.CODEX_PATH || 'codex'` (resolved from PATH)
- PTY processes stored in `ptyMap` keyed by sessionId
- Input injection also available via `POST /terminal/input` (used by agent interop)
- Claude Code uses `--append-system-prompt`; Codex uses the `developer_instructions` config override to inject AIO endpoint docs without starting a task
- Both CLIs inherit the Pancake process environment and their existing local CLI authentication

### WebSocket routing
Path-based routing via HTTP `upgrade` event:
- `/ws/terminal` — PTY terminal connections (TerminalTile.tsx ↔ server)
- `/ws/control` — AIO control channel (App.tsx ↔ server, single connection)

### Agent interoperability (AIO)
**Chat sessions:** Tools (`list_agents`, `read_agent_chat`, `send_message_to_agent`, `create_agent`, `delete_agent`) are injected as system prompt tool definitions in `App.tsx`.

**Terminal agent sessions:** AIO is exposed as REST endpoints on the server (`/aio/list-agents`, `/aio/create-agent`, `/aio/send-message`). Claude Code and Codex receive endpoint instructions at launch and call them with `curl`. The server relays requests to the frontend via a control WebSocket for operations that require frontend state (session creation, listing).

### Filesystems
- **PFS** — In-memory virtual filesystem (browser only), stored in React state
- **LFS** — Real filesystem bridge via Express server at port 4174, scoped to a root dir

## Development

```bash
npm install
npm run dev          # Starts Vite (5173) + backend server (4174)
```

### Important: node-pty native bindings

`node-pty` requires native compilation. If terminal agent sessions fail with `posix_spawnp failed`, rebuild:

```bash
cd node_modules/node-pty && npx node-gyp rebuild
```

This is needed when switching machines, Node versions, or architectures.

## Conventions

- **Single CSS file** — All styles live in `src/index.css`. No CSS modules or styled-components.
- **No state management library** — All state is React `useState`/`useRef` in `App.tsx`, passed down as props.
- **ESM everywhere** — Both frontend and backend use ES modules (`"type": "module"` in package.json).
- **No test framework** — No tests currently exist.
- **Responsive design** — CSS uses `clamp()` for fluid sizing. Breakpoints at 900px, 640px, 400px.
- **Theme** — Warm brown/cream palette defined as CSS custom properties in `:root`.

## Adding a new feature — checklist

1. **Types** — Add any new types/interfaces to `src/types.ts`
2. **State** — Add state to `App.tsx` (this is the single source of truth)
3. **Component** — Create or modify components in `src/components/`
4. **Styles** — Add CSS to `src/index.css` (follow existing variable/naming conventions)
5. **Responsive** — Add responsive rules in the `@media` blocks at the bottom of `index.css`
6. **Props** — Thread new props through `App.tsx → TileGrid → Tile → component`
7. **Docs** — Update `HowToPage.tsx` and `README.md` if user-facing
