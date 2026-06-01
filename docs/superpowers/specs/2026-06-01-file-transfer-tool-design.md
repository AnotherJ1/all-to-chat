# 跨设备文件传输工具 — 设计文档

- 日期：2026-06-01
- 项目：ai-chat-hub（纯前端工具集，React 18 + Vite + Tailwind + Zustand，部署于 Cloudflare Pages 纯静态）
- 状态：已确认，待实现

## 1. 目标

在工具集中新增一个「跨设备文件传输」小工具，支持两种渠道：

- **内网渠道（本期实现）**：通过 WebRTC DataChannel 在两台设备间 P2P 直传文件与文本片段，文件不经任何服务器。
- **外网渠道（本期占位）**：UI 入口先就位，标注「即将推出」，并简短说明受 TURN 服务器限制的原因。

核心约束：**纯前端、无后端、无信令服务器**。部署目标为 Cloudflare Pages 纯静态托管（当前仅有 `_redirects` 做 SPA 路由，无 Functions/Workers）。

## 2. 关键技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 传输技术 | WebRTC DataChannel | 唯一能在纯前端、跨设备做真 P2P 直传的方案 |
| 信令交换 | 连接码（SDP）复制粘贴为主，二维码展示辅助 | 无信令服务器；连接码通用、二维码便于手机扫 |
| ICE 模式 | 非 trickle（vanilla ICE） | 等 `icegatheringstate === 'complete'` 后一次性把含全部 candidate 的完整 SDP 编码为连接码，双方各贴一次码即可 |
| 传输内容 | 文件 + 文本片段 | 文本片段近乎零成本却大幅提升实用性 |
| 外网渠道 | UI 占位「即将推出」 | 真·外网 P2P 受 TURN 服务器限制（对称型 NAT 必须 TURN 中转，纯静态站点无稳定免费 TURN） |

## 3. 架构

```
FileTransferPage（主壳，编排 UI）
   ├── ChannelSwitcher（内网 / 外网 Tab）
   ├── 内网渠道（核心）
   │      ├── 角色：发送方 / 接收方
   │      ├── SignalExchange：连接码输入框 + 二维码展示
   │      └── TransferPanel：文件拖拽区 + 文本框 + 进度列表
   └── 外网渠道：ComingSoonCard（占位 + TURN 限制说明）
```

## 4. 文件结构

遵循项目既有「壳页面 + lib（逻辑/Hook）+ components（UI 子件）」模式，Hook 就近放入 `lib/filetransfer/`。

```
src/pages/FileTransferPage.tsx              # 主壳，编排 UI
src/lib/filetransfer/
   ├── types.ts          # 共享类型（角色、连接状态、传输项、控制帧）
   ├── webrtc.ts         # RTCPeerConnection 封装：createOffer / createAnswer / 完整 SDP 收集
   ├── transfer.ts       # 文件分块发送/接收、进度、文本消息协议
   ├── signal.ts         # SDP ↔ 连接码 编解码（压缩 + base64）
   ├── useFileTransfer.ts# 连接状态机 + 传输逻辑总 Hook
   └── __tests__/
        ├── signal.test.ts    # SDP 编解码往返一致性
        └── transfer.test.ts  # 分块协议帧解析
src/components/filetransfer/
   ├── ChannelSwitcher.tsx   # 内网/外网 Tab（复用 theme-tab）
   ├── SignalExchange.tsx    # 连接码输入 + 二维码
   ├── TransferPanel.tsx     # 拖拽区 + 文本框 + 进度列表
   └── ComingSoonCard.tsx    # 外网占位
```

注册：在 `src/registry/tools.ts` 新增一条工具元数据（`category: 'dev'`），并在 `src/components/common/Icons.tsx` 新增 `IconFileTransfer`。路由与首页卡片由注册表自动生成。

## 5. 数据流（内网传输）

1. **发送方**：选文件 / 输入文本 → 点「创建连接」→ 生成 offer 连接码（同时渲染二维码）→ 复制给接收方。
2. **接收方**：粘贴 offer 连接码 → 生成 answer 连接码 → 复制回发送方。
3. **发送方**：粘贴 answer → DataChannel 打开 → 自动开始分块传输。
4. 双方实时显示进度；接收方收完用 `file-saver`（项目已有依赖）触发下载。

### 传输协议（DataChannel 之上）

- **控制帧**：JSON 字符串，`{ type: 'meta' | 'text' | 'done', ... }`
  - `meta`：文件名、大小、MIME、总块数
  - `text`：文本片段内容
  - `done`：单个文件传输完成
- **数据帧**：`ArrayBuffer` 数据块，默认 16KB/块
- **背压**：通过 `bufferedAmount` + `bufferedAmountLowThreshold` 控制发送节奏，避免内存堆积

## 6. 错误处理

- 连接码格式非法 / 解析失败 → `theme-alert-error` 提示
- ICE 收集超时（5s 仍未 complete）→ 用已有 candidate 兜底并提示「网络受限，可能仅同设备/同热点可用」
- DataChannel 中断 → 状态机回初始态，提示重连
- 大文件：分块 + 背压；`>500MB` 时软提示「文件较大，传输可能较慢，请保持页面前台」
- 接收端用 Blob 数组拼装，收完一次性生成下载，避免中途内存峰值

## 7. 测试

- `signal.test.ts`：SDP ↔ 连接码 编解码往返一致性（核心，必测）
- `transfer.test.ts`：meta / text / data / done 帧的构造与解析
- 页面组件：渲染、Tab 切换、连接码非法提示（vitest + @testing-library/react，参照现有 `__tests__` 风格）

## 8. UI/UX

用 `ui-ux-pro-max` skill 指导，严格复用现有多主题设计系统：

- 类：`theme-card` / `theme-btn` / `theme-btn-primary` / `theme-input` / `theme-tab` / `theme-alert-*`
- 变量：`var(--bg-*)` / `var(--text-*)` / `var(--accent-*)` / `var(--radius*)` / `var(--font-*)`
- 头部：复用 `BackToHome`
- 布局：双栏 `theme-card` 栅格，视觉语言对齐二维码页
- 自动适配全部 6 套主题（claymorphism / motion / brutalism / neubrutalism / cyberpunk / vaporwave）

## 9. 范围边界（YAGNI）

- 本期**不做**：外网真实 P2P / TURN 集成、云存储中转、剪贴板自动同步、传输历史持久化、断点续传。
- 外网渠道仅作 UI 占位入口。
