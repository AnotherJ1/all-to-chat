// OpenAI 兼容 API 调用（支持流式输出）
import type { Message } from '../types'

interface ChatCompletionOptions {
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

export async function chatCompletion({
  url,
  apiKey,
  model,
  messages,
  systemPrompt,
  streaming = true,
  onChunk,
  onComplete,
  onError,
}: ChatCompletionOptions): Promise<string> {
  // 构建消息列表，系统提示作为第一条消息
  const allMessages: Message[] = []
  if (systemPrompt) {
    allMessages.push({
      id: crypto.randomUUID(),
      role: 'system',
      content: systemPrompt,
      timestamp: Date.now(),
    })
  }
  allMessages.push(...messages)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: allMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: streaming,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 错误: ${response.status} - ${errorText}`)
    }

    if (!streaming) {
      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
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
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullContent += content
              onChunk?.(content)
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

// 获取模型列表
export async function fetchModelList(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    const base = baseUrl.replace(/\/$/, '')
    // NewAPI 类代理通常使用 /api/models，OpenAI 原生使用 /v1/models
    const url = `${base}/api/models`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      // 如果不支持 /api/models，尝试 /v1/models
      const fallbackUrl = `${base}/v1/models`
      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })
      if (!fallbackResponse.ok) {
        return getDefaultModels(baseUrl)
      }
      const fallbackData = await fallbackResponse.json()
      if (fallbackData.data && Array.isArray(fallbackData.data)) {
        return fallbackData.data.map((m: { id: string }) => m.id)
      }
      return getDefaultModels(baseUrl)
    }

    const data = await response.json()
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((m: { id: string }) => m.id)
    }
    if (Array.isArray(data)) {
      return data.map((m: string | { id: string }) => typeof m === 'string' ? m : m.id)
    }
    return getDefaultModels(baseUrl)
  } catch {
    return getDefaultModels(baseUrl)
  }
}

// 根据 baseUrl 返回默认模型列表
function getDefaultModels(baseUrl: string): string[] {
  if (baseUrl.includes('openai') || baseUrl.includes('api.openai')) {
    return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini']
  }
  if (baseUrl.includes('anthropic') || baseUrl.includes('api.anthropic')) {
    return ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest']
  }
  if (baseUrl.includes('gemini') || baseUrl.includes('generativelanguage')) {
    return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash']
  }
  // 默认 OpenAI 兼容列表
  return ['gpt-4', 'gpt-3.5-turbo', 'gpt-4o', 'claude-3-sonnet', 'gemini-pro']
}
