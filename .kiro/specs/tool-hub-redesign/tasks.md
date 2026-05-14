# Implementation Plan: Tool Hub Redesign

## Overview

将现有 AI Chat Hub 单页应用按 4 阶段迁移策略重构为多工具平台（Tool Hub）。按照目录重组 → 路由和注册表 → UI 主题更新 → 验证和清理的顺序，确保每一步构建通过且功能不回退。

## Tasks

- [x] 1. 阶段一：目录重组（无功能变更）
  - [x] 1.1 创建新目录结构并移动聊天相关组件
    - 创建 `src/pages/`、`src/registry/`、`src/components/common/`、`src/components/chat/`、`src/components/image/` 目录
    - 将 `ChatView.tsx`、`ChatMessage.tsx`、`MessageInput.tsx`、`SessionManager.tsx`、`Sidebar.tsx`、`SystemPromptInput.tsx` 移动到 `src/components/chat/`
    - 将 `ImageGenerator.tsx` 移动到 `src/components/image/`
    - 将 `Toast.tsx`、`ErrorBoundary.tsx`、`Icons.tsx` 移动到 `src/components/common/`
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 1.2 更新所有 import 路径并验证构建通过
    - 更新 `App.tsx`、`Layout.tsx`、`Header.tsx`、`MainArea.tsx` 中的 import 路径指向新位置
    - 更新组件内部的相互引用路径
    - 运行 `tsc -b && vite build` 确认无编译错误
    - _Requirements: 8.1, 8.2_

- [x] 2. 阶段二：引入路由和注册表
  - [x] 2.1 安装 react-router-dom 并创建类型定义
    - 执行 `npm install react-router-dom@^6.28.0`
    - 在 `src/types/index.ts` 中新增 `ToolMeta` 接口类型定义
    - _Requirements: 1.1, 3.1_

  - [x] 2.2 创建工具注册表 `src/registry/tools.ts`
    - 定义 `toolRegistry` 数组，包含 AI 聊天（route: `/chat`）和图片生成（route: `/image`）两个工具条目
    - 每个条目包含 id、name、description、icon、route、component（懒加载）字段
    - 导出类型化数组供 HomePage 和 Router 使用
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.3 创建页面壳组件
    - 创建 `src/pages/HomePage.tsx`：工具卡片网格页面，从 toolRegistry 读取数据
    - 创建 `src/pages/ChatPage.tsx`：全屏聊天页面壳，包含 Sidebar + ChatView + 初始化逻辑
    - 创建 `src/pages/ImagePage.tsx`：全屏图片生成页面壳，包含 ImageGenerator
    - _Requirements: 2.1, 2.2, 2.6, 4.1, 4.4_

  - [x] 2.4 重写 App.tsx 为路由配置
    - 使用 `BrowserRouter` + `Routes` + `Route` 配置路由
    - 根路径 `/` 渲染 HomePage
    - 从 toolRegistry 动态生成工具路由
    - 未定义路由 `*` 重定向到首页
    - 使用 `Suspense` 包裹懒加载组件
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 2.5 创建 Cloudflare Pages SPA fallback 配置
    - 创建 `public/_redirects` 文件，内容为 `/*    /index.html   200`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.6 移除旧布局组件
    - 删除 `src/components/Layout.tsx`、`src/components/Header.tsx`、`src/components/MainArea.tsx`（功能已被新页面壳替代）
    - 将 Header 中的设置弹窗逻辑迁移到 ChatPage 或独立组件中保留
    - 确认构建通过
    - _Requirements: 4.4, 8.1_

  - [x] 2.7 编写路由正确性属性测试
    - **Property 1: 未定义路由重定向**
    - **Validates: Requirements 1.7**

  - [x] 2.8 编写注册表结构完整性属性测试
    - **Property 4: 工具注册表结构完整性**
    - **Validates: Requirements 3.1, 2.4**

- [x] 3. Checkpoint - 路由和注册表验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 阶段三：UI 主题更新
  - [x] 4.1 更新 Tailwind 配置和全局 CSS 变量
    - 在 `tailwind.config.js` 中扩展颜色（zinc-950 背景、cyan/purple 强调色）和字体（Inter）配置
    - 更新 `src/index.css` 中的 CSS 变量为新设计系统定义的 token
    - 定义 glass-morphism 卡片样式类
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 4.2 创建 ToolCard 组件
    - 创建 `src/components/common/ToolCard.tsx`
    - 实现 glass-morphism 卡片样式：`bg-white/5 backdrop-blur-sm border-white/10`
    - 实现 hover 状态：`hover:border-white/20 hover:bg-white/[0.08]` 带 200ms 过渡
    - 显示工具图标、名称、描述
    - 添加 `cursor-pointer` 和无障碍属性
    - _Requirements: 2.4, 2.5, 5.5, 5.6, 5.7_

  - [x] 4.3 创建 BackToHome 导航组件
    - 创建 `src/components/common/BackToHome.tsx`
    - 使用 `useNavigate` 实现返回首页导航
    - 固定定位在左上角，glass 样式按钮
    - 添加 SVG 箭头图标和 `aria-label`
    - _Requirements: 4.2, 4.3, 5.7_

  - [x] 4.4 扩展 Icons.tsx 图标集
    - 在 `src/components/common/Icons.tsx` 中新增 `IconChat`、`IconImage`、`IconArrowLeft` SVG 图标组件
    - 确保所有图标使用统一的 `className` prop 接口
    - _Requirements: 5.7_

  - [x] 4.5 完善 HomePage 样式和响应式布局
    - 实现深色背景 `bg-gray-950`、居中布局、`max-w-4xl` 约束
    - 实现响应式网格：`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
    - 添加平台标题和 tagline
    - _Requirements: 2.6, 5.4, 6.1, 6.3_

  - [x] 4.6 编写首页渲染属性测试
    - **Property 2: 首页渲染所有注册工具**
    - **Validates: Requirements 2.1**

  - [x] 4.7 编写工具卡片导航属性测试
    - **Property 3: 工具卡片导航正确性**
    - **Validates: Requirements 2.3**

  - [x] 4.8 编写工具页面返回导航属性测试
    - **Property 5: 工具页面返回导航**
    - **Validates: Requirements 4.2, 4.3**

- [x] 5. Checkpoint - UI 主题和组件验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. 阶段四：验证和清理
  - [x] 6.1 验证所有路由和功能正常工作
    - 验证 `/`、`/chat`、`/image` 路由正确渲染对应页面
    - 验证未定义路由重定向到首页
    - 验证浏览器前进/后退按钮正常工作
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 6.2 验证 localStorage 数据持久化
    - 确认 configStore、sessionStore、imageHistoryStore 的 persist key 未变更
    - 验证聊天会话和图片生成历史在页面刷新后正常加载
    - _Requirements: 8.3, 8.4, 8.5_

  - [x] 6.3 编写 Store 数据持久化 round-trip 属性测试
    - **Property 6: Store 数据持久化 round-trip**
    - **Validates: Requirements 8.3**

  - [x] 6.4 清理未使用文件并最终构建验证
    - 确认 `src/components/` 根目录下无残留的旧组件文件（Layout、Header、MainArea、ComparisonPanel 等）
    - 运行 `tsc -b && vite build` 确认无错误
    - 验证 `public/_redirects` 文件存在且内容正确
    - _Requirements: 7.2, 7.3_

- [x] 7. Final checkpoint - 全量验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 阶段一确保目录重组不引入功能变更，构建通过即可进入下一阶段
- 阶段二是核心变更，引入路由后旧的 Layout/Header/MainArea 将被替代
- Header 中的设置弹窗（API 配置）需要在移除 Header 前迁移到 ChatPage 中
- 所有现有 Zustand store 的 persist key 不可变更，确保用户数据无损
- Property tests 使用 Vitest + @testing-library/react 编写

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.5"] },
    { "id": 4, "tasks": ["2.3", "4.4"] },
    { "id": 5, "tasks": ["2.4"] },
    { "id": 6, "tasks": ["2.6"] },
    { "id": 7, "tasks": ["2.7", "2.8"] },
    { "id": 8, "tasks": ["4.1"] },
    { "id": 9, "tasks": ["4.2", "4.3"] },
    { "id": 10, "tasks": ["4.5"] },
    { "id": 11, "tasks": ["4.6", "4.7", "4.8"] },
    { "id": 12, "tasks": ["6.1", "6.2"] },
    { "id": 13, "tasks": ["6.3", "6.4"] }
  ]
}
```
