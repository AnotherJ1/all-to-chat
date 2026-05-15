/**
 * Base64 与图片相互转换工具库
 *
 * 兼容性处理：
 * - 图片 → Base64：使用 FileReader.readAsDataURL（IE10+ / 所有现代浏览器支持）
 * - Base64 → 图片：兼容 Data URI（data:image/png;base64,xxx）和纯 Base64 字符串
 * - 自动嗅探 MIME 类型（PNG / JPEG / GIF / WebP / BMP / SVG）
 * - 安全解码：atob 无法解析非法字符时给出明确错误
 * - 大小校验：防止超大文件阻塞主线程
 */

/** 默认大小上限：10 MB（防止主线程阻塞） */
export const DEFAULT_MAX_SIZE = 10 * 1024 * 1024

/** 走 Web Worker 的阈值：超过 1 MB 时主线程会有明显卡顿 */
export const WORKER_THRESHOLD = 1 * 1024 * 1024

/** 支持的图片 MIME 类型 */
export const SUPPORTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
] as const

export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number]

/** 文件 → Data URL（含 data:image/xxx;base64, 前缀） */
export function fileToDataUrl(
  file: File,
  options: { maxSize?: number } = {}
): Promise<string> {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE

  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('文件为空'))
      return
    }
    if (file.size > maxSize) {
      reject(new Error(`文件过大（${formatBytes(file.size)}），最大支持 ${formatBytes(maxSize)}`))
      return
    }
    if (!file.type.startsWith('image/')) {
      reject(new Error(`不支持的文件类型: ${file.type || '未知'}（仅支持图片）`))
      return
    }

    // FileReader 兼容性最好（IE10+ / 所有现代浏览器）
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result)
      } else {
        reject(new Error('读取结果格式错误'))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.onabort = () => reject(new Error('文件读取已取消'))
    reader.readAsDataURL(file)
  })
}

/**
 * 文件校验（大小 / MIME），通过返回 true，否则抛错
 * 提取出来供主线程在调度 worker 之前先做检查
 */
export function validateImageFile(file: File, maxSize: number = DEFAULT_MAX_SIZE): void {
  if (!file) throw new Error('文件为空')
  if (file.size > maxSize) {
    throw new Error(`文件过大（${formatBytes(file.size)}），最大支持 ${formatBytes(maxSize)}`)
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`不支持的文件类型: ${file.type || '未知'}（仅支持图片）`)
  }
}

/** 文件 → ArrayBuffer（用于走 Worker 的零拷贝路径） */
export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  // File.arrayBuffer() 在所有现代浏览器（含 Safari 14+）支持
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer()
  }
  // 降级到 FileReader.readAsArrayBuffer（IE10+ 兼容）
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const r = reader.result
      if (r instanceof ArrayBuffer) resolve(r)
      else reject(new Error('读取结果格式错误'))
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

/** 从 Data URL 中剥离前缀，返回纯 Base64
 *  性能：用 indexOf + slice (O(1) SlicedString) 代替带 capture group 的正则（会复制字符串） */
export function stripDataUrlPrefix(dataUrl: string): string {
  if (!dataUrl.startsWith('data:')) return dataUrl
  const idx = dataUrl.indexOf(';base64,')
  if (idx < 0) return dataUrl
  return dataUrl.slice(idx + 8) // ';base64,'.length === 8
}

/** 从 Data URL 中提取 MIME 类型 */
export function extractMimeType(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;]+);base64,/)
  return match ? match[1] : null
}

/**
 * 通过文件头魔数嗅探图片 MIME 类型
 * 当用户输入裸 Base64 时使用，避免无脑默认 png
 */
export function sniffMimeFromBase64(base64: string): SupportedMimeType {
  // 取前若干字节做 magic number 判断
  const header = base64.slice(0, 16)

  // PNG: iVBORw0KGgo...（base64 of 89 50 4E 47）
  if (header.startsWith('iVBORw0KGgo')) return 'image/png'
  // JPEG: /9j/...（base64 of FF D8 FF）
  if (header.startsWith('/9j/')) return 'image/jpeg'
  // GIF: R0lGOD...（base64 of 47 49 46 38）
  if (header.startsWith('R0lGOD')) return 'image/gif'
  // WebP: UklGR... + ...WEBP
  if (header.startsWith('UklGR')) return 'image/webp'
  // BMP: Qk...（base64 of 42 4D）
  if (header.startsWith('Qk')) return 'image/bmp'
  // SVG: PHN2Zy 或 PD94bWw（'<svg' / '<?xml'）
  if (header.startsWith('PHN2Zy') || header.startsWith('PD94bWw')) return 'image/svg+xml'

  // 默认按 PNG 处理
  return 'image/png'
}

/**
 * 标准化用户输入的 Base64 字符串为合法的 Data URL
 * 支持以下输入：
 * - 完整 Data URL: data:image/png;base64,iVBOR...
 * - 纯 Base64: iVBOR...
 * - 含空白/换行的 Base64
 */
export function normalizeToDataUrl(input: string): { dataUrl: string; mime: string } {
  if (!input || typeof input !== 'string') {
    throw new Error('输入为空')
  }

  // 去除空白字符（base64 允许包含空白，但解码前需清理）
  const cleaned = input.trim().replace(/\s/g, '')

  if (!cleaned) {
    throw new Error('输入为空')
  }

  // 已经是 Data URL
  if (cleaned.startsWith('data:')) {
    const mime = extractMimeType(cleaned)
    if (!mime) {
      throw new Error('Data URL 格式错误，未找到 MIME 类型')
    }
    if (!mime.startsWith('image/')) {
      throw new Error(`Data URL 类型不是图片: ${mime}`)
    }
    const pureBase64 = stripDataUrlPrefix(cleaned)
    validateBase64(pureBase64)
    return { dataUrl: cleaned, mime }
  }

  // 纯 Base64：先校验合法性，再嗅探 MIME 拼装 Data URL
  validateBase64(cleaned)
  const mime = sniffMimeFromBase64(cleaned)
  return { dataUrl: `data:${mime};base64,${cleaned}`, mime }
}

/**
 * 校验 Base64 字符串合法性
 * 1. 字符集只能是 A-Z a-z 0-9 + / =
 * 2. 长度必须是 4 的倍数（标准 base64）
 * 3. atob 必须能成功解析
 */
export function validateBase64(base64: string): void {
  // 字符集
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('Base64 含有非法字符（只允许 A-Z a-z 0-9 + / =）')
  }
  if (base64.length === 0) {
    throw new Error('Base64 内容为空')
  }
  if (base64.length % 4 !== 0) {
    throw new Error('Base64 长度无效（必须是 4 的倍数）')
  }
  try {
    // atob 是同步、IE10+ 支持，但只能处理 latin1 字符集
    atob(base64.slice(0, Math.min(base64.length, 1024)))
  } catch {
    throw new Error('Base64 解码失败，请检查输入是否完整')
  }
}

/**
 * Data URL → Blob
 * 用于「下载图片」或「转 ObjectURL 渲染」
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const mime = extractMimeType(dataUrl) || 'application/octet-stream'
  const base64 = stripDataUrlPrefix(dataUrl)
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

/** 触发浏览器下载（兼容旧版 IE/Edge：使用 a[download]） */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const blob = dataUrlToBlob(dataUrl)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    // 延迟释放，避免某些浏览器尚未启动下载就回收
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** 复制文本到剪贴板（带降级方案，兼容 HTTP 与旧浏览器） */
export async function copyToClipboard(text: string): Promise<void> {
  // 优先用 navigator.clipboard（仅 HTTPS / localhost 可用）
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  // 降级：使用 textarea + execCommand（已废弃但兼容性最好）
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    const ok = document.execCommand('copy')
    if (!ok) throw new Error('execCommand 失败')
  } finally {
    document.body.removeChild(textarea)
  }
}

/** 格式化字节数为可读字符串 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** 估算 Base64 字符串解码后的字节数
 *  性能：避免对原始大字符串调用 replace 复制副本；按字符遍历仅统计空白与 padding */
export function estimateBase64Size(base64: string): number {
  const len = base64.length
  if (len === 0) return 0

  // 跳过 data:xxx;base64, 前缀（只查一次 indexOf，O(常数)）
  let start = 0
  if (base64.length > 5 && base64.charCodeAt(0) === 100 /* 'd' */) {
    const idx = base64.indexOf(';base64,')
    if (idx >= 0) start = idx + 8
  }

  let chars = 0
  let padding = 0
  // 倒序计 padding（== 至多两个）
  for (let i = len - 1; i >= start && len - i <= 4; i--) {
    if (base64.charCodeAt(i) === 61 /* '=' */) padding++
    else if (base64.charCodeAt(i) > 32) break
  }

  // 正向计有效字符数（跳过空白）
  for (let i = start; i < len; i++) {
    const c = base64.charCodeAt(i)
    // 32=space 9=tab 10=lf 13=cr
    if (c > 32) chars++
  }

  return Math.floor((chars * 3) / 4) - padding
}

/** 推断文件扩展名 */
export function mimeToExtension(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
  }
  return map[mime] || 'bin'
}
