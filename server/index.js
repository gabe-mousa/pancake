#!/usr/bin/env node
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

// Start server — try port, fallback up to 5 times on EADDRINUSE
function listen(port, attempt = 0) {
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`[FS Server] listening on http://127.0.0.1:${port}`)
    // Communicate final port to parent process if different from requested
    if (port !== fsPort) {
      process.stdout.write(`__FS_PORT__:${port}\n`)
    }
  })
  server.on('error', e => {
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
