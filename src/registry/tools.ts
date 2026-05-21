import { lazy } from 'react'
import type { ToolMeta } from '../types'
import { IconChat, IconImage, IconJson, IconDatabase, IconBase64, IconClock, IconLink, IconCron, IconDiff, IconCollage, IconQrCode } from '../components/common/Icons'

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
  {
    id: 'timestamp',
    name: '时间戳转换',
    description: 'Unix 时间戳 ↔ 日期，多时区与相对时间',
    icon: IconClock,
    route: '/timestamp',
    component: lazy(() => import('../pages/TimestampPage')),
  },
  {
    id: 'url-tool',
    name: 'URL 工具',
    description: 'URL 编解码 + Query 参数可视化',
    icon: IconLink,
    route: '/url',
    component: lazy(() => import('../pages/UrlToolPage')),
  },
  {
    id: 'cron',
    name: 'Cron 可视化',
    description: '解析 Cron 表达式并预览未来执行时间',
    icon: IconCron,
    route: '/cron',
    component: lazy(() => import('../pages/CronPage')),
  },
  {
    id: 'text-diff',
    name: '文本对比',
    description: '行级 diff，双栏对照 / 统一视图',
    icon: IconDiff,
    route: '/diff',
    component: lazy(() => import('../pages/DiffPage')),
  },
  {
    id: 'collage',
    name: '自由拼图',
    description: '多图自由画布：拖动、缩放，一键导出 PNG / JPG / 剪贴板',
    icon: IconCollage,
    route: '/collage',
    component: lazy(() => import('../pages/CollagePage')),
  },
  {
    id: 'qr-code',
    name: '二维码工具',
    description: '二维码快速生成与解析，支持自定义 Logo 和颜色',
    icon: IconQrCode,
    route: '/qr-code',
    component: lazy(() => import('../pages/QrCodePage')),
  },
]
