import { ComponentType, LazyExoticComponent, CSSProperties } from 'react'

// 工具分类
export type ToolCategory = 'ai' | 'text-data' | 'dev' | 'image' | 'encode'

// 工具元数据类型
export interface ToolMeta {
  /** 工具唯一标识符 */
  id: string
  /** 工具显示名称 */
  name: string
  /** 工具简短描述 */
  description: string
  /** 工具图标组件 */
  icon: ComponentType<{ className?: string; style?: CSSProperties }>
  /** 路由路径（如 '/chat'） */
  route: string
  /** 懒加载的页面组件 */
  component: LazyExoticComponent<ComponentType>
  /** 是否禁用（禁用时点击提示暂未开放） */
  disabled?: boolean
  /** 分类归属 */
  category: ToolCategory
  /** 搜索别名/拼音/英文缩写 */
  keywords?: string[]
}

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
