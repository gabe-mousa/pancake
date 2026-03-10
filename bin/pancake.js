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

console.log(`\nStarting Pancake on http://localhost:${port}\n`)

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

preview.on('close', code => process.exit(code ?? 0))

process.on('SIGINT', () => {
  preview.kill('SIGINT')
  process.exit(0)
})
