import { lazy } from 'react'
import type { ToolMeta } from '../types'
import { IconChat, IconImage, IconJson, IconDatabase, IconBase64 } from '../components/common/Icons'

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
    disabled: true,
  },
  {
    id: 'json-formatter',
    name: 'JSON 格式化',
    description: 'JSON 格式化/压缩，支持超大文件',
    icon: IconJson,
    route: '/json',
    component: lazy(() => import('../pages/JsonFormatterPage')),
  },
  {
    id: 'mybatis-log',
    name: 'MyBatis 日志转 SQL',
    description: '自动解析 MyBatis 日志为可执行 SQL',
    icon: IconDatabase,
    route: '/mybatis',
    component: lazy(() => import('../pages/MybatisLogPage')),
  },
  {
    id: 'base64-image',
    name: 'Base64 图片互转',
    description: '图片 ↔ Base64 双向转换，含多语言示例',
    icon: IconBase64,
    route: '/base64-image',
    component: lazy(() => import('../pages/Base64ImagePage')),
  },
]
