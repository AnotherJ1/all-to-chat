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