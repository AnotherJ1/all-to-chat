// 统一 API 导出
export { chatCompletion } from './openai'
export { anthropicMessages } from './anthropic'
export { generateContent } from './gemini'
export { fetchModelList } from './openai'

import { chatCompletion } from './openai'
import { anthropicMessages } from './anthropic'
import { generateContent } from './gemini'
import type { Protocol, Message } from '../types'

// URL后缀映射
const API_PATHS: Record<Protocol, string> = {
  openai: '/v1/chat/completions',
  anthropic: '/v1/messages',
  gemini: '', // Gemini使用查询参数
}

interface ApiOptions {
  protocol: Protocol
  baseUrl: string
  apiKey: string
  model: string
  messages: Message[]
  systemPrompt?: string
  streaming?: boolean
  onChunk?: (chunk: string) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

// 统一 API 调用入口
export async function callApi(options: ApiOptions): Promise<string> {
  const { protocol } = options

  // 根据协议构建完整URL（只有OpenAI和Anthropic需要拼接后缀，Gemini单独处理）
  const baseUrl = options.baseUrl.replace(/\/$/, '')
  const path = API_PATHS[protocol]

  switch (protocol) {
    case 'openai': {
      const url = `${baseUrl}${path}`
      return chatCompletion({ ...options, url })
    }
    case 'anthropic': {
      const url = `${baseUrl}${path}`
      return anthropicMessages({ ...options, url })
    }
    case 'gemini': {
      // Gemini URL格式: baseUrl/models/model:generateContent?key=apiKey
      const url = `${baseUrl}/models/${options.model}:generateContent`
      return generateContent({ ...options, url })
    }
    default:
      throw new Error(`不支持的协议: ${protocol}`)
  }
}
