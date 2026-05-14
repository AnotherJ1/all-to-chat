// 协议类型
export type Protocol = 'openai' | 'anthropic' | 'gemini'

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
