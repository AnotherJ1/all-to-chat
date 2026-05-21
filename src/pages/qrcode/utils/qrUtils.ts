/**
 * 二维码工具的纯函数集合
 * - 图像降采样（防止超大图 OOM）
 * - 颜色合法性校验
 * - 颜色对比度计算
 * - URL scheme 校验
 * - URL 参数与对象互转
 */

/**
 * 安全释放 ObjectURL（兜底空值，避免抛错）
 */
export function safeRevoke(url?: string | null): void {
  if (!url) return
  // 仅 blob: 与 data: 前缀有意义；data: 不需要 revoke，但调用 revoke 也是安全的
  try {
    if (typeof URL !== 'undefined' && URL.revokeObjectURL && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  } catch {
    // 忽略
  }
}

/**
 * 把文件读取为 dataURL（适合 Logo，规避反复 createObjectURL）
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 大图降采样：超过 maxSide 时按比例缩放，防止 jsQR 解析时 OOM
 * 返回绘制好的 canvas（已包含图像数据），调用方可直接 getImageData
 */
export function downscaleImage(
  file: File,
  maxSide: number = 1600,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        try {
          const ratio = Math.min(1, maxSide / Math.max(img.width, img.height))
          const w = Math.max(1, Math.round(img.width * ratio))
          const h = Math.max(1, Math.round(img.height * ratio))

          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('当前环境不支持 Canvas 2D 上下文'))
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas)
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * Hex 颜色合法性校验，支持 #RGB / #RRGGBB / #RRGGBBAA
 */
export function isValidHexColor(hex: string): boolean {
  if (typeof hex !== 'string') return false
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex.trim())
}

/**
 * 把任意有效 hex 扩展为 #RRGGBB 形式
 */
function expandHex(hex: string): string {
  const s = hex.trim()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return '#' + s.slice(1).split('').map((c) => c + c).join('')
  }
  if (/^#[0-9a-fA-F]{8}$/.test(s)) {
    return s.slice(0, 7)
  }
  return s
}

/** 把 hex 转换为 0-255 RGB 三元组 */
function hexToRgb(hex: string): [number, number, number] {
  const s = expandHex(hex)
  const r = parseInt(s.slice(1, 3), 16)
  const g = parseInt(s.slice(3, 5), 16)
  const b = parseInt(s.slice(5, 7), 16)
  return [r, g, b]
}

/** 计算单通道相对亮度分量（WCAG 标准） */
function channelLum(c: number): number {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

/**
 * WCAG 对比度（结果范围约 1~21），无效输入回退为 1。
 * 用于二维码前/背景颜色对比警告。
 */
export function getContrastRatio(fg: string, bg: string): number {
  if (!isValidHexColor(fg) || !isValidHexColor(bg)) return 1
  const [r1, g1, b1] = hexToRgb(fg)
  const [r2, g2, b2] = hexToRgb(bg)
  const L1 = 0.2126 * channelLum(r1) + 0.7152 * channelLum(g1) + 0.0722 * channelLum(b1)
  const L2 = 0.2126 * channelLum(r2) + 0.7152 * channelLum(g2) + 0.0722 * channelLum(b2)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 仅允许 http(s) 链接的安全打开方式，防止 javascript:、data: 等 XSS 风险
 * 返回 true 表示成功打开
 */
export function safeOpenUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (typeof window !== 'undefined') {
      window.open(u.href, '_blank', 'noopener,noreferrer')
    }
    return true
  } catch {
    return false
  }
}

/**
 * 把可序列化对象转为 query string（不含前导 ?）
 * - undefined / null / '' 字段会被跳过
 */
export function paramsToQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    usp.set(k, String(v))
  }
  return usp.toString()
}

/** 从 query string 还原对象，未指定 key 回退为空 */
export function queryStringToParams(qs: string): Record<string, string> {
  const out: Record<string, string> = {}
  const trimmed = qs.startsWith('?') ? qs.slice(1) : qs
  if (!trimmed) return out
  const usp = new URLSearchParams(trimmed)
  usp.forEach((v, k) => {
    out[k] = v
  })
  return out
}
