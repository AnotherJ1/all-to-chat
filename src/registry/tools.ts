import { lazy } from 'react'
import type { ToolMeta } from '../types'
import { IconChat, IconImage } from '../components/common/Icons'

/**
 * 工具注册表 — 平台所有可用工具的声明式配置
 * 新增工具只需在此数组中添加一个条目，路由和首页卡片自动生成。
 */
export const toolRegistry: ToolMeta[] = [
  {
    id: 'ai-chat',
    name: 'AI 聊天',
    description: '多模型对话，支持 OpenAI / Anthropic / Gemini',
    icon: IconChat,
    route: '/chat',
    component: lazy(() => import('../pages/ChatPage')),
  },
  {
    id: 'image-gen',
    name: '图片生成',
    description: '文生图，支持 DALL-E / Imagen / Flux',
    icon: IconImage,
    route: '/image',
    component: lazy(() => import('../pages/ImagePage')),
  },
]
