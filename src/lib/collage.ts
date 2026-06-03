/**
 * 拼图工具核心纯函数
 *
 * 提供：
 * - 画布预设尺寸映射
 * - 坐标夹紧（防止图片被拖出画布）
 * - 等比缩放计算（基于角点拖动）
 * - 合成导出（canvas.drawImage + toBlob）
 */
import type { CanvasPreset, CanvasSize, CollageItem, ResizeCorner } from '../types/collage'

/** 画布最大边长上限（像素），防止 canvas 内存爆炸 */
export const MAX_CANVAS_DIMENSION = 8000

/** 画布最小边长 */
export const MIN_CANVAS_DIMENSION = 1

/** 画布上同时存在的最大图片数量 */
export const MAX_ITEMS_PER_CANVAS = 20

/** 单张图片缩放后的最小边长（像素） */
export const MIN_ITEM_SIZE = 16

/** 预设比例对应的初始像素尺寸（用户切到 custom 后可继续调整） */
export const PRESET_SIZE_MAP: Record<Exclude<CanvasPreset, 'custom'>, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '4:3': { width: 1600, height: 1200 },
  // A4 纵向 300dpi 近似 2480x3508；为节省内存使用 200dpi 等比
  A4: { width: 1654, height: 2339 },
}

/** 预设的中文显示名 */
export const PRESET_LABEL_MAP: Record<CanvasPreset, string> = {
  '1:1': '正方形 1:1',
  '16:9': '横版 16:9',
  '9:16': '竖版 9:16',
  '4:3': '横版 4:3',
  A4: 'A4 纵版',
  custom: '自定义尺寸',
}

/** 根据预设构造画布尺寸 */
export function canvasSizeFromPreset(preset: Exclude<CanvasPreset, 'custom'>): CanvasSize {
  const { width, height } = PRESET_SIZE_MAP[preset]
  return { preset, width, height }
}

/** 校验自定义像素值（返回夹紧后的合法值） */
export function clampCanvasDimension(value: number): number {
  if (!Number.isFinite(value)) return MIN_CANVAS_DIMENSION
  return Math.max(MIN_CANVAS_DIMENSION, Math.min(MAX_CANVAS_DIMENSION, Math.round(value)))
}

/**
 * 计算新加入图片的初始尺寸 + 居中位置
 * 策略：图片最大占画布短边的 60%，等比缩放，居中
 */
export function placeNewItem(
  canvas: CanvasSize,
  naturalWidth: number,
  naturalHeight: number
): { x: number; y: number; width: number; height: number } {
  const targetMax = Math.min(canvas.width, canvas.height) * 0.6
  const ratio = naturalWidth / naturalHeight
  let width: number
  let height: number
  if (ratio >= 1) {
    width = Math.min(naturalWidth, targetMax)
    height = width / ratio
  } else {
    height = Math.min(naturalHeight, targetMax)
    width = height * ratio
  }
  // 居中放置
  const x = (canvas.width - width) / 2
  const y = (canvas.height - height) / 2
  return { x, y, width, height }
}

/**
 * 把图片位置/尺寸夹紧到画布内
 * - 完全脱出画布时会被拉回到边界
 * - 允许部分超出（保留拼贴自由度），但至少需保留 1px 在画布内
 */
export function clampItemToCanvas(item: CollageItem, canvas: CanvasSize): CollageItem {
  const minX = -item.width + 1
  const maxX = canvas.width - 1
  const minY = -item.height + 1
  const maxY = canvas.height - 1
  const x = Math.max(minX, Math.min(maxX, item.x))
  const y = Math.max(minY, Math.min(maxY, item.y))
  if (x === item.x && y === item.y) return item
  return { ...item, x, y }
}

/**
 * 角点拖动 → 等比缩放
 *
 * 输入：
 * - corner: 当前拖动的角点
 * - startBox: 拖动开始时的图片尺寸/位置
 * - dx/dy: 鼠标相对开始位置的位移（画布坐标系）
 *
 * 输出：新的 x/y/width/height（保持原宽高比）
 */
export function resizeBoxByCorner(
  corner: ResizeCorner,
  startBox: { x: number; y: number; width: number; height: number },
  dx: number,
  // _dy 暂未使用：等比缩放只看 dx，保留参数是为了将来支持自由缩放
  _dy: number
): { x: number; y: number; width: number; height: number } {
  const ratio = startBox.width / startBox.height
  const minSize = MIN_ITEM_SIZE

  // 各角点对宽高的影响方向：右下扩大为正，左上反向
  let newW = startBox.width
  let newH = startBox.height

  switch (corner) {
    case 'se':
      newW = startBox.width + dx
      newH = newW / ratio
      break
    case 'sw':
      newW = startBox.width - dx
      newH = newW / ratio
      break
    case 'ne':
      newW = startBox.width + dx
      newH = newW / ratio
      break
    case 'nw':
      newW = startBox.width - dx
      newH = newW / ratio
      break
  }

  if (newW < minSize) {
    newW = minSize
    newH = newW / ratio
  }

  // 计算新左上角：保持对角点不动
  let newX = startBox.x
  let newY = startBox.y
  if (corner === 'sw' || corner === 'nw') {
    newX = startBox.x + (startBox.width - newW)
  }
  if (corner === 'nw' || corner === 'ne') {
    newY = startBox.y + (startBox.height - newH)
  }

  return { x: newX, y: newY, width: newW, height: newH }
}

/**
 * 异步加载图片为 HTMLImageElement
 * 用于导出时把 ObjectURL 重新解码到 canvas
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`图片加载失败: ${src.slice(0, 64)}`))
    img.src = src
  })
}

/**
 * 把所有图片合成到 canvas 并输出 Blob
 *
 * @param items 图片项（按数组顺序作为层级，先加入的在底层）
 * @param canvas 画布尺寸
 * @param format 'png' 透明背景；'jpg' 白底；
 * @param quality JPG 编码质量（0-1）
 */
export async function composeCollage(
  items: CollageItem[],
  canvas: CanvasSize,
  format: 'png' | 'jpg',
  quality = 0.92
): Promise<Blob> {
  const el = document.createElement('canvas')
  el.width = canvas.width
  el.height = canvas.height
  const ctx = el.getContext('2d')
  if (!ctx) throw new Error('无法创建 2D 渲染上下文')

  // JPG 不支持透明：填白底
  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // 顺序绘制（保证层叠顺序与 UI 一致）
  for (const item of items) {
    try {
      const img = await loadImage(item.src)
      ctx.drawImage(img, item.x, item.y, item.width, item.height)
    } catch (err) {
      // 单张图加载失败不阻断整体导出，仅在控制台输出警告
      console.warn('[collage] 跳过加载失败的图片:', err)
    }
  }

  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  return await new Promise<Blob>((resolve, reject) => {
    el.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob 返回空'))
      },
      mime,
      format === 'jpg' ? quality : undefined
    )
  })
}

/** 触发浏览器下载一个 Blob */
export function downloadBlob(blob: Blob, filename: string): void {
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
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/**
 * 把 PNG Blob 写入剪贴板
 * 兼容性：navigator.clipboard.write 仅在 Chromium 88+/Safari 13.1+/Firefox 127+ 可用
 */
export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
    throw new Error('当前浏览器不支持复制图片到剪贴板，请改用下载')
  }
  // ClipboardItem 仅在安全上下文（HTTPS / localhost）可用
  if (typeof ClipboardItem === 'undefined') {
    throw new Error('当前环境不支持 ClipboardItem，请改用下载')
  }
  const item = new ClipboardItem({ [blob.type]: blob })
  await navigator.clipboard.write([item])
}
