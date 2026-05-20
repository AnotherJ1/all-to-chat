/**
 * 拼图工具类型定义
 *
 * 设计要点：
 * - CanvasSize 同时支持预设比例与自定义像素
 * - CollageItem 是画布上的一张图片，使用绝对像素坐标（相对画布原始尺寸）
 * - 不含 rotation/opacity/zIndex 字段：极简操作集，按数组顺序自然层叠
 */

/** 画布预设比例（含一个 custom 标识） */
export type CanvasPreset = '1:1' | '16:9' | '9:16' | '4:3' | 'A4' | 'custom'

/** 画布尺寸描述 */
export interface CanvasSize {
  /** 当前选中的预设；选 custom 时使用 width/height 自定义值 */
  preset: CanvasPreset
  /** 画布宽度（像素，导出尺寸） */
  width: number
  /** 画布高度（像素，导出尺寸） */
  height: number
}

/** 单张图片在画布上的状态
 *  - x/y 是图片左上角在画布坐标系中的位置（像素）
 *  - width/height 是图片当前显示尺寸（像素，等比缩放后的结果）
 *  - naturalWidth/naturalHeight 是原图固有尺寸，用于锁定宽高比 */
export interface CollageItem {
  id: string
  src: string
  naturalWidth: number
  naturalHeight: number
  x: number
  y: number
  width: number
  height: number
  /** 仅展示用：原始文件名 */
  fileName?: string
}

/** 导出格式 */
export type ExportFormat = 'png' | 'jpg' | 'clipboard'

/** 拖拽 / 缩放交互的临时状态 */
export type InteractionMode =
  | { type: 'idle' }
  | { type: 'drag'; itemId: string; offsetX: number; offsetY: number }
  | { type: 'resize'; itemId: string; corner: ResizeCorner; startW: number; startH: number; startX: number; startY: number; pointerStartX: number; pointerStartY: number }

/** 4 个角点把手 */
export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'
