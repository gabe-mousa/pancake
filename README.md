# Pancake

Run multiple Claude AI agent sessions side by side in your browser.

## Quick start

```bash
npx pancake
```

Pancake builds itself on first run, opens `http://localhost:4173` in your browser, and prompts you to enter your Anthropic API key. No installation required.

## Features

- **Multi-session grid** — run up to 4 sessions per row, each with its own model and conversation history
- **Claude Code sessions** — spawn full xterm.js terminal tiles running a local Claude Code CLI process alongside chat sessions
- **Session persistence** — save and restore sessions across page refreshes with the **STO** toggle
- **Layout modes** — switch between wide (4 columns) and tall (2 columns, larger tiles) from the nav bar
- **Broadcasting** — select multiple tiles and send one message to all of them simultaneously
- **Shared notepad** — a floating, resizable markdown scratchpad readable and writable by any agent or by you
- **Agent interoperability** — agents can list, message, create, and delete other sessions autonomously via tool calls. Claude Code sessions can also use AIO via REST endpoints (`curl`)
- **Pancake's Filesystem (PFS)** — an in-browser virtual filesystem; upload files and folders for agents to read and write
- **Local Filesystem (LFS)** — a bridge to a real directory on your machine, served by a local Express server Pancake starts automatically
- **Drag and drop** — reorder session tiles by dragging
- **Configurable hotkeys** — all keyboard shortcuts are remappable in the settings menu
- **Session indicators** — unread messages show an orange pulsing dot; PFS (green) and LFS (blue) dots indicate filesystem access per session
- **Terminal reconnection** — Claude Code PTY processes survive WebSocket disconnections and automatically reattach with buffered output replay
- **In-app documentation** — comprehensive Docs and About pages accessible from the nav bar
- **Toolbar help** — click the **?** button in the header to see a quick reference of what each toolbar button does
- **Flexible auth** — connect via Anthropic API key or a Cybertron devbox gateway

## Requirements

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) — or a Cybertron devbox shell for gateway access

## Usage

### Getting started

1. Run `npx pancake`
2. Click **⚙** (top right) and enter your Anthropic API key (or set auth mode to Cybertron if using a devbox shell)
3. Press **Ctrl+Shift+N** (or click **+**) to create a session
4. Choose a session type (**Chat** or **Claude Code**) — press **Ctrl+Shift+N** again to toggle the type — then enter a name and optionally a model or working directory, and press **Enter** or click **Create**
5. Type in the chat input and press **Enter** to send (Chat), or type directly in the terminal (Claude Code)

### Layout modes

Use the layout toggle in the nav bar to switch between two grid modes:

- **Wide** (default) — 4 columns, compact tile height; fit as many sessions as possible on screen
- **Tall** — 2 columns, tiles fill roughly half the viewport height; better for reading longer conversations

### Keyboard shortcuts

| Action | Default shortcut |
|---|---|
| New session | `Ctrl+Shift+N` (press again to toggle Chat / Claude Code) |
| Navigate tiles | `Alt+Arrow keys` |
| Select tiles (for broadcast) | `Shift+Arrow keys` |
| Deselect all | `Shift+F` |
| Expand focused tile | `Ctrl+Shift+F` |
| Toggle notepad window | `Ctrl+Shift+X` |

All shortcuts are configurable in the settings menu.

### Broadcasting

Select multiple tiles using `Shift+Arrow keys` — selected tiles are highlighted in yellow. Typing and sending a message while tiles are selected delivers that message to all selected sessions at once.

### Session persistence

Click the **STO** button in the header to enable session persistence. When active, all sessions, their conversation history, and the current layout mode are saved to `localStorage` and restored automatically on page reload. Streaming status is not persisted — sessions resume in an idle state.

### Notepad

The shared notepad (`Ctrl+Shift+X`) is a floating, resizable markdown editor visible to all sessions. Drag any edge or corner to resize it. Agents can read and write it as a tool during their responses, making it useful for passing context between agents, accumulating results from parallel runs, or keeping shared state across sessions.

The full-page Notepad editor is also accessible from the **Notepad** nav link.

### Filesystems

Pancake provides two independent filesystems:

**PFS (Pancake's Filesystem)** — an in-memory virtual filesystem. Upload files and folders for agents to access. Files live only while the page is open; nothing is read from or written to your machine. Toggle with the **PFS** button (green when on).

**LFS (Local Filesystem)** — a bridge to a real directory on your machine served by a local Express server Pancake starts on port 4174. Set a root directory on the Filesystem page; agents are scoped to it. Access level is controlled per-session by the **FS badge** on each tile (off / read / r/w / r/w/d). Toggle with the **LFS** button (blue when on). LFS enforces path safety — symlinks that escape the root directory are rejected, binary files return an error with size info, and reads are capped at 1 MB.

### Agent interoperability

When enabled (the **AIO** button, lavender when on), agents can use five tools to interact with other sessions:

- `list_agents` — list all open sessions
- `read_agent_chat(id)` — read another session's full conversation history
- `send_message_to_agent(id, message, await_response?)` — inject a message into another session
- `create_agent(name?, model?, session_type?, cwd?)` — spawn a new session tile
- `delete_agent(id)` — close and erase another session (requires confirmation; can be suppressed for the current session)

Interop is enabled by default and can be toggled globally from the header or per-session from each tile's AIO badge.

Claude Code sessions also have access to AIO via REST endpoints on the Pancake server. CC sessions are automatically informed about these endpoints when they start and can call them with `curl`:

- `GET /aio/list-agents` — list all sessions
- `POST /aio/create-agent` — create a new session
- `POST /aio/send-message` — send a message to another session

### Models

Each session can use a different model. Select from the dropdown when creating a session. The default model for new sessions is set in **⚙ Config**.

## Local development

```bash
git clone https://github.com/gabemousa/pancake
cd pancake
npm install
npm run dev
```

Then open `http://localhost:5173`.

**Note:** `node-pty` (used for Claude Code terminal sessions) includes native bindings that must be compiled for your machine. If `npm install` doesn't build them automatically, run:

```bash
cd node_modules/node-pty && npx node-gyp rebuild
```

### Environment variables

| Variable | Description |
|---|---|
| `PORT` | Override the Vite preview server port (default `4173`) |
| `FS_PORT` | Override the filesystem/backend server port (default `4174`) |
| `FS_ROOT` | Set the LFS root directory at startup |
| `CLAUDE_PATH` | Override the path to the Claude Code CLI binary. Defaults to `claude` (resolved from `PATH`) |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server + backend server with hot reload |
| `npm run build` | TypeScript compile + Vite bundle to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm start` | Build if needed, then launch the production server |

## License

MIT
