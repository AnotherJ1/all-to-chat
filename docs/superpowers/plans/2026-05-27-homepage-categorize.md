# 首页工具分类 + 搜索 + 命令面板 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首页 18 个工具按 5 个分类分组渲染，加顶部搜索框过滤，并提供 Ctrl/Cmd + K 全局命令面板跳转。

**Architecture:** 在 `ToolMeta` 加 `category` / `keywords` 字段；新建 `categoryRegistry` 与 `searchTools` 纯函数；首页按分类分组渲染并接搜索框；命令面板挂在 `App` 根节点上，通过全局快捷键打开，与首页搜索共享同一过滤函数。

**Tech Stack:** React 18 + react-router-dom v6 + Zustand + Vite + Vitest + @testing-library/react + Tailwind 3 + 现有 CSS 变量主题系统。

参考设计文档：`docs/superpowers/specs/2026-05-27-homepage-categorize-design.md`

---

## 文件结构

| 文件 | 类型 | 责任 |
|---|---|---|
| `src/types/index.ts` | 修改 | 加 `ToolCategory` 联合类型，给 `ToolMeta` 加 `category`、`keywords` 字段 |
| `src/registry/categories.ts` | 新建 | 分类元数据（id / 中文名 / 排序），唯一来源 |
| `src/registry/tools.ts` | 修改 | 给 18 个工具补 `category`，按需补 `keywords` |
| `src/lib/searchTools.ts` | 新建 | 纯函数：按 query 过滤工具，可单测 |
| `src/lib/__tests__/searchTools.test.ts` | 新建 | searchTools 单元测试 |
| `src/components/common/SearchBar.tsx` | 新建 | 顶部受控搜索输入框 + ⌘K 提示徽标 |
| `src/components/common/CommandPalette.tsx` | 新建 | 居中浮层 + 输入 + 键盘导航 + 跳转 |
| `src/stores/commandPaletteStore.ts` | 新建 | 全局开关 store（open/close） |
| `src/App.tsx` | 修改 | 挂载 `<CommandPalette />`，注册 ⌘K 全局监听 |
| `src/pages/HomePage.tsx` | 修改 | 顶部加搜索框；按 category 分组渲染；空状态 |
| `src/__tests__/registry.test.ts` | 修改 | 加 `category` 字段断言 |
| `src/__tests__/homepage.test.tsx` | 修改 | 适配分组结构 + 搜索过滤断言 |
| `src/__tests__/commandPalette.test.tsx` | 新建 | 命令面板交互测试 |

---

## Task 1: 扩展 ToolMeta 类型并新建分类注册表

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/registry/categories.ts`

- [ ] **Step 1: 在 types 中加 `ToolCategory` 与字段**

Edit `src/types/index.ts`，在 `ToolMeta` 上方插入 `ToolCategory`，并在 `ToolMeta` 中加 `category`、`keywords` 字段：

```ts
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
```

注意：`category` 改为必填，下一 Task 立刻补完所有工具，避免 TS 编译失败留太久。

- [ ] **Step 2: 新建 `src/registry/categories.ts`**

Create `src/registry/categories.ts`：

```ts
import type { ToolCategory } from '../types'

export interface CategoryMeta {
  id: ToolCategory
  /** 中文显示名 */
  name: string
  /** 渲染顺序 */
  order: number
}

export const categoryRegistry: CategoryMeta[] = [
  { id: 'ai',        name: 'AI 智能',     order: 1 },
  { id: 'text-data', name: '文本与数据',   order: 2 },
  { id: 'dev',       name: '开发辅助',     order: 3 },
  { id: 'image',     name: '图像处理',     order: 4 },
  { id: 'encode',    name: '编码与时间',   order: 5 },
]

/** 按 order 升序的分类列表（防御性副本） */
export function getOrderedCategories(): CategoryMeta[] {
  return [...categoryRegistry].sort((a, b) => a.order - b.order)
}
```

- [ ] **Step 3: 此时项目 TS 编译会失败（缺 category），先不修，由 Task 2 继续**

跳过编译检查，进入 Task 2。

- [ ] **Step 4: 提交**

```bash
git add src/types/index.ts src/registry/categories.ts
git commit -m "feat(types): add ToolCategory + category/keywords fields, add categoryRegistry"
```

---

## Task 2: 给所有工具补 category（修复编译）

**Files:**
- Modify: `src/registry/tools.ts`

- [ ] **Step 1: 替换整个 `toolRegistry` 数组，给每条加 `category`**

Edit `src/registry/tools.ts`，逐条添加 `category` 字段（不动现有顺序）：

| id | category |
|---|---|
| ai-chat | `ai` |
| image-gen | `ai` |
| json-formatter | `text-data` |
| mybatis-log | `dev` |
| base64-image | `image` |
| timestamp | `encode` |
| url-tool | `encode` |
| cron | `dev` |
| text-diff | `text-data` |
| collage | `image` |
| qr-code | `image` |
| curl | `dev` |
| color | `image` |
| data-convert | `text-data` |
| id-gen | `dev` |
| image-compress | `image` |
| markdown | `text-data` |
| csv | `text-data` |

对每个对象字面量，在 `component:` 那行之后追加 `category: 'xxx',`。例如：

```ts
{
  id: 'ai-chat',
  name: 'AI 聊天',
  description: '多模型对话，支持 OpenAI / Anthropic / Gemini',
  icon: IconChat,
  route: '/chat',
  component: lazy(() => import('../pages/ChatPage')),
  category: 'ai',
},
```

对 `image-gen` 那条同时保留 `disabled: true`：

```ts
{
  id: 'image-gen',
  name: '图片生成',
  description: '文生图，支持 DALL-E / Imagen / Flux',
  icon: IconImage,
  route: '/image',
  component: lazy(() => import('../pages/ImagePage')),
  disabled: true,
  category: 'ai',
},
```

- [ ] **Step 2: 运行 TS 编译验证**

Run: `npm run build`
Expected: 编译通过（dist 目录生成）。如失败，按报错继续补齐。

- [ ] **Step 3: 提交**

```bash
git add src/registry/tools.ts
git commit -m "feat(registry): assign category to all 18 tools"
```

---

## Task 3: searchTools 纯函数 + 单测（TDD）

**Files:**
- Create: `src/lib/searchTools.ts`
- Create: `src/lib/__tests__/searchTools.test.ts`

- [ ] **Step 1: 先写失败测试**

Create `src/lib/__tests__/searchTools.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { searchTools } from '../searchTools'
import type { ToolMeta } from '../../types'

function fakeTool(over: Partial<ToolMeta> & Pick<ToolMeta, 'id' | 'name'>): ToolMeta {
  return {
    description: '',
    icon: (() => null) as unknown as ToolMeta['icon'],
    route: '/' + over.id,
    component: {} as ToolMeta['component'],
    category: 'dev',
    ...over,
  }
}

describe('searchTools', () => {
  const tools: ToolMeta[] = [
    fakeTool({ id: 'json', name: 'JSON 格式化', description: 'JSON 压缩与美化', keywords: ['jsn', '格式化'] }),
    fakeTool({ id: 'csv', name: 'CSV ↔ JSON', description: 'CSV 与 JSON 互转' }),
    fakeTool({ id: 'curl', name: 'cURL 工具', description: 'cURL 转 fetch / axios' }),
  ]

  it('空 query 返回全部', () => {
    expect(searchTools('', tools)).toHaveLength(3)
  })

  it('仅空白的 query 返回全部', () => {
    expect(searchTools('   ', tools)).toHaveLength(3)
  })

  it('按 name 命中（大小写不敏感）', () => {
    const r = searchTools('json', tools)
    expect(r.map((t) => t.id).sort()).toEqual(['csv', 'json'])
  })

  it('按 description 命中', () => {
    const r = searchTools('fetch', tools)
    expect(r.map((t) => t.id)).toEqual(['curl'])
  })

  it('按 keywords 命中', () => {
    const r = searchTools('jsn', tools)
    expect(r.map((t) => t.id)).toEqual(['json'])
  })

  it('中文命中', () => {
    const r = searchTools('压缩', tools)
    expect(r.map((t) => t.id)).toEqual(['json'])
  })

  it('未命中返回空数组', () => {
    expect(searchTools('xxxxxx', tools)).toEqual([])
  })

  it('大小写无关', () => {
    expect(searchTools('JSON', tools).map((t) => t.id).sort()).toEqual(['csv', 'json'])
  })

  it('不修改原数组', () => {
    const copy = [...tools]
    searchTools('json', tools)
    expect(tools).toEqual(copy)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- src/lib/__tests__/searchTools.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `searchTools`**

Create `src/lib/searchTools.ts`：

```ts
import type { ToolMeta } from '../types'

/**
 * 按 query 在 name + description + keywords 上做大小写不敏感的 includes 匹配。
 * 空白 query 返回原数组（保序）。
 */
export function searchTools(query: string, tools: ToolMeta[]): ToolMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools
  return tools.filter((t) => {
    const haystack = [t.name, t.description, ...(t.keywords ?? [])]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- src/lib/__tests__/searchTools.test.ts`
Expected: 9 passed.

- [ ] **Step 5: 提交**

```bash
git add src/lib/searchTools.ts src/lib/__tests__/searchTools.test.ts
git commit -m "feat(lib): add searchTools pure function with tests"
```

---

## Task 4: SearchBar 组件

**Files:**
- Create: `src/components/common/SearchBar.tsx`

- [ ] **Step 1: 创建 SearchBar**

Create `src/components/common/SearchBar.tsx`：

```tsx
import { useEffect, useState } from 'react'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  /** 点击右侧 ⌘K 徽标时调用 */
  onOpenPalette?: () => void
  placeholder?: string
}

/**
 * 顶部受控搜索框 + ⌘K / Ctrl+K 提示徽标。
 * 仅做视觉与受控转发；过滤逻辑由调用方处理。
 */
export default function SearchBar({ value, onChange, onOpenPalette, placeholder = '搜索工具...' }: SearchBarProps) {
  const [isMac, setIsMac] = useState(false)
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/mac/i.test(navigator.platform))
    }
  }, [])

  return (
    <div
      className="flex items-center w-full max-w-2xl mx-auto rounded-xl px-4 py-3 gap-3"
      style={{
        background: 'var(--surface-elevated, var(--bg-secondary))',
        border: '1px solid var(--border-color, rgba(127,127,127,0.2))',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="搜索工具"
        className="flex-1 bg-transparent outline-none"
        style={{ color: 'inherit', fontSize: '0.95rem' }}
      />

      {onOpenPalette && (
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="打开命令面板"
          className="px-2 py-1 rounded-md text-xs opacity-70 hover:opacity-100"
          style={{ border: '1px solid var(--border-color, rgba(127,127,127,0.25))' }}
        >
          {isMac ? '⌘K' : 'Ctrl K'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 构建检查**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add src/components/common/SearchBar.tsx
git commit -m "feat(ui): add SearchBar component with cmd-k hint"
```

---

## Task 5: commandPaletteStore + CommandPalette 组件

**Files:**
- Create: `src/stores/commandPaletteStore.ts`
- Create: `src/components/common/CommandPalette.tsx`

- [ ] **Step 1: 创建开关 store**

Create `src/stores/commandPaletteStore.ts`：

```ts
import { create } from 'zustand'

interface CommandPaletteState {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
```

- [ ] **Step 2: 创建命令面板组件**

Create `src/components/common/CommandPalette.tsx`：

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toolRegistry } from '../../registry/tools'
import { searchTools } from '../../lib/searchTools'
import { useCommandPaletteStore } from '../../stores/commandPaletteStore'
import { toast } from '../../stores/toastStore'

const MAX_RESULTS = 8

export default function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open)
  const setOpen = useCommandPaletteStore((s) => s.setOpen)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(
    () => searchTools(query, toolRegistry).slice(0, MAX_RESULTS),
    [query],
  )

  // 打开时清空状态并聚焦输入
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // results 变化时把选中索引夹回合法范围
  useEffect(() => {
    setSelectedIndex((i) => (results.length === 0 ? 0 : Math.min(i, results.length - 1)))
  }, [results.length])

  if (!open) return null

  const handleSelect = (index: number) => {
    const tool = results[index]
    if (!tool) return
    if (tool.disabled) {
      toast.info('该功能暂未开放，敬请期待')
      setOpen(false)
      return
    }
    navigate(tool.route)
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-label="命令面板"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      onClick={() => setOpen(false)}
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color, rgba(127,127,127,0.25))',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入关键字搜索工具..."
          aria-label="命令面板搜索框"
          className="w-full px-4 py-3 bg-transparent outline-none"
          style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color, rgba(127,127,127,0.2))' }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSelectedIndex((i) => (results.length ? (i + 1) % results.length : 0))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSelectedIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              handleSelect(selectedIndex)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
            }
          }}
        />

        <ul role="listbox" className="max-h-80 overflow-auto">
          {results.length === 0 ? (
            <li
              className="px-4 py-6 text-center"
              style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}
            >
              没有找到相关工具
            </li>
          ) : (
            results.map((tool, i) => (
              <li
                key={tool.id}
                role="option"
                aria-selected={i === selectedIndex}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => handleSelect(i)}
                className="px-4 py-3 cursor-pointer flex items-center gap-3"
                style={{
                  background: i === selectedIndex ? 'var(--surface-elevated, rgba(127,127,127,0.12))' : 'transparent',
                  opacity: tool.disabled ? 0.6 : 1,
                }}
              >
                <span style={{ fontWeight: 600 }}>{tool.name}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{tool.description}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 构建检查**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 4: 提交**

```bash
git add src/stores/commandPaletteStore.ts src/components/common/CommandPalette.tsx
git commit -m "feat(ui): add CommandPalette overlay with keyboard navigation"
```

---

## Task 6: 在 App 中挂载命令面板 + 全局 ⌘K 监听

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 编辑 App.tsx**

在 `src/App.tsx`：

1. 顶部新增导入：

```tsx
import { useEffect } from 'react'
import CommandPalette from './components/common/CommandPalette'
import { useCommandPaletteStore } from './stores/commandPaletteStore'
```

（`useEffect` 已存在，确认即可。）

2. 新增一个 hook 组件，注册全局监听：

```tsx
function CommandPaletteHotkey() {
  const toggle = useCommandPaletteStore((s) => s.toggle)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])
  return null
}
```

3. 在 `App()` return 中，把 `<CommandPaletteHotkey />` 放到 `<ThemeSync />` 旁边（在 `BrowserRouter` 之外也可，但 `CommandPalette` 内部用了 `useNavigate`，必须放在 `BrowserRouter` 之内）。最终结构：

```tsx
<ErrorBoundary>
  <ThemeSync />
  <BrowserRouter>
    <CommandPaletteHotkey />
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {toolRegistry.map((tool) => (
          <Route
            key={tool.id}
            path={tool.route}
            element={tool.disabled ? <Navigate to="/" replace /> : <tool.component />}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    <CommandPalette />
  </BrowserRouter>
  <ThemeSwitcher />
  <ToastContainer />
</ErrorBoundary>
```

- [ ] **Step 2: 构建检查**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add src/App.tsx
git commit -m "feat(app): mount CommandPalette + global cmd/ctrl+k hotkey"
```

---

## Task 7: HomePage 改造为分组渲染 + 顶部搜索

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: 重写 HomePage**

替换 `src/pages/HomePage.tsx` 整个文件为：

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toolRegistry } from '../registry/tools'
import { getOrderedCategories } from '../registry/categories'
import ToolCard from '../components/common/ToolCard'
import Logo from '../components/common/Logo'
import SearchBar from '../components/common/SearchBar'
import { useThemeStore } from '../stores/themeStore'
import { useCommandPaletteStore } from '../stores/commandPaletteStore'
import { searchTools } from '../lib/searchTools'
import { toast } from '../stores/toastStore'
import type { ToolMeta } from '../types'

export default function HomePage() {
  const navigate = useNavigate()
  const style = useThemeStore((s) => s.style)
  const openPalette = useCommandPaletteStore((s) => s.setOpen)

  const [query, setQuery] = useState('')

  const filtered = useMemo(() => searchTools(query, toolRegistry), [query])

  const groups = useMemo(() => {
    const cats = getOrderedCategories()
    return cats
      .map((cat) => ({ cat, tools: filtered.filter((t) => t.category === cat.id) }))
      .filter((g) => g.tools.length > 0)
  }, [filtered])

  const handleToolClick = (tool: ToolMeta) => {
    if (tool.disabled) {
      toast.info('该功能暂未开放，敬请期待')
      return
    }
    navigate(tool.route)
  }

  // 为每张卡片计算稳定的全局 index，保证强调色随分类位置不抖
  let runningIndex = 0

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-16 relative overflow-hidden">
      {style === 'motion' && <div className="fixed inset-0 motion-gradient-bg pointer-events-none" />}
      {style === 'claymorphism' && (
        <>
          <div className="clay-blob" style={{ width: '400px', height: '400px', background: '#a78bfa', top: '-100px', left: '-100px' }} />
          <div className="clay-blob" style={{ width: '300px', height: '300px', background: '#f472b6', bottom: '-80px', right: '-80px' }} />
        </>
      )}
      {style === 'cyberpunk' && <div className="fixed inset-0 cyber-scanlines pointer-events-none" />}

      <header className="text-center mb-12 relative z-10">
        <div className="flex items-center justify-center mb-4">
          <Logo size={56} />
        </div>
        <h1
          className={`font-bold tracking-tight ${style === 'motion' ? 'motion-float' : ''}`}
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)',
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            lineHeight: 1.1,
          }}
        >
          Tool Hub
        </h1>
        <p className="mt-3" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontFamily: 'var(--font-body)' }}>
          AI 驱动的创作工具集
        </p>
      </header>

      <div className="w-full max-w-5xl relative z-10 mb-12">
        <SearchBar value={query} onChange={setQuery} onOpenPalette={() => openPalette(true)} />
      </div>

      <div className="w-full max-w-5xl relative z-10 flex flex-col gap-12">
        {groups.length === 0 ? (
          <div
            className="text-center py-12"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            没有找到相关工具
          </div>
        ) : (
          groups.map(({ cat, tools }) => (
            <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
              <h2
                id={`cat-${cat.id}`}
                className="mb-5 pb-2 font-semibold"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border-color, rgba(127,127,127,0.18))',
                }}
              >
                {cat.name}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '0.5rem', fontWeight: 400 }}>
                  {tools.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {tools.map((tool) => {
                  const idx = runningIndex++
                  return (
                    <ToolCard key={tool.id} tool={tool} onClick={() => handleToolClick(tool)} index={idx} />
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
```

注意：`runningIndex` 在 render 函数体内累加，每次 render 都会从 0 开始，不会跨次累计；只用于给 `ToolCard` 的 `index` 提供稳定的全局序号。

- [ ] **Step 2: 启动 dev 服务器手动验证**

Run: `npm run dev`
打开 `http://127.0.0.1:5173`，确认：
- 标题下出现搜索框
- 工具按 5 个分类分组渲染，每组前有标题与计数
- 输入 `json` 后只剩"文本与数据"分组下的 JSON 格式化、CSV、数据格式互转等命中项
- 输入 `xxxxxx` 显示"没有找到相关工具"
- 按 `Ctrl/Cmd + K` 打开命令面板，输入关键字、用 ↑↓ + Enter 跳转

如确认无误，Ctrl+C 停止 dev。

- [ ] **Step 3: 提交**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(home): group tools by category and add top search"
```

---

## Task 8: 更新现有 registry 测试

**Files:**
- Modify: `src/__tests__/registry.test.ts`

- [ ] **Step 1: 新增 category 字段断言**

在 `src/__tests__/registry.test.ts` 文件末尾、最外层 `describe` 内的最后一个测试之后，插入以下断言：

```ts
  it.each(toolRegistry)('条目 "$id" 的 category 应为合法值', (entry) => {
    expect(['ai', 'text-data', 'dev', 'image', 'encode']).toContain(entry.category)
  })

  it('每个 categoryRegistry 中的分类都至少有一个工具归属', async () => {
    const { categoryRegistry } = await import('../registry/categories')
    for (const cat of categoryRegistry) {
      const has = toolRegistry.some((t) => t.category === cat.id)
      expect(has, `category ${cat.id} should have at least one tool`).toBe(true)
    }
  })
```

- [ ] **Step 2: 运行 registry 测试**

Run: `npm test -- src/__tests__/registry.test.ts`
Expected: 全部通过（含新增 2 项）。

- [ ] **Step 3: 提交**

```bash
git add src/__tests__/registry.test.ts
git commit -m "test(registry): assert category field + category coverage"
```

---

## Task 9: 更新现有 homepage 测试

**Files:**
- Modify: `src/__tests__/homepage.test.tsx`

旧测试在新分组结构下仍然成立（所有工具名/描述/按钮数仍应渲染），但需要补充"分组标题渲染"与"搜索过滤"两个断言。

- [ ] **Step 1: 在文件末尾追加新 describe 块**

在 `src/__tests__/homepage.test.tsx` 末尾追加：

```tsx
import { fireEvent } from '@testing-library/react'
import { categoryRegistry } from '../registry/categories'

describe('首页分类与搜索', () => {
  it('应渲染所有分类标题', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    for (const cat of categoryRegistry) {
      expect(screen.getByText(cat.name)).toBeInTheDocument()
    }
  })

  it('输入搜索词后只显示命中的工具', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const input = screen.getByLabelText('搜索工具') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JSON' } })

    // 命中的工具仍可见
    expect(screen.getByText('JSON 格式化')).toBeInTheDocument()
    // 未命中的工具不应再可见（例如 cron）
    expect(screen.queryByText('Cron 可视化')).toBeNull()
  })

  it('零匹配时显示空状态文案', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const input = screen.getByLabelText('搜索工具') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zzzzzzzz' } })

    expect(screen.getByText('没有找到相关工具')).toBeInTheDocument()
  })
})
```

注意：`fireEvent` 的导入要加到现有 `@testing-library/react` 的 import 行里。如果原来是：

```tsx
import { render, screen } from '@testing-library/react'
```

改为：

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
```

并删除上面我额外写的 `import { fireEvent } from ...`，保持单一 import 源。

- [ ] **Step 2: 运行 homepage 测试**

Run: `npm test -- src/__tests__/homepage.test.tsx`
Expected: 旧 4 个测试 + 新 3 个测试全部通过。

如旧测试 "应渲染恰好 N 个工具卡片" 因分组结构未失败则不需调整；如确实因 React.StrictMode 或重复渲染失败，把它从 `toHaveLength` 改为 `>= toolRegistry.length`（但首期默认仍只渲染一次，应通过）。

- [ ] **Step 3: 提交**

```bash
git add src/__tests__/homepage.test.tsx
git commit -m "test(home): cover category headings and search filtering"
```

---

## Task 10: 命令面板交互测试

**Files:**
- Create: `src/__tests__/commandPalette.test.tsx`

- [ ] **Step 1: 写测试**

Create `src/__tests__/commandPalette.test.tsx`：

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CommandPalette from '../components/common/CommandPalette'
import { useCommandPaletteStore } from '../stores/commandPaletteStore'

function setup() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/json" element={<div>JSON_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CommandPalette', () => {
  beforeEach(() => {
    act(() => {
      useCommandPaletteStore.getState().setOpen(false)
    })
  })

  it('open=false 时不渲染', () => {
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('open=true 时渲染输入框', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    expect(screen.getByLabelText('命令面板搜索框')).toBeInTheDocument()
  })

  it('输入关键字过滤结果', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    const input = screen.getByLabelText('命令面板搜索框') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JSON 格式化' } })
    expect(screen.getByText('JSON 格式化')).toBeInTheDocument()
    expect(screen.queryByText('Cron 可视化')).toBeNull()
  })

  it('Enter 选中并跳转，面板关闭', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    const input = screen.getByLabelText('命令面板搜索框') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JSON 格式化' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('JSON_PAGE')).toBeInTheDocument()
    expect(useCommandPaletteStore.getState().open).toBe(false)
  })

  it('Escape 关闭面板', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    const input = screen.getByLabelText('命令面板搜索框') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(useCommandPaletteStore.getState().open).toBe(false)
  })

  it('零结果显示空状态', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    const input = screen.getByLabelText('命令面板搜索框') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zzzzzzzzz' } })
    expect(screen.getByText('没有找到相关工具')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行**

Run: `npm test -- src/__tests__/commandPalette.test.tsx`
Expected: 6 个测试全部通过。

- [ ] **Step 3: 提交**

```bash
git add src/__tests__/commandPalette.test.tsx
git commit -m "test(palette): cover open/close, filter, Enter, Escape, empty"
```

---

## Task 11: 全量校验 + 收尾

- [ ] **Step 1: 全套测试**

Run: `npm test`
Expected: 所有测试通过（含原有的所有套件）。如有失败，检查是否是 Task 9 中提到的 `homepage.test.tsx` 旧断言冲突，按 Task 9 的备注调整。

- [ ] **Step 2: lint**

Run: `npm run lint`
Expected: 0 errors（warning 可接受，但若新增文件产生 warning 应修复）。

- [ ] **Step 3: build**

Run: `npm run build`
Expected: 构建成功，无 TS 错误。

- [ ] **Step 4: dev 手动回归**

Run: `npm run dev`
浏览器打开 `http://127.0.0.1:5173`，验收清单：
- 首页按 5 个分类分组展示
- 搜索框输入 `json` 命中过滤
- 输入无匹配显示"没有找到相关工具"
- `Ctrl/Cmd + K` 打开命令面板
- 面板内 ↑↓ + Enter 跳转
- 面板内 Esc 关闭
- 点击禁用工具（图片生成）弹出 toast 而非跳转
- 切换主题（claymorphism / motion / cyberpunk）下视觉一致

Ctrl+C 停止。

- [ ] **Step 5: 收尾提交（如有未提交的小修复）**

```bash
git status
# 如果有遗留变更
git add -A
git commit -m "chore: post-implementation polish"
```

---

## 自检对照（规格覆盖）

| Spec 要求 | 实现 Task |
|---|---|
| ToolCategory + category/keywords | Task 1 |
| categoryRegistry | Task 1 |
| 18 工具补 category | Task 2 |
| searchTools 纯函数 | Task 3 |
| 顶部搜索框 | Task 4 + 7 |
| 命令面板（⌘K / Esc / 上下 / Enter / 空状态 / disabled toast） | Task 5 + 6 + 10 |
| 首页分组渲染 + 标题分隔线 + 空状态 | Task 7 |
| registry/category 断言 | Task 8 |
| homepage 分类与搜索断言 | Task 9 |
| 命令面板测试 | Task 10 |
| build / lint / test 全绿 | Task 11 |
