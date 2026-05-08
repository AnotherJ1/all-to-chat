// 图片生成API - 支持 DALL-E, Imagen, Flux

export interface ImageGenerationRequest {
  baseUrl: string
  apiKey: string
  model: string
  prompt: string
  provider: 'dalle' | 'imagen' | 'flux'
}

export interface ImageGenerationResult {
  success: boolean
  imageUrl?: string
  error?: string
}

// DALL-E 图片生成 (OpenAI 兼容)
async function generateWithDalle(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<ImageGenerationResult> {
  try {
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { success: false, error: errorData.error?.message || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { success: true, imageUrl: data.data[0]?.url }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Google Imagen 图片生成
async function generateWithImagen(
  baseUrl: string,
  apiKey: string,
  prompt: string
): Promise<ImageGenerationResult> {
  try {
    // Imagen 使用 Vertex AI 或 Google AI API
    const endpoint = baseUrl.includes('vertexai')
      ? `${baseUrl}/images:generate`
      : `https://generativelanguage.googleapis.com/v1beta/models/imagen-3-generate:generateImage`

    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        numberOfImages: 1,
        aspectRatio: '1:1',
        personGeneration: 'dont_allow',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { success: false, error: errorData.error?.message || `HTTP ${response.status}` }
    }

    const data = await response.json()
    // Imagen 返回 base64 编码的图片或 URL
    const imageData = data.images?.[0]?.image?.bytesBase64Encoded
    if (imageData) {
      return { success: true, imageUrl: `data:image/png;base64,${imageData}` }
    }
    return { success: false, error: 'No image returned' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Flux 图片生成 (通常通过 Replicate 或 OpenAI 兼容 API)
async function generateWithFlux(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<ImageGenerationResult> {
  try {
    // Flux 通常使用 Replicate API 或 OpenAI 兼容端点
    const response = await fetch(`${baseUrl}/images/generations`, {
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
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { success: false, error: errorData.error?.message || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { success: true, imageUrl: data.data[0]?.url }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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
      return { success: false, error: `Unknown provider: ${provider}` }
  }
}

// 获取提供商默认模型
export function getDefaultModel(provider: 'dalle' | 'imagen' | 'flux'): string {
  switch (provider) {
    case 'dalle':
      return 'dall-e-3'
    case 'imagen':
      return 'imagen-3'
    case 'flux':
      return 'flux-pro'
    default:
      return 'dall-e-3'
  }
}
