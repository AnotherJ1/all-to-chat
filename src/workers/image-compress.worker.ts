/**
 * 图片压缩 Web Worker
 *
 * 工作流程：
 * 1. 主线程把原图二进制（ArrayBuffer，零拷贝 transfer）+ 压缩参数发过来
 * 2. Worker 内用 Blob + createImageBitmap 解码原图（OffscreenCanvas 不支持直接 drawImage(<img>)，
 *    必须先生成 ImageBitmap）
 * 3. 在 OffscreenCanvas 上按等比缩放后的目标尺寸重绘
 * 4. 通过 OffscreenCanvas.convertToBlob 输出指定 MIME / quality 的压缩 Blob
 * 5. 把 Blob 直接 postMessage 回主线程（结构化克隆，浏览器原生支持 Blob）
 *
 * 注意：
 * - PNG 不参考 quality（无损），convertToBlob 会忽略 quality 参数
 * - createImageBitmap 失败一般意味着 sourceMime 不被浏览器原生解码（动画 GIF / SVG 等），
 *   错误会被抛回主线程，由调用方决定降级
 * - 全程不使用 wasm，零新依赖
 */

import { calcResizedDims } from '../lib/image/dimensions'

interface CompressRequest {
  type: 'compress'
  /** 原图字节（已转移所有权） */
  buffer: ArrayBuffer
  /** 原图 MIME（用于构造 Blob 让浏览器选解码器） */
  sourceMime: string
  /** 输出格式 */
  targetFormat: 'image/png' | 'image/jpeg' | 'image/webp'
  /** 质量 0~1（PNG 忽略） */
  quality: number
  /** 较长边目标尺寸（px） */
  maxDim: number
}

interface CompressSuccess {
  type: 'compress'
  success: true
  blob: Blob
  width: number
  height: number
}

interface CompressFailure {
  type: 'compress'
  success: false
  error: string
}

// Worker scope 类型最小化断言，避免污染主线程 DOM lib
interface MinimalWorkerScope {
  onmessage: ((this: MinimalWorkerScope, ev: MessageEvent) => unknown) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}
const ctx = self as unknown as MinimalWorkerScope

ctx.onmessage = async (event: MessageEvent<CompressRequest>) => {
  const req = event.data
  if (!req || req.type !== 'compress') {
    const r: CompressFailure = { type: 'compress', success: false, error: '未知请求类型' }
    ctx.postMessage(r)
    return
  }

  try {
    // 1) 解码：Blob -> ImageBitmap（零拷贝、不阻塞 GC）
    const srcBlob = new Blob([req.buffer], { type: req.sourceMime })
    const bitmap = await createImageBitmap(srcBlob)

    // 2) 计算等比缩放后的目标尺寸
    const { width, height } = calcResizedDims(bitmap.width, bitmap.height, req.maxDim)

    // 3) OffscreenCanvas 重绘（自动丢弃 EXIF / ICC）
    const canvas = new OffscreenCanvas(width, height)
    const cctx = canvas.getContext('2d')
    if (!cctx) throw new Error('OffscreenCanvas 2d context 不可用')
    cctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    // 4) 输出：PNG 忽略 quality；JPEG / WebP 用调用方传入的 quality
    const isPng = req.targetFormat === 'image/png'
    const blob = await canvas.convertToBlob(
      isPng ? { type: req.targetFormat } : { type: req.targetFormat, quality: req.quality }
    )

    const resp: CompressSuccess = {
      type: 'compress',
      success: true,
      blob,
      width,
      height,
    }
    ctx.postMessage(resp)
  } catch (e) {
    const resp: CompressFailure = {
      type: 'compress',
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }
    ctx.postMessage(resp)
  }
}

// 让 TS 把本文件视作模块，避免 worker 内类型污染
export {}
