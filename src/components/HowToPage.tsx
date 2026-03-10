export default function HowToPage() {
  return (
    <div className="how-to-page">
      <h1>How To Use Pancake</h1>

      <section>
        <h2>What is this?</h2>
        <p>
          Pancake is a local web app for running multiple AI agent sessions side by side.
          Each session is an independent conversation with an AI model. You can use them for
          different tasks simultaneously — writing, coding, research, brainstorming — without
          losing context between sessions.
        </p>
      </section>

      <section>
        <h2>Getting started</h2>
        <ol>
          <li>Click the <strong>⚙ icon</strong> (top right) to open Config. Enter your API key and choose a default model, then click <strong>Save</strong>. Press <strong>Esc</strong> to close without saving.</li>
          <li>Click <strong>+</strong> (bottom right) or press <code>Ctrl+Shift+N</code> to create a new session. Enter an optional name, choose a model, and press <strong>Enter</strong> or click <strong>Create</strong>.</li>
          <li>Click a tile or use <code>Alt+Arrow</code> to focus it, then type in the chat input and press <strong>Enter</strong> to send a message.</li>
        </ol>
      </section>

      <section>
        <h2>Session tiles</h2>
        <ul>
          <li>Each tile is one independent session with its own conversation history and model.</li>
          <li><strong>Click</strong> anywhere on a tile to focus it. The focused tile has a <strong>brown</strong> outline.</li>
          <li><strong>Double-click</strong> the session name to rename it inline.</li>
          <li>The <strong>status bar</strong> below the tile title shows what the agent is currently doing.</li>
          <li>Click <strong>⊞</strong> or press <code>Shift+Ctrl+F</code> to expand a tile to full screen. The chat input is focused automatically. Press <strong>Esc</strong> or <code>Shift+Ctrl+F</code> again, or click <strong>⊡</strong>, to minimize.</li>
          <li>Drag the <strong>⠿</strong> handle to reorder tiles in the grid.</li>
          <li>Click <strong>✕</strong> to close a session.</li>
          <li>The grid fits <strong>4 tiles per row</strong>. Tiles have a fixed height and scroll internally.</li>
        </ul>
      </section>

      <section>
        <h2>Multi-session broadcasting</h2>
        <p>
          Select multiple tiles to send the same message to all of them simultaneously.
        </p>
        <ul>
          <li>Use <code>Shift+Arrow</code> to build a selection. Both the origin tile and the destination tile are added automatically.</li>
          <li>Selected tiles are highlighted in <strong>yellow</strong>. The focused tile keeps its <strong>brown</strong> outline even when selected.</li>
          <li>When multiple tiles are selected, all their chat inputs mirror what you type. Press <strong>Enter</strong> to send to all of them at once.</li>
          <li>Press <code>Shift+F</code> to clear the selection.</li>
          <li>Switching focus with <code>Alt+Arrow</code> clears any text you were typing but does not deselect tiles.</li>
        </ul>
      </section>

      <section>
        <h2>Notepad</h2>
        <p>
          Notepad is a shared scratch space for notes, prompts, or anything else. It supports markdown. Agents can read and write it as a tool.
        </p>
        <ul>
          <li>Click <strong>Notepad</strong> in the nav to open the full-page editor.</li>
          <li>Press <code>Shift+Ctrl+X</code> (configurable) to toggle a small <strong>floating Notepad window</strong> that you can drag anywhere on screen. It stays open while you work in sessions.</li>
          <li>The floating window and the Notepad page share the same content — edits in one appear in the other.</li>
          <li>Click <strong>Preview</strong> to render the text as markdown. Click <strong>Edit</strong> to go back.</li>
          <li>Press <strong>Esc</strong> while the floating Notepad is open to close it.</li>
          <li>Content is kept in memory and lost on page refresh.</li>
        </ul>
        <h3>Agent notepad access</h3>
        <p>
          Every agent session has access to two tools it can call autonomously:
        </p>
        <ul>
          <li><code>read_notepad</code> — reads the current contents of the Notepad.</li>
          <li><code>write_notepad</code> — overwrites the Notepad with new content. The agent reads first and then writes if it wants to append.</li>
        </ul>
        <p>
          To trigger notepad access, just tell an agent naturally — e.g. "Read the notepad" or "Write a summary to the notepad". When an agent calls a tool, the tile's status bar shows <em>"Using tool: read_notepad..."</em> or <em>"Using tool: write_notepad..."</em>. After the tool result is returned, the agent continues its response automatically. Notepad updates appear in real time in both the floating window and the Notepad page.
        </p>
        <p>
          This means multiple agents can collaborate through the shared Notepad — one writes a plan, another reads it and builds on it.
        </p>
      </section>

      <section>
        <h2>Config &amp; reset</h2>
        <ul>
          <li>Click <strong>⚙</strong> (top right) to open the Config modal. You can set your API key, default model, and customize all hotkeys. Press <strong>Esc</strong> or <strong>Cancel</strong> to close without saving.</li>
          <li>Click the <strong>↺ reset button</strong> (next to ⚙) to wipe everything — all sessions, notes, and settings are cleared and reset to defaults. A confirmation prompt appears first.</li>
          <li>Your API key is stored only in your browser's <code>localStorage</code> and is never sent anywhere except the Anthropic API.</li>
        </ul>
      </section>

      <section>
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
            <tr><td><code>Shift+ArrowRight</code></td><td>Select current + right tile, move focus right</td></tr>
            <tr><td><code>Shift+ArrowLeft</code></td><td>Select current + left tile, move focus left</td></tr>
            <tr><td><code>Shift+ArrowDown</code></td><td>Select current + tile below, move focus down</td></tr>
            <tr><td><code>Shift+ArrowUp</code></td><td>Select current + tile above, move focus up</td></tr>
            <tr><td><code>Shift+F</code></td><td>Deselect all tiles</td></tr>
            <tr><td><code>Shift+Ctrl+F</code></td><td>Expand / minimize focused tile</td></tr>
            <tr><td><code>Ctrl+Shift+N</code></td><td>Open new session dialog</td></tr>
            <tr><td><code>Shift+Ctrl+X</code></td><td>Toggle floating Notepad window</td></tr>
            <tr><td><code>Enter</code></td><td>Send message (in chat input)</td></tr>
            <tr><td><code>Esc</code></td><td>Minimize expanded tile / close floating Notepad / close modal</td></tr>
          </tbody>
        </table>
        <p>All hotkeys except <code>Enter</code> and <code>Esc</code> are fully configurable in the Config menu.</p>
      </section>

      <section>
        <h2>Notes</h2>
        <ul>
          <li>Sessions and Notepad content <strong>are not persisted</strong> across page refreshes.</li>
          <li>API keys <strong>are persisted</strong> across page refreshes.</li>
          <li>Responses stream in real time. Markdown is rendered in the chat window and Notepad preview.</li>
          <li>The floating Notepad remembers its position within a session but resets to its default position after a page refresh.</li>
        </ul>
      </section>
    </div>
  )
}
