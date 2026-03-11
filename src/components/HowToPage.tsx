export default function HowToPage() {
  return (
    <div className="how-to-layout">
      <nav className="how-to-toc">
        <p className="toc-heading">Contents</p>
        <ul>
          <li><a href="#what-is-pancake">What is Pancake?</a></li>
          <li><a href="#getting-started">Getting started</a></li>
          <li><a href="#session-tiles">Session tiles</a>
            <ul>
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
            context between them. Agents can autonomously read and write files, use the Notepad, and more.
          </p>
        </section>

        <section id="getting-started">
          <h2>Getting started</h2>
          <ol>
            <li>Click <strong>⚙</strong> (top right) to open Config. Enter your Anthropic API key and choose a default model, then click <strong>Save</strong>.</li>
            <li>Click <strong>+</strong> (bottom right) or press <code>Ctrl+Shift+N</code> to create a new session. Give it an optional name, pick a model, and press <strong>Enter</strong> or click <strong>Create</strong>.</li>
            <li>Click a tile to focus it, then type in the chat input and press <strong>Enter</strong> to send.</li>
          </ol>
        </section>

        <section id="session-tiles">
          <h2>Session tiles</h2>
          <ul>
            <li>Each tile is one fully independent session with its own conversation history, model, and tool access.</li>
            <li><strong>Click</strong> anywhere on a tile to focus it. The focused tile has a brown outline.</li>
            <li><strong>Double-click</strong> the session name to rename it inline.</li>
            <li>The <strong>status bar</strong> below the tile header shows what the agent is currently doing (Idle, Thinking, Using tool, Done, or an error).</li>
            <li>Click <strong>⊞</strong> or press <code>Shift+Ctrl+F</code> to expand a tile to full screen. Press <strong>Esc</strong> or <code>Shift+Ctrl+F</code> again, or click <strong>⊡</strong>, to minimize.</li>
            <li>Drag the <strong>⠿</strong> handle to reorder tiles in the grid.</li>
            <li>Click <strong>✕</strong> to close a session permanently.</li>
            <li>The grid fits <strong>4 tiles per row</strong>. Tiles have a fixed height and scroll internally.</li>
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
            This only affects local filesystem (LFS) access — it has no effect on Pancake's virtual filesystem (PFS).
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
            These are read-only indicators. They record what was active at creation time so you always know the intended context of that session. The current FS access level is still controlled by the FS badge.
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

        <section id="notepad">
          <h2>Notepad</h2>
          <p>
            A markdown supported shared text space for notes, prompts, context, or anything else you can dream of. I personally wanted a place to put things, and also agents have access to read from and write to the notepad!
          </p>
          <ul>
            <li>Click <strong>Notepad</strong> in the nav for the full-page editor.</li>
            <li>Press <code>Shift+Ctrl+X</code> to toggle a <strong>floating Notepad window</strong> you can drag anywhere.</li>
            <li>The floating window and the Notepad page share the same content — edits appear instantly in both.</li>
            <li>Click <strong>Preview</strong> to render as Markdown; click <strong>Edit</strong> to return to editing.</li>
            <li>Content lives in memory only — it does not persist after a page refresh.</li>
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
              <tr><td><strong>PFS</strong> (green when on)</td><td>Toggle Pancake's virtual filesystem globally</td></tr>
              <tr><td><strong>LFS</strong> (blue when on)</td><td>Toggle local filesystem bridge globally</td></tr>
              <tr><td><strong>LFS default: …</strong></td><td>Set the default FS access level for new sessions (LFS only)</td></tr>
              <tr><td><strong>↺</strong></td><td>Reset everything — sessions, notes, and settings (confirmation required)</td></tr>
              <tr><td><strong>⚙</strong></td><td>Open Config — API key, default model, hotkeys</td></tr>
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
              <tr><td><code>Ctrl+Shift+N</code></td><td>Open new session dialog</td></tr>
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
            <li><strong>Sessions and Notepad</strong> reset on page refresh — they are not persisted.</li>
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
