// Base64 图片转换 Web Worker
// 用于处理大型图片（≥1MB）的 ArrayBuffer ↔ Base64 转换，避免阻塞主线程

interface EncodeRequest {
  type: 'encode'
  /** 图片二进制内容，使用 Transferable 转移所有权，零拷贝 */
  buffer: ArrayBuffer
  mime: string
}

interface DecodeRequest {
  type: 'decode'
  /** 纯 Base64（不含 data:xxx;base64, 前缀） */
  base64: string
}

type WorkerRequest = EncodeRequest | DecodeRequest

interface EncodeResponse {
  type: 'encode'
  success: true
  dataUrl: string
}

interface DecodeResponse {
  type: 'decode'
  success: true
  buffer: ArrayBuffer
}

interface ErrorResponse {
  type: 'encode' | 'decode'
  success: false
  error: string
}

/** Worker 全局 self 在 TS DOM lib 下默认推断为 Window，这里显式断言为简化的 worker 上下文类型 */
interface MinimalWorkerScope {
  onmessage: ((this: MinimalWorkerScope, ev: MessageEvent) => unknown) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}
const ctx = self as unknown as MinimalWorkerScope

/**
 * Uint8Array → Base64 字符串
 *
 * 性能要点：
 * - 直接 String.fromCharCode(...bytes) 在 100KB+ 时栈溢出
 * - 分块拼接（每 32KB 一段）兼顾速度与安全
 * - 之后由原生 btoa 编码，比手写 base64 表查表快 5-10 倍
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000 // 32KB
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK)
    // fromCharCode 接受类数组；用 apply 展开避免 spread 在大数组上失败
    binary += String.fromCharCode.apply(null, slice as unknown as number[])
  }
  return btoa(binary)
}

/** Base64 字符串 → Uint8Array */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data
  try {
    if (req.type === 'encode') {
      const bytes = new Uint8Array(req.buffer)
      const base64 = bytesToBase64(bytes)
      const dataUrl = `data:${req.mime};base64,${base64}`
      const resp: EncodeResponse = { type: 'encode', success: true, dataUrl }
      ctx.postMessage(resp)
    } else if (req.type === 'decode') {
      const bytes = base64ToBytes(req.base64)
      const resp: DecodeResponse = { type: 'decode', success: true, buffer: bytes.buffer }
      // 用 Transferable 把 ArrayBuffer 所有权转回主线程，零拷贝
      ctx.postMessage(resp, [bytes.buffer])
    } else {
      const resp: ErrorResponse = { type: 'encode', success: false, error: '未知请求类型' }
      ctx.postMessage(resp)
    }
  } catch (e) {
    const resp: ErrorResponse = {
      type: req.type,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }
    ctx.postMessage(resp)
  }
}

export {}
