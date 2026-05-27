# 首页工具分类 + 搜索 + 命令面板 — 设计文档

- 日期：2026-05-27
- 状态：Draft（待用户审阅）
- 范围：首页（`/`）+ 工具注册表元数据
- 不在范围：工具页面内部、布局/导航重构、主题与设置、后端持久化

## 1. 背景与问题

当前首页（`src/pages/HomePage.tsx`）将 `toolRegistry` 中的 18 个工具直接平铺为 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` 的卡片网格，无搜索、无分类、无快捷入口，首屏需要滚动并用肉眼扫描才能找到目标工具。随着工具持续增加，发现成本会继续升高。

## 2. 目标

- 把工具按语义分组渲染，降低视觉扫描成本
- 提供顶部搜索框，名称 / 描述 / 别名命中即过滤
- 提供 Ctrl/Cmd + K 命令面板，全局快速跳转

## 3. 非目标（YAGNI）

- 不做"最近使用 / 收藏"
- 不做侧边栏 / 工作区布局重构
- 不调整卡片密度（保持现有三列与间距）
- 命令面板只做"工具跳转"，不接其他动作（主题切换等）
- 不引入 cmdk 等第三方依赖，自研即可
- 不做模糊算法（fuzzy），18 个工具用 `includes` 足够

## 4. 数据模型变更

### 4.1 `src/types/index.ts`

新增分类联合类型与可选关键字字段：

```ts
export type ToolCategory = 'ai' | 'text-data' | 'dev' | 'image' | 'encode'

export interface ToolMeta {
  // ...现有字段
  category: ToolCategory        // 必填
  keywords?: string[]           // 可选，搜索别名/拼音/英文缩写
}
```

`category` 设为必填，强制每个工具显式归属，避免漏分类。

### 4.2 `src/registry/categories.ts`（新文件）

```ts
import type { ComponentType, CSSProperties } from 'react'
import type { ToolCategory } from '../types'
// 视情况引入图标

export interface CategoryMeta {
  id: ToolCategory
  name: string            // 中文显示名
  icon?: ComponentType<{ className?: string; style?: CSSProperties }>
  order: number           // 渲染顺序
}

export const categoryRegistry: CategoryMeta[] = [
  { id: 'ai',        name: 'AI 智能',     order: 1 },
  { id: 'text-data', name: '文本与数据',   order: 2 },
  { id: 'dev',       name: '开发辅助',     order: 3 },
  { id: 'image',     name: '图像处理',     order: 4 },
  { id: 'encode',    name: '编码与时间',   order: 5 },
]
```

分类图标首期可选；如果不想引新图标可省略 `icon` 字段，在标题前用 emoji 或纯文字过渡。

### 4.3 工具分类归属

| 分类 | 工具 |
|---|---|
| `ai` | ai-chat, image-gen |
| `text-data` | json-formatter, text-diff, data-convert, csv, markdown |
| `dev` | mybatis-log, curl, id-gen, cron |
| `image` | collage, qr-code, base64-image, image-compress, color |
| `encode` | url-tool, timestamp |

## 5. 搜索

### 5.1 搜索函数 `src/lib/searchTools.ts`

```ts
export function searchTools(query: string, tools: ToolMeta[]): ToolMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools
  return tools.filter((t) => {
    const haystack = [
      t.name,
      t.description,
      ...(t.keywords ?? []),
    ].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}
```

- 大小写不敏感
- 多字段拼接后 `includes` 匹配
- `keywords` 用来塞拼音首字母 / 英文别名（例如 JSON 工具加 `['jsn', 'gsh', '格式化']`），首期可只给少数工具补，后续按需补充
- 禁用的工具（`disabled`）仍参与搜索与展示（与当前一致），点击时已有 toast 提示

### 5.2 顶部搜索框 `src/components/common/SearchBar.tsx`

- 受控组件：`{ value, onChange, onSubmit?, placeholder }`
- 视觉：复用现有 token（`var(--text-*)`、`var(--surface-*)`），与卡片风格一致
- 行为：输入即时过滤；右侧显示 `⌘K` 提示徽标，点击徽标打开命令面板（与全局快捷键等价）

## 6. 命令面板 `src/components/common/CommandPalette.tsx`

- 触发：全局监听 `Ctrl/Cmd + K`（在 `App.tsx` 注册一次）
- UI：居中浮层，遮罩 + 卡片，输入框 + 结果列表（最多展示前 8 条）
- 交互：
  - 输入过滤（共用 `searchTools`）
  - `ArrowUp` / `ArrowDown` 移动选中项
  - `Enter` 跳转到选中工具的 `route`
  - `Esc` 或点击遮罩关闭
  - 禁用的工具也可选中，跳转时由 `HomePage` 现有逻辑改造为：禁用工具跳转时弹 toast 而非真正 navigate（命令面板内同样判断 `disabled` 并 toast）
- 状态：组件内本地 `useState`，无需 store
- 不持久化、无历史记录

## 7. 首页改造 `src/pages/HomePage.tsx`

伪结构：

```tsx
const [query, setQuery] = useState('')
const filtered = searchTools(query, toolRegistry)
const groups = categoryRegistry.map((cat) => ({
  cat,
  tools: filtered.filter((t) => t.category === cat.id),
})).filter((g) => g.tools.length > 0)

return (
  <Layout>
    <Header />
    <SearchBar value={query} onChange={setQuery} />
    {groups.length === 0 ? (
      <EmptyState message="没有找到相关工具" />
    ) : (
      groups.map(({ cat, tools }) => (
        <section key={cat.id}>
          <h2>{cat.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {tools.map((tool) => <ToolCard ... />)}
          </div>
        </section>
      ))
    )}
    <CommandPalette />
  </Layout>
)
```

- 分组标题左对齐，下方一条细分隔线（border-bottom + opacity 调低），与卡片间留出适度间距
- 搜索为空且分类全显时：5 组从上到下依序渲染
- 搜索命中时：自动隐藏空分组
- 网格列数保持现状（1/2/3 列）

## 8. 文件改动清单

| 文件 | 类型 | 操作 |
|---|---|---|
| `src/types/index.ts` | 修改 | 加 `ToolCategory`、`category`、`keywords` |
| `src/registry/tools.ts` | 修改 | 给 18 个工具补 `category`，按需补 `keywords` |
| `src/registry/categories.ts` | 新建 | 分类元数据 + 排序 |
| `src/lib/searchTools.ts` | 新建 | 搜索过滤函数（纯函数，可单测） |
| `src/components/common/SearchBar.tsx` | 新建 | 顶部搜索框 |
| `src/components/common/CommandPalette.tsx` | 新建 | ⌘K 浮层 |
| `src/pages/HomePage.tsx` | 修改 | 分组渲染 + 搜索接线 + 挂载命令面板 |
| `src/App.tsx`（如需）| 修改 | 全局快捷键 hook 或将 CommandPalette 提升到根节点 |

## 9. 主题与样式

- 所有新增组件复用现有主题 CSS 变量（`var(--text-primary)` / `var(--surface-*)` / `var(--font-body)` 等），不引入新主题分支
- Motion / Claymorphism / Cyberpunk 三种主题下表现一致（不为命令面板做特化样式，仅保证背景遮罩、卡片层级与现有风格不冲突）

## 10. 验收标准

- 首页打开时按 5 个分类展示工具，每组前有标题
- 顶部搜索框输入"json"过滤出 JSON 格式化（及其他命中项），空分组不渲染
- 输入无匹配字符显示空状态文案
- 在任意页面按 Ctrl/Cmd + K 打开命令面板，输入关键字 → ↑↓ → Enter 跳转工具
- 在命令面板点选禁用工具不会真正导航，会弹 toast
- `npm run build` 和 `npm run lint` 通过

## 11. 风险与缓解

- **风险**：`category` 改为必填会让 `tools.ts` 编译失败 → **缓解**：与字段添加同 PR 一次性补完所有工具
- **风险**：⌘K 与浏览器/系统快捷键冲突 → **缓解**：仅在浏览器内 `preventDefault`，输入框聚焦时不抢键；macOS 用 Cmd，其他用 Ctrl，按 `event.metaKey || event.ctrlKey` 判断
- **风险**：搜索过滤后所有分组都空 → **缓解**：显示明确的空状态而非空白页

## 12. 后续可扩展（不在本期）

- 收藏 / 最近使用（如未来需要）
- 命令面板支持非工具动作（主题、设置）
- 工具数 30+ 时再考虑卡片密度调整
