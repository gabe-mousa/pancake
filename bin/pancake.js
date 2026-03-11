#!/usr/bin/env node
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync, spawn } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = resolve(root, 'dist')

// Build if dist doesn't exist
if (!existsSync(dist)) {
  console.log('Building Pancake...')
  const result = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    console.error('Build failed.')
    process.exit(1)
  }
}

const port = process.env.PORT || 4173
const fsPort = parseInt(process.env.FS_PORT || '4174', 10)
const fsRoot = process.env.FS_ROOT || process.cwd()
const serverScript = resolve(root, 'server', 'index.js')

console.log(`\nStarting Pancake on http://localhost:${port}\n`)

// Start the FS bridge server
const fsServer = spawn(
  'node',
  [serverScript, '--root', fsRoot, '--port', String(fsPort)],
  { cwd: root, stdio: 'inherit' }
)

fsServer.on('error', err => {
  console.error(`[FS Server] failed to start: ${err.message}`)
})

// Open browser after short delay
setTimeout(() => {
  const url = `http://localhost:${port}`
  const opener =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open'
  spawn(opener, [url], { shell: true, detached: true, stdio: 'ignore' }).unref()
}, 800)

// Resolve vite bin directly to avoid shell: true
const viteBin = resolve(root, 'node_modules', '.bin', 'vite')

// Start vite preview
const preview = spawn(
  viteBin,
  ['preview', '--port', String(port), '--host'],
  { cwd: root, stdio: 'inherit' }
)

preview.on('close', code => {
  fsServer.kill()
  process.exit(code ?? 0)
})

function shutdown() {
  preview.kill('SIGINT')
  fsServer.kill('SIGINT')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
