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

// 从 Gemini 响应中提取文本：content.parts 是数组，可能包含多段文本，需全部拼接
function extractGeminiText(payload: unknown): string {
  const parts = (payload as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  })?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((p) => p?.text ?? '').join('')
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
      const content = extractGeminiText(data)
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
        // 流式 chunk 中也可能因安全策略等返回错误
        if (parsed.error) {
          throw new Error(parsed.error.message || 'Gemini 流式响应错误')
        }
        const text = extractGeminiText(parsed)
        if (text) {
          fullContent += text
          onChunk?.(text)
        }
      } catch (err) {
        // JSON 解析失败忽略；但业务错误（上面 throw 的）要向上抛
        if (err instanceof Error && err.message.includes('Gemini')) throw err
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
