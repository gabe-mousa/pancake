const TERMINAL_AGENTS = {
  'claude-code': {
    displayName: 'Claude Code',
    defaultBinary: 'claude',
    envPath: 'CLAUDE_PATH',
    buildArgs: (aioInstructions) => ['--append-system-prompt', aioInstructions],
  },
  codex: {
    displayName: 'Codex',
    defaultBinary: 'codex',
    envPath: 'CODEX_PATH',
    buildArgs: (aioInstructions) => [
      '-c',
      `developer_instructions=${JSON.stringify(aioInstructions)}`,
    ],
  },
}

export function getTerminalAgentConfig(sessionType, aioInstructions, env = process.env) {
  const agent = TERMINAL_AGENTS[sessionType]
  if (!agent) throw new Error(`Unsupported terminal session type: ${sessionType}`)

  return {
    displayName: agent.displayName,
    binary: env[agent.envPath] || agent.defaultBinary,
    args: agent.buildArgs(aioInstructions),
  }
}
