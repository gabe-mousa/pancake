export default function HowToPage() {
  return (
    <div className="how-to-layout">
      <nav className="how-to-toc">
        <p className="toc-heading">Contents</p>
        <ul>
          <li><a href="#what-is-pancake">What is Pancake?</a></li>
          <li><a href="#getting-started">Getting started</a></li>
          <li><a href="#authentication">Authentication</a>
            <ul>
              <li><a href="#auth-api-key">API Key</a></li>
              <li><a href="#auth-cybertron">Cybertron</a></li>
            </ul>
          </li>
          <li><a href="#session-tiles">Session tiles</a>
            <ul>
              <li><a href="#claude-code-sessions">Claude Code sessions</a></li>
              <li><a href="#interop-badge">AIO badge</a></li>
              <li><a href="#fs-badge">FS access badge</a></li>
              <li><a href="#pfs-lfs-dots">PFS / LFS indicators</a></li>
            </ul>
          </li>
          <li><a href="#broadcasting">Multi-session broadcasting</a></li>
          <li><a href="#filesystems">Filesystems</a>
            <ul>
              <li><a href="#pfs">PFS — virtual filesystem</a></li>
              <li><a href="#lfs">LFS — local filesystem</a></li>
              <li><a href="#both-fs">Using both together</a></li>
              <li><a href="#default-lfs">Default LFS access</a></li>
            </ul>
          </li>
          <li><a href="#agent-interop">Agent interoperability</a>
            <ul>
              <li><a href="#interop-tools">Agent tools</a></li>
              <li><a href="#interop-cc-rest">Claude Code AIO (REST)</a></li>
              <li><a href="#interop-toggle">Enabling / disabling</a></li>
              <li><a href="#interop-messages">Injected messages</a></li>
              <li><a href="#interop-delete-confirm">Delete confirmation</a></li>
            </ul>
          </li>
          <li><a href="#session-groups">Session groups</a></li>
          <li><a href="#layout">Layout modes</a></li>
          <li><a href="#notepad">Notepad</a></li>
          <li><a href="#header-controls">Header controls</a></li>
          <li><a href="#shortcuts">Keyboard shortcuts</a></li>
          <li><a href="#persistence">Persistence &amp; privacy</a></li>
        </ul>
      </nav>

      <div className="how-to-page">
        <h1>How To Use Pancake</h1>

        <section id="what-is-pancake">
          <h2>What is Pancake?</h2>
          <p>
            Pancake is a local web app for running multiple Claude AI agent sessions side by side.
            Each session is an independent conversation with its own history, model, and filesystem access.
            You can run them simultaneously — writing, coding, research, brainstorming — without losing
            context between them. Agents can autonomously read and write files, use the Notepad, and
            interact directly with each other through agent interoperability tools.
          </p>
        </section>

        <section id="getting-started">
          <h2>Getting started</h2>
          <ol>
            <li>Click <strong>⚙</strong> (top right) to open Config. Choose an <strong>Auth Mode</strong> — <strong>API Key</strong> or <strong>Cybertron</strong> (see <a href="#authentication">Authentication</a> below) — enter your credentials if required, choose a default model, and click <strong>Save</strong>.</li>
            <li>Click <strong>+</strong> (bottom right) or press <code>Ctrl+Shift+N</code> to create a new session. Choose a session type — <strong>Chat</strong> for a standard model conversation, or <strong>Claude Code</strong> for a full terminal running the Claude Code CLI. Press <code>Ctrl+Shift+N</code> again while the dialog is open to toggle between types. Give it a name; Chat sessions also let you pick a model, Claude Code sessions let you optionally set a working directory. Press <strong>Enter</strong> or click <strong>Create</strong>.</li>
            <li>Click a tile to focus it, then type in the chat input and press <strong>Enter</strong> to send.</li>
          </ol>
        </section>

        <section id="authentication">
          <h2>Authentication</h2>
          <p>
            Pancake supports two auth modes, selectable in <strong>Config (⚙)</strong> under <strong>Auth Mode</strong>.
          </p>

          <h3 id="auth-api-key">API Key</h3>
          <p>
            The default mode. Enter your Anthropic API key (starts with <code>sk-ant-</code>) in Config. API calls go directly from your browser to the Anthropic API — your key is stored only in <code>localStorage</code> and never sent anywhere else.
          </p>

          <h3 id="auth-cybertron">Cybertron</h3>
          <p>
            An alternative auth mode that routes API calls through a Cybertron gateway instead of directly to Anthropic. No API key is needed — authentication uses the credentials from your devbox environment.
          </p>
          <ul>
            <li>Start Pancake from inside a devbox shell. The shell sets the <code>ANTHROPIC_BASE_URL</code>, <code>ANTHROPIC_AUTH_TOKEN</code>, and any required custom headers as environment variables that the Pancake server reads automatically.</li>
            <li>In Config, switch <strong>Auth Mode</strong> to <strong>Cybertron</strong>. The API key field disappears — credentials come from the server environment instead.</li>
            <li>All API requests are proxied through <code>POST /api/v1/messages</code> on Pancake's local Express server, which forwards them to the gateway with the correct auth headers. The browser never contacts the gateway directly.</li>
            <li>If Pancake is not running in a devbox shell (i.e. <code>ANTHROPIC_BASE_URL</code> is not set), requests will return a <code>503</code> error and Claude will not respond.</li>
          </ul>
          <p className="how-to-note">
            <strong>Note:</strong> Auth mode is stored in <code>localStorage</code> and persists across page refreshes. If you switch machines or leave your devbox session, switch back to API Key mode to avoid failed requests.
          </p>
        </section>

        <section id="session-tiles">
          <h2>Session tiles</h2>
          <ul>
            <li>Each tile is one fully independent session with its own conversation history, model, and tool access.</li>
            <li><strong>Click</strong> anywhere on a tile to focus it. The focused tile has a brown outline.</li>
            <li><strong>Double-click</strong> the session name to rename it inline.</li>
            <li>The <strong>status bar</strong> below the tile header shows what the agent is currently doing (Idle, Thinking, Using tool, Done, or an error). A small <strong>orange pulsing dot</strong> appears at the left of the status bar when the session has a new response you haven't seen — it clears automatically when you focus the tile or send it a message.</li>
            <li>Tiles do <strong>not</strong> auto-scroll when agents respond. Scroll position is fully manual, so multiple active agents won't fight over the view.</li>
            <li>Click <strong>⊞</strong> or press <code>Shift+Ctrl+F</code> to expand a tile to full screen. Press <strong>Esc</strong> or <code>Shift+Ctrl+F</code> again, or click <strong>⊡</strong>, to minimize.</li>
            <li>Drag the <strong>⠿</strong> handle to reorder tiles in the grid.</li>
            <li>Click <strong>✕</strong> to close a session permanently.</li>
            <li>The grid layout is switchable — see <a href="#layout">Layout modes</a> below.</li>
          </ul>

          <h3 id="claude-code-sessions">Claude Code sessions</h3>
          <p>
            Claude Code sessions run the local Claude Code CLI (<code>claude</code>) inside a full PTY terminal rendered with xterm.js. The binary is resolved from your <code>PATH</code>, or you can set <code>CLAUDE_PATH</code> to override. They behave like a real terminal tab embedded in the grid.
          </p>
          <ul>
            <li>Identified by the <strong>≥_</strong> badge in the tile header. The current working directory of the PTY process is displayed in the status bar.</li>
            <li>All input goes directly to the PTY — type in the terminal just as you would in a dedicated terminal window.</li>
            <li>Pancake hotkeys (navigation, expand, etc.) still work: they are intercepted before reaching the PTY so they do not interfere with the terminal session.</li>
            <li>Click <strong>⊞</strong> or press <code>Ctrl+Shift+F</code> to expand — the terminal resizes automatically to fill the screen.</li>
            <li>Claude Code sessions have an <strong>AIO badge</strong> and can participate in agent interoperability (see below). Messages sent via <code>send_message_to_agent</code> are injected directly into the terminal as typed input.</li>
            <li>Claude Code sessions are automatically informed about <strong>AIO REST endpoints</strong> on the Pancake server via a system prompt injection. They can call <code>curl http://127.0.0.1:4174/aio/list-agents</code> (and the other <code>/aio/*</code> endpoints) to list, create, and message other sessions — including spawning new Claude Code sessions.</li>
            <li>Claude Code sessions do <strong>not</strong> have an FS access badge or PFS/LFS dot indicators — filesystem access is managed by Claude Code itself.</li>
            <li>Click <strong>✕</strong> to close the tile — this kills the underlying PTY process immediately.</li>
          </ul>

          <h3 id="interop-badge">AIO badge</h3>
          <p>
            Each tile also has an <strong>AIO badge</strong> (Agent Interoperability) in its header, controlling whether that session can use the agent interoperability tools. Click it to open a dropdown:
          </p>
          <ul>
            <li><strong>Default (on/off)</strong> — inherits the global default set in Config</li>
            <li><strong>On</strong> — interop tools always enabled for this session, regardless of global setting</li>
            <li><strong>Off</strong> — interop tools always disabled for this session, regardless of global setting</li>
          </ul>

          <h3 id="fs-badge">FS access badge</h3>
          <p>
            Each tile has an <strong>FS badge</strong> in its header that controls the local filesystem access level for that session. Click it to change:
          </p>
          <ul>
            <li><strong>FS: off</strong> — no local filesystem tools (default)</li>
            <li><strong>FS: read</strong> — agent can read files and list directories</li>
            <li><strong>FS: r/w</strong> — agent can read, write, create, and move files</li>
            <li><strong>FS: r/w/d</strong> — agent can also permanently delete files (use with care)</li>
          </ul>
          <p>
            This only affects local filesystem (LFS) access — it has no effect on Pancake's virtual filesystem (PFS). Claude Code session tiles do not show this badge.
          </p>

          <h3 id="pfs-lfs-dots">PFS / LFS session indicators</h3>
          <p>
            Two small colored dots may appear in the tile header next to the session name:
          </p>
          <ul>
            <li><strong>Green dot (PFS)</strong> — Pancake's Filesystem was enabled when this session was created</li>
            <li><strong>Blue dot (LFS)</strong> — Local Filesystem was enabled when this session was created</li>
          </ul>
          <p>
            These are read-only indicators. They record what was active at creation time so you always know the intended context of that session. The current FS access level is still controlled by the FS badge. Claude Code session tiles do not show these dots.
          </p>
        </section>

        <section id="broadcasting">
          <h2>Multi-session broadcasting</h2>
          <p>
            Select multiple tiles to send the same message to all of them at once.
          </p>
          <ul>
            <li>Use <code>Shift+Arrow</code> to build a selection. Both the origin and destination tiles are added.</li>
            <li>Selected tiles are highlighted in <strong>yellow</strong>. The focused tile keeps its brown outline even when selected.</li>
            <li>When multiple tiles are selected, all their chat inputs mirror what you type. Press <strong>Enter</strong> to send to all selected sessions simultaneously.</li>
            <li>Press <code>Shift+F</code> to clear the selection.</li>
          </ul>
        </section>

        <section id="filesystems">
          <h2>Filesystems</h2>
          <p>
            Pancake provides two independent filesystems, both controlled from the <strong>Filesystem page</strong> in the nav and toggled globally from the header.
          </p>
          <p className="how-to-note">
            <strong>Per-session access is fixed at creation time.</strong> Each session's PFS and LFS access is determined when it is created — toggling PFS or LFS globally afterward does not affect existing sessions. If you open a session while PFS is off, that session will never have PFS access even if you enable PFS later. Start a new session after toggling to pick up the new settings.
          </p>

          <h3 id="pfs">PFS — Pancake's Filesystem (virtual)</h3>
          <p>
            A private, in-memory filesystem that lives entirely inside the app. Files exist only while the page is open — nothing is read from or written to your actual machine.
          </p>
          <ul>
            <li>Toggle with the <strong>PFS button</strong> (top-right header). Green = enabled.</li>
            <li>Upload files or entire folders by dragging onto the drop zone, clicking it, or clicking <strong>Upload files</strong>. Folders are uploaded recursively with their structure preserved (e.g. <code>src/utils/helper.js</code>).</li>
            <li>Files appear in a collapsible tree view. Click a folder's <strong>▶ / ▼</strong> to expand or collapse it.</li>
            <li>Click a file name to preview its text content inline. Binary files show a type badge and can be downloaded but not previewed.</li>
            <li>Each file has a <strong>dl</strong> button to download it and an <strong>rm</strong> button to remove it.</li>
            <li>When PFS is enabled, agents gain access to these tools:
              <ul>
                <li><code>list_virtual_files</code> — list all uploaded files</li>
                <li><code>read_virtual_file(name)</code> — read a file's content by name or path</li>
                <li><code>move_virtual_file(from, to)</code> — rename or move a file within PFS</li>
                <li><code>delete_virtual_file(name)</code> — request deletion (you must confirm)</li>
              </ul>
            </li>
            <li>If PFS is disabled, agents cannot access virtual files and will tell you so.</li>
          </ul>
          <p className="how-to-note">
            <strong>Note:</strong> PFS and the Notepad are completely separate. The Notepad is a text scratch pad. PFS holds files you upload (code, documents, data). Agents can access both and may occasionally confuse the two, but I'm working on it ;). 
          </p>

          <h3 id="lfs">LFS — Local Filesystem (real machine)</h3>
          <p>
            A bridge to a real directory on your machine, served by a local Express server Pancake starts automatically. Changes made via LFS tools affect actual files on disk.
          </p>
          <ul>
            <li>Toggle with the <strong>LFS button</strong> (top-right header). Blue = enabled.</li>
            <li>Set the <strong>root directory</strong> on the Filesystem page — agents are scoped to this folder. All paths are relative to it.</li>
            <li>The level of access is controlled per-session by the <strong>FS badge</strong> on each tile (off / read / r/w / r/w/d).</li>
            <li>When LFS is enabled and the FS badge is not "off", agents can use:
              <ul>
                <li><code>read_file(path)</code>, <code>list_directory(path)</code>, <code>file_exists(path)</code></li>
                <li><code>write_file(path, content)</code>, <code>create_directory(path)</code>, <code>move_file(from, to)</code> (r/w and above)</li>
                <li><code>delete_file(path)</code> (r/w/d only — permanent, cannot be undone)</li>
              </ul>
            </li>
            <li>If LFS is disabled or the FS badge is "off", agents cannot access local files and will tell you so.</li>
            <li>Requires <code>npm run dev</code> (development) or <code>npx pancake</code> (production) — both start the FS server automatically.</li>
            <li>Setting the root to <code>/</code> or your home directory will show a warning — use a specific project folder instead.</li>
          </ul>

          <h3 id="both-fs">Using both filesystems together</h3>
          <p>
            Agents understand both filesystems simultaneously. For example:
          </p>
          <ul>
            <li>"Read <code>schema.sql</code> from Pancake's filesystem and write it to my local project folder."</li>
            <li>"List my local project files and summarize the ones I've uploaded to Pancake's filesystem."</li>
          </ul>
          <p>
            If a request is ambiguous and a filename exists in both, the agent will ask which one you mean. Once clarified, it won't ask again for that conversation.
          </p>

          <h3 id="default-lfs">Default LFS access for new sessions</h3>
          <p>
            The <strong>LFS default</strong> dropdown in the header sets the FS access level that new sessions start with. Individual sessions can still be changed after creation via their tile's FS badge.
          </p>
        </section>

        <section id="agent-interop">
          <h2>Agent interoperability</h2>
          <p>
            Agents can directly interact with other agent sessions running in the same Pancake workspace. Each session can list, read the chat history of, send messages to, create, and delete other sessions — all through Claude tool calls, without any user involvement.
          </p>
          <p>
            This enables multi-agent workflows where sessions divide up tasks, hand off work, review each other's output, or dynamically spawn and clean up helpers as needed.
          </p>

          <h3 id="interop-tools">Agent tools</h3>
          <p>When agent interop is enabled for a session, five tools become available:</p>
          <ul>
            <li>
              <code>list_agents</code> — returns a list of all other open sessions with their id, name, model (<code>claude code</code> for Claude Code sessions), session type, status, streaming state, and message count. This is the starting point for any inter-agent workflow: the agent uses the name to identify the right target and the id to call the other tools.
            </li>
            <li>
              <code>read_agent_chat(agent_id)</code> — returns the full conversation history of another session as an array of <code>{'{role, content}'}</code> messages. For Claude Code sessions, returns a descriptive note instead of a message array (the terminal history is not accessible as structured chat).
            </li>
            <li>
              <code>send_message_to_agent(agent_id, message, await_response?)</code> — injects a user-role message into another session, triggering that agent to respond. By default this is fire-and-forget: the tool returns immediately and both sessions run in parallel. Set <code>await_response: true</code> to block until the target agent finishes responding, then receive its reply text directly in the tool result. For Claude Code sessions, the message is injected directly into the terminal as typed input (as if the user typed it). Cannot send to self or to a session that is currently streaming.
            </li>
            <li>
              <code>create_agent(name?, model?, session_type?, cwd?)</code> — creates a new session tile in the workspace. <code>name</code> defaults to "Session N" and <code>model</code> defaults to the app's configured default. Set <code>session_type</code> to <code>'claude-code'</code> to spawn a Claude Code terminal session; optionally provide <code>cwd</code> as the working directory for the new terminal. Returns the new session's id, name, and model so the agent can immediately start working with it.
            </li>
            <li>
              <code>delete_agent(agent_id)</code> — closes another session and permanently erases its chat history. Cannot delete self or a currently streaming session. Triggers a confirmation dialog (see below). Cannot be undone.
            </li>
          </ul>

          <h3 id="interop-cc-rest">Claude Code AIO (REST endpoints)</h3>
          <p>
            Chat sessions use AIO via tool calls injected into the system prompt. Claude Code sessions cannot use those tools directly, so Pancake exposes equivalent functionality as REST endpoints on the local server. CC sessions are automatically informed about these endpoints when they start (via <code>--append-system-prompt</code>) and can call them with <code>curl</code>.
          </p>
          <ul>
            <li><code>GET /aio/list-agents</code> — returns a JSON array of all sessions with their id, name, model, status, and session type.</li>
            <li><code>GET /aio/read-agent?agentId=uuid</code> — reads another session's content. For chat sessions, returns the full message history. For Claude Code sessions, returns the recent terminal output (ANSI codes stripped).</li>
            <li><code>POST /aio/create-agent</code> — creates a new session. Body: <code>{'{"name": "Worker", "sessionType": "claude-code", "cwd": "/path"}'}</code>. Returns the new session's id and name.</li>
            <li><code>POST /aio/send-message</code> — sends a message to another session. Body: <code>{'{"agentId": "uuid", "message": "text"}'}</code>. For Claude Code targets, the message is injected directly into the PTY and submitted automatically. For Chat targets, it triggers a normal message send.</li>
          </ul>
          <p>
            Example from inside a Claude Code session:
          </p>
          <pre style={{ fontSize: '0.8rem', background: 'var(--cream-dark, #f5ede4)', padding: '8px 12px', borderRadius: '5px', overflowX: 'auto' }}>
            {`curl -s http://127.0.0.1:4174/aio/list-agents | jq
curl -s -X POST http://127.0.0.1:4174/aio/create-agent \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Helper","sessionType":"claude-code"}'`}
          </pre>

          <h3 id="interop-toggle">Enabling / disabling</h3>
          <p>
            Agent interop follows the same two-level toggle pattern as LFS access:
          </p>
          <ul>
            <li><strong>Global default</strong> — the <strong>AIO button</strong> in the top-right header (lavender when on) toggles the default for all new sessions. The same setting is also accessible in <strong>Config (⚙)</strong> via the "Agent Interoperability" checkbox. On by default.</li>
            <li><strong>Per-session override</strong> — the <strong>AIO badge</strong> on each tile header. Click it to choose Default / On / Off for that session specifically, overriding the global setting. A session set to Off will never receive the interop tools in its system prompt, even if the global default is On.</li>
          </ul>
          <p className="how-to-note">
            <strong>Note:</strong> The interop toggle only controls whether the <em>calling</em> session has access to the tools. Any session can be read or messaged regardless of its own toggle — the toggle is not a privacy control, it is a capability control.
          </p>

          <h3 id="interop-messages">Injected messages</h3>
          <p>
            When an agent uses <code>send_message_to_agent</code>, the message appears in the target session's chat window as a normal user-role message, with a small italic annotation below the role label:
          </p>
          <ul>
            <li>The annotation reads: <em>sent by "Agent Name"</em> — showing which session sent it.</li>
            <li>The injected message appears in the target's tile just like any user message, and the target agent's response appears normally.</li>
            <li>Injected messages are stripped of metadata before being sent to the Claude API — they appear to Claude as plain user messages.</li>
          </ul>

          <h3 id="interop-delete-confirm">Delete confirmation</h3>
          <p>
            When an agent calls <code>delete_agent</code>, a confirmation dialog appears before anything is deleted:
          </p>
          <ul>
            <li>Click <strong>Cancel</strong> to abort — the tool returns an error and the agent is informed.</li>
            <li>Click <strong>Delete</strong> to proceed — the session is closed immediately.</li>
            <li>Check <strong>Don't ask me again this session</strong> to suppress the dialog for all subsequent <code>delete_agent</code> calls during the current page session. This resets on page reload.</li>
          </ul>
        </section>

        <section id="session-groups">
          <h2>Session groups</h2>
          <p>
            Organize your sessions visually by creating named groups. Groups are purely aesthetic — they help you keep related sessions together without affecting any functionality.
          </p>
          <ul>
            <li>Click <strong>+ Group</strong> above the session grid to create a new group. Type a name and press Enter.</li>
            <li><strong>Drag sessions</strong> between groups by dragging a tile onto another group's area or onto a tile already in that group.</li>
            <li>Click the <strong>▸/▾</strong> arrow to collapse or expand a group.</li>
            <li><strong>Double-click</strong> a group name to rename it.</li>
            <li>Click <strong>✕</strong> on a group header to delete the group — sessions move back to the ungrouped section.</li>
            <li>Sessions not assigned to any group appear in an <strong>Ungrouped</strong> section at the bottom (only visible when groups exist).</li>
            <li>Groups persist across page refreshes when <strong>STO</strong> is enabled.</li>
          </ul>
        </section>

        <section id="layout">
          <h2>Layout modes</h2>
          <p>
            The layout toggle in the nav bar (between the nav links and the header controls) switches the session grid between two modes:
          </p>
          <ul>
            <li><strong>Wide</strong> (default) — 4 columns, compact tile height. Best for monitoring many sessions at a glance.</li>
            <li><strong>Tall</strong> — 2 columns, tiles fill roughly half the viewport height. Better for reading longer conversations or working with fewer sessions in more detail.</li>
          </ul>
          <p>
            The two small icons in the toggle visually represent each layout — four thin bars for wide, two wider bars for tall. The active layout is highlighted.
          </p>
        </section>

        <section id="notepad">
          <h2>Notepad</h2>
          <p>
            A markdown supported shared text space for notes, prompts, context, or anything else you can dream of. I personally wanted a place to put things, and also agents have access to read from and write to the notepad!
          </p>
          <ul>
            <li>Click <strong>Notepad</strong> in the nav for the full-page editor.</li>
            <li>Press <code>Shift+Ctrl+X</code> to toggle a <strong>floating Notepad window</strong> you can drag anywhere on screen.</li>
            <li>Drag any <strong>edge or corner</strong> of the floating window to resize it freely. Minimum size is 220×180px.</li>
            <li>The floating window and the Notepad page share the same content — edits appear instantly in both.</li>
            <li>Click <strong>Preview</strong> to render as Markdown; click <strong>Edit</strong> to return to editing.</li>
            <li>When <strong>STO</strong> (session persistence) is enabled, Notepad content persists across page refreshes. When STO is off, content lives in memory only.</li>
          </ul>
          <h3>Agent Notepad tools</h3>
          <ul>
            <li><code>read_notepad</code> — reads the current Notepad contents</li>
            <li><code>write_notepad</code> — overwrites the Notepad with new content</li>
          </ul>
          <p>
            Multiple agents can collaborate through the Notepad — one writes a plan, another reads and continues. Tell an agent naturally: "Write a summary to the notepad" or "Read the notepad and continue from where we left off."
          </p>
        </section>

        <section id="header-controls">
          <h2>Header controls</h2>
          <table>
            <thead>
              <tr><th>Control</th><th>What it does</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Layout toggle</strong> (wide / tall icons)</td><td>Switch the session grid between 4-column wide and 2-column tall layouts</td></tr>
              <tr><td><strong>?</strong></td><td>Toolbar guide — click to show a quick reference popover explaining what each header button does</td></tr>
              <tr><td><strong>PFS</strong> (green when on)</td><td>Toggle Pancake's virtual filesystem globally for new sessions</td></tr>
              <tr><td><strong>LFS</strong> (blue when on)</td><td>Toggle local filesystem bridge globally for new sessions</td></tr>
              <tr><td><strong>AIO</strong> (lavender when on)</td><td>Toggle agent interoperability globally — the default for new sessions. Per-session overrides can still be set on each tile's Interop badge.</td></tr>
              <tr><td><strong>STO</strong> (cyan when on)</td><td>Session persistence — when enabled, sessions survive page refreshes. When disabled, sessions are lost on reload.</td></tr>
              <tr><td><strong>LFS default: …</strong></td><td>Set the default FS access level for new sessions (LFS only)</td></tr>
              <tr><td><strong>■</strong></td><td>Emergency stop — immediately aborts all actively streaming agents. Disabled (greyed out) when no agents are running. Useful when agents are spawning sub-agents uncontrollably.</td></tr>
              <tr><td><strong>↺</strong></td><td>Reset everything — sessions, notes, and settings (confirmation required)</td></tr>
              <tr><td><strong>⚙</strong></td><td>Open Config — API key, default model, agent interop default, hotkeys</td></tr>
            </tbody>
          </table>
        </section>

        <section id="shortcuts">
          <h2>Keyboard shortcuts</h2>
          <table>
            <thead>
              <tr><th>Default key</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td><code>Alt+ArrowRight</code></td><td>Move focus to next tile (right)</td></tr>
              <tr><td><code>Alt+ArrowLeft</code></td><td>Move focus to previous tile (left)</td></tr>
              <tr><td><code>Alt+ArrowDown</code></td><td>Move focus down one row</td></tr>
              <tr><td><code>Alt+ArrowUp</code></td><td>Move focus up one row</td></tr>
              <tr><td><code>Shift+Arrow</code></td><td>Select current + adjacent tile, move focus</td></tr>
              <tr><td><code>Shift+F</code></td><td>Clear tile selection</td></tr>
              <tr><td><code>Shift+Ctrl+F</code></td><td>Expand / minimize focused tile</td></tr>
              <tr><td><code>Ctrl+Shift+N</code></td><td>Open new session dialog (press again to toggle Chat / Claude Code)</td></tr>
              <tr><td><code>Shift+Ctrl+X</code></td><td>Toggle floating Notepad window</td></tr>
              <tr><td><code>Enter</code></td><td>Send message (in chat input)</td></tr>
              <tr><td><code>Esc</code></td><td>Minimize expanded tile / close floating Notepad / close modal</td></tr>
            </tbody>
          </table>
          <p>All hotkeys except <code>Enter</code> and <code>Esc</code> are configurable in the Config menu.</p>
        </section>

        <section id="persistence">
          <h2>Persistence &amp; privacy</h2>
          <ul>
            <li><strong>Sessions, Notepad, and session groups</strong> reset on page refresh by default. Enable <strong>STO</strong> in the header to persist all of these across refreshes.</li>
            <li><strong>API key, model, hotkeys, FS settings, and FS toggles</strong> persist in <code>localStorage</code> and survive page refreshes.</li>
            <li><strong>Pancake's virtual filesystem</strong> (uploaded files) does not persist across page refreshes.</li>
            <li><strong>Local filesystem root</strong> is restored on startup if LFS was previously enabled.</li>
            <li>Your API key is stored only in your browser and sent only to the Anthropic API — never to any other server.</li>
            <li>The local FS server binds to <code>127.0.0.1</code> only and is not accessible from other machines on your network.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
