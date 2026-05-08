// Gemini API 调用
import type { Message } from '../types'

interface GenerateContentOptions {
  url: string
  apiKey: string
  messages: Message[]
  systemPrompt?: string
  onChunk?: (chunk: string) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export async function generateContent({
  url,
  apiKey,
  messages,
  systemPrompt,
  onChunk,
  onComplete,
  onError,
}: GenerateContentOptions): Promise<string> {
  // 构建内容，将历史消息合并为单个 prompt
  let prompt = ''
  if (systemPrompt) {
    prompt += `${systemPrompt}\n\n`
  }
  for (const msg of messages) {
    if (msg.role === 'user') {
      prompt += `用户: ${msg.content}\n`
    } else if (msg.role === 'assistant') {
      prompt += `助手: ${msg.content}\n`
    }
  }

  try {
    const response = await fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 4096,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 错误: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    onChunk?.(content)
    onComplete?.()
    return content
  } catch (error) {
    onError?.(error as Error)
    throw error
  }
}