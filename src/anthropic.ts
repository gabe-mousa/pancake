import Anthropic from '@anthropic-ai/sdk'
import type { Message, FsAccess, VirtualFile } from './types'

const FS_SERVER = 'http://127.0.0.1:4174'

// ── Tool definitions ──────────────────────────────────────────────────────────

const NOTEPAD_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_notepad',
    description: 'Read the current contents of the shared notepad.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'write_notepad',
    description: 'Overwrite the shared notepad with new content.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The new notepad content.' },
      },
      required: ['content'],
    },
  },
]

const FS_READ_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the text content of a file. Path is relative to the workspace root.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path to the file' } },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List the contents of a directory. Returns files and subdirectories.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path to the directory (use "." for root)' } },
      required: ['path'],
    },
  },
  {
    name: 'file_exists',
    description: 'Check whether a file or directory exists at the given path.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
]

const FS_WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'write_file',
    description: 'Write text content to a file, creating it and any missing parent directories.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the file' },
        content: { type: 'string', description: 'Text content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a directory (and any missing parents) at the given path.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'move_file',
    description: 'Move or rename a file or directory.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Current relative path' },
        to: { type: 'string', description: 'Destination relative path' },
      },
      required: ['from', 'to'],
    },
  },
]

const FS_DELETE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'delete_file',
    description: 'Permanently delete a file or directory (recursive). This cannot be undone.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path to delete' } },
      required: ['path'],
    },
  },
]

const VIRTUAL_FS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_virtual_file',
    description: "Read the content of a file that the user has uploaded to Pancake's virtual filesystem (PFS). PFS is completely separate from the Notepad — the Notepad is a text scratch pad, while PFS holds actual uploaded files (code, documents, data, etc.). Use this tool when the user asks to read or access a file they uploaded to Pancake.",
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string', description: "Filename or path as it appears in Pancake's Filesystem (e.g. 'notes.md' or 'src/utils/helper.js')" } },
      required: ['name'],
    },
  },
  {
    name: 'list_virtual_files',
    description: "List all files that have been uploaded to Pancake's virtual filesystem (PFS). Use this to see what files are available before reading them. PFS is not the same as the Notepad — the Notepad is a text scratch pad, PFS holds uploaded files.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'move_virtual_file',
    description: "Rename or move a file within Pancake's virtual filesystem (PFS) by changing its name or path.",
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: "Current filename/path in Pancake's Filesystem" },
        to: { type: 'string', description: 'New filename/path for the file' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'delete_virtual_file',
    description: "Delete a file from Pancake's virtual filesystem (PFS). The user must confirm before this takes effect.",
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string', description: "Filename to delete from Pancake's Filesystem" } },
      required: ['name'],
    },
  },
]

// ── StreamContext ─────────────────────────────────────────────────────────────

export interface StreamContext {
  getNotepad: () => string
  setNotepad: (s: string) => void
  fsAccess: FsAccess
  localEnabled: boolean   // whether Local Filesystem is enabled
  fsRoot: string          // resolved root path from FS server (for system prompt)
  pancakeEnabled: boolean // whether Pancake's virtual FS is enabled
  virtualFsFiles: VirtualFile[]
  removeVirtualFile: (name: string) => void
  renameVirtualFile: (from: string, to: string) => void
  confirmVirtualDelete: (name: string) => Promise<boolean>
  onToolCall?: (name: string) => void
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(ctx: StreamContext): string | undefined {
  const localActive = ctx.localEnabled && ctx.fsAccess !== 'none'
  // PFS tools are available whenever PFS is enabled, even if no files are uploaded yet
  const virtualActive = ctx.pancakeEnabled
  const both = localActive && virtualActive

  const parts: string[] = []

  // Core clarification: Notepad vs PFS are completely different things
  const notepadVsPfsClarification =
    `IMPORTANT TOOL DISTINCTION:\n` +
    `- The Notepad (read_notepad / write_notepad) is a shared text scratch pad for notes, prompts, and context. It is NOT a filesystem.\n` +
    `- Pancake's virtual filesystem / PFS (read_virtual_file / list_virtual_files / move_virtual_file / delete_virtual_file) holds actual files the user has uploaded — code, documents, data files, etc.\n` +
    `- These are completely separate. Never confuse them. If the user says "read my file" or "access the file I uploaded", use the PFS tools, not the Notepad.`

  if (both) {
    parts.push(notepadVsPfsClarification)
    parts.push(
      `You have access to two separate filesystems:\n` +
      `1. Local filesystem (read_file, write_file, list_directory, etc.) — rooted at: ${ctx.fsRoot}\n` +
      `   Changes here affect real files on disk.\n` +
      `2. Pancake's virtual filesystem / PFS (read_virtual_file, list_virtual_files, etc.) — files the\n` +
      `   user has uploaded to the app. They live inside the app only and are never written to disk.\n\n` +
      `You may use both filesystems in the same response or agentic loop.\n\n` +
      `Only ask for clarification if the user's request is genuinely ambiguous about which filesystem\n` +
      `to use and you cannot reasonably infer intent from context. Good reasons to ask:\n` +
      `- The user says "use the filesystem" or "read that file" with no indication of which one\n` +
      `- A filename exists in both filesystems and the user hasn't said which copy to use\n\n` +
      `Do NOT ask for clarification if:\n` +
      `- The user explicitly names one ("from Pancake's filesystem", "on my local machine")\n` +
      `- The task clearly requires both (e.g. "copy X from Pancake's filesystem to my local folder")\n` +
      `- The task references a file that only exists in one of the two filesystems\n` +
      `- The user already clarified earlier in this conversation\n\n` +
      `When you do ask, be specific. Example: "Should I use notes.md from your local filesystem at\n` +
      `${ctx.fsRoot}, or the notes.md you've uploaded to Pancake's virtual filesystem?"\n\n` +
      `Once context is established, proceed for the rest of the conversation without asking again.`
    )
  } else if (localActive) {
    parts.push(notepadVsPfsClarification)
    parts.push(
      `You have access to the local filesystem rooted at: ${ctx.fsRoot}\n` +
      `All file paths you use with read_file, write_file, etc. must be relative to this root.`
    )
  } else if (virtualActive) {
    parts.push(notepadVsPfsClarification)
    const fileList = ctx.virtualFsFiles.length > 0
      ? `\nCurrently uploaded files:\n${ctx.virtualFsFiles.map(f => `  - ${f.name} (${formatBytes(f.size)})`).join('\n')}`
      : `\nNo files have been uploaded yet — the user can upload files on the Filesystem page.`
    parts.push(
      `You have access to Pancake's virtual filesystem (PFS) — files the user has uploaded to the app.\n` +
      `They live inside the app only and are never written to disk.\n` +
      `Use list_virtual_files() to see all available files, and read_virtual_file(name) to read them.` +
      fileList
    )
  }

  // Disabled filesystem notices
  if (!ctx.pancakeEnabled) {
    parts.push(
      `Pancake's virtual filesystem (PFS) is currently disabled. ` +
      `If the user asks you to access files they've uploaded to Pancake, tell them PFS is disabled ` +
      `and they can enable it using the green PFS button in the top-right of the app. ` +
      `Do NOT use the Notepad as a substitute for PFS — they are completely different things.`
    )
  }
  if (!ctx.localEnabled || ctx.fsAccess === 'none') {
    parts.push(
      `The local filesystem is currently disabled or set to no access for this session. ` +
      `If the user asks you to read or write files on their machine, tell them the Local Filesystem ` +
      `is disabled or that this session's FS access badge is set to off.`
    )
  }

  return parts.length > 0 ? parts.join('\n\n') : undefined
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(block: Anthropic.ToolUseBlock, ctx: StreamContext): Promise<string> {
  const input = block.input as Record<string, string>

  // Notepad tools
  if (block.name === 'read_notepad') {
    return ctx.getNotepad() || '(notepad is empty)'
  }
  if (block.name === 'write_notepad') {
    ctx.setNotepad(input.content ?? '')
    return 'Notepad updated.'
  }

  // Virtual filesystem tools
  if (block.name === 'list_virtual_files') {
    if (ctx.virtualFsFiles.length === 0) return '(no files in virtual filesystem)'
    return ctx.virtualFsFiles.map(f => `${f.name} (${formatBytes(f.size)})`).join('\n')
  }
  if (block.name === 'read_virtual_file') {
    const file = ctx.virtualFsFiles.find(f => f.name === input.name)
    if (!file) return `File not found in Pancake's virtual filesystem: ${input.name}`
    if (file.isBinary) return `(Binary file — ${formatBytes(file.size)})`
    return file.content
  }
  if (block.name === 'move_virtual_file') {
    const { from, to } = input
    const exists = ctx.virtualFsFiles.some(f => f.name === from)
    if (!exists) return `File not found in Pancake's virtual filesystem: ${from}`
    const conflict = ctx.virtualFsFiles.some(f => f.name === to)
    if (conflict) return `A file named "${to}" already exists in Pancake's virtual filesystem.`
    ctx.renameVirtualFile(from, to)
    return `"${from}" has been renamed to "${to}".`
  }
  if (block.name === 'delete_virtual_file') {
    const name = input.name
    const exists = ctx.virtualFsFiles.some(f => f.name === name)
    if (!exists) return `File not found in Pancake's virtual filesystem: ${name}`
    const confirmed = await ctx.confirmVirtualDelete(name)
    if (!confirmed) return `Deletion of "${name}" was cancelled by the user.`
    ctx.removeVirtualFile(name)
    return `"${name}" has been deleted from Pancake's virtual filesystem.`
  }

  // Local filesystem tools — all go via the FS bridge server
  const fsToolMap: Record<string, () => Promise<Response>> = {
    read_file: () => fetch(`${FS_SERVER}/fs/read?path=${encodeURIComponent(input.path)}`),
    list_directory: () => fetch(`${FS_SERVER}/fs/list?path=${encodeURIComponent(input.path ?? '.')}`),
    file_exists: () => fetch(`${FS_SERVER}/fs/exists?path=${encodeURIComponent(input.path)}`),
    write_file: () => fetch(`${FS_SERVER}/fs/write`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: input.path, content: input.content }) }),
    create_directory: () => fetch(`${FS_SERVER}/fs/mkdir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: input.path }) }),
    move_file: () => fetch(`${FS_SERVER}/fs/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: input.from, to: input.to }) }),
    delete_file: () => fetch(`${FS_SERVER}/fs/delete`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: input.path }) }),
  }

  const fetcher = fsToolMap[block.name]
  if (!fetcher) return `Unknown tool: ${block.name}`

  try {
    const res = await fetcher()
    const data = await res.json()
    if (!res.ok) return `Error: ${data.error ?? res.statusText}`

    // Format successful responses as readable strings for Claude
    if (block.name === 'read_file') return data.content
    if (block.name === 'list_directory') {
      if (!data.entries?.length) return '(empty directory)'
      return data.entries.map((e: { name: string; type: string }) => `${e.type === 'dir' ? '[dir]' : '[file]'} ${e.name}`).join('\n')
    }
    if (block.name === 'file_exists') return data.exists ? 'Yes, the path exists.' : 'No, the path does not exist.'
    return 'OK'
  } catch {
    return 'Error: could not reach the local filesystem server. Is Pancake running with npx pancake?'
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function streamMessage(
  apiKey: string,
  model: string,
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
  ctx: StreamContext,
) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const localActive = ctx.localEnabled && ctx.fsAccess !== 'none'
  // PFS tools are always available when PFS is enabled, even if no files uploaded yet
  const virtualActive = ctx.pancakeEnabled

  const tools: Anthropic.Tool[] = [
    ...NOTEPAD_TOOLS,
    ...(localActive ? FS_READ_TOOLS : []),
    ...(localActive && (ctx.fsAccess === 'read-write' || ctx.fsAccess === 'read-write-delete') ? FS_WRITE_TOOLS : []),
    ...(localActive && ctx.fsAccess === 'read-write-delete' ? FS_DELETE_TOOLS : []),
    ...(virtualActive ? VIRTUAL_FS_TOOLS : []),
  ]

  const systemPrompt = buildSystemPrompt(ctx)

  const conversation: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  let fullText = ''

  try {
    while (true) {
      const requestParams: Anthropic.MessageStreamParams = {
        model,
        max_tokens: 4096,
        tools,
        messages: conversation,
      }
      if (systemPrompt) requestParams.system = systemPrompt

      const stream = client.messages.stream(requestParams)

      const toolUseBlocks: Anthropic.ToolUseBlock[] = []
      let currentToolUse: { id: string; name: string; inputJson: string } | null = null

      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          currentToolUse = { id: event.content_block.id, name: event.content_block.name, inputJson: '' }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            fullText += event.delta.text
            onChunk(fullText)
          } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
            currentToolUse.inputJson += event.delta.partial_json
          }
        } else if (event.type === 'content_block_stop' && currentToolUse) {
          try {
            const input = JSON.parse(currentToolUse.inputJson || '{}')
            toolUseBlocks.push({ type: 'tool_use', id: currentToolUse.id, name: currentToolUse.name, input })
          } catch {
            toolUseBlocks.push({ type: 'tool_use', id: currentToolUse.id, name: currentToolUse.name, input: {} })
          }
          currentToolUse = null
        }
      }

      const finalMsg = await stream.finalMessage()

      if (finalMsg.stop_reason === 'tool_use') {
        conversation.push({ role: 'assistant', content: finalMsg.content })

        const toolResults = await Promise.all(toolUseBlocks.map(async block => {
          ctx.onToolCall?.(block.name)
          const result = await executeTool(block, ctx)
          return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
        }))

        conversation.push({ role: 'user', content: toolResults })
      } else {
        onDone(fullText)
        break
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err))
  }
}
