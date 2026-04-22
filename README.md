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
- **Broadcasting** — select multiple tiles and send one message to all of them simultaneously
- **Agent interoperability** — agents can list, message, read, create, and delete other sessions through tool calls
- **Filesystems** — virtual in-browser filesystem (PFS) and a local filesystem bridge (LFS) with per-session access control
- **Agentic tool loop** — Claude can read and write a shared notepad as a tool, enabling inter-agent coordination
- **Shared notepad** — a floating markdown scratchpad readable and writable by any agent or by you
- **Drag and drop** — reorder session tiles by dragging
- **Configurable hotkeys** — all keyboard shortcuts are remappable in the settings menu
- **Flexible auth** — connect via Anthropic API key or a Cybertron devbox gateway

## Requirements

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) — or a Cybertron devbox shell for gateway access

## Usage

### Getting started

1. Run `npx pancake`
2. Click the cog in the top right and enter your Anthropic API key (or set auth mode to Cybertron if using a devbox shell)
3. Press **Ctrl+Shift+N** (or click **+**) to create a session
4. Choose a session type (**Chat** or **Claude Code**), a name, and optionally a model or working directory, then click **Create**
5. Type in the chat input and press **Enter** to send (Chat), or type directly in the terminal (Claude Code)

### Keyboard shortcuts

| Action | Default shortcut |
|---|---|
| New session | `Ctrl+Shift+N` |
| Navigate tiles | `Alt+Arrow keys` |
| Select tiles (for broadcast) | `Shift+Arrow keys` |
| Deselect all | `Shift+F` |
| Expand focused tile | `Ctrl+Shift+F` |
| Toggle notepad window | `Ctrl+Shift+X` |

All shortcuts are configurable in the settings menu in the top right.

### Broadcasting

Select multiple tiles using `Shift+Arrow keys` — selected tiles are highlighted. Typing and sending a message while tiles are selected delivers that message to all selected sessions at once.

### Notepad

The shared notepad (`Ctrl+Shift+X`) is a floating markdown editor visible to all sessions. Agents can read and write it as a tool during their responses, making it useful for passing context between agents, accumulating results from parallel runs, or keeping shared state across sessions.

### Models

Each session can use a different model. Currently supports Anthropic models (requires an [Anthropic API key](https://console.anthropic.com/)). Select from the dropdown when creating a session or in the settings menu.

## Local development

```bash
git clone https://github.com/gabemousa/pancake
cd pancake
npm install
npm run dev
```

Then open `http://localhost:5173`.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with hot reload |
| `npm run build` | TypeScript compile + Vite bundle to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm start` | Build if needed, then launch the production server |

## License

MIT