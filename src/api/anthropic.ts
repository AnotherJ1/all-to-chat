// Anthropic API 调用（支持流式输出 + 原生 system 字段）
import type { Message } from '../types'
import { parseSSEStream } from '../lib/sse'

interface AnthropicMessagesOptions {
  url: string
  apiKey: string
  model: string
  messages: Message[]
  systemPrompt?: string
  streaming?: boolean
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export async function anthropicMessages({
  url,
  apiKey,
  model,
  messages,
  systemPrompt,
  streaming = true,
  signal,
  onChunk,
  onComplete,
  onError,
}: AnthropicMessagesOptions): Promise<string> {
  // Anthropic 格式: system 是顶层字段,messages 只有 user/assistant
  const allMessages: { role: 'user' | 'assistant'; content: string }[] = []
  for (const msg of messages) {
    if (msg.role === 'system') continue
    allMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })
  }

  const body: Record<string, unknown> = {
    model,
    messages: allMessages,
    max_tokens: 4096,
    stream: streaming,
  }
  // 使用原生 system 字段
  if (systemPrompt) {
    body.system = systemPrompt
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 错误: ${response.status} - ${errorText}`)
    }

    if (!streaming) {
      const data = await response.json()
      const content = data.content?.[0]?.text || ''
      onChunk?.(content)
      onComplete?.()
      return content
    }

    if (!response.body) throw new Error('无法读取响应流')

    let fullContent = ''
    for await (const event of parseSSEStream(response.body, signal)) {
      let parsed: {
        type?: string
        delta?: { type?: string; text?: string }
        error?: { message?: string }
      }
      try {
        parsed = JSON.parse(event.data)
      } catch {
        // 非 JSON 数据（如心跳）忽略
        continue
      }
      // Anthropic 流式即使 HTTP 200，中途出错也会发 error 事件
      if (parsed.type === 'error' || parsed.error) {
        throw new Error(parsed.error?.message || 'Anthropic 流式响应错误')
      }
      // 正常结束信号
      if (parsed.type === 'message_stop') break
      // 只取文本增量；thinking_delta 等其他增量类型跳过
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
        const content = parsed.delta.text
        if (content) {
          fullContent += content
          onChunk?.(content)
        }
      }
    }

    onComplete?.()
    return fullContent
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      onError?.(error as Error)
    }
    throw error
  }
}
