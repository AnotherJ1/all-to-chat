// 协议类型
export type Protocol = 'openai' | 'anthropic' | 'gemini'

// 模型配置
export interface ModelConfig {
  id: string
  protocol: Protocol
  baseUrl: string
  apiKey: string
  model: string
}

// 消息结构
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  imageUrls?: string[]
}

// 会话结构
export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

// 配置存储
export interface ConfigStore {
  protocol: Protocol
  baseUrl: string
  apiKey: string
  model: string
  theme: 'light' | 'dark'
}
