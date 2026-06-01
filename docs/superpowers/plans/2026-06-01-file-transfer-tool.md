# 跨设备文件传输工具 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ai-chat-hub 工具集新增「跨设备文件传输」工具，内网通过 WebRTC DataChannel P2P 直传文件与文本片段，外网渠道做 UI 占位。

**Architecture:** 纯前端无信令服务器。WebRTC 用非 trickle ICE（等 candidate 收集完成后一次性把完整 SDP 编码成连接码），双方各贴一次连接码完成握手。文件分块走 DataChannel，带背压控制。遵循项目「壳页面 + lib（逻辑/Hook）+ components（UI 子件）」模式，注册表自动生成路由与首页卡片。

**Tech Stack:** React 18, TypeScript, Vite, Tailwind（多主题 CSS 变量）, Zustand, WebRTC, file-saver（已有依赖）, qrcode（已有依赖）, vitest + @testing-library/react。

---

## 文件结构

```
src/pages/FileTransferPage.tsx              # 主壳，编排 UI
src/lib/filetransfer/
   ├── types.ts          # 共享类型
   ├── signal.ts         # SDP <-> 连接码 编解码
   ├── transfer.ts       # 分块协议帧的构造/解析
   ├── webrtc.ts         # RTCPeerConnection 封装 + 完整 SDP 收集
   ├── useFileTransfer.ts# 连接状态机 + 传输逻辑总 Hook
   └── __tests__/
        ├── signal.test.ts
        └── transfer.test.ts
src/components/filetransfer/
   ├── ChannelSwitcher.tsx   # 内网/外网 Tab
   ├── SignalExchange.tsx    # 连接码输入 + 二维码
   ├── TransferPanel.tsx     # 拖拽区 + 文本框 + 进度列表
   └── ComingSoonCard.tsx    # 外网占位
src/components/common/Icons.tsx   # 新增 IconFileTransfer（修改）
src/registry/tools.ts             # 新增工具元数据（修改）
```

---

## Task 1: 共享类型定义

**Files:**
- Create: `src/lib/filetransfer/types.ts`

- [ ] **Step 1: 写类型文件**

```typescript
// src/lib/filetransfer/types.ts

/** 渠道：内网 P2P / 外网（占位） */
export type Channel = 'lan' | 'wan'

/** 本端角色 */
export type Role = 'sender' | 'receiver'

/** 连接状态机 */
export type ConnState =
  | 'idle'            // 初始
  | 'creating-offer'  // 发送方生成 offer 中
  | 'awaiting-answer' // 发送方等待对方回贴 answer
  | 'creating-answer' // 接收方生成 answer 中
  | 'connecting'      // DataChannel 建立中
  | 'connected'       // 已连通
  | 'transferring'    // 传输中
  | 'error'           // 出错

/** 单个传输项（文件或文本） */
export interface TransferItem {
  id: string
  kind: 'file' | 'text'
  name: string          // 文件名；文本则用摘要
  size: number          // 字节数
  mime: string          // 文件 MIME；文本为 'text/plain'
  direction: 'send' | 'recv'
  progress: number      // 0~1
  status: 'pending' | 'active' | 'done' | 'failed'
  content?: string      // 仅文本项：原文
  blob?: Blob           // 仅接收完成的文件项
}

/** DataChannel 控制帧（JSON 字符串传输） */
export type ControlFrame =
  | { type: 'meta'; id: string; name: string; size: number; mime: string; chunks: number }
  | { type: 'text'; id: string; content: string }
  | { type: 'done'; id: string }

/** 连接码封装（编码进连接码的对象） */
export interface SignalPayload {
  v: 1                  // 协议版本
  role: Role            // 生成方角色：sender 产 offer / receiver 产 answer
  sdp: string           // 完整 SDP（含全部 ICE candidate）
  type: 'offer' | 'answer'
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过（无新增报错）

- [ ] **Step 3: 提交**

```bash
git add src/lib/filetransfer/types.ts
git commit -m "feat(filetransfer): add shared types"
```

---

## Task 2: 连接码编解码（signal.ts）

连接码需要：把含全部 candidate 的完整 SDP（很长）+ 元信息，编码成一段**可复制、可生成二维码**的紧凑字符串。方案：JSON → UTF-8 → base64url（不引新依赖；SDP 本身高度可压缩但为零依赖先用 base64url，足够复制粘贴用）。

**Files:**
- Create: `src/lib/filetransfer/signal.ts`
- Test: `src/lib/filetransfer/__tests__/signal.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// src/lib/filetransfer/__tests__/signal.test.ts
import { describe, it, expect } from 'vitest'
import { encodeSignal, decodeSignal } from '../signal'
import type { SignalPayload } from '../types'

const sample: SignalPayload = {
  v: 1,
  role: 'sender',
  type: 'offer',
  sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\na=candidate:1 1 udp 2113 192.168.1.5 50000 typ host\r\n',
}

describe('encodeSignal / decodeSignal', () => {
  it('编码后是非空字符串且不含换行（便于复制/二维码）', () => {
    const code = encodeSignal(sample)
    expect(typeof code).toBe('string')
    expect(code.length).toBeGreaterThan(0)
    expect(code).not.toMatch(/[\r\n]/)
  })

  it('往返一致：decode(encode(x)) === x', () => {
    const code = encodeSignal(sample)
    const back = decodeSignal(code)
    expect(back).toEqual(sample)
  })

  it('支持含中文/特殊字符的 SDP（UTF-8 安全）', () => {
    const withUtf8: SignalPayload = { ...sample, sdp: sample.sdp + 'a=note:测试😀\r\n' }
    expect(decodeSignal(encodeSignal(withUtf8))).toEqual(withUtf8)
  })

  it('非法连接码抛出可识别错误', () => {
    expect(() => decodeSignal('not-a-valid-code!!!')).toThrow()
  })

  it('解码结构不完整时抛错', () => {
    // 合法 base64url 但内容不是 SignalPayload
    const bad = encodeSignal({ ...sample })
    const tampered = bad.slice(0, Math.max(1, bad.length - 4))
    expect(() => decodeSignal(tampered)).toThrow()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/filetransfer/__tests__/signal.test.ts`
Expected: FAIL（`encodeSignal` 未定义）

- [ ] **Step 3: 写实现**

```typescript
// src/lib/filetransfer/signal.ts
import type { SignalPayload } from './types'

/**
 * 连接码编解码。
 * 把 SignalPayload(JSON) 转 UTF-8 字节再 base64url。
 * base64url 不含换行/+///，便于复制粘贴与生成二维码。
 */

/** 字符串 -> base64url */
function toBase64Url(json: string): string {
  // 用 TextEncoder 得到 UTF-8 字节，再逐字节转 binary string 喂给 btoa
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const b64 = btoa(binary)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** base64url -> 字符串 */
function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64) // 非法字符会抛 DOMException
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** 编码连接码 */
export function encodeSignal(payload: SignalPayload): string {
  return toBase64Url(JSON.stringify(payload))
}

/** 解码连接码；非法时抛 Error */
export function decodeSignal(code: string): SignalPayload {
  const trimmed = code.trim()
  if (!trimmed) throw new Error('连接码为空')
  let json: string
  try {
    json = fromBase64Url(trimmed)
  } catch {
    throw new Error('连接码格式无效')
  }
  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch {
    throw new Error('连接码内容已损坏')
  }
  if (!isSignalPayload(obj)) throw new Error('连接码结构不完整')
  return obj
}

/** 运行时校验 SignalPayload 结构 */
function isSignalPayload(x: unknown): x is SignalPayload {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return (
    o.v === 1 &&
    (o.role === 'sender' || o.role === 'receiver') &&
    (o.type === 'offer' || o.type === 'answer') &&
    typeof o.sdp === 'string' &&
    o.sdp.length > 0
  )
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/filetransfer/__tests__/signal.test.ts`
Expected: PASS（5 个用例全过）

- [ ] **Step 5: 提交**

```bash
git add src/lib/filetransfer/signal.ts src/lib/filetransfer/__tests__/signal.test.ts
git commit -m "feat(filetransfer): add signal code encode/decode with tests"
```

---

## Task 3: 分块传输协议帧（transfer.ts）

负责控制帧的构造/解析，以及文件分块计算。不直接碰 RTCPeerConnection（便于纯函数单测）。

**Files:**
- Create: `src/lib/filetransfer/transfer.ts`
- Test: `src/lib/filetransfer/__tests__/transfer.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// src/lib/filetransfer/__tests__/transfer.test.ts
import { describe, it, expect } from 'vitest'
import {
  CHUNK_SIZE,
  totalChunks,
  buildMetaFrame,
  buildTextFrame,
  buildDoneFrame,
  parseControlFrame,
} from '../transfer'

describe('totalChunks', () => {
  it('按 CHUNK_SIZE 向上取整', () => {
    expect(totalChunks(0)).toBe(0)
    expect(totalChunks(1)).toBe(1)
    expect(totalChunks(CHUNK_SIZE)).toBe(1)
    expect(totalChunks(CHUNK_SIZE + 1)).toBe(2)
  })
})

describe('control frame 构造与解析往返', () => {
  it('meta 帧', () => {
    const s = buildMetaFrame({ id: 'a', name: 'x.png', size: 100, mime: 'image/png', chunks: 7 })
    const f = parseControlFrame(s)
    expect(f).toEqual({ type: 'meta', id: 'a', name: 'x.png', size: 100, mime: 'image/png', chunks: 7 })
  })

  it('text 帧', () => {
    const s = buildTextFrame('b', '你好 world')
    expect(parseControlFrame(s)).toEqual({ type: 'text', id: 'b', content: '你好 world' })
  })

  it('done 帧', () => {
    expect(parseControlFrame(buildDoneFrame('c'))).toEqual({ type: 'done', id: 'c' })
  })

  it('非法 JSON 返回 null', () => {
    expect(parseControlFrame('{not json')).toBeNull()
  })

  it('未知 type 返回 null', () => {
    expect(parseControlFrame(JSON.stringify({ type: 'xxx' }))).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/filetransfer/__tests__/transfer.test.ts`
Expected: FAIL（模块未定义）

- [ ] **Step 3: 写实现**

```typescript
// src/lib/filetransfer/transfer.ts
import type { ControlFrame } from './types'

/** 单块大小：16KB，兼顾 DataChannel 限制与吞吐 */
export const CHUNK_SIZE = 16 * 1024

/** 大文件软提示阈值：500MB */
export const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024

/** 计算文件总块数 */
export function totalChunks(size: number): number {
  return Math.ceil(size / CHUNK_SIZE)
}

/** 构造 meta 控制帧 */
export function buildMetaFrame(p: {
  id: string; name: string; size: number; mime: string; chunks: number
}): string {
  const frame: ControlFrame = {
    type: 'meta', id: p.id, name: p.name, size: p.size, mime: p.mime, chunks: p.chunks,
  }
  return JSON.stringify(frame)
}

/** 构造 text 控制帧 */
export function buildTextFrame(id: string, content: string): string {
  const frame: ControlFrame = { type: 'text', id, content }
  return JSON.stringify(frame)
}

/** 构造 done 控制帧 */
export function buildDoneFrame(id: string): string {
  const frame: ControlFrame = { type: 'done', id }
  return JSON.stringify(frame)
}

/** 解析控制帧；非法或未知类型返回 null */
export function parseControlFrame(s: string): ControlFrame | null {
  let obj: unknown
  try {
    obj = JSON.parse(s)
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  switch (o.type) {
    case 'meta':
      if (
        typeof o.id === 'string' && typeof o.name === 'string' &&
        typeof o.size === 'number' && typeof o.mime === 'string' &&
        typeof o.chunks === 'number'
      ) return o as ControlFrame
      return null
    case 'text':
      if (typeof o.id === 'string' && typeof o.content === 'string') return o as ControlFrame
      return null
    case 'done':
      if (typeof o.id === 'string') return o as ControlFrame
      return null
    default:
      return null
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/filetransfer/__tests__/transfer.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/filetransfer/transfer.ts src/lib/filetransfer/__tests__/transfer.test.ts
git commit -m "feat(filetransfer): add chunk transfer protocol frames with tests"
```

---

## Task 4: WebRTC 封装（webrtc.ts）

封装 `RTCPeerConnection`：创建连接、收集完整 SDP（非 trickle）、收发文件/文本。不写单测（依赖浏览器 WebRTC API，jsdom 无；逻辑正确性靠 signal/transfer 单测 + 手动联调保证）。

**Files:**
- Create: `src/lib/filetransfer/webrtc.ts`

- [ ] **Step 1: 写实现**

```typescript
// src/lib/filetransfer/webrtc.ts
import type { TransferItem } from './types'
import {
  CHUNK_SIZE, totalChunks,
  buildMetaFrame, buildTextFrame, buildDoneFrame, parseControlFrame,
} from './transfer'

/** 公共 STUN（仅辅助 candidate 收集；内网场景多数无需） */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

/** ICE 收集超时（毫秒）：超时用已收集的 candidate 兜底 */
const ICE_GATHER_TIMEOUT = 5000

/** 等待 ICE 收集完成（或超时），返回含全部 candidate 的完整 SDP */
function waitForCompleteSdp(pc: RTCPeerConnection): Promise<string> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve(pc.localDescription!.sdp)
      return
    }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      pc.removeEventListener('icegatheringstatechange', onChange)
      resolve(pc.localDescription!.sdp)
    }
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish()
    }
    pc.addEventListener('icegatheringstatechange', onChange)
    setTimeout(finish, ICE_GATHER_TIMEOUT)
  })
}

/** 事件回调集合 */
export interface PeerHandlers {
  onOpen: () => void
  onClose: () => void
  onError: (msg: string) => void
  /** 收到对端 meta：新建一条接收项 */
  onIncomingMeta: (item: TransferItem) => void
  /** 接收进度更新 */
  onRecvProgress: (id: string, progress: number) => void
  /** 接收完成（文件给 blob，文本给 content） */
  onRecvDone: (id: string, payload: { blob?: Blob; content?: string }) => void
  /** 发送进度更新 */
  onSendProgress: (id: string, progress: number) => void
}

/** 接收端逐文件累积状态 */
interface RecvState {
  item: TransferItem
  buffers: ArrayBuffer[]
  received: number   // 已收字节
}

/**
 * Peer：封装单条 P2P 连接的生命周期与收发。
 * 用法：
 *   sender:   p = new Peer('sender', h); offer = await p.createOffer(); ...贴 answer... await p.acceptAnswer(answer)
 *   receiver: p = new Peer('receiver', h); answer = await p.acceptOfferCreateAnswer(offer)
 */
export class Peer {
  private pc: RTCPeerConnection
  private dc: RTCDataChannel | null = null
  private handlers: PeerHandlers
  private recv = new Map<string, RecvState>()
  /** 当前正在接收的文件 id（数据块属于它） */
  private activeRecvId: string | null = null

  constructor(role: 'sender' | 'receiver', handlers: PeerHandlers) {
    this.handlers = handlers
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState
      if (st === 'failed' || st === 'disconnected') this.handlers.onError('连接已断开')
      if (st === 'closed') this.handlers.onClose()
    }
    if (role === 'sender') {
      // 发送方主动建 DataChannel
      this.dc = this.pc.createDataChannel('ft', { ordered: true })
      this.bindChannel(this.dc)
    } else {
      // 接收方等待对端 DataChannel
      this.pc.ondatachannel = (e) => {
        this.dc = e.channel
        this.bindChannel(this.dc)
      }
    }
  }

  /** 绑定 DataChannel 事件 */
  private bindChannel(dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer'
    dc.bufferedAmountLowThreshold = CHUNK_SIZE * 8
    dc.onopen = () => this.handlers.onOpen()
    dc.onclose = () => this.handlers.onClose()
    dc.onerror = () => this.handlers.onError('数据通道出错')
    dc.onmessage = (e) => this.onMessage(e.data)
  }

  /** 处理收到的消息（控制帧字符串 或 二进制数据块） */
  private onMessage(data: string | ArrayBuffer) {
    if (typeof data === 'string') {
      const frame = parseControlFrame(data)
      if (!frame) return
      if (frame.type === 'meta') {
        const item: TransferItem = {
          id: frame.id, kind: 'file', name: frame.name, size: frame.size,
          mime: frame.mime, direction: 'recv', progress: 0, status: 'active',
        }
        this.recv.set(frame.id, { item, buffers: [], received: 0 })
        this.activeRecvId = frame.id
        this.handlers.onIncomingMeta(item)
      } else if (frame.type === 'text') {
        const item: TransferItem = {
          id: frame.id, kind: 'text', name: frame.content.slice(0, 20) || '文本',
          size: new Blob([frame.content]).size, mime: 'text/plain',
          direction: 'recv', progress: 1, status: 'done', content: frame.content,
        }
        this.handlers.onIncomingMeta(item)
        this.handlers.onRecvDone(frame.id, { content: frame.content })
      } else if (frame.type === 'done') {
        const st = this.recv.get(frame.id)
        if (st) {
          const blob = new Blob(st.buffers, { type: st.item.mime })
          this.handlers.onRecvDone(frame.id, { blob })
          this.recv.delete(frame.id)
          if (this.activeRecvId === frame.id) this.activeRecvId = null
        }
      }
    } else {
      // 二进制块归属当前 activeRecvId
      if (!this.activeRecvId) return
      const st = this.recv.get(this.activeRecvId)
      if (!st) return
      st.buffers.push(data)
      st.received += data.byteLength
      const progress = st.item.size ? Math.min(1, st.received / st.item.size) : 1
      this.handlers.onRecvProgress(st.item.id, progress)
    }
  }

  /** 发送方：生成 offer（含完整 candidate） */
  async createOffer(): Promise<string> {
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return waitForCompleteSdp(this.pc)
  }

  /** 发送方：贴入对端 answer SDP */
  async acceptAnswer(sdp: string): Promise<void> {
    await this.pc.setRemoteDescription({ type: 'answer', sdp })
  }

  /** 接收方：贴入 offer SDP 并生成 answer（含完整 candidate） */
  async acceptOfferCreateAnswer(sdp: string): Promise<string> {
    await this.pc.setRemoteDescription({ type: 'offer', sdp })
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return waitForCompleteSdp(this.pc)
  }

  /** 发送一段文本片段 */
  sendText(id: string, content: string): void {
    if (!this.dc || this.dc.readyState !== 'open') throw new Error('通道未就绪')
    this.dc.send(buildTextFrame(id, content))
  }

  /** 发送一个文件（分块 + 背压） */
  async sendFile(item: TransferItem, file: File): Promise<void> {
    const dc = this.dc
    if (!dc || dc.readyState !== 'open') throw new Error('通道未就绪')
    dc.send(buildMetaFrame({
      id: item.id, name: file.name, size: file.size,
      mime: file.type || 'application/octet-stream', chunks: totalChunks(file.size),
    }))
    let offset = 0
    while (offset < file.size) {
      // 背压：缓冲区高于阈值时等待回落
      if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
        await new Promise<void>((res) => {
          const onLow = () => { dc.removeEventListener('bufferedamountlow', onLow); res() }
          dc.addEventListener('bufferedamountlow', onLow)
        })
      }
      const slice = file.slice(offset, offset + CHUNK_SIZE)
      const buf = await slice.arrayBuffer()
      dc.send(buf)
      offset += buf.byteLength
      this.handlers.onSendProgress(item.id, Math.min(1, offset / file.size))
    }
    dc.send(buildDoneFrame(item.id))
  }

  /** 关闭连接 */
  close(): void {
    try { this.dc?.close() } catch { /* ignore */ }
    try { this.pc.close() } catch { /* ignore */ }
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过

- [ ] **Step 3: 提交**

```bash
git add src/lib/filetransfer/webrtc.ts
git commit -m "feat(filetransfer): add RTCPeerConnection wrapper with non-trickle ICE"
```

---

## Task 5: 连接状态机总 Hook（useFileTransfer.ts）

把 `Peer` 的命令式 API 包成 React Hook：暴露状态 + 动作给页面。不写单测（强依赖 WebRTC；逻辑薄，主要是状态编排，由页面集成测试覆盖渲染层）。

**Files:**
- Create: `src/lib/filetransfer/useFileTransfer.ts`

- [ ] **Step 1: 写实现**

```typescript
// src/lib/filetransfer/useFileTransfer.ts
import { useCallback, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { saveAs } from 'file-saver'
import { Peer } from './webrtc'
import { encodeSignal, decodeSignal } from './signal'
import { LARGE_FILE_THRESHOLD } from './transfer'
import type { ConnState, Role, TransferItem } from './types'

export interface UseFileTransfer {
  role: Role | null
  state: ConnState
  error: string | null
  /** 本端生成、供对方扫描/粘贴的连接码 */
  localCode: string
  /** 传输项列表（收发合并展示） */
  items: TransferItem[]
  /** 选择角色并初始化 */
  startAsSender: () => Promise<void>
  startAsReceiver: () => void
  /** 接收方：贴入 offer 连接码 -> 产出 answer 连接码（写入 localCode） */
  acceptOfferCode: (code: string) => Promise<void>
  /** 发送方：贴入 answer 连接码完成握手 */
  acceptAnswerCode: (code: string) => Promise<void>
  /** 连通后：发送文件 */
  sendFiles: (files: FileList | File[]) => Promise<void>
  /** 连通后：发送文本片段 */
  sendText: (content: string) => void
  /** 接收完成的文件触发下载 */
  download: (item: TransferItem) => void
  /** 复位整个会话 */
  reset: () => void
}

export function useFileTransfer(): UseFileTransfer {
  const [role, setRole] = useState<Role | null>(null)
  const [state, setState] = useState<ConnState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [localCode, setLocalCode] = useState('')
  const [items, setItems] = useState<TransferItem[]>([])
  const peerRef = useRef<Peer | null>(null)

  /** 局部更新某条 item */
  const patchItem = useCallback((id: string, patch: Partial<TransferItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  /** 构造 Peer 的事件回调 */
  const makeHandlers = useCallback(() => ({
    onOpen: () => setState('connected'),
    onClose: () => setState((s) => (s === 'error' ? s : 'idle')),
    onError: (msg: string) => { setError(msg); setState('error') },
    onIncomingMeta: (item: TransferItem) => setItems((prev) => [...prev, item]),
    onRecvProgress: (id: string, progress: number) => patchItem(id, { progress }),
    onRecvDone: (id: string, payload: { blob?: Blob; content?: string }) =>
      patchItem(id, { status: 'done', progress: 1, blob: payload.blob, content: payload.content }),
    onSendProgress: (id: string, progress: number) =>
      patchItem(id, { progress, status: progress >= 1 ? 'done' : 'active' }),
  }), [patchItem])

  /** 发送方：初始化并生成 offer 连接码 */
  const startAsSender = useCallback(async () => {
    setRole('sender')
    setError(null)
    setState('creating-offer')
    try {
      const peer = new Peer('sender', makeHandlers())
      peerRef.current = peer
      const offerSdp = await peer.createOffer()
      setLocalCode(encodeSignal({ v: 1, role: 'sender', type: 'offer', sdp: offerSdp }))
      setState('awaiting-answer')
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建连接失败')
      setState('error')
    }
  }, [makeHandlers])

  /** 接收方：初始化（等待贴 offer） */
  const startAsReceiver = useCallback(() => {
    setRole('receiver')
    setError(null)
    setState('idle')
    peerRef.current = new Peer('receiver', makeHandlers())
  }, [makeHandlers])

  /** 接收方：贴入 offer，产出 answer 连接码 */
  const acceptOfferCode = useCallback(async (code: string) => {
    setError(null)
    setState('creating-answer')
    try {
      const payload = decodeSignal(code)
      if (payload.type !== 'offer') throw new Error('请粘贴发送方的连接码（offer）')
      const peer = peerRef.current
      if (!peer) throw new Error('请先选择「接收文件」')
      const answerSdp = await peer.acceptOfferCreateAnswer(payload.sdp)
      setLocalCode(encodeSignal({ v: 1, role: 'receiver', type: 'answer', sdp: answerSdp }))
      setState('connecting')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析连接码失败')
      setState('error')
    }
  }, [])

  /** 发送方：贴入 answer 完成握手 */
  const acceptAnswerCode = useCallback(async (code: string) => {
    setError(null)
    setState('connecting')
    try {
      const payload = decodeSignal(code)
      if (payload.type !== 'answer') throw new Error('请粘贴接收方的连接码（answer）')
      const peer = peerRef.current
      if (!peer) throw new Error('连接已失效，请重新创建')
      await peer.acceptAnswer(payload.sdp)
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析连接码失败')
      setState('error')
    }
  }, [])

  /** 发送文件 */
  const sendFiles = useCallback(async (files: FileList | File[]) => {
    const peer = peerRef.current
    if (!peer) return
    const list = Array.from(files)
    for (const file of list) {
      const item: TransferItem = {
        id: nanoid(), kind: 'file', name: file.name, size: file.size,
        mime: file.type || 'application/octet-stream',
        direction: 'send', progress: 0, status: 'active',
      }
      setItems((prev) => [...prev, item])
      setState('transferring')
      try {
        await peer.sendFile(item, file)
      } catch (e) {
        patchItem(item.id, { status: 'failed' })
        setError(e instanceof Error ? e.message : '发送失败')
      }
    }
    setState('connected')
  }, [patchItem])

  /** 发送文本片段 */
  const sendText = useCallback((content: string) => {
    const peer = peerRef.current
    if (!peer || !content) return
    const id = nanoid()
    const item: TransferItem = {
      id, kind: 'text', name: content.slice(0, 20) || '文本',
      size: new Blob([content]).size, mime: 'text/plain',
      direction: 'send', progress: 1, status: 'done', content,
    }
    setItems((prev) => [...prev, item])
    try {
      peer.sendText(id, content)
    } catch (e) {
      patchItem(id, { status: 'failed' })
      setError(e instanceof Error ? e.message : '发送失败')
    }
  }, [patchItem])

  /** 下载接收到的文件 */
  const download = useCallback((item: TransferItem) => {
    if (item.blob) saveAs(item.blob, item.name)
  }, [])

  /** 复位会话 */
  const reset = useCallback(() => {
    peerRef.current?.close()
    peerRef.current = null
    setRole(null)
    setState('idle')
    setError(null)
    setLocalCode('')
    setItems([])
  }, [])

  return {
    role, state, error, localCode, items,
    startAsSender, startAsReceiver, acceptOfferCode, acceptAnswerCode,
    sendFiles, sendText, download, reset,
  }
}

/** 供页面判断是否超大文件用 */
export { LARGE_FILE_THRESHOLD }
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过

- [ ] **Step 3: 提交**

```bash
git add src/lib/filetransfer/useFileTransfer.ts
git commit -m "feat(filetransfer): add connection state machine hook"
```

---

## Task 6: 图标 + 注册表

**Files:**
- Modify: `src/components/common/Icons.tsx`（文件末尾新增导出）
- Modify: `src/registry/tools.ts`

- [ ] **Step 1: 新增图标**

在 `src/components/common/Icons.tsx` 末尾追加（与现有 Icon 同风格，24x24、stroke=currentColor、strokeWidth=1.5）：

```tsx
export function IconFileTransfer({ className = 'w-5 h-5', style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}
```

- [ ] **Step 2: 注册表导入并新增条目**

在 `src/registry/tools.ts` 顶部 import 行追加 `IconFileTransfer`：

```typescript
import {
  IconChat, IconImage, IconJson, IconDatabase, IconBase64, IconClock, IconLink, IconCron, IconDiff, IconCollage, IconQrCode,
  // 批次 A-D 新增
  IconCurl, IconColor, IconDataConvert, IconIdGen, IconImageCompress, IconMarkdown, IconCsv,
  IconFileTransfer,
} from '../components/common/Icons'
```

在 `toolRegistry` 数组末尾（`csv` 条目之后、`]` 之前）新增：

```typescript
  {
    id: 'file-transfer',
    name: '文件传输',
    description: '跨设备 P2P 直传文件与文本，内网零服务器，外网即将推出',
    icon: IconFileTransfer,
    route: '/file-transfer',
    component: lazy(() => import('../pages/FileTransferPage')),
    category: 'dev',
    keywords: ['p2p', 'webrtc', '传文件', '互传', 'send', 'share', 'airdrop'],
  },
```

- [ ] **Step 3: 类型检查（此时页面组件还不存在，import 会报错——故本步骤先跳过 tsc，等 Task 8 建好页面再统一验证）**

说明：注册表的 `lazy(() => import('../pages/FileTransferPage'))` 在 Task 8 创建页面前会让 `tsc` 报「找不到模块」。这是预期的中间态。本任务**先不**单独跑 tsc，第 4 步直接提交，避免误判。

- [ ] **Step 4: 提交**

```bash
git add src/components/common/Icons.tsx src/registry/tools.ts
git commit -m "feat(filetransfer): register file-transfer tool and add icon"
```

---

## Task 7: 外网占位卡 + 渠道 Tab

**Files:**
- Create: `src/components/filetransfer/ComingSoonCard.tsx`
- Create: `src/components/filetransfer/ChannelSwitcher.tsx`

- [ ] **Step 1: 写 ComingSoonCard**

```tsx
// src/components/filetransfer/ComingSoonCard.tsx

/** 外网渠道占位：解释受 TURN 服务器限制，本期不实现真·外网 P2P */
export default function ComingSoonCard() {
  return (
    <div className="theme-card cursor-default p-8 flex flex-col items-center text-center gap-4" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="text-5xl" aria-hidden>🌐</div>
      <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
        外网传输 · 即将推出
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        跨网络的 P2P 直传需要 TURN 中转服务器来穿透对称型 NAT。
        本工具是纯前端零后端应用，暂无稳定的免费 TURN 资源，
        因此外网渠道尚未开放。
      </p>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        当前请使用「内网」渠道：在同一局域网 / 同一热点下，
        两台设备可零服务器直接互传。
      </p>
    </div>
  )
}
```

- [ ] **Step 2: 写 ChannelSwitcher**

```tsx
// src/components/filetransfer/ChannelSwitcher.tsx
import type { Channel } from '../../lib/filetransfer/types'

interface Props {
  value: Channel
  onChange: (c: Channel) => void
}

/** 内网 / 外网 渠道切换（复用 theme-tab 样式） */
export default function ChannelSwitcher({ value, onChange }: Props) {
  const tabs: { key: Channel; label: string }[] = [
    { key: 'lan', label: '内网（局域网直传）' },
    { key: 'wan', label: '外网（即将推出）' },
  ]
  return (
    <div role="tablist" aria-label="传输渠道" className="flex gap-3 justify-center flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          className="theme-tab"
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 仅剩 `FileTransferPage` 未创建导致的模块缺失报错（Task 8 解决），本任务两个组件本身无报错。

- [ ] **Step 4: 提交**

```bash
git add src/components/filetransfer/ComingSoonCard.tsx src/components/filetransfer/ChannelSwitcher.tsx
git commit -m "feat(filetransfer): add channel switcher and WAN coming-soon card"
```

---

## Task 8: 信令交换组件（SignalExchange.tsx）

显示本端连接码（文本框 + 二维码 + 复制按钮）+ 粘贴对端连接码输入框。

**Files:**
- Create: `src/components/filetransfer/SignalExchange.tsx`

- [ ] **Step 1: 写实现**

```tsx
// src/components/filetransfer/SignalExchange.tsx
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from '../../stores/toastStore'

interface Props {
  /** 本端生成的连接码（供对方扫/贴）；空则不显示 */
  localCode: string
  /** 是否需要让用户粘贴对端连接码 */
  needPaste: boolean
  /** 粘贴框标题 */
  pasteLabel: string
  /** 提交对端连接码 */
  onSubmit: (code: string) => void
  /** 本端连接码区标题 */
  localLabel: string
}

/** 信令交换：本端码（文本+二维码+复制） + 对端码粘贴 */
export default function SignalExchange({ localCode, needPaste, pasteLabel, onSubmit, localLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [paste, setPaste] = useState('')

  // 连接码 -> 二维码（连接码可能较长，用低容错等级提高容量）
  useEffect(() => {
    if (!localCode || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, localCode, { errorCorrectionLevel: 'L', width: 220, margin: 1 })
      .catch(() => { /* 内容过长无法生成二维码时静默，文本码仍可用 */ })
  }, [localCode])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(localCode)
      toast.success('连接码已复制')
    } catch {
      toast.error('复制失败，请手动选择文本复制')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {localCode && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {localLabel}
          </label>
          <div className="flex flex-col items-center gap-3 p-4 rounded-lg"
            style={{ background: 'var(--bg-secondary)', border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius)' }}>
            <div className="p-2 rounded" style={{ background: '#fff' }}>
              <canvas ref={canvasRef} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              对方可扫码，或复制下方连接码粘贴
            </p>
          </div>
          <textarea
            className="theme-input font-mono"
            readOnly
            value={localCode}
            onFocus={(e) => e.currentTarget.select()}
            style={{ minHeight: 72, fontSize: 12, resize: 'vertical', wordBreak: 'break-all' }}
          />
          <button className="theme-btn theme-btn-primary self-start" onClick={copy} style={{ fontSize: 13, padding: '8px 18px' }}>
            复制连接码
          </button>
        </div>
      )}

      {needPaste && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {pasteLabel}
          </label>
          <textarea
            className="theme-input font-mono"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="粘贴对方提供的连接码..."
            style={{ minHeight: 72, fontSize: 12, resize: 'vertical', wordBreak: 'break-all' }}
            spellCheck={false}
          />
          <button
            className="theme-btn theme-btn-primary self-start"
            onClick={() => onSubmit(paste.trim())}
            disabled={!paste.trim()}
            style={{ fontSize: 13, padding: '8px 18px' }}
          >
            确认连接码
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/filetransfer/SignalExchange.tsx
git commit -m "feat(filetransfer): add signal exchange UI with QR + copy/paste"
```

---

## Task 9: 传输面板组件（TransferPanel.tsx）

连通后：文件拖拽/选择区 + 文本片段输入 + 收发进度列表 + 接收文件下载。

**Files:**
- Create: `src/components/filetransfer/TransferPanel.tsx`

- [ ] **Step 1: 写实现**

```tsx
// src/components/filetransfer/TransferPanel.tsx
import { useRef, useState } from 'react'
import type { TransferItem } from '../../lib/filetransfer/types'
import { LARGE_FILE_THRESHOLD } from '../../lib/filetransfer/transfer'
import { toast } from '../../stores/toastStore'

interface Props {
  items: TransferItem[]
  onSendFiles: (files: FileList | File[]) => void
  onSendText: (content: string) => void
  onDownload: (item: TransferItem) => void
}

/** 人类可读文件大小 */
function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function TransferPanel({ items, onSendFiles, onSendText, onDownload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [text, setText] = useState('')

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.some((f) => f.size > LARGE_FILE_THRESHOLD)) {
      toast.info('文件较大，传输可能较慢，请保持页面在前台')
    }
    onSendFiles(list)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 文件拖拽区 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="拖拽或点击选择文件发送"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true) }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files) }}
        className="flex flex-col items-center justify-center border-2 border-dashed p-8 text-center cursor-pointer"
        style={{
          borderColor: dragging ? 'var(--accent-1)' : 'var(--border-color)',
          background: dragging ? 'color-mix(in srgb, var(--accent-1) 10%, transparent)' : 'var(--bg-secondary)',
          borderRadius: 'var(--radius)', outline: 'none',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }}
        />
        <div className="text-4xl mb-2" style={{ color: 'var(--accent-1)' }}>📤</div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {dragging ? '松开以发送' : '拖拽文件到这里，或点击选择'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>支持多文件</p>
      </div>

      {/* 文本片段 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>发送文本片段</label>
        <textarea
          className="theme-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入要发送的文字 / 链接..."
          style={{ minHeight: 64, fontSize: 13, resize: 'vertical' }}
        />
        <button
          className="theme-btn self-start"
          disabled={!text.trim()}
          onClick={() => { onSendText(text.trim()); setText('') }}
          style={{ fontSize: 13, padding: '8px 18px' }}
        >
          发送文本
        </button>
      </div>

      {/* 收发进度列表 */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>传输记录</label>
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.id} className="p-3 rounded-lg flex flex-col gap-2"
                style={{ background: 'var(--bg-secondary)', border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span aria-hidden>{it.direction === 'send' ? '↑' : '↓'}</span>
                    <span className="truncate">{it.name}</span>
                  </span>
                  <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    {it.kind === 'file' ? fmtSize(it.size) : '文本'}
                  </span>
                </div>

                {/* 进度条（文件展示；文本即时完成不展示） */}
                {it.kind === 'file' && it.status !== 'done' && (
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                    <div className="h-full" style={{ width: `${Math.round(it.progress * 100)}%`, background: 'var(--accent-1)', transition: 'width 0.2s' }} />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs" style={{
                    color: it.status === 'failed' ? 'var(--color-danger)'
                      : it.status === 'done' ? 'var(--color-success)' : 'var(--text-muted)',
                  }}>
                    {it.status === 'failed' ? '失败'
                      : it.status === 'done' ? '完成'
                      : `${Math.round(it.progress * 100)}%`}
                  </span>

                  {/* 接收完成的文件可下载 */}
                  {it.direction === 'recv' && it.kind === 'file' && it.status === 'done' && it.blob && (
                    <button className="theme-btn theme-btn-primary" onClick={() => onDownload(it)} style={{ fontSize: 12, padding: '4px 12px' }}>
                      下载
                    </button>
                  )}
                  {/* 接收的文本可复制 */}
                  {it.kind === 'text' && it.content && (
                    <button className="theme-btn" onClick={async () => {
                      try { await navigator.clipboard.writeText(it.content!); toast.success('已复制') }
                      catch { toast.error('复制失败') }
                    }} style={{ fontSize: 12, padding: '4px 12px' }}>
                      复制文本
                    </button>
                  )}
                </div>

                {/* 文本内容预览 */}
                {it.kind === 'text' && it.content && (
                  <div className="text-xs font-mono p-2 rounded break-all"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', maxHeight: 96, overflow: 'auto' }}>
                    {it.content}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/filetransfer/TransferPanel.tsx
git commit -m "feat(filetransfer): add transfer panel with progress and download"
```

---

## Task 10: 主壳页面（FileTransferPage.tsx）

编排：BackToHome 头部 + ChannelSwitcher + 按角色/状态渲染信令交换与传输面板 + 外网占位。

**Files:**
- Create: `src/pages/FileTransferPage.tsx`

- [ ] **Step 1: 写实现**

```tsx
// src/pages/FileTransferPage.tsx
import { useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import ChannelSwitcher from '../components/filetransfer/ChannelSwitcher'
import ComingSoonCard from '../components/filetransfer/ComingSoonCard'
import SignalExchange from '../components/filetransfer/SignalExchange'
import TransferPanel from '../components/filetransfer/TransferPanel'
import { useFileTransfer } from '../lib/filetransfer/useFileTransfer'
import type { Channel } from '../lib/filetransfer/types'

export default function FileTransferPage() {
  const [channel, setChannel] = useState<Channel>('lan')
  const ft = useFileTransfer()

  const connected = ft.state === 'connected' || ft.state === 'transferring'

  return (
    <div className="min-h-screen w-full pb-12" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>跨设备文件传输</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          内网零服务器 P2P 直传文件与文本，数据不经任何中转
        </p>
      </header>

      <div className="px-4 mb-8">
        <ChannelSwitcher value={channel} onChange={setChannel} />
      </div>

      <main className="px-4" style={{ maxWidth: 1100, margin: '0 auto' }}>
        {channel === 'wan' ? (
          <ComingSoonCard />
        ) : (
          <>
            {/* 错误提示 */}
            {ft.error && (
              <div className="theme-alert theme-alert-error mb-6" role="alert" style={{ maxWidth: 760, margin: '0 auto 1.5rem' }}>
                <span>⚠</span><span>{ft.error}</span>
              </div>
            )}

            {/* 角色选择 */}
            {ft.role === null && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ maxWidth: 760, margin: '0 auto' }}>
                <button className="theme-card p-8 flex flex-col items-center gap-3 text-center" onClick={ft.startAsSender}>
                  <div className="text-4xl" aria-hidden>📤</div>
                  <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>发送文件</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>生成连接码给对方</span>
                </button>
                <button className="theme-card p-8 flex flex-col items-center gap-3 text-center" onClick={ft.startAsReceiver}>
                  <div className="text-4xl" aria-hidden>📥</div>
                  <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>接收文件</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>粘贴对方的连接码</span>
                </button>
              </div>
            )}

            {/* 已选角色但未连通：信令交换 */}
            {ft.role !== null && !connected && (
              <section className="theme-card cursor-default p-6" style={{ maxWidth: 760, margin: '0 auto' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                    {ft.role === 'sender' ? '① 把连接码发给对方 → ② 贴回对方的连接码' : '① 贴入对方连接码 → ② 把生成的连接码发回对方'}
                  </h2>
                  <button className="theme-btn" onClick={ft.reset} style={{ fontSize: 12, padding: '4px 12px' }}>重置</button>
                </div>

                {ft.role === 'sender' ? (
                  <SignalExchange
                    localLabel="你的连接码（offer，发给对方）"
                    localCode={ft.localCode}
                    needPaste
                    pasteLabel="粘贴对方回传的连接码（answer）"
                    onSubmit={ft.acceptAnswerCode}
                  />
                ) : (
                  <SignalExchange
                    localLabel="你的连接码（answer，发回对方）"
                    localCode={ft.localCode}
                    needPaste={!ft.localCode}
                    pasteLabel="粘贴对方的连接码（offer）"
                    onSubmit={ft.acceptOfferCode}
                  />
                )}
              </section>
            )}

            {/* 已连通：传输面板 */}
            {connected && (
              <section className="theme-card cursor-default p-6" style={{ maxWidth: 760, margin: '0 auto' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                    <span style={{ color: 'var(--color-success)' }}>●</span> 已连接
                  </h2>
                  <button className="theme-btn" onClick={ft.reset} style={{ fontSize: 12, padding: '4px 12px' }}>断开</button>
                </div>
                <TransferPanel
                  items={ft.items}
                  onSendFiles={ft.sendFiles}
                  onSendText={ft.sendText}
                  onDownload={ft.download}
                />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: 全量类型检查（页面已建，模块缺失应消失）**

Run: `npx tsc --noEmit`
Expected: 通过，无报错

- [ ] **Step 3: 提交**

```bash
git add src/pages/FileTransferPage.tsx
git commit -m "feat(filetransfer): add main page shell wiring channels and roles"
```

---

## Task 11: 集成测试（路由 + 渲染 + Tab 切换）

参照 `src/__tests__/` 既有风格，验证页面注册、渲染、外网 Tab 切换出现占位文案。WebRTC 在 jsdom 不可用，故只测 UI 层。

**Files:**
- Test: `src/__tests__/file-transfer.test.tsx`

- [ ] **Step 1: 写测试**

```tsx
// src/__tests__/file-transfer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FileTransferPage from '../pages/FileTransferPage'
import { toolRegistry } from '../registry/tools'

describe('文件传输工具', () => {
  it('已在注册表中且路由为 /file-transfer', () => {
    const tool = toolRegistry.find((t) => t.id === 'file-transfer')
    expect(tool).toBeDefined()
    expect(tool?.route).toBe('/file-transfer')
    expect(tool?.category).toBe('dev')
  })

  it('默认显示内网渠道与角色选择', () => {
    render(<MemoryRouter><FileTransferPage /></MemoryRouter>)
    expect(screen.getByText('跨设备文件传输')).toBeInTheDocument()
    expect(screen.getByText('发送文件')).toBeInTheDocument()
    expect(screen.getByText('接收文件')).toBeInTheDocument()
  })

  it('切到外网 Tab 显示「即将推出」占位', () => {
    render(<MemoryRouter><FileTransferPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /外网/ }))
    expect(screen.getByText(/即将推出/)).toBeInTheDocument()
    expect(screen.getByText(/TURN/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npx vitest run src/__tests__/file-transfer.test.tsx`
Expected: PASS（3 个用例）

- [ ] **Step 3: 提交**

```bash
git add src/__tests__/file-transfer.test.tsx
git commit -m "test(filetransfer): cover registry, render, and channel switch"
```

---

## Task 12: 全量验证

- [ ] **Step 1: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过

- [ ] **Step 2: 全量测试**

Run: `npx vitest run`
Expected: 全绿（含新增 filetransfer 用例，且不破坏既有用例）

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 无新增错误

- [ ] **Step 4: 构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 5: 手动联调（两个浏览器标签/两台同网设备）**

1. 标签 A 打开 `/file-transfer` → 选「发送文件」→ 复制 offer 连接码
2. 标签 B 打开 `/file-transfer` → 选「接收文件」→ 粘贴 offer → 复制生成的 answer
3. 标签 A 粘贴 answer → 双方显示「已连接」
4. A 选文件发送 → B 进度增长 → 完成后 B 点「下载」得到原文件
5. A 发送文本 → B 出现文本项并可复制
6. 切到「外网」Tab 确认占位文案

---

## Self-Review（规划期自检）

**Spec 覆盖：**
- 内网 WebRTC P2P 直传 → Task 4/5/10 ✓
- 连接码为主 + 二维码辅助 → Task 2/8 ✓
- 非 trickle ICE 一次性完整 SDP → Task 4 `waitForCompleteSdp` ✓
- 文件 + 文本片段 → Task 3/5/9 ✓
- 背压 / 分块 → Task 3/4 ✓
- 大文件 >500MB 软提示 → Task 9 `LARGE_FILE_THRESHOLD` + toast ✓
- 外网占位 + TURN 说明 → Task 7 ComingSoonCard ✓
- 注册表自动路由/卡片 → Task 6 ✓
- 复用多主题设计系统 → 所有组件用 `theme-*` / `var(--*)` ✓
- 测试：signal 往返、transfer 帧、页面渲染/Tab → Task 2/3/11 ✓
- 错误处理：连接码非法、ICE 超时、通道断开 → Task 2(decode 抛错)/4(超时兜底+onError)/10(error 展示) ✓

**类型一致性：**
- `SignalPayload`/`ControlFrame`/`TransferItem`/`ConnState` 在 types.ts 定义，各处引用一致 ✓
- Hook 方法名 `startAsSender`/`startAsReceiver`/`acceptOfferCode`/`acceptAnswerCode`/`sendFiles`/`sendText`/`download`/`reset` 在 Task 5 定义、Task 10 调用一致 ✓
- `Peer` 方法 `createOffer`/`acceptAnswer`/`acceptOfferCreateAnswer`/`sendFile`/`sendText`/`close` 在 Task 4 定义、Task 5 调用一致 ✓

**占位符扫描：** 无 TODO/TBD，每个代码步骤均为完整可运行代码 ✓

**注意（中间态）：** Task 6 注册表引用页面后、Task 10 建页面前，`tsc` 会临时报模块缺失，已在 Task 6 Step 3 显式说明并跳过该步 tsc。
