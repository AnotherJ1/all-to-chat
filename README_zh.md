# AI Chat Hub

> 支持 OpenAI、Anthropic 和 Google Gemini 的现代多协议 AI 聊天界面。

[English](./README.md) | [中文](./README_zh.md)

## 功能特性

- **多协议支持** — OpenAI、Anthropic、Gemini，URL 后缀自动补全
- **动态模型选择** — 直接从 API 提供方获取模型列表
- **配置管理** — 按协议保存、加载和切换多个 API 配置
- **会话管理** — 创建、重命名和管理多个聊天会话
- **System Prompt** — 通过协议自定义 AI 行为
- **图片生成** — 基于 GPT Image 2，支持文生图、图生图编辑、多图融合（兼容 CLIProxyAPI 等代理）
- **多模型对比** — 并排对比多个模型的回复
- **Aurora UI** — 渐变网格背景 + 玻璃拟态效果
- **主题切换** — 支持深色/浅色模式
- **持久化存储** — 配置和会话自动保存到 localStorage

## 快速开始

```bash
npm install
npm run dev
```

在浏览器中打开 [http://localhost:5173](http://localhost:5173)

## 配置说明

1. 点击顶部的 **设置** 按钮 (⚙️)
2. 选择你的 **协议**（OpenAI / Anthropic / Gemini）
3. 输入 **Base URL** 和 **API Key**
4. （可选）输入或获取 **模型**
5. 点击 **+ 保存当前配置** 将配置命名保存

### URL 自动补全

应用会根据协议自动补全正确的路径后缀：

| 协议 | 后缀 |
|------|------|
| OpenAI | `/v1/chat/completions` |
| Anthropic | `/v1/messages` |
| Gemini | 使用查询参数 |

### 保存配置

每个协议可以保存多个命名配置：

1. 填写 API 详情
2. 点击 **+ 保存当前配置**
3. 输入名称（如"工作 API"、"个人密钥"）
4. 切换到 **保存的配置** 标签页进行加载或删除

## 项目结构

```
src/
├── api/               # API 客户端 (openai, anthropic, gemini)
├── components/        # React 组件
│   ├── Header.tsx         # 顶部导航栏 + 设置面板
│   ├── Sidebar.tsx        # 会话列表侧边栏
│   ├── ChatView.tsx       # 主聊天区域
│   ├── ChatMessage.tsx     # 消息气泡
│   ├── MessageInput.tsx   # 输入框 + 流式输出
│   ├── SystemPromptInput.tsx
│   ├── ImageGenerator.tsx
│   ├── ComparisonPanel.tsx
│   └── ...
├── stores/            # Zustand 状态管理
│   ├── configStore.ts     # API 配置和协议设置
│   ├── sessionStore.ts    # 聊天会话
│   └── ...
├── types/             # TypeScript 类型定义
├── App.tsx
└── main.tsx
```

## 技术栈

- **React 18** + TypeScript
- **Vite** — 快速构建工具
- **Tailwind CSS** — 实用优先样式
- **Zustand** — 轻量状态管理，支持持久化
- **React Markdown** — 聊天消息 Markdown 渲染

## 开发命令

```bash
# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 预览生产构建
npm run preview
```

## 支持的 API 提供商

- OpenAI 兼容 API（Azure OpenAI、本地模型等）
- Anthropic API
- Google Gemini API
- NewAPI 兼容代理服务

> **注意：** 部分 API 提供商可能会阻止浏览器的跨域请求。如遇 CORS 错误，建议通过后端代理转发请求。

## License

MIT
