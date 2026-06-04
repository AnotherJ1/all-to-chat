# Tool Hub

> 开发者工具集合平台 — AI 聊天（多协议 / 多模型对比 / 系统提示词预设）、图片生成、JSON 格式化、MyBatis 日志转 SQL、Base64 图片互转、时间戳转换、URL 工具、Cron 可视化、文本对比

## 功能概览

| 工具 | 路由 | 说明 |
|------|------|------|
| AI 聊天 | `/chat` | 多模型对话，支持 OpenAI / Anthropic / Gemini，内置系统提示词预设 |
| 图片生成 | `/image` | 文生图，支持 DALL-E / Imagen / Flux |
| JSON 格式化 | `/json` | JSON 格式化/压缩，Web Worker 处理超大文件 |
| MyBatis 日志转 SQL | `/mybatis` | 自动解析 MyBatis 日志为可执行 SQL |
| Base64 图片互转 | `/base64-image` | 图片 ↔ Base64 双向转换，自动识别 MIME，含多语言代码示例 |
| 时间戳转换 | `/timestamp` | Unix 时间戳 ↔ 日期，自动识别秒/毫秒，多时区与相对时间 |
| URL 工具 | `/url` | URL 编解码 + Query 参数表格化解析与编辑 |
| Cron 可视化 | `/cron` | 解析 Cron 表达式，预览未来执行时间 |
| 文本对比 | `/diff` | 行级 diff，双栏 / 统一视图，差异块导航跳转 |

## 运行截图

| 首页 | AI 聊天 |
|:---:|:---:|
| ![首页](public/screenshots/home.png) | ![AI 聊天](public/screenshots/chat.png) |

| JSON 格式化 | MyBatis 日志转 SQL |
|:---:|:---:|
| ![JSON 格式化](public/screenshots/json.png) | ![MyBatis 日志转 SQL](public/screenshots/mybatis.png) |

| Base64 图片互转 | 时间戳转换 |
|:---:|:---:|
| ![Base64 图片互转](public/screenshots/base64-image.png) | ![时间戳转换](public/screenshots/timestamp.png) |

| URL 工具 | Cron 可视化 |
|:---:|:---:|
| ![URL 工具](public/screenshots/url.png) | ![Cron 可视化](public/screenshots/cron.png) |

| 文本对比 | 自由拼图 |
|:---:|:---:|
| ![文本对比](public/screenshots/diff.png) | ![自由拼图](public/screenshots/collage.png) |

| 二维码工具 | cURL 工具 |
|:---:|:---:|
| ![二维码工具](public/screenshots/qr-code.png) | ![cURL 工具](public/screenshots/curl.png) |

| 颜色工具 | 数据格式互转 |
|:---:|:---:|
| ![颜色工具](public/screenshots/color.png) | ![数据格式互转](public/screenshots/data-convert.png) |

| ID 生成器 | 图片压缩 |
|:---:|:---:|
| ![ID 生成器](public/screenshots/id-gen.png) | ![图片压缩](public/screenshots/image-compress.png) |

| Markdown 工具 | CSV ↔ JSON |
|:---:|:---:|
| ![Markdown 工具](public/screenshots/markdown.png) | ![CSV ↔ JSON](public/screenshots/csv.png) |

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
│   ├── Base64ImagePage.tsx    # Base64 图片互转页面
│   ├── TimestampPage.tsx      # 时间戳转换页面
│   ├── UrlToolPage.tsx        # URL 编解码 / Query 解析页面
│   ├── CronPage.tsx           # Cron 表达式可视化页面
│   └── DiffPage.tsx           # 文本对比页面
├── registry/              # 工具注册表（声明式配置）
├── stores/                # Zustand 状态管理
├── types/                 # TypeScript 类型定义
└── workers/               # Web Worker（JSON 格式化、Base64 编解码）
```

## AI 聊天

围绕"对话 + 多模型对比"两条主线设计，移动端做了完整适配：

- **三协议自适应**：OpenAI / Anthropic / Gemini，URL 路径自动补全，模型列表可通过 `/v1/models` 拉取
- **多协议配置管理**：每个协议下可保存多套命名配置（如「公司 API」「自购账号」），一键切换
- **系统提示词预设**：内置 14 套常用预设（通用 / 编程 / 代码评审 / 中英翻译 / 文案润色 / SQL / 知识讲解 / 简洁回答，以及 JS / Android / 二进制 / 协议 / 密码学 / CTF 等逆向场景），点击即用，可基于预设继续编辑
- **多模型对比**：将一条 prompt 同时发给多个模型，并排显示流式回复 + 耗时 / 状态徽章
  - 每个模型一份独立会话，**支持多轮上下文**
  - 自动持久化到「会话管理」，一条记录一个模型
  - 可中止单个模型 / 全部停止；可针对单列重试
  - 「新对话」按钮清空当前一轮，保留历史 session
- **会话管理**：搜索、JSON / Markdown 导出、**「恢复」按钮一键将该会话拉回对话页继续聊**
- **Tab 状态保留**：在对话 / 多模型 / 会话管理之间切换不会丢失各 tab 内部状态（流式生成不会被打断）
- **移动端布局**：
  - Sidebar 在桌面端常驻，移动端转为抽屉式（带遮罩 + 滑入动画）
  - 多模型对比在桌面端横向并排，移动端纵向堆叠（每列 ≥ 40vh）
  - iOS 输入框防自动放大（统一 16px）

## 图片生成

支持三类提供方，可独立配置 API（与对话页解耦），每次生成自动记录到本地历史：

- **DALL-E（OpenAI 兼容）**：兼容 CLIProxyAPI 等 OpenAI 兼容代理，可拉取模型列表选择
- **Imagen（Google）**：Google AI 原生 API
- **Flux（OpenAI 兼容端点）**：Replicate / 各类代理
- **历史栅格**：响应式列数（移动端 1 列 / 平板 2 列 / 桌面 3 列），点击图片下载，单张可删除
- **移动端**：顶部 Tab 切换「生成」/「历史」，避免双栏挤压
- **超时保护**：60s 强制中止，且组件卸载时主动 abort，无内存泄漏

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

## 开发者实用工具

为日常开发场景内建了一组离线小工具，全部纯前端实现，零网络请求：

### 时间戳转换 (`/timestamp`)

- **自动识别秒 / 毫秒**：根据数值阈值（≥ 1e11 视作毫秒）自动切换单位，下拉框仍可手动覆盖
- 双向转换：Unix 时间戳 ↔ 本地时间 ↔ ISO 8601
- 实时刷新当前时间，一键填入
- 多时区显示：UTC / 北京 / 东京 / 纽约 / 伦敦 / 洛杉矶
- 相对时间描述（X 分钟前/后）

### URL 工具 (`/url`)

- **URL 解析**：自动拆分协议 / 主机 / 路径 / Hash，Query 参数以表格形式展示
- 可直接增删改 Query 参数，URL 实时同步
- **编码 / 解码**：`encodeURIComponent` 与 `encodeURI` 双模式可切，错误输入有友好提示
- 支持仅输入 query 串（如 `?foo=1&bar=2`）的场景

### Cron 表达式可视化 (`/cron`)

- 同时支持 5 段（分 时 日 月 周）和 6 段（秒 分 时 日 月 周）
- 支持 `*` `,` `-` `/` `?` 通配符
- 字段拆解卡片化展示
- 自然语言描述（如「工作日 9 点」）
- 预览未来 5 / 8 / 12 / 20 / 50 次执行时间，含相对时间
- 内置 10 个常用预设可一键填入

### 文本对比 (`/diff`)

- 基于 LCS 的行级 diff，无新增依赖
- **双栏对照** 和 **统一视图** 双视图切换
- 忽略大小写、忽略前后空白
- **差异块导航**：上一处 / 下一处按钮 + 计数指示，一键跳转并平滑滚动到视图中心
- 大文本输入用 `useDeferredValue` 延迟计算，避免输入卡顿
- 一键复制为 unified patch 格式

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
