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