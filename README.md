# Tool Hub

> 开发者工具集合平台 — AI 聊天、图片生成、JSON 格式化、MyBatis 日志转 SQL、Base64 图片互转

## 功能概览

| 工具 | 路由 | 说明 |
|------|------|------|
| AI 聊天 | `/chat` | 多模型对话，支持 OpenAI / Anthropic / Gemini |
| 图片生成 | `/image` | 文生图，支持 DALL-E / Imagen / Flux |
| JSON 格式化 | `/json` | JSON 格式化/压缩，Web Worker 处理超大文件 |
| MyBatis 日志转 SQL | `/mybatis` | 自动解析 MyBatis 日志为可执行 SQL |
| Base64 图片互转 | `/base64-image` | 图片 ↔ Base64 双向转换，自动识别 MIME，含多语言代码示例 |

## 技术栈

- **React 18** + TypeScript
- **Vite 5** — 极速构建
- **Tailwind CSS 3** — 原子化样式
- **Zustand 5** — 轻量状态管理 + localStorage 持久化
- **highlight.js** — 代码语法高亮
- **Web Worker** — 大文件异步处理，不阻塞 UI
- **React Router 6** — SPA 路由

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 http://localhost:5173

## 项目结构

```
src/
├── api/                    # API 客户端（OpenAI、Anthropic、Gemini）
├── components/
│   ├── chat/              # 聊天相关组件
│   ├── common/            # 通用组件（BackToHome、Icons、ToolCard 等）
│   ├── image/             # 图片生成组件
│   ├── json/              # JSON 工具组件（预留）
│   └── mybatis/           # MyBatis 工具组件（预留）
├── lib/                   # 工具库（SSE、UUID、MyBatis 解析器）
├── pages/                 # 页面组件
│   ├── HomePage.tsx       # 首页（工具卡片网格）
│   ├── ChatPage.tsx       # AI 聊天页面
│   ├── ImagePage.tsx      # 图片生成页面
│   ├── JsonFormatterPage.tsx   # JSON 格式化页面
│   ├── MybatisLogPage.tsx     # MyBatis 日志转 SQL 页面
│   └── Base64ImagePage.tsx    # Base64 图片互转页面
├── registry/              # 工具注册表（声明式配置）
├── stores/                # Zustand 状态管理
├── types/                 # TypeScript 类型定义
└── workers/               # Web Worker（JSON 格式化、Base64 编解码）
```

## Base64 图片互转

针对图片与 Base64 双向转换的常见需求做了体验和性能上的打磨：

- **双向模式**：图片 → Base64、Base64 → 图片，可在两个 tab 间切换且保留输入内容
- **多种输入方式**：点击选择 / 拖拽上传 / `Ctrl/⌘ + V` 直接粘贴剪贴板图片
- **MIME 自动识别**：通过 base64 头部魔数嗅探 PNG / JPEG / GIF / WebP / BMP / SVG，无需手动指定
- **输出格式可切换**：完整 Data URL（`data:image/png;base64,...`）或纯 Base64
- **多语言代码示例**：HTML/CSS、JS 编码、JS 解码、React、Node.js、Python、Java，自动注入当前数据（已截断），一键复制
- **大文件性能优化**：
  - 单文件上限 10 MB；≥ 1 MB 走 Web Worker 编解码（ArrayBuffer Transferable 零拷贝），主线程不阻塞
  - 上传瞬间用 `URL.createObjectURL` 立即预览，不等编码完成
  - 输出 textarea 超过 200 KB 自动截断显示（首 70% + 尾 10%），可手动展开完整
  - 解码 tab 的输入框采用非受控 + 节流统计，粘贴几十 MB 也不卡
  - 代码示例区使用 `useMemo` + `useDeferredValue` + `React.memo`，输入响应优先于示例更新
- **内存管理**：所有 ObjectURL 在切换文件 / 卸载页面时自动 `revokeObjectURL`，无泄漏
- **A11y**：标签 / 按钮带 `role` 与 `aria-*` 标注，键盘可触发上传区

## 主题系统

内置 6 种主题风格，默认使用「新粗」(Neubrutalism)：

- 黏土 (Claymorphism)
- 流光 (Motion)
- 粗野 (Brutalism)
- **新粗 (Neubrutalism)** — 默认
- 赛博 (Cyberpunk)
- 蒸汽 (Vaporwave)

点击页面右下角主题切换按钮即可切换。

## 构建与部署

### 本地构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### 部署到 Cloudflare Pages

</text>
</invoke>

#### 方式一：通过 Git 集成（推荐）

1. **将代码推送到 GitHub/GitLab 仓库**

2. **登录 Cloudflare Dashboard**
   - 进入 https://dash.cloudflare.com
   - 左侧菜单选择 **Workers & Pages**

3. **创建项目**
   - 点击 **Create application** → **Pages** → **Connect to Git**
   - 选择你的 GitHub/GitLab 仓库并授权

4. **配置构建设置**
   | 配置项 | 值 |
   |--------|-----|
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/`（如果是 monorepo 则填子目录路径） |
   | Node.js version | 22（在 Environment variables 中设置 `NODE_VERSION=22`） |

5. **点击 Save and Deploy**
   - 首次部署约 1-2 分钟
   - 部署成功后会分配一个 `*.pages.dev` 域名

6. **后续更新**
   - 每次 push 到主分支会自动触发部署
   - PR 会自动生成预览链接

#### 方式二：通过 Wrangler CLI 直接上传

```bash
# 1. 安装 Wrangler
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 构建项目
npm run build

# 4. 创建 Pages 项目并部署
wrangler pages deploy dist --project-name=tool-hub

# 后续更新只需重复步骤 3-4
```

#### SPA 路由配置

项目已包含 `public/_redirects` 文件，内容为：

```
/*    /index.html   200
```

这确保所有路由都回退到 `index.html`，SPA 路由正常工作。Cloudflare Pages 会自动识别此文件。

#### 自定义域名（可选）

1. 在 Cloudflare Pages 项目设置中点击 **Custom domains**
2. 添加你的域名（如 `tools.example.com`）
3. 如果域名已在 Cloudflare DNS 管理，会自动配置 CNAME
4. 如果域名在其他 DNS 服务商，需要手动添加 CNAME 记录指向 `<project>.pages.dev`
5. SSL 证书自动签发，无需额外配置

#### 环境变量（如需要）

在 Cloudflare Pages 项目设置 → **Environment variables** 中配置：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `NODE_VERSION` | Node.js 版本 | `22` |

> 注意：本项目为纯前端应用，API Key 等敏感信息存储在用户浏览器 localStorage 中，不需要在服务端配置。

## 开发命令

```bash
# 开发服务器（热更新）
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

## 添加新工具

只需 3 步：

1. 在 `src/pages/` 创建页面组件
2. 在 `src/components/common/Icons.tsx` 添加图标
3. 在 `src/registry/tools.ts` 注册工具条目

路由和首页卡片自动生成，无需修改其他文件。

## License

MIT
