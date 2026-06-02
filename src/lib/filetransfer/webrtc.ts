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
