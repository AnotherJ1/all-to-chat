# Technical Design Document

## Introduction

本文档描述将现有 AI Chat Hub 单页应用重构为多工具平台（Tool Hub）的技术架构设计。重构后的平台采用 React Router 实现多页面路由，通过工具注册表机制支持工具的声明式注册，并以现代深色主题呈现统一的视觉体验。

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   App Shell                          │
│  ┌───────────────────────────────────────────────┐  │
│  │            React Router (BrowserRouter)        │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────┐  │  │
│  │  │HomePage │  │ToolPage  │  │  ToolPage   │  │  │
│  │  │(工具列表)│  │(/chat)   │  │  (/image)   │  │  │
│  │  └─────────┘  └──────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │              Zustand Stores                    │  │
│  │  configStore | sessionStore | imageHistory    │  │
│  │  multiModelStore | toastStore                 │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │              Tool Registry                    │  │
│  │  { id, name, description, icon, route, component }│
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**核心设计决策：**
- 路由层与工具层解耦：路由配置从 ToolRegistry 自动生成，新增工具无需修改路由代码
- 全屏工具页面：每个工具独占视口，不共享 HomePage 的布局壳
- Store 零迁移：保留所有现有 Zustand store 及其 persist key，确保用户数据无损

## Project Directory Structure

```
src/
├── main.tsx                    # 应用入口，挂载 RouterProvider
├── App.tsx                     # 根组件，包含 Router 配置
├── registry/
│   └── tools.ts                # 工具注册表（元数据 + 懒加载组件）
├── pages/
│   ├── HomePage.tsx            # 首页：工具卡片网格
│   ├── ChatPage.tsx            # AI 聊天工具页面壳
│   └── ImagePage.tsx           # 图片生成工具页面壳
├── components/
│   ├── common/
│   │   ├── ToolCard.tsx        # 工具卡片组件
│   │   ├── BackToHome.tsx      # 返回首页导航按钮
│   │   ├── Toast.tsx           # Toast 通知（保留）
│   │   ├── ErrorBoundary.tsx   # 错误边界（保留）
│   │   └── Icons.tsx           # SVG 图标集（保留+扩展）
│   ├── chat/
│   │   ├── ChatView.tsx        # 聊天主视图（保留）
│   │   ├── ChatMessage.tsx     # 消息气泡（保留）
│   │   ├── MessageInput.tsx    # 消息输入框（保留）
│   │   ├── SessionManager.tsx  # 会话管理（保留）
│   │   ├── Sidebar.tsx         # 聊天侧栏（保留）
│   │   └── SystemPromptInput.tsx
│   └── image/
│       └── ImageGenerator.tsx  # 图片生成器（保留）
├── api/                        # API 层（完全保留）
│   ├── index.ts
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── gemini.ts
│   └── imagegen.ts
├── stores/                     # 状态管理（完全保留）
│   ├── configStore.ts
│   ├── sessionStore.ts
│   ├── imageHistoryStore.ts
│   ├── multiModelStore.ts
│   └── toastStore.ts
├── lib/                        # 工具库（保留）
│   ├── sse.ts
│   └── uuid.ts
├── types/
│   └── index.ts                # 类型定义（扩展 ToolMeta 类型）
└── index.css                   # 全局样式（更新设计系统变量）
```

## Components

### 1. Tool Registry (`src/registry/tools.ts`)

工具注册表是平台的核心配置中心，维护所有可用工具的元数据和懒加载组件引用。

```typescript
import { lazy, ComponentType } from 'react'

export interface ToolMeta {
  id: string
  name: string
  description: string
  icon: ComponentType<{ className?: string }>
  route: string
  component: React.LazyExoticComponent<ComponentType>
}

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
```

**扩展方式：** 新增工具只需在数组中添加一个条目，路由和首页卡片自动生成。

### 2. Router Configuration (`src/App.tsx`)

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import HomePage from './pages/HomePage'
import { toolRegistry } from './registry/tools'
import ErrorBoundary from './components/common/ErrorBoundary'
import ToastContainer from './components/common/Toast'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            {toolRegistry.map((tool) => (
              <Route
                key={tool.id}
                path={tool.route}
                element={<tool.component />}
              />
            ))}
            {/* 未定义路由重定向到首页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <ToastContainer />
    </ErrorBoundary>
  )
}
```

### 3. HomePage (`src/pages/HomePage.tsx`)

```typescript
import { useNavigate } from 'react-router-dom'
import { toolRegistry } from '../registry/tools'
import ToolCard from '../components/common/ToolCard'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6">
      {/* 标题区域 */}
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Tool Hub
        </h1>
        <p className="mt-3 text-gray-400 text-lg">
          AI 驱动的创作工具集
        </p>
      </header>

      {/* 工具卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl w-full">
        {toolRegistry.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onClick={() => navigate(tool.route)}
          />
        ))}
      </div>
    </div>
  )
}
```

### 4. ToolCard (`src/components/common/ToolCard.tsx`)

```typescript
import type { ToolMeta } from '../../registry/tools'

interface ToolCardProps {
  tool: ToolMeta
  onClick: () => void
}

export default function ToolCard({ tool, onClick }: ToolCardProps) {
  const Icon = tool.icon

  return (
    <button
      onClick={onClick}
      className="group relative p-6 rounded-2xl border border-white/10
        bg-white/5 backdrop-blur-sm
        hover:border-white/20 hover:bg-white/[0.08]
        transition-all duration-200 cursor-pointer text-left"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20
        flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-cyan-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">
        {tool.name}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed">
        {tool.description}
      </p>
    </button>
  )
}
```

### 5. BackToHome (`src/components/common/BackToHome.tsx`)

```typescript
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft } from './Icons'

export default function BackToHome() {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/')}
      className="fixed top-4 left-4 z-50 w-9 h-9 rounded-xl
        bg-white/5 border border-white/10 backdrop-blur-sm
        flex items-center justify-center
        hover:bg-white/10 hover:border-white/20
        transition-all duration-200 cursor-pointer"
      aria-label="返回首页"
    >
      <IconArrowLeft className="w-4 h-4 text-gray-400" />
    </button>
  )
}
```

### 6. Tool Page Shell (以 ChatPage 为例)

```typescript
// src/pages/ChatPage.tsx
import { useEffect } from 'react'
import BackToHome from '../components/common/BackToHome'
import ChatView from '../components/chat/ChatView'
import Sidebar from '../components/chat/Sidebar'
import { useSessionStore } from '../stores/sessionStore'

export default function ChatPage() {
  const { sessions, createSession } = useSessionStore()

  useEffect(() => {
    if (sessions.length === 0) createSession()
  }, [])

  return (
    <div className="h-screen w-screen bg-gray-950 flex">
      <BackToHome />
      <Sidebar />
      <main className="flex-1 min-w-0">
        <ChatView />
      </main>
    </div>
  )
}
```

## Data Models

### ToolMeta 类型

```typescript
export interface ToolMeta {
  /** 工具唯一标识符 */
  id: string
  /** 工具显示名称 */
  name: string
  /** 工具简短描述 */
  description: string
  /** 工具图标组件 */
  icon: React.ComponentType<{ className?: string }>
  /** 路由路径（如 '/chat'） */
  route: string
  /** 懒加载的页面组件 */
  component: React.LazyExoticComponent<React.ComponentType>
}
```

### 现有类型保留（无变更）

```typescript
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
```

## UI Design System

### 颜色体系

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-base` | `#09090b` (zinc-950) | 页面背景 |
| `--bg-surface` | `#18181b` (zinc-900) | 卡片/面板背景 |
| `--bg-elevated` | `#27272a` (zinc-800) | 悬浮/弹出层 |
| `--border-default` | `rgba(255,255,255,0.1)` | 默认边框 |
| `--border-hover` | `rgba(255,255,255,0.2)` | 悬浮边框 |
| `--text-primary` | `#fafafa` (zinc-50) | 主要文字 |
| `--text-secondary` | `#a1a1aa` (zinc-400) | 次要文字 |
| `--text-muted` | `#71717a` (zinc-500) | 辅助文字 |
| `--accent-cyan` | `#22d3ee` | 主强调色 |
| `--accent-purple` | `#a855f7` | 辅强调色 |

### 字体

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

| 级别 | 大小 | 行高 | 字重 |
|------|------|------|------|
| H1 (页面标题) | 2.25rem (36px) | 1.2 | 700 |
| H2 (区域标题) | 1.5rem (24px) | 1.3 | 600 |
| H3 (卡片标题) | 1.125rem (18px) | 1.4 | 600 |
| Body | 0.875rem (14px) | 1.5 | 400 |
| Caption | 0.75rem (12px) | 1.4 | 400 |

### 间距系统

基于 4px 网格：4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96

| 场景 | 间距 |
|------|------|
| 组件内部 padding | 16px - 24px |
| 卡片间距 (gap) | 24px |
| 区域间距 | 48px - 64px |
| 页面边距 | 24px (mobile) / 48px (desktop) |

### 圆角

| 元素 | 圆角 |
|------|------|
| 按钮 | 12px (rounded-xl) |
| 卡片 | 16px (rounded-2xl) |
| 输入框 | 12px (rounded-xl) |
| 头像/图标容器 | 12px (rounded-xl) |

### 动画

```css
/* 标准过渡 */
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);

/* 悬浮效果 */
transition: border-color 200ms, background-color 200ms;
```

### Glass-morphism 卡片样式

```css
.tool-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}
.tool-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}
```

## Routing Architecture

```
/                → HomePage (工具列表)
/chat            → ChatPage (AI 聊天全屏)
/image           → ImagePage (图片生成全屏)
/*               → Navigate to / (兜底重定向)
```

**路由生成逻辑：** 从 `toolRegistry` 数组自动映射，无需手动维护路由表。

**Cloudflare Pages SPA 配置：** 在项目根目录添加 `public/_redirects` 文件：

```
/*    /index.html   200
```

## Migration Strategy

### 阶段 1：目录重组（无功能变更）

1. 创建 `src/pages/`、`src/registry/`、`src/components/common/`、`src/components/chat/`、`src/components/image/` 目录
2. 将现有组件移动到对应子目录：
   - `ChatView`, `ChatMessage`, `MessageInput`, `SessionManager`, `Sidebar`, `SystemPromptInput` → `components/chat/`
   - `ImageGenerator` → `components/image/`
   - `Toast`, `ErrorBoundary`, `Icons` → `components/common/`
3. 更新所有 import 路径
4. 验证构建通过

### 阶段 2：引入路由和注册表

1. 安装 `react-router-dom`
2. 创建 `src/registry/tools.ts` 工具注册表
3. 创建 `src/pages/HomePage.tsx`、`ChatPage.tsx`、`ImagePage.tsx`
4. 重写 `App.tsx` 为路由配置
5. 移除旧的 `Layout.tsx`、`Header.tsx`、`MainArea.tsx`（功能已被新页面壳替代）

### 阶段 3：UI 主题更新

1. 更新 `tailwind.config.js` 扩展颜色和字体配置
2. 更新 `index.css` CSS 变量为新设计系统
3. 创建 `ToolCard` 和 `BackToHome` 组件
4. 调整现有组件样式以匹配新设计语言

### 阶段 4：验证和清理

1. 验证所有路由正常工作
2. 验证 localStorage 数据正常加载
3. 验证 Cloudflare Pages 部署配置
4. 移除未使用的旧组件文件
5. 运行 `tsc -b && vite build` 确认无错误

### 保留清单

| 模块 | 处理方式 |
|------|----------|
| `src/api/*` | 完全保留，无变更 |
| `src/stores/*` | 完全保留，persist key 不变 |
| `src/lib/*` | 完全保留 |
| `src/types/index.ts` | 保留现有类型，新增 ToolMeta |
| 聊天相关组件 | 移动到 `components/chat/`，内部逻辑不变 |
| 图片生成组件 | 移动到 `components/image/`，内部逻辑不变 |

## Error Handling

| 场景 | 处理方式 |
|------|----------|
| 路由不存在 | `<Route path="*">` 重定向到首页 |
| 懒加载失败 | `<Suspense>` + `ErrorBoundary` 捕获并显示重试 UI |
| API 调用失败 | 现有 toast 通知机制保留 |
| Store 数据损坏 | Zustand persist 的 migrate 机制处理版本兼容 |

## Dependencies

### 新增依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `react-router-dom` | `^6.28.0` | 客户端路由 |

### 保留依赖（无变更）

react, react-dom, zustand, react-markdown, remark-gfm, highlight.js, date-fns

## Correctness Properties

*属性是系统在所有有效执行中应保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: 未定义路由重定向

*For any* URL path that is not registered in the toolRegistry and is not the root path `/`, navigating to that path SHALL result in a redirect to the HomePage at `/`.

**Validates: Requirements 1.7**

### Property 2: 首页渲染所有注册工具

*For any* state of the toolRegistry containing N tool entries, the HomePage SHALL render exactly N ToolCard components.

**Validates: Requirements 2.1**

### Property 3: 工具卡片导航正确性

*For any* tool entry in the toolRegistry, clicking its corresponding ToolCard on the HomePage SHALL navigate to the route path specified in that tool's metadata.

**Validates: Requirements 2.3**

### Property 4: 工具注册表结构完整性

*For any* entry in the toolRegistry array, the entry SHALL contain non-empty values for all required fields: id, name, description, icon, and route.

**Validates: Requirements 3.1, 2.4**

### Property 5: 工具页面返回导航

*For any* tool page rendered at a registered route, the page SHALL contain a navigation element that, when activated, navigates the user back to the HomePage at `/`.

**Validates: Requirements 4.2, 4.3**

### Property 6: Store 数据持久化 round-trip

*For any* valid Zustand store state object, serializing it to localStorage and then deserializing it back SHALL produce an equivalent state object with all fields preserved.

**Validates: Requirements 8.3**
