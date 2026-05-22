/**
 * 图片压缩主线程入口
 *
 * 路由策略：
 * - file.size ≥ WORKER_THRESHOLD（1MB）：走 Worker（支持 OffscreenCanvas + createImageBitmap）
 * - 否则走主线程 HTMLCanvasElement（避免 Worker 启动开销）
 *
 * 输出契约：
 * - 返回 { blob, before, after, ratio }；ratio = after / before，<1 表示压缩成功
 * - 任意失败抛错（含原始错误消息），调用方捕获展示 toast
 *
 * 注意：
 * - 不支持的输入 MIME（如 SVG / GIF）会在 createImageBitmap / Image.onerror 阶段失败
 * - PNG 输出忽略 quality 参数；JPEG / WebP 使用 quality 0~1
 * - EXIF / ICC 等元数据通过 Canvas 重绘自动丢弃
 */

import { calcResizedDims } from './dimensions'

/** Worker 阈值：≥1MB 走 Worker；否则主线程 */
export const WORKER_THRESHOLD = 1 * 1024 * 1024

export type ImageOutputFormat = 'image/png' | 'image/jpeg' | 'image/webp'

/** 输入 MIME 校验白名单（与 PNG/JPEG/WebP 三种 toBlob 原生支持对齐） */
export const SUPPORTED_INPUT_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const

export interface CompressOptions {
  /** 输出格式 */
  targetFormat: ImageOutputFormat
  /** 质量 0~1（PNG 忽略） */
  quality: number
  /** 较长边最大尺寸（px） */
  maxDim: number
}

export interface CompressResult {
  /** 压缩后 Blob（已是 targetFormat） */
  blob: Blob
  /** 原始字节数 */
  before: number
  /** 压缩后字节数 */
  after: number
  /** after/before；<1 表示体积变小 */
  ratio: number
  /** 实际输出宽度 */
  width: number
  /** 实际输出高度 */
  height: number
}

/** 入参校验：保护后续 canvas 调用不会因为非法值崩溃 */
function validateOptions(opts: CompressOptions): void {
  if (
    opts.targetFormat !== 'image/png' &&
    opts.targetFormat !== 'image/jpeg' &&
    opts.targetFormat !== 'image/webp'
  ) {
    throw new Error(`不支持的输出格式: ${opts.targetFormat}`)
  }
  if (!Number.isFinite(opts.quality) || opts.quality < 0 || opts.quality > 1) {
    throw new Error(`quality 必须在 [0,1] 区间: ${opts.quality}`)
  }
  if (!Number.isFinite(opts.maxDim) || opts.maxDim < 16 || opts.maxDim > 8192) {
    throw new Error(`maxDim 必须在 [16,8192] 区间: ${opts.maxDim}`)
  }
}

/** 文件 -> ArrayBuffer */
function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const v = r.result
      if (v instanceof ArrayBuffer) resolve(v)
      else reject(new Error('FileReader 结果非 ArrayBuffer'))
    }
    r.onerror = () => reject(new Error('文件读取失败'))
    r.readAsArrayBuffer(file)
  })
}

/** 在主线程用 HTMLCanvasElement 完成压缩（小文件路径，避免 Worker 启动开销） */
async function compressOnMainThread(file: File, opts: CompressOptions): Promise<CompressResult> {
  // 1) 用 ObjectURL + Image 解码（兼容性最好；OffscreenCanvas 在测试环境 jsdom 不存在）
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('图片解码失败（损坏 / 不支持的格式）'))
      i.src = url
    })

    const { width, height } = calcResizedDims(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      opts.maxDim
    )

    // 2) 主线程 canvas 重绘
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2d context 不可用')
    ctx.drawImage(img, 0, 0, width, height)

    // 3) toBlob（PNG 忽略 quality）
    const isPng = opts.targetFormat === 'image/png'
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob 返回 null'))),
        opts.targetFormat,
        isPng ? undefined : opts.quality
      )
    })

    return {
      blob,
      before: file.size,
      after: blob.size,
      ratio: file.size > 0 ? blob.size / file.size : 1,
      width,
      height,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Worker 路径：≥1MB 时使用，避免大图阻塞主线程 */
async function compressInWorker(
  file: File,
  opts: CompressOptions,
  worker: Worker
): Promise<CompressResult> {
  const buffer = await fileToArrayBuffer(file)

  return new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent) => {
      const resp = ev.data
      if (!resp || resp.type !== 'compress') return
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (resp.success) {
        resolve({
          blob: resp.blob,
          before: file.size,
          after: resp.blob.size,
          ratio: file.size > 0 ? resp.blob.size / file.size : 1,
          width: resp.width,
          height: resp.height,
        })
      } else {
        reject(new Error(resp.error || '压缩失败'))
      }
    }
    const onError = (ev: ErrorEvent) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(new Error(ev.message || 'Worker 错误'))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)

    // Transferable：buffer 所有权转入 Worker，主线程不再可用
    worker.postMessage(
      {
        type: 'compress',
        buffer,
        sourceMime: file.type || 'image/png',
        targetFormat: opts.targetFormat,
        quality: opts.quality,
        maxDim: opts.maxDim,
      },
      [buffer]
    )
  })
}

/**
 * 压缩单张图片
 *
 * @param file   File 对象（用户选择 / 拖拽 / 粘贴而来）
 * @param opts   压缩参数
 * @param worker 可选：调用方提供的 Worker 实例（懒加载并复用，避免每次新建）
 * @throws       任意阶段失败时抛错，含原始错误消息
 */
export async function compressImage(
  file: File,
  opts: CompressOptions,
  worker?: Worker
): Promise<CompressResult> {
  if (!file) throw new Error('文件为空')
  validateOptions(opts)

  // 输入 MIME 校验：只接受 PNG / JPEG / WebP（与 toBlob 原生支持对齐）
  if (!SUPPORTED_INPUT_MIMES.includes(file.type as (typeof SUPPORTED_INPUT_MIMES)[number])) {
    throw new Error(`不支持的输入格式: ${file.type || '未知'}（仅支持 PNG / JPEG / WebP）`)
  }

  // 路由：≥阈值且调用方提供了 worker，则走 Worker；否则主线程
  if (file.size >= WORKER_THRESHOLD && worker) {
    return compressInWorker(file, opts, worker)
  }
  return compressOnMainThread(file, opts)
}

/** 格式化字节数为可读字符串（与 base64-image.ts 行为保持一致） */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** MIME -> 扩展名映射（用于下载文件名） */
export function formatToExtension(format: ImageOutputFormat): string {
  switch (format) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
  }
}
