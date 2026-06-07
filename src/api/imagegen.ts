// 图片生成 API —— 仅支持 OpenAI GPT Image 2 协议（/v1/images/generations）
// 兼容 OpenAI 官方及 NewAPI / OneAPI / CLIProxyAPI 等 OpenAI 兼容代理

export interface ImageGenerationResult {
  success: boolean
  imageUrl?: string
  error?: string
}

/** GPT Image 2 默认模型名 */
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2'

/** 支持的图片尺寸（gpt-image 系列） */
export const IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536', 'auto'] as const
export type ImageSize = (typeof IMAGE_SIZES)[number]

/**
 * 解析图片生成响应（OpenAI Images 格式）
 * gpt-image 系列默认返回 b64_json；部分代理会改为返回可访问的 url
 */
function parseImageResponse(data: Record<string, unknown>): ImageGenerationResult {
  // 代理可能返回 message 字段表示错误（如内容策略拒绝）
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    const msg = (data as { message?: string }).message
    return { success: false, error: msg || '未返回图片数据' }
  }

  const item = (data.data as Record<string, string>[])[0]
  // 优先使用 url（代理已存储的图片地址），其次用 b64_json
  if (item?.url) {
    return { success: true, imageUrl: item.url }
  }
  if (item?.b64_json) {
    return { success: true, imageUrl: `data:image/png;base64,${item.b64_json}` }
  }
  return { success: false, error: '未返回图片数据' }
}

/** 从错误响应中提取可读的错误信息 */
async function extractError(response: Response): Promise<string> {
  const errorData = (await response.json().catch(() => ({}))) as {
    error?: string | { message?: string }
    detail?: string | { error?: string }
    message?: string
  }
  // error 可能是对象（OpenAI 官方）或字符串（部分 NewAPI 风格代理）
  const err = errorData.error
  if (typeof err === 'string' && err) return err
  if (err && typeof err === 'object' && err.message) return err.message
  // detail 可能是对象或字符串
  const detail = errorData.detail
  if (typeof detail === 'string' && detail) return detail
  if (detail && typeof detail === 'object' && detail.error) return detail.error
  // 顶层 message
  if (errorData.message) return errorData.message
  return `HTTP ${response.status}`
}

/**
 * 通过 Chat Completions API 生成图片（modalities 方式）
 * 适用于 CLIProxyAPI 等通过 OAuth 代理的服务：它们不直接支持
 * /v1/images/generations，但支持 chat/completions + modalities:["text","image"]。
 *
 * 注意：此处保持调用方传入的图片模型不变（不再改写成 gpt-4o），
 * 由代理自行决定如何路由到底层图片模型。
 */
async function generateWithChatCompletions(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  const base = baseUrl.replace(/\/$/, '')
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_IMAGE_MODEL,
      messages: [
        {
          role: 'user',
          content: `Please generate an image based on the following description. Only generate the image, no text explanation needed.\n\n${prompt}`,
        },
      ],
      modalities: ['text', 'image'],
      stream: false,
    }),
    signal,
  })

  if (!response.ok) {
    return { success: false, error: await extractError(response) }
  }

  const data = (await response.json()) as Record<string, unknown>
  const choices = (
    data as {
      choices?: Array<{
        message?: {
          images?: Array<{ type?: string; image_url?: { url?: string } }>
          content?: string
        }
      }>
    }
  ).choices
  if (choices && choices.length > 0) {
    const message = choices[0].message
    // 方式1: images 数组（Vercel AI Gateway / 某些代理的格式）
    if (message?.images && Array.isArray(message.images)) {
      for (const img of message.images) {
        if (img.type === 'image_url' && img.image_url?.url) {
          return { success: true, imageUrl: img.image_url.url }
        }
      }
    }
    // 方式2: content 中直接包含 base64 图片
    if (message?.content && message.content.startsWith('data:image')) {
      return { success: true, imageUrl: message.content }
    }
  }
  return { success: false, error: '模型未返回图片，该代理可能不支持图片生成' }
}

/**
 * GPT Image 2 图片生成
 * 走标准 /v1/images/generations；若代理内部转换失败（tool_choice / image_generation 报错），
 * 回退到 chat/completions + modalities 方式（保持同一图片模型）。
 *
 * 注意：gpt-image 系列默认返回 b64_json 且不接受 response_format 参数，
 * 因此请求体保持最简（model/prompt/n/size），不要附加 response_format。
 */
export async function generateImage(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  size: ImageSize = '1024x1024',
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  try {
    const base = baseUrl.replace(/\/$/, '')
    const actualModel = model || DEFAULT_IMAGE_MODEL

    const body: Record<string, unknown> = {
      model: actualModel,
      prompt,
      n: 1,
      size,
    }

    const response = await fetch(`${base}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errMsg = await extractError(response)
      // 代理内部转换失败时，回退到 chat/completions + modalities 方式
      if (errMsg.includes('tool_choice') || errMsg.includes('image_generation')) {
        return generateWithChatCompletions(base, apiKey, actualModel, prompt, signal)
      }
      return { success: false, error: errMsg }
    }

    const data = await response.json()
    return parseImageResponse(data)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    return { success: false, error: error instanceof Error ? error.message : '网络错误' }
  }
}
