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

// DALL-E / OpenAI 兼容图片生成
// 适用于: OpenAI 官方、NewAPI/OneAPI 代理、chatgpt2api 等
async function generateWithDalle(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
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
        model: model || 'gpt-image-2',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
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

// Google Imagen 图片生成
async function generateWithImagen(
  baseUrl: string,
  apiKey: string,
  prompt: string
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
  prompt: string
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
  provider: 'dalle' | 'imagen' | 'flux'
): Promise<ImageGenerationResult> {
  switch (provider) {
    case 'dalle':
      return generateWithDalle(baseUrl, apiKey, model, prompt)
    case 'imagen':
      return generateWithImagen(baseUrl, apiKey, prompt)
    case 'flux':
      return generateWithFlux(baseUrl, apiKey, model, prompt)
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
