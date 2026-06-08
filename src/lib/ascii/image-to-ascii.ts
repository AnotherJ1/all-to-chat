/**
 * 图片转 ASCII 字符画 —— 纯 Canvas 亮度采样，零依赖
 *
 * 思路：
 *  1. 把图片按目标“字符列数”等比缩放绘制到离屏 canvas
 *  2. 字符通常高比宽大约 2:1，所以行数要按 0.5 的字符宽高比折算，否则成像被纵向拉长
 *  3. 逐像素取亮度（感知加权），映射到字符集梯度（暗→亮 或 亮→暗）
 *
 * 纯函数 `imageDataToAscii` 不依赖 DOM，便于单测；`imageToAscii` 负责 DOM 绘制。
 */

/** 预设字符梯度：索引 0 表示“最暗”，末尾表示“最亮” */
export const RAMPS: Record<string, string> = {
  // 经典 70 级（暗→亮）
  standard: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
  // 简洁 10 级
  simple: '@%#*+=-:. ',
  // 块字符（适合深色背景）
  blocks: '█▓▒░ ',
}

export type RampName = keyof typeof RAMPS

export interface AsciiOptions {
  /** 输出字符列数（宽度），常用 60–200 */
  columns: number
  /** 字符集名 */
  ramp: RampName
  /** 是否反色（亮↔暗对调，适配深色/浅色背景） */
  invert: boolean
  /** 字符高宽比修正，默认 0.5（多数等宽字体一个字符约 2 倍高于宽） */
  aspectRatio?: number
}

export const DEFAULT_ASCII_OPTIONS: AsciiOptions = {
  columns: 100,
  ramp: 'standard',
  invert: false,
  aspectRatio: 0.5,
}

/** 感知亮度（0–255），ITU-R BT.601 加权 */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * 纯函数：从已采样的 ImageData（尺寸应为目标 cols × rows）生成字符画。
 * 不做缩放——缩放由调用方在绘制 canvas 时完成。
 */
export function imageDataToAscii(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  ramp: string,
  invert: boolean,
): string {
  if (width <= 0 || height <= 0) return ''
  const chars = ramp.length > 0 ? ramp : RAMPS.simple
  const lastIndex = chars.length - 1
  const lines: string[] = []

  for (let y = 0; y < height; y++) {
    let line = ''
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3] / 255
      // 透明像素视为背景（最亮）
      const lum = a === 0 ? 255 : luminance(data[i], data[i + 1], data[i + 2])
      let t = lum / 255 // 0=暗 1=亮
      if (invert) t = 1 - t
      // ramp 约定 index0=最暗：亮度高→取靠后的“浅”字符
      const idx = Math.round(t * lastIndex)
      line += chars[idx] ?? ' '
    }
    lines.push(line)
  }
  return lines.join('\n')
}

/** 根据原图尺寸与目标列数，计算等比缩放后的行数（已做字符高宽比修正） */
export function computeRows(
  imgWidth: number,
  imgHeight: number,
  columns: number,
  aspectRatio = 0.5,
): number {
  if (imgWidth <= 0) return 1
  const rows = Math.round((imgHeight / imgWidth) * columns * aspectRatio)
  return Math.max(1, rows)
}

/**
 * 把图片元素转为 ASCII 字符画（需要 DOM canvas）。
 * @param img 已加载完成的 HTMLImageElement
 */
export function imageToAscii(img: HTMLImageElement, options: AsciiOptions): string {
  const { columns, ramp, invert, aspectRatio = 0.5 } = options
  const cols = Math.max(1, Math.floor(columns))
  const rows = computeRows(img.naturalWidth || img.width, img.naturalHeight || img.height, cols, aspectRatio)

  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return ''
  ctx.drawImage(img, 0, 0, cols, rows)
  const { data } = ctx.getImageData(0, 0, cols, rows)
  return imageDataToAscii(data, cols, rows, RAMPS[ramp] ?? RAMPS.standard, invert)
}
