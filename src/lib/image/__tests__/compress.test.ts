import { describe, it, expect, beforeEach, vi } from 'vitest'
import { compressImage, formatToExtension, WORKER_THRESHOLD, formatBytes } from '../compress'

/**
 * 测试目标：参数校验 + 主线程/Worker 分支选择
 *
 * 不测试真实编码（jsdom 没有真实的 toBlob，需要在浏览器/真实 canvas 中跑）：
 * - 这里只 mock canvas/Image 的最小行为，验证：
 *   1. 非法 file / opts 抛错
 *   2. 不支持的输入 MIME 抛错
 *   3. <1MB 走主线程（即使提供 worker 也不被调用）
 *   4. ≥1MB 提供了 worker 则走 Worker 分支
 *   5. 主线程路径成功时返回 before/after/ratio
 */

/** 构造一个指定大小、指定 type 的 File；用 Uint8Array 填充 */
function makeFile(size: number, type: string, name = 'a.png'): File {
  // 用零字节填充足够；测试只关心 size 与 type
  const data = new Uint8Array(size)
  return new File([data], name, { type })
}

/** 全局 mock：让 HTMLCanvasElement.toBlob 返回一个固定大小的 Blob，
 *  让 Image 在 src 设置后立即触发 onload，naturalWidth/Height 返回固定值 */
function installCanvasMocks(opts: { outputBytes?: number; width?: number; height?: number } = {}) {
  const outputBytes = opts.outputBytes ?? 100
  const w = opts.width ?? 1600
  const h = opts.height ?? 900

  // mock toBlob
  if (!HTMLCanvasElement.prototype.getContext) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: vi.fn(() => ({
        drawImage: vi.fn(),
      })),
      configurable: true,
    })
  } else {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ({ drawImage: vi.fn() })
    ) as unknown as HTMLCanvasElement['getContext']
  }

  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string
  ) {
    // 同步回调一个零数据 Blob，size 由我们伪造
    const fakeBlob = new Blob([new Uint8Array(outputBytes)], { type: type || 'image/png' })
    // 真实浏览器异步调用，这里立即 setTimeout 模拟微队列
    setTimeout(() => callback(fakeBlob), 0)
  })

  // mock Image：设置 src 后下一个 microtask 触发 onload
  // jsdom 的 Image 有基础实现，但 onload 不会因 ObjectURL 自动触发
  const ImgProto = window.Image.prototype as unknown as {
    _src?: string
    onload?: ((this: HTMLImageElement, ev: Event) => void) | null
    onerror?: ((this: HTMLImageElement, ev: Event) => void) | null
  }
  Object.defineProperty(ImgProto, 'src', {
    set(this: HTMLImageElement, v: string) {
      ;(this as unknown as { _src: string })._src = v
      // 下一个微任务里触发 onload，并塞入 naturalWidth/Height
      Promise.resolve().then(() => {
        Object.defineProperty(this, 'naturalWidth', { value: w, configurable: true })
        Object.defineProperty(this, 'naturalHeight', { value: h, configurable: true })
        Object.defineProperty(this, 'width', { value: w, configurable: true })
        Object.defineProperty(this, 'height', { value: h, configurable: true })
        if (typeof this.onload === 'function') this.onload(new Event('load'))
      })
    },
    get(this: HTMLImageElement) {
      return (this as unknown as { _src: string })._src || ''
    },
    configurable: true,
  })

  // ObjectURL 在 jsdom 里返回 blob:... 串即可
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:fake')
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn()
  }
}

describe('compressImage — 参数校验', () => {
  beforeEach(() => installCanvasMocks())

  it('file 为空抛错', async () => {
    await expect(
      // @ts-expect-error 故意传 null
      compressImage(null, { targetFormat: 'image/png', quality: 0.8, maxDim: 1024 })
    ).rejects.toThrow(/文件为空/)
  })

  it('不支持的输入 MIME（GIF）抛错', async () => {
    const f = makeFile(100, 'image/gif')
    await expect(
      compressImage(f, { targetFormat: 'image/png', quality: 0.8, maxDim: 1024 })
    ).rejects.toThrow(/不支持的输入格式/)
  })

  it('targetFormat 非法抛错', async () => {
    const f = makeFile(100, 'image/png')
    await expect(
      // @ts-expect-error 故意传非法
      compressImage(f, { targetFormat: 'image/bmp', quality: 0.8, maxDim: 1024 })
    ).rejects.toThrow(/不支持的输出格式/)
  })

  it('quality 越界抛错', async () => {
    const f = makeFile(100, 'image/png')
    await expect(
      compressImage(f, { targetFormat: 'image/jpeg', quality: 1.5, maxDim: 1024 })
    ).rejects.toThrow(/quality/)
    await expect(
      compressImage(f, { targetFormat: 'image/jpeg', quality: -0.1, maxDim: 1024 })
    ).rejects.toThrow(/quality/)
  })

  it('maxDim 越界抛错', async () => {
    const f = makeFile(100, 'image/png')
    await expect(
      compressImage(f, { targetFormat: 'image/jpeg', quality: 0.8, maxDim: 0 })
    ).rejects.toThrow(/maxDim/)
    await expect(
      compressImage(f, { targetFormat: 'image/jpeg', quality: 0.8, maxDim: 99999 })
    ).rejects.toThrow(/maxDim/)
  })
})

describe('compressImage — 路由分支', () => {
  beforeEach(() => installCanvasMocks({ outputBytes: 50 }))

  it('小于 WORKER_THRESHOLD 时走主线程，不调用 worker.postMessage', async () => {
    const f = makeFile(100 * 1024, 'image/jpeg') // 100KB < 1MB
    const fakeWorker = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    } as unknown as Worker

    const r = await compressImage(
      f,
      { targetFormat: 'image/jpeg', quality: 0.8, maxDim: 1024 },
      fakeWorker
    )

    expect(fakeWorker.postMessage).not.toHaveBeenCalled()
    expect(r.before).toBe(f.size)
    expect(r.after).toBe(50)
    expect(r.ratio).toBeCloseTo(50 / f.size, 5)
    expect(r.width).toBeGreaterThan(0)
    expect(r.height).toBeGreaterThan(0)
  })

  it('≥WORKER_THRESHOLD 且提供 worker 时走 Worker 分支', async () => {
    const f = makeFile(WORKER_THRESHOLD + 1024, 'image/png')

    // 假 worker：收到 postMessage 后立即派发一个成功响应
    const listeners: Record<string, ((ev: MessageEvent | ErrorEvent) => void)[]> = {}
    const fakeWorker = {
      postMessage: vi.fn((msg: unknown, transfer?: Transferable[]) => {
        // 验证零拷贝 transfer 数组里包含 buffer
        expect(Array.isArray(transfer)).toBe(true)
        expect(transfer && transfer.length).toBe(1)
        // 异步派发成功响应
        Promise.resolve().then(() => {
          const blob = new Blob([new Uint8Array(200)], { type: 'image/png' })
          const fakeEvent = {
            data: { type: 'compress', success: true, blob, width: 800, height: 450 },
          } as MessageEvent
          ;(listeners.message || []).forEach((fn) => fn(fakeEvent))
        })
        // 引用 msg 防 lint 报未用
        void msg
      }),
      addEventListener: vi.fn((type: string, fn: (ev: MessageEvent | ErrorEvent) => void) => {
        listeners[type] = listeners[type] || []
        listeners[type].push(fn)
      }),
      removeEventListener: vi.fn((type: string, fn: (ev: MessageEvent | ErrorEvent) => void) => {
        listeners[type] = (listeners[type] || []).filter((x) => x !== fn)
      }),
      terminate: vi.fn(),
    } as unknown as Worker

    const r = await compressImage(
      f,
      { targetFormat: 'image/png', quality: 0.8, maxDim: 800 },
      fakeWorker
    )

    expect(fakeWorker.postMessage).toHaveBeenCalledTimes(1)
    expect(r.before).toBe(f.size)
    expect(r.after).toBe(200)
    expect(r.width).toBe(800)
    expect(r.height).toBe(450)
  })

  it('Worker 返回失败时抛错', async () => {
    const f = makeFile(WORKER_THRESHOLD + 1024, 'image/png')
    const listeners: Record<string, ((ev: MessageEvent | ErrorEvent) => void)[]> = {}
    const fakeWorker = {
      postMessage: vi.fn(() => {
        Promise.resolve().then(() => {
          const fakeEvent = {
            data: { type: 'compress', success: false, error: 'fake decode fail' },
          } as MessageEvent
          ;(listeners.message || []).forEach((fn) => fn(fakeEvent))
        })
      }),
      addEventListener: vi.fn((type: string, fn: (ev: MessageEvent | ErrorEvent) => void) => {
        listeners[type] = listeners[type] || []
        listeners[type].push(fn)
      }),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    } as unknown as Worker

    await expect(
      compressImage(f, { targetFormat: 'image/png', quality: 0.8, maxDim: 800 }, fakeWorker)
    ).rejects.toThrow(/fake decode fail/)
  })
})

describe('辅助函数', () => {
  it('formatToExtension 映射正确', () => {
    expect(formatToExtension('image/png')).toBe('png')
    expect(formatToExtension('image/jpeg')).toBe('jpg')
    expect(formatToExtension('image/webp')).toBe('webp')
  })
  it('formatBytes 输出可读字符串', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.00 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB')
  })
})
