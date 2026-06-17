// OpenAI 兼容 API 调用（支持流式输出）
import type { Message } from '../types'
import { parseSSEStream } from '../lib/sse'
import { normalizeApiBase } from '../lib/api-url'

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
  // 历史里的 system 消息不透传，统一由 systemPrompt 控制（与 anthropic/gemini 行为一致）
  allMessages.push(
    ...messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))
  )

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
      let parsed: {
        choices?: { delta?: { content?: string } }[]
        error?: { message?: string }
      }
      try {
        parsed = JSON.parse(event.data)
      } catch {
        // 非 JSON 数据忽略
        continue
      }
      // 部分兼容网关在流式中途返回 error 对象（HTTP 仍为 200）
      if (parsed.error) {
        throw new Error(parsed.error.message || 'OpenAI 流式响应错误')
      }
      const content = parsed.choices?.[0]?.delta?.content
      if (content) {
        fullContent += content
        onChunk?.(content)
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

/** 从模型列表响应中解析出 model id 数组；无法识别的结构返回 null */
function parseModelList(data: unknown): string[] | null {
  // 标准 OpenAI / CLIProxyAPI 格式：{ object:"list", data:[{id}] }
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: Array<{ id: string }> }).data.map((m) => m.id).filter(Boolean)
  }
  // 部分代理直接返回数组（字符串或 {id}）
  if (Array.isArray(data)) {
    return data.map((m: string | { id: string }) => (typeof m === 'string' ? m : m.id)).filter(Boolean)
  }
  return null
}

/**
 * 获取模型列表
 * 依次尝试 /v1/models（OpenAI / CLIProxyAPI 标准）与 /api/models（NewAPI 代理）。
 *
 * 错误语义：
 * - 成功拿到响应但列表为空/结构未知 → 返回 []（"该地址确实没有可列模型"）
 * - 鉴权失败 / HTTP 错误 / 网络超时 → 抛出携带真实原因的 Error，由调用方提示用户
 *   （避免把 401「API Key 无效」伪装成「未获取到模型」）
 */
export async function fetchModelList(baseUrl: string, apiKey: string): Promise<string[]> {
  const base = normalizeApiBase(baseUrl)
  const urls = [`${base}/v1/models`, `${base}/api/models`]

  let lastError: string | null = null
  for (const url of urls) {
    try {
      // 每个请求 15s 超时，避免慢/挂起的代理导致「加载中」一直转
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        // 404 多为该路径不存在，继续尝试下一个端点；其余错误（401/403/5xx）记录原因
        lastError = await extractModelListError(response)
        continue
      }
      const parsed = parseModelList(await response.json())
      if (parsed) return parsed
      // 200 但结构无法识别，记录后继续尝试
      lastError = '响应格式无法识别'
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        lastError = '请求超时（15秒）'
      } else if (err instanceof Error && err.name === 'AbortError') {
        throw err
      } else {
        lastError = err instanceof Error ? err.message : '网络错误'
      }
    }
  }

  // 所有端点都失败：抛出真实原因，让调用方区分「鉴权失败」与「确无模型」
  throw new Error(lastError || '未获取到模型列表')
}

/** 从模型列表错误响应中提取可读信息（兼容 CLIProxyAPI 的 {error:"..."} 等格式） */
async function extractModelListError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as
    | { error?: string | { message?: string }; message?: string }
    | null
  const err = body?.error
  const detail =
    (typeof err === 'string' && err) ||
    (err && typeof err === 'object' && err.message) ||
    body?.message ||
    ''
  return detail ? `${detail}（HTTP ${response.status}）` : `HTTP ${response.status}`
}
