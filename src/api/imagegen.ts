// 图片生成API - 支持 DALL-E/OpenAI兼容, Imagen, Flux

export interface ImageGenerationResult {
  success: boolean
  imageUrl?: string
  error?: string
}

/**
 * 解析图片生成响应(OpenAI 兼容格式)
 * 支持返回 url 或 b64_json,也处理代理返回的 message 错误
 */
function parseImageResponse(data: Record<string, unknown>): ImageGenerationResult {
  // 代理可能返回 message 字段表示错误(如内容策略拒绝)
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    const msg = (data as { message?: string }).message
    return { success: false, error: msg || '未返回图片数据' }
  }

  const item = (data.data as Record<string, string>[])[0]
  // 优先使用 url(代理已存储的图片地址),其次用 b64_json
  if (item?.url) {
    return { success: true, imageUrl: item.url }
  }
  if (item?.b64_json) {
    return { success: true, imageUrl: `data:image/png;base64,${item.b64_json}` }
  }
  return { success: false, error: '未返回图片数据' }
}

/**
 * 通过 Chat Completions API 生成图片 (modalities 方式)
 * 适用于 CLIProxyAPI 等通过 OAuth 代理的服务
 * 这些服务不直接支持 /v1/images/generations，但支持 chat/completions
 * 通过 modalities: ["text", "image"] 让模型生成图片
 */
async function generateWithChatCompletions(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  const base = baseUrl.replace(/\/$/, '')
  // 使用支持图片生成的模型
  const chatModel = /^gpt-image/i.test(model) ? 'gpt-4o' : (model || 'gpt-4o')
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: chatModel,
      messages: [
        { role: 'user', content: `Please generate an image based on the following description. Only generate the image, no text explanation needed.\n\n${prompt}` }
      ],
      modalities: ['text', 'image'],
      stream: false,
    }),
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errMsg = (errorData as { error?: { message?: string }; detail?: { error?: string } }).error?.message
      || (errorData as { detail?: { error?: string } }).detail?.error
      || `HTTP ${response.status}`
    return { success: false, error: errMsg }
  }

  const data = await response.json() as Record<string, unknown>
  // 解析 chat completions 响应中的图片
  const choices = (data as { choices?: Array<{ message?: { images?: Array<{ type?: string; image_url?: { url?: string } }>; content?: string } }> }).choices
  if (choices && choices.length > 0) {
    const message = choices[0].message
    // 方式1: images 数组 (Vercel AI Gateway / 某些代理的格式)
    if (message?.images && Array.isArray(message.images)) {
      for (const img of message.images) {
        if (img.type === 'image_url' && img.image_url?.url) {
          return { success: true, imageUrl: img.image_url.url }
        }
      }
    }
    // 方式2: content 中包含 base64 图片 (某些代理直接在 content 中返回)
    if (message?.content && message.content.startsWith('data:image')) {
      return { success: true, imageUrl: message.content }
    }
  }
  return { success: false, error: '模型未返回图片，该代理可能不支持图片生成' }
}

// DALL-E / OpenAI 兼容图片生成
// 适用于: OpenAI 官方、NewAPI/OneAPI 代理、CLIProxyAPI 等
// 如果 /v1/images/generations 返回 tool_choice 错误，回退到 chat/completions + modalities 方式
async function generateWithDalle(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  try {
    const base = baseUrl.replace(/\/$/, '')
    const actualModel = model || 'gpt-image-2'

    // 对于 CLIProxyAPI 等代理，发送最简化的请求体
    // 只包含 model, prompt, n, size 即可，不要加额外参数
    const body: Record<string, unknown> = {
      model: actualModel,
      prompt,
      n: 1,
      size: '1024x1024',
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
      const errorData = await response.json().catch(() => ({}))
      const errMsg = (errorData as { error?: { message?: string }; detail?: { error?: string } }).error?.message
        || (errorData as { detail?: { error?: string } }).detail?.error
        || `HTTP ${response.status}`

      // CLIProxyAPI 等代理内部转换失败时，回退到 chat/completions + modalities 方式
      if (errMsg.includes('tool_choice') || errMsg.includes('image_generation')) {
        return generateWithChatCompletions(base, apiKey, actualModel, prompt, signal)
      }

      return { success: false, error: errMsg }
    }

    const data = await response.json()
    return parseImageResponse(data)
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '网络错误' }
  }
}

// Google Imagen 图片生成
async function generateWithImagen(
  baseUrl: string,
  apiKey: string,
  prompt: string,
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  try {
    const endpoint = baseUrl.includes('vertexai')
      ? `${baseUrl}/images:generate`
      : `https://generativelanguage.googleapis.com/v1beta/models/imagen-3-generate:generateImage`

    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        numberOfImages: 1,
        aspectRatio: '1:1',
        personGeneration: 'dont_allow',
      }),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { success: false, error: (errorData as { error?: { message?: string } }).error?.message || `HTTP ${response.status}` }
    }

    const data = await response.json()
    const imageData = data.images?.[0]?.image?.bytesBase64Encoded
    if (imageData) {
      return { success: true, imageUrl: `data:image/png;base64,${imageData}` }
    }
    return { success: false, error: '未返回图片数据' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '网络错误' }
  }
}

// Flux 图片生成 (OpenAI 兼容端点)
async function generateWithFlux(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  try {
    const base = baseUrl.replace(/\/$/, '')
    const response = await fetch(`${base}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'flux-pro',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errMsg = (errorData as { error?: { message?: string }; detail?: { error?: string } }).error?.message
        || (errorData as { detail?: { error?: string } }).detail?.error
        || `HTTP ${response.status}`
      return { success: false, error: errMsg }
    }

    const data = await response.json()
    return parseImageResponse(data)
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '网络错误' }
  }
}

// 主入口函数
export async function generateImage(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  provider: 'dalle' | 'imagen' | 'flux',
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  switch (provider) {
    case 'dalle':
      return generateWithDalle(baseUrl, apiKey, model, prompt, signal)
    case 'imagen':
      return generateWithImagen(baseUrl, apiKey, prompt, signal)
    case 'flux':
      return generateWithFlux(baseUrl, apiKey, model, prompt, signal)
    default:
      return { success: false, error: `不支持的提供商: ${provider}` }
  }
}

// 获取提供商默认模型
export function getDefaultModel(provider: 'dalle' | 'imagen' | 'flux'): string {
  switch (provider) {
    case 'dalle':
      return 'gpt-image-2'
    case 'imagen':
      return 'imagen-3'
    case 'flux':
      return 'flux-pro'
    default:
      return 'gpt-image-2'
  }
}
