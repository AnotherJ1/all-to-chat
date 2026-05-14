// 通用 SSE / 流式响应解析工具
// 兼容 OpenAI / Anthropic / Gemini streamGenerateContent

export interface SSEEvent {
  event?: string
  data: string
}

/**
 * 读取 SSE 流,逐条 yield 出 `data:` 行
 * 自动处理跨 chunk 拆包问题(一行 data 可能横跨多个 read)
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent, void, void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE 以双换行作为事件分隔
      let sepIndex: number
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + 2)

        const lines = rawEvent.split('\n')
        let eventName: string | undefined
        const dataLines: string[] = []
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
          }
        }
        if (dataLines.length > 0) {
          yield { event: eventName, data: dataLines.join('\n') }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* noop */
    }
  }
}
