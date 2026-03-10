import Anthropic from '@anthropic-ai/sdk'
import type { Message } from './types'

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

export async function streamMessage(
  apiKey: string,
  model: string,
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
  getNotepad: () => string,
  setNotepad: (s: string) => void,
  onToolCall?: (name: string) => void,
) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  // Agentic loop: stream → tool calls → tool results → stream again
  const conversation: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  let fullText = ''

  try {
    while (true) {
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        tools: NOTEPAD_TOOLS,
        messages: conversation,
      })

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
            toolUseBlocks.push({
              type: 'tool_use',
              id: currentToolUse.id,
              name: currentToolUse.name,
              input,
            })
          } catch {
            toolUseBlocks.push({
              type: 'tool_use',
              id: currentToolUse.id,
              name: currentToolUse.name,
              input: {},
            })
          }
          currentToolUse = null
        }
      }

      const finalMsg = await stream.finalMessage()

      if (finalMsg.stop_reason === 'tool_use') {
        // Append the assistant message with all content blocks
        conversation.push({ role: 'assistant', content: finalMsg.content })

        // Execute each tool and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(block => {
          onToolCall?.(block.name)
          let result: string
          if (block.name === 'read_notepad') {
            result = getNotepad() || '(notepad is empty)'
          } else if (block.name === 'write_notepad') {
            const input = block.input as { content?: string }
            setNotepad(input.content ?? '')
            result = 'Notepad updated.'
          } else {
            result = `Unknown tool: ${block.name}`
          }
          return { type: 'tool_result', tool_use_id: block.id, content: result }
        })

        conversation.push({ role: 'user', content: toolResults })
        // Continue the loop
      } else {
        // stop_reason === 'end_turn' or other — we're done
        onDone(fullText)
        break
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err))
  }
}
