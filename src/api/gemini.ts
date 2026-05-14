// Gemini API 调用（支持流式输出 streamGenerateContent）
import type { Message } from '../types'
import { parseSSEStream } from '../lib/sse'

interface GenerateContentOptions {
  url: string
  apiKey: string
  model?: string
  messages: Message[]
  systemPrompt?: string
  streaming?: boolean
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export async function generateContent({
  url,
  apiKey,
  messages,
  systemPrompt,
  streaming = true,
  signal,
  onChunk,
  onComplete,
  onError,
}: GenerateContentOptions): Promise<string> {
  // 构建 Gemini 多轮对话格式
  const contents: { role: string; parts: { text: string }[] }[] = []
  for (const msg of messages) {
    if (msg.role === 'system') continue
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 4096 },
  }
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  // 流式使用 streamGenerateContent,非流式使用 generateContent
  const endpoint = streaming
    ? url.replace(':generateContent', ':streamGenerateContent') + `?alt=sse&key=${apiKey}`
    : `${url}?key=${apiKey}`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 错误: ${response.status} - ${errorText}`)
    }

    if (!streaming) {
      const data = await response.json()
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      onChunk?.(content)
      onComplete?.()
      return content
    }

    // Gemini streamGenerateContent 返回 SSE,复用通用 SSE 解析器
    if (!response.body) throw new Error('无法读取响应流')

    let fullContent = ''
    for await (const event of parseSSEStream(response.body, signal)) {
      try {
        const parsed = JSON.parse(event.data)
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          fullContent += text
          onChunk?.(text)
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
