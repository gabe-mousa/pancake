# Pancake — Claude Code Project Guide

## What is Pancake?

A browser-based multi-session Claude AI workbench. Run multiple chat and Claude Code terminal sessions side by side in a tile grid, with agent interoperability, shared notepad, and virtual/local filesystems.

## Architecture

```
pancake/
├── bin/pancake.js           # CLI entry point (npx pancake)
├── server/index.js          # Express + WebSocket backend (port 4174)
│                              - Local filesystem bridge (LFS)
│                              - PTY management for Claude Code sessions
│                              - WebSocket server for terminal I/O
├── src/
│   ├── App.tsx              # Main app: state, routing, agent interop, layout
│   ├── anthropic.ts         # Anthropic API streaming client
│   ├── types.ts             # All TypeScript interfaces and types
│   ├── index.css            # All styles (single file, ~1800 lines)
│   ├── components/
│   │   ├── TileGrid.tsx     # Sortable grid of session tiles (dnd-kit)
│   │   ├── Tile.tsx         # Single tile wrapper — renders ChatWindow or TerminalTile
│   │   ├── ChatWindow.tsx   # Chat UI for API-based sessions
│   │   ├── TerminalTile.tsx # xterm.js terminal for Claude Code sessions
│   │   ├── NewSessionModal.tsx  # Session creation (chat or claude-code)
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

### Layout modes (`Layout` in App.tsx)
- **`wide`** — 4 tiles per row (default)
- **`tall`** — 2 tiles per row with larger tile height
- Toggled from the header bar; CSS class `tile-grid--tall` on the grid

### Data flow for Claude Code sessions
```
TerminalTile.tsx → WebSocket (ws://127.0.0.1:4174) → server/index.js → pty.spawn(claude)
```
- Binary path: `process.env.CLAUDE_PATH || 'claude'` (resolved from PATH)
- PTY processes stored in `ptyMap` keyed by sessionId
- Input injection also available via `POST /terminal/input` (used by agent interop)

### Agent interoperability (AIO)
When enabled, sessions get tools: `list_agents`, `read_agent_chat`, `send_message_to_agent`, `create_agent`, `delete_agent`. These are injected as system prompt tool definitions in `App.tsx`.

### Filesystems
- **PFS** — In-memory virtual filesystem (browser only), stored in React state
- **LFS** — Real filesystem bridge via Express server at port 4174, scoped to a root dir

## Development

```bash
npm install
npm run dev          # Starts Vite (5173) + backend server (4174)
```

### Important: node-pty native bindings

`node-pty` requires native compilation. If Claude Code sessions fail with `posix_spawnp failed`, rebuild:

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
