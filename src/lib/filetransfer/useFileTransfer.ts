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
  /** 代次计数：reset / 重建 peer 时自增，用于失效旧 Peer 的异步回调 */
  const genRef = useRef(0)

  /** 局部更新某条 item */
  const patchItem = useCallback((id: string, patch: Partial<TransferItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  /** 构造 Peer 的事件回调（闭包捕获当前代次，过期回调直接丢弃） */
  const makeHandlers = useCallback(() => {
    const gen = genRef.current
    const fresh = () => gen === genRef.current
    return {
      onOpen: () => { if (fresh()) setState('connected') },
      onClose: () => { if (fresh()) setState((s) => (s === 'error' ? s : 'idle')) },
      onError: (msg: string) => { if (fresh()) { setError(msg); setState('error') } },
      onIncomingMeta: (item: TransferItem) => { if (fresh()) setItems((prev) => [...prev, item]) },
      onRecvProgress: (id: string, progress: number) => { if (fresh()) patchItem(id, { progress }) },
      onRecvDone: (id: string, payload: { blob?: Blob; content?: string }) => { if (fresh()) patchItem(id, { status: 'done', progress: 1, blob: payload.blob, content: payload.content }) },
      onSendProgress: (id: string, progress: number) => { if (fresh()) patchItem(id, { progress, status: progress >= 1 ? 'done' : 'active' }) },
    }
  }, [patchItem])

  /** 发送方：初始化并生成 offer 连接码 */
  const startAsSender = useCallback(async () => {
    setRole('sender')
    setError(null)
    setState('creating-offer')
    try {
      peerRef.current?.close()
      genRef.current++
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
    peerRef.current?.close()
    genRef.current++
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
    genRef.current++
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