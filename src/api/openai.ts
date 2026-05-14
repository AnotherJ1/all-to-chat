// OpenAI 兼容 API 调用（支持流式输出）
import type { Message } from '../types'
import { parseSSEStream } from '../lib/sse'

interface ChatCompletionOptions {
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

export async function chatCompletion({
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
}: ChatCompletionOptions): Promise<string> {
  const allMessages: { role: string; content: string }[] = []
  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt })
  }
  allMessages.push(...messages.map((m) => ({ role: m.role, content: m.content })))

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        stream: streaming,
      }),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 错误: ${response.status} - ${errorText}`)
    }

    if (!streaming) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      onChunk?.(content)
      onComplete?.()
      return content
    }

    // 流式处理
    if (!response.body) throw new Error('无法读取响应流')

    let fullContent = ''
    for await (const event of parseSSEStream(response.body, signal)) {
      if (event.data === '[DONE]') break
      try {
        const parsed = JSON.parse(event.data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          fullContent += content
          onChunk?.(content)
        }
      } catch {
        // 忽略解析错误
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

// 获取模型列表
export async function fetchModelList(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    const base = baseUrl.replace(/\/$/, '')
    // 先尝试标准 /v1/models,再 fallback 到 /api/models (NewAPI 代理)
    const urls = [`${base}/v1/models`, `${base}/api/models`]

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!response.ok) continue
        const data = await response.json()
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((m: { id: string }) => m.id)
        }
        if (Array.isArray(data)) {
          return data.map((m: string | { id: string }) => typeof m === 'string' ? m : m.id)
        }
      } catch {
        continue
      }
    }
    return []
  } catch {
    return []
  }
}
