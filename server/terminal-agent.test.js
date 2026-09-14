import test from 'node:test'
import assert from 'node:assert/strict'
import { getTerminalAgentConfig } from './terminal-agent.js'

test('builds the Claude Code launch command with AIO instructions', () => {
  assert.deepEqual(getTerminalAgentConfig('claude-code', 'AIO', {}), {
    displayName: 'Claude Code',
    binary: 'claude',
    args: ['--append-system-prompt', 'AIO'],
  })
})

test('builds the Codex launch command with developer instructions', () => {
  assert.deepEqual(getTerminalAgentConfig('codex', 'AIO\nwith "quotes"', {}), {
    displayName: 'Codex',
    binary: 'codex',
    args: ['-c', 'developer_instructions="AIO\\nwith \\"quotes\\""'],
  })
})

test('honors CLI path overrides', () => {
  assert.equal(getTerminalAgentConfig('claude-code', '', { CLAUDE_PATH: '/bin/claude' }).binary, '/bin/claude')
  assert.equal(getTerminalAgentConfig('codex', '', { CODEX_PATH: '/bin/codex' }).binary, '/bin/codex')
})

test('rejects unknown terminal session types', () => {
  assert.throws(() => getTerminalAgentConfig('chat', '', {}), /Unsupported terminal session type/)
})
