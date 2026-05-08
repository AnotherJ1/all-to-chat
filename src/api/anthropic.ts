// Anthropic API 调用（支持流式输出）
import type { Message } from '../types'

interface AnthropicMessagesOptions {
  url: string
  apiKey: string
  model: string
  messages: Message[]
  systemPrompt?: string
  streaming?: boolean
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
  onChunk,
  onComplete,
  onError,
}: AnthropicMessagesOptions): Promise<string> {
  // 构建消息，Anthropic 格式
  const allMessages: { role: 'user' | 'assistant'; content: string }[] = []
  if (systemPrompt) {
    allMessages.push({
      role: 'user',
      content: `<system>\n${systemPrompt}\n</system>`,
    })
  }
  for (const msg of messages) {
    allMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        max_tokens: 4096,
        stream: streaming,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 错误: ${response.status} - ${errorText}`)
    }

    if (!streaming) {
      const data = await response.json()
      return data.content?.[0]?.text || ''
    }

    // 流式处理
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta') {
              const content = parsed.delta?.text
              if (content) {
                fullContent += content
                onChunk?.(content)
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    onComplete?.()
    return fullContent
  } catch (error) {
    onError?.(error as Error)
    throw error
  }
}