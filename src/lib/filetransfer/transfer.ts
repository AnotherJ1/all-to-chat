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