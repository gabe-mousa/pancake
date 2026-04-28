#!/usr/bin/env node
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import http from 'http'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import pty from 'node-pty'

// Parse CLI args: --root <path> --port <number>
const args = process.argv.slice(2)
function getArg(name) {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = process.env.HOME || process.env.USERPROFILE || ''

let fsRoot = path.resolve(getArg('--root') || process.cwd())
const fsPort = parseInt(getArg('--port') || '4174', 10)

function warnIfSensitiveRoot(root) {
  if (root === '/' || root === HOME) {
    console.warn(`\n⚠️  WARNING: FS root is set to "${root}" — this gives the agent broad filesystem access.\n`)
  }
}
warnIfSensitiveRoot(fsRoot)
console.log(`\n[FS Server] root: ${fsRoot}`)
console.log(`[FS Server] port: ${fsPort}\n`)

// Path safety: validate every user-supplied path stays inside root
function safePath(root, userPath) {
  const resolved = path.resolve(root, userPath)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw Object.assign(new Error('Path outside root'), { code: 'OUTSIDE_ROOT' })
  }
  // Resolve symlinks only if path already exists (write targets may not exist yet)
  try {
    const real = fs.realpathSync(resolved)
    if (!real.startsWith(root + path.sep) && real !== root) {
      throw Object.assign(new Error('Symlink escapes root'), { code: 'OUTSIDE_ROOT' })
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  return resolved
}

// Binary detection: check first 8KB for null bytes
function isBinaryBuffer(buf) {
  const check = buf.slice(0, Math.min(8192, buf.length))
  for (let i = 0; i < check.length; i++) {
    if (check[i] === 0) return true
  }
  return false
}

const app = express()
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }))
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, root: fsRoot })
})

// Cybertron proxy — forwards Anthropic API requests through the devbox gateway
app.post('/api/v1/messages', async (req, res) => {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN || ''
  const customHeadersRaw = process.env.ANTHROPIC_CUSTOM_HEADERS || ''

  if (!baseUrl) {
    return res.status(503).json({ error: 'ANTHROPIC_BASE_URL is not set. Start Pancake from a devbox shell.' })
  }

  const extraHeaders = {}
  for (const line of customHeadersRaw.split('\n')) {
    const idx = line.indexOf(': ')
    if (idx > 0) extraHeaders[line.slice(0, idx).trim()] = line.slice(idx + 2).trim()
  }

  try {
    const upstream = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${authToken}`,
        'anthropic-version': '2023-06-01',
        ...extraHeaders,
      },
      body: JSON.stringify(req.body),
    })

    res.status(upstream.status)
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') res.setHeader(key, value)
    })

    if (!upstream.body) return res.end()

    const reader = upstream.body.getReader()
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) { res.end(); break }
        res.write(value)
      }
    }
    pump().catch(err => { console.error('[Cybertron proxy] stream error:', err.message); res.end() })
  } catch (err) {
    console.error('[Cybertron proxy] error:', err.message)
    res.status(502).json({ error: `Proxy error: ${err.message}` })
  }
})

// Set root dynamically
app.post('/fs/set-root', (req, res) => {
  const { path: newPath } = req.body
  if (!newPath || typeof newPath !== 'string') {
    return res.status(400).json({ error: 'path is required' })
  }
  const resolved = path.resolve(newPath)
  try {
    const stat = fs.statSync(resolved)
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' })
    }
  } catch {
    return res.status(400).json({ error: 'Path does not exist' })
  }
  fsRoot = resolved
  warnIfSensitiveRoot(fsRoot)
  console.log(`[FS Server] root updated to: ${fsRoot}`)
  res.json({ ok: true, resolved: fsRoot })
})

// Read file
app.get('/fs/read', (req, res) => {
  const userPath = req.query.path
  if (!userPath) return res.status(400).json({ error: 'path query param required' })
  try {
    const abs = safePath(fsRoot, userPath)
    const stat = fs.statSync(abs)
    if (stat.size > 1024 * 1024) {
      return res.status(413).json({ error: `File too large (${stat.size} bytes). Max is 1 MB.` })
    }
    const buf = fs.readFileSync(abs)
    if (isBinaryBuffer(buf)) {
      return res.status(415).json({ error: 'Binary file', sizeBytes: stat.size })
    }
    res.json({ content: buf.toString('utf8') })
  } catch (e) {
    if (e.code === 'OUTSIDE_ROOT') return res.status(403).json({ error: e.message })
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File not found' })
    res.status(500).json({ error: e.message })
  }
})

// Write file
app.post('/fs/write', (req, res) => {
  const { path: userPath, content } = req.body
  if (!userPath || content === undefined) return res.status(400).json({ error: 'path and content are required' })
  try {
    const abs = safePath(fsRoot, userPath)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf8')
    res.json({ ok: true })
  } catch (e) {
    if (e.code === 'OUTSIDE_ROOT') return res.status(403).json({ error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// List directory
app.get('/fs/list', (req, res) => {
  const userPath = req.query.path || '.'
  try {
    const abs = safePath(fsRoot, userPath)
    const entries = fs.readdirSync(abs, { withFileTypes: true }).map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      path: path.join(userPath, e.name),
    }))
    res.json({ entries })
  } catch (e) {
    if (e.code === 'OUTSIDE_ROOT') return res.status(403).json({ error: e.message })
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'Directory not found' })
    res.status(500).json({ error: e.message })
  }
})

// Make directory
app.post('/fs/mkdir', (req, res) => {
  const { path: userPath } = req.body
  if (!userPath) return res.status(400).json({ error: 'path is required' })
  try {
    const abs = safePath(fsRoot, userPath)
    fs.mkdirSync(abs, { recursive: true })
    res.json({ ok: true })
  } catch (e) {
    if (e.code === 'OUTSIDE_ROOT') return res.status(403).json({ error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// Delete file or directory
app.delete('/fs/delete', (req, res) => {
  const { path: userPath } = req.body
  if (!userPath) return res.status(400).json({ error: 'path is required' })
  try {
    const abs = safePath(fsRoot, userPath)
    fs.rmSync(abs, { recursive: true, force: true })
    res.json({ ok: true })
  } catch (e) {
    if (e.code === 'OUTSIDE_ROOT') return res.status(403).json({ error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// Move / rename
app.post('/fs/move', (req, res) => {
  const { from, to } = req.body
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' })
  try {
    const absFrom = safePath(fsRoot, from)
    const absTo = safePath(fsRoot, to)
    fs.mkdirSync(path.dirname(absTo), { recursive: true })
    fs.renameSync(absFrom, absTo)
    res.json({ ok: true })
  } catch (e) {
    if (e.code === 'OUTSIDE_ROOT') return res.status(403).json({ error: e.message })
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'Source not found' })
    res.status(500).json({ error: e.message })
  }
})

// Exists check
app.get('/fs/exists', (req, res) => {
  const userPath = req.query.path
  if (!userPath) return res.status(400).json({ error: 'path query param required' })
  try {
    const abs = safePath(fsRoot, userPath)
    res.json({ exists: fs.existsSync(abs) })
  } catch (e) {
    if (e.code === 'OUTSIDE_ROOT') return res.status(403).json({ error: e.message })
    res.status(500).json({ error: e.message })
  }
})

// PTY management for Claude Code sessions
const ptyMap = new Map()        // sessionId → ptyProcess
const ptyBuffers = new Map()    // sessionId → circular buffer of recent output (for reconnect replay)
const PTY_BUFFER_SIZE = 50000   // max chars to buffer per PTY

// Get the current working directory of a Claude Code PTY session
app.get('/terminal/cwd', async (req, res) => {
  const sessionId = req.query.sessionId
  if (!sessionId) return res.status(400).json({ error: 'sessionId query param required' })
  const p = ptyMap.get(sessionId)
  if (!p) return res.status(404).json({ error: 'No active terminal session with that id' })
  try {
    const pid = p.pid
    // Use lsof on macOS or readlink on Linux to find CWD of the process
    const { execSync } = await import('child_process')
    let cwd
    try {
      // Try Linux first (faster)
      cwd = execSync(`readlink -f /proc/${pid}/cwd`, { encoding: 'utf8', timeout: 2000 }).trim()
    } catch {
      // Fall back to lsof for macOS
      try {
        const output = execSync(`lsof -p ${pid} -Fn 2>/dev/null | grep '^n/' | head -1`, { encoding: 'utf8', timeout: 2000 }).trim()
        cwd = output.replace(/^n/, '')
      } catch {
        cwd = ''
      }
    }
    res.json({ cwd: cwd || '' })
  } catch {
    res.json({ cwd: '' })
  }
})

// Inject input into a Claude Code PTY session (used by agent interop)
app.post('/terminal/input', (req, res) => {
  const { sessionId, data } = req.body
  if (!sessionId || data === undefined) return res.status(400).json({ error: 'sessionId and data are required' })
  const p = ptyMap.get(sessionId)
  if (!p) return res.status(404).json({ error: 'No active terminal session with that id' })
  p.write(data)
  res.json({ ok: true })
})

// Helper: type text into a PTY character-by-character, then submit with Enter.
// Sends Escape first to dismiss any autocomplete popup, types chars with delays
// to avoid buffer issues, then sends \r (which Ink maps to 'return' key for submit).
function typeIntoPty(p, message) {
  return new Promise((resolve) => {
    const chars = [...message]
    let i = 0
    function typeNext() {
      if (i < chars.length) {
        p.write(chars[i])
        i++
        setTimeout(typeNext, 10)
      } else {
        // All text typed — now dismiss autocomplete and submit
        setTimeout(() => {
          p.write('\x1b')  // Escape — dismiss autocomplete popup
          setTimeout(() => {
            p.write('\r')  // Carriage return — Ink maps to 'return' key → submit
            resolve()
          }, 150)
        }, 200)
      }
    }
    typeNext()
  })
}

// Inject input into a Claude Code session by writing directly to the PTY.
// Types each character with small delays, sends Escape to dismiss autocomplete,
// then sends \r to submit.
app.post('/terminal/type', async (req, res) => {
  const { sessionId, message } = req.body
  if (!sessionId || !message) return res.status(400).json({ error: 'sessionId and message are required' })
  const p = ptyMap.get(sessionId)
  if (!p) return res.status(404).json({ error: 'No active terminal session with that id' })

  try {
    await typeIntoPty(p, message)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// AIO system prompt injected into Claude Code sessions
const aioSystemPrompt = `You are running inside Pancake, a multi-session AI workbench. You can interact with other sessions using these HTTP endpoints on localhost:4174:

- GET /aio/list-agents — List all sessions in the workspace
- GET /aio/read-agent?agentId=<uuid> — Read another session's content. Returns chat messages for chat sessions, or recent terminal output for Claude Code sessions.
- POST /aio/create-agent — Create a new session. Body: { "name": "string", "sessionType": "chat" | "claude-code", "cwd": "/optional/path" }
- POST /aio/send-message — Send a message to another session. Body: { "agentId": "uuid", "message": "text" }

Use curl to call these endpoints. Example: curl -s http://127.0.0.1:4174/aio/list-agents | jq`

// --- AIO Control WebSocket + REST endpoints ---
let controlWs = null                  // single frontend control connection
const pendingAioRequests = new Map()  // requestId → { res, timer }

function sendToControl(requestId, operation, params) {
  if (!controlWs || controlWs.readyState !== 1 /* WebSocket.OPEN */) {
    return null
  }
  controlWs.send(JSON.stringify({ type: 'aio_request', requestId, operation, params }))
  return true
}

// AIO REST endpoints — proxy to frontend via control WS
app.get('/aio/list-agents', (req, res) => {
  const requestId = crypto.randomUUID()
  if (!sendToControl(requestId, 'list_agents', {})) {
    return res.status(503).json({ error: 'No frontend connected' })
  }
  const timer = setTimeout(() => {
    pendingAioRequests.delete(requestId)
    res.status(504).json({ error: 'Timeout waiting for frontend response' })
  }, 10000)
  pendingAioRequests.set(requestId, { res, timer })
})

app.post('/aio/create-agent', (req, res) => {
  const { name, sessionType, cwd } = req.body || {}
  const requestId = crypto.randomUUID()
  if (!sendToControl(requestId, 'create_agent', { name, sessionType, cwd })) {
    return res.status(503).json({ error: 'No frontend connected' })
  }
  const timer = setTimeout(() => {
    pendingAioRequests.delete(requestId)
    res.status(504).json({ error: 'Timeout waiting for frontend response' })
  }, 10000)
  pendingAioRequests.set(requestId, { res, timer })
})

app.get('/aio/read-agent', (req, res) => {
  const agentId = req.query.agentId
  if (!agentId) return res.status(400).json({ error: 'agentId query param required' })

  // For CC targets with a PTY buffer, return the recent terminal output
  const buffer = ptyBuffers.get(agentId)
  if (buffer !== undefined) {
    // Strip ANSI escape sequences for readability
    const clean = buffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
    return res.json({ sessionType: 'claude-code', content: clean })
  }

  // For chat targets, proxy to frontend via control WS
  const requestId = crypto.randomUUID()
  if (!sendToControl(requestId, 'read_agent', { agentId })) {
    return res.status(503).json({ error: 'No frontend connected' })
  }
  const timer = setTimeout(() => {
    pendingAioRequests.delete(requestId)
    res.status(504).json({ error: 'Timeout waiting for frontend response' })
  }, 10000)
  pendingAioRequests.set(requestId, { res, timer })
})

app.post('/aio/send-message', async (req, res) => {
  const { agentId, message } = req.body || {}
  if (!agentId || !message) return res.status(400).json({ error: 'agentId and message are required' })

  // For CC targets with an active PTY, type directly into the PTY
  const p = ptyMap.get(agentId)
  if (p) {
    try {
      await typeIntoPty(p, message)
      return res.json({ ok: true, delivered: true })
    } catch (err) {
      return res.status(500).json({ error: String(err) })
    }
  }

  // For chat targets, forward to frontend
  const requestId = crypto.randomUUID()
  if (!sendToControl(requestId, 'send_message', { agentId, message })) {
    return res.status(503).json({ error: 'No frontend connected' })
  }
  const timer = setTimeout(() => {
    pendingAioRequests.delete(requestId)
    res.status(504).json({ error: 'Timeout waiting for frontend response' })
  }, 10000)
  pendingAioRequests.set(requestId, { res, timer })
})

const httpServer = http.createServer(app)

// Path-based WebSocket routing
const terminalWss = new WebSocketServer({ noServer: true })
const controlWss = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, 'http://127.0.0.1')
  if (pathname === '/ws/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request)
    })
  } else if (pathname === '/ws/control') {
    controlWss.handleUpgrade(request, socket, head, (ws) => {
      controlWss.emit('connection', ws, request)
    })
  } else {
    socket.destroy()
  }
})

// --- Control WebSocket handling ---
controlWss.on('connection', (ws) => {
  console.log('[AIO] Control WebSocket connected')
  controlWs = ws

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    if (msg.type === 'aio_response' && msg.requestId) {
      const pending = pendingAioRequests.get(msg.requestId)
      if (pending) {
        clearTimeout(pending.timer)
        pendingAioRequests.delete(msg.requestId)
        pending.res.json(msg.result ?? { ok: true })
      }
    }
  })

  ws.on('close', () => {
    console.log('[AIO] Control WebSocket disconnected')
    if (controlWs === ws) controlWs = null
  })
})

// --- Terminal WebSocket handling ---
// Track which WebSocket is attached to each PTY
const ptyWsMap = new Map()      // sessionId → ws

function attachWsToPty(ws, sid, ptyProcess) {
  // Remove old listener if any
  const oldDispose = ptyProcess._pancakeDispose
  if (oldDispose) oldDispose()

  const onData = (data) => {
    // Buffer output for reconnect replay
    let buf = ptyBuffers.get(sid) || ''
    buf += data
    if (buf.length > PTY_BUFFER_SIZE) buf = buf.slice(-PTY_BUFFER_SIZE)
    ptyBuffers.set(sid, buf)

    if (ws.readyState === ws.OPEN) ws.send(data)
  }
  ptyProcess.onData(onData)

  ptyProcess._pancakeDispose = () => {
    // node-pty doesn't expose removeListener, but replacing via attachWsToPty handles it
  }

  ptyWsMap.set(sid, ws)
}

terminalWss.on('connection', (ws) => {
  let sessionId = null

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    if (msg.type === 'reconnect') {
      sessionId = msg.sessionId
      const existing = ptyMap.get(sessionId)
      if (existing) {
        // Replay buffered output and reattach
        const buf = ptyBuffers.get(sessionId)
        if (buf) ws.send(buf)
        attachWsToPty(ws, sessionId, existing)
        ws.send(JSON.stringify({ type: 'reconnect_ok' }))
      } else {
        ws.send(JSON.stringify({ type: 'reconnect_failed' }))
      }
    } else if (msg.type === 'create') {
      sessionId = msg.sessionId
      const claudePath = process.env.CLAUDE_PATH || 'claude'
      const cwd = msg.cwd ? path.resolve(msg.cwd.replace(/^~/, process.env.HOME || '')) : process.cwd()

      const ccArgs = ['--append-system-prompt', aioSystemPrompt]

      let ptyProcess
      try {
        ptyProcess = pty.spawn(claudePath, ccArgs, {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd,
          env: process.env,
        })
      } catch (e) {
        ws.send(`\r\n\x1b[31m[Pancake] Failed to start Claude Code: ${e.message}\x1b[0m\r\n`)
        return
      }

      ptyMap.set(sessionId, ptyProcess)
      ptyBuffers.set(sessionId, '')
      attachWsToPty(ws, sessionId, ptyProcess)

      ptyProcess.onExit(() => {
        ptyMap.delete(sessionId)
        ptyBuffers.delete(sessionId)
        ptyWsMap.delete(sessionId)
        if (ws.readyState === ws.OPEN) ws.close()
      })
    } else if (msg.type === 'input') {
      const p = ptyMap.get(msg.sessionId)
      if (p) p.write(msg.data)
    } else if (msg.type === 'resize') {
      const p = ptyMap.get(msg.sessionId)
      if (p) p.resize(msg.cols, msg.rows)
    }
  })

  ws.on('close', () => {
    // Do NOT kill the PTY on disconnect — keep it alive for reconnection
    if (sessionId) {
      const currentWs = ptyWsMap.get(sessionId)
      if (currentWs === ws) ptyWsMap.delete(sessionId)
    }
  })
})

// Start server — try port, fallback up to 5 times on EADDRINUSE
function listen(port, attempt = 0) {
  httpServer.listen(port, '127.0.0.1', () => {
    console.log(`[FS Server] listening on http://127.0.0.1:${port}`)
    // Communicate final port to parent process if different from requested
    if (port !== fsPort) {
      process.stdout.write(`__FS_PORT__:${port}\n`)
    }
  })
  httpServer.on('error', e => {
    if (e.code === 'EADDRINUSE' && attempt < 4) {
      console.warn(`[FS Server] port ${port} in use, trying ${port + 1}`)
      listen(port + 1, attempt + 1)
    } else {
      console.error(`[FS Server] failed to bind: ${e.message}`)
      process.exit(1)
    }
  })
}

listen(fsPort)
