import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import { toast } from '../stores/toastStore'
import {
  copyToClipboard,
  DEFAULT_MAX_SIZE,
  estimateBase64Size,
  fileToArrayBuffer,
  formatBytes,
  mimeToExtension,
  normalizeToDataUrl,
  stripDataUrlPrefix,
  validateImageFile,
  WORKER_THRESHOLD,
} from '../lib/base64-image'

type Mode = 'image-to-base64' | 'base64-to-image'

/** 输出格式：完整 Data URL 还是纯 Base64 */
type OutputFormat = 'dataurl' | 'pure'

/** 预览/输出区统一高度，让左右两侧对齐；高度适中以避免页面占比过大 */
const PREVIEW_HEIGHT = '320px'

/** Base64 输出展示阈值：超过此长度默认仅展示截断版，避免 textarea 渲染卡顿 */
const TEXTAREA_DISPLAY_LIMIT = 200 * 1024 // 200 KB 字符

/**
 * Base64 与图片相互转换工具
 *
 * 功能：
 * - 图片 → Base64：支持拖拽 / 点击选择 / 粘贴；自动计算大小、尺寸；可切换输出格式
 * - Base64 → 图片：支持 Data URL 或纯 Base64；自动嗅探 MIME 类型；可预览 / 下载
 * - 代码示例：HTML / CSS / JS / React / Node.js / Python / Java
 *
 * 兼容性：
 * - FileReader 读取文件（IE10+）
 * - atob / Blob / URL.createObjectURL 已在 lib/base64-image.ts 处理降级
 * - 剪贴板复制带 execCommand 回退
 * - prefers-reduced-motion：所有装饰动画通过 CSS 媒体查询禁用
 */
export default function Base64ImagePage() {
  const [mode, setMode] = useState<Mode>('image-to-base64')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('dataurl')

  // 图片 → Base64 状态
  /** 预览用 URL（优先 ObjectURL，立即可用） */
  const [previewUrl, setPreviewUrl] = useState('')
  /** Base64 编码后的纯字符串（不含 data: 前缀），由 Worker 计算 */
  const [pureBase64, setPureBase64] = useState('')
  /** 当前文件 MIME，编码完成后用于拼装 Data URL */
  const [imageMime, setImageMime] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [encoding, setEncoding] = useState(false)
  /** 是否强制展示完整 base64 输出（超长时默认 false，仅展示截断版） */
  const [showFullOutput, setShowFullOutput] = useState(false)

  // Base64 → 图片状态
  /**
   * 注意：base64Input 不再用受控 textarea —— 大文本受控会导致每次 onChange 都
   * 触发 React 全量更新 + V8 字符串复制，几十 MB 时极卡。改成 ref + 节流读取。
   */
  const base64InputRef = useRef<HTMLTextAreaElement>(null)
  /** 节流后的输入摘要：仅长度（不存大字符串），用于显示统计 */
  const [inputStats, setInputStats] = useState({ length: 0, decodedBytes: 0, hasContent: false })
  /** 解码后的 ObjectURL，用于预览/下载 */
  const [decodedUrl, setDecodedUrl] = useState('')
  const [decodedMime, setDecodedMime] = useState('')
  const [decodeError, setDecodeError] = useState('')
  const [decoding, setDecoding] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const workerRef = useRef<Worker | null>(null)
  /** 保存当前预览 ObjectURL 以便切换文件时释放，避免内存泄漏 */
  const previewObjectUrlRef = useRef<string>('')
  const decodedObjectUrlRef = useRef<string>('')

  // 懒加载 Worker（首次需要时再创建，节省启动开销）
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/base64-image.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }
    return workerRef.current
  }, [])

  // 卸载时清理：终止 Worker，释放所有 ObjectURL
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
      if (decodedObjectUrlRef.current) URL.revokeObjectURL(decodedObjectUrlRef.current)
    }
  }, [])

  // ============ 图片 → Base64 处理 ============

  const handleFile = useCallback(async (file: File) => {
    try {
      validateImageFile(file)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '文件无效')
      return
    }

    // 1) 立即建立预览（ObjectURL，零拷贝、不阻塞、瞬时显示）
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
    const objectUrl = URL.createObjectURL(file)
    previewObjectUrlRef.current = objectUrl

    setPreviewUrl(objectUrl)
    setPureBase64('')
    setImageMime(file.type || 'image/png')
    setFileName(file.name)
    setFileSize(file.size)
    setImageDims(null)
    setShowFullOutput(false)

    // 2) 异步获取尺寸（不阻塞编码）
    const img = new Image()
    img.onload = () => setImageDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setImageDims(null)
    img.src = objectUrl

    // 3) 编码 base64：小文件主线程同步（< 1MB），大文件走 Worker
    setEncoding(true)
    try {
      const buffer = await fileToArrayBuffer(file)
      const mime = file.type || 'image/png'

      if (buffer.byteLength < WORKER_THRESHOLD) {
        // 小文件：直接在主线程编码（避免 Worker 启动开销）
        const bytes = new Uint8Array(buffer)
        let binary = ''
        const CHUNK = 0x8000
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode.apply(
            null,
            bytes.subarray(i, i + CHUNK) as unknown as number[]
          )
        }
        setPureBase64(btoa(binary))
      } else {
        // 大文件：Worker 编码 + Transferable 零拷贝转移
        const worker = getWorker()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const onMessage = (ev: MessageEvent) => {
            const resp = ev.data
            worker.removeEventListener('message', onMessage)
            if (resp.type === 'encode' && resp.success) resolve(resp.dataUrl)
            else reject(new Error(resp.error || '编码失败'))
          }
          worker.addEventListener('message', onMessage)
          // 转移 ArrayBuffer 所有权（注意：转移后 buffer 不可在主线程使用）
          worker.postMessage({ type: 'encode', buffer, mime }, [buffer])
        })
        setPureBase64(stripDataUrlPrefix(dataUrl))
      }
      toast.success(`已读取 ${file.name}（${formatBytes(file.size)}）`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '编码失败')
    } finally {
      setEncoding(false)
    }
  }, [getWorker])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // 重置 input 以便重复选择同一文件
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  // 监听全局粘贴事件：从剪贴板粘贴图片
  useEffect(() => {
    if (mode !== 'image-to-base64') return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            handleFile(file)
            e.preventDefault()
            break
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [mode, handleFile])

  /** 实际输出的字符串（根据格式切换） */
  const output = useMemo(() => {
    if (!pureBase64) return ''
    return outputFormat === 'dataurl' ? `data:${imageMime};base64,${pureBase64}` : pureBase64
  }, [pureBase64, imageMime, outputFormat])

  /**
   * 用于 textarea 显示的字符串
   * - 超过阈值时只展示首 N + 尾 M，中间标识省略，避免几十 MB 字符串塞进 DOM 卡死布局
   * - 用户可点「显示完整」按钮切换
   */
  const displayedOutput = useMemo(() => {
    if (!output) return ''
    if (showFullOutput || output.length <= TEXTAREA_DISPLAY_LIMIT) return output
    const head = output.slice(0, Math.floor(TEXTAREA_DISPLAY_LIMIT * 0.7))
    const tail = output.slice(-Math.floor(TEXTAREA_DISPLAY_LIMIT * 0.1))
    const omitted = output.length - head.length - tail.length
    return `${head}\n\n... [中间省略 ${omitted.toLocaleString()} 字符 / 约 ${formatBytes(omitted)}，点击右上角「显示完整」展开] ...\n\n${tail}`
  }, [output, showFullOutput])

  /** 输出是否被截断显示 */
  const isOutputTruncated = output.length > TEXTAREA_DISPLAY_LIMIT && !showFullOutput

  const handleCopyBase64 = async () => {
    if (!output) return
    try {
      await copyToClipboard(output)
      toast.success(`已复制 ${formatBytes(output.length)} 字符到剪贴板`)
    } catch {
      toast.error('复制失败，请手动选中复制')
    }
  }

  const handleClearImage = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = ''
    }
    setPreviewUrl('')
    setPureBase64('')
    setImageMime('')
    setFileName('')
    setFileSize(0)
    setImageDims(null)
    setShowFullOutput(false)
  }

  // ============ Base64 → 图片处理 ============

  /**
   * 节流更新输入统计（每次 onInput 调度一个 setTimeout，已有则跳过）
   * 关键：只在节流窗口结束时读一次 textarea.value 并算长度，避免每按键触发 React 重渲染
   */
  const statsRafRef = useRef<number>(0)
  const updateInputStats = useCallback(() => {
    if (statsRafRef.current) return
    statsRafRef.current = window.setTimeout(() => {
      statsRafRef.current = 0
      const v = base64InputRef.current?.value || ''
      // 直接对 textarea.value 调 estimateBase64Size（已优化为单次 charCodeAt 扫描，O(n) 无内存复制）
      setInputStats({
        length: v.length,
        decodedBytes: v ? estimateBase64Size(v) : 0,
        hasContent: v.trim().length > 0,
      })
    }, 200) as unknown as number
  }, [])

  // 卸载时清理节流定时器
  useEffect(() => {
    return () => {
      if (statsRafRef.current) {
        clearTimeout(statsRafRef.current)
        statsRafRef.current = 0
      }
    }
  }, [])

  const handleDecode = useCallback(async () => {
    setDecodeError('')
    if (decodedObjectUrlRef.current) {
      URL.revokeObjectURL(decodedObjectUrlRef.current)
      decodedObjectUrlRef.current = ''
    }
    setDecodedUrl('')
    setDecodedMime('')

    // 关键：从 ref 读最新值，避免依赖 state
    const raw = base64InputRef.current?.value || ''
    if (!raw.trim()) {
      setDecodeError('请输入 Base64 字符串')
      return
    }

    setDecoding(true)
    try {
      // normalizeToDataUrl 内部会校验 + 拼装 Data URL
      const { mime } = normalizeToDataUrl(raw)
      // 取出纯 base64（去掉 data: 前缀和空白）
      const cleaned = raw.trim().replace(/\s/g, '')
      const pure = stripDataUrlPrefix(cleaned)

      // 估算解码后大小决定走 Worker 还是主线程
      const estimated = estimateBase64Size(pure)

      let blob: Blob
      if (estimated < WORKER_THRESHOLD) {
        const bin = atob(pure)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        blob = new Blob([bytes], { type: mime })
      } else {
        const worker = getWorker()
        const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const onMessage = (ev: MessageEvent) => {
            const resp = ev.data
            worker.removeEventListener('message', onMessage)
            if (resp.type === 'decode' && resp.success) resolve(resp.buffer)
            else reject(new Error(resp.error || '解码失败'))
          }
          worker.addEventListener('message', onMessage)
          worker.postMessage({ type: 'decode', base64: pure })
        })
        blob = new Blob([buffer], { type: mime })
      }

      const url = URL.createObjectURL(blob)
      decodedObjectUrlRef.current = url
      setDecodedUrl(url)
      setDecodedMime(mime)
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : '解码失败')
    } finally {
      setDecoding(false)
    }
  }, [getWorker])

  const handleDownloadDecoded = () => {
    if (!decodedUrl) return
    const ext = mimeToExtension(decodedMime)
    // 下载用 <a download>，与 ObjectURL 兼容
    const a = document.createElement('a')
    a.href = decodedUrl
    a.download = `decoded-${Date.now()}.${ext}`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleClearDecode = () => {
    if (decodedObjectUrlRef.current) {
      URL.revokeObjectURL(decodedObjectUrlRef.current)
      decodedObjectUrlRef.current = ''
    }
    if (base64InputRef.current) base64InputRef.current.value = ''
    setInputStats({ length: 0, decodedBytes: 0, hasContent: false })
    setDecodedUrl('')
    setDecodedMime('')
    setDecodeError('')
  }

  // ============ 衍生数据 ============

  const decodedSize = inputStats.decodedBytes

  const detectedMime = imageMime

  /**
   * 用于代码示例的截断 base64（≤ 80 字符）
   * 关键：这里只算一次小字符串，避免把几十 MB 的 base64 透传到子组件
   * - 编码模式：直接 slice pureBase64（V8 用 SlicedString，零拷贝）
   * - 解码模式：解码完成后从 textarea 读一次取首段（仅用于示例展示）
   */
  const sampleTruncatedBase64 = useMemo(() => {
    if (mode === 'image-to-base64') {
      return pureBase64 ? truncateBase64(pureBase64) : ''
    }
    if (!decodedUrl || !decodedMime) return ''
    const raw = base64InputRef.current?.value || ''
    if (!raw) return ''
    // 只取前 256 字符做清理 + 截断（避免对大字符串做 replace）
    const head = raw.slice(0, 256).trim().replace(/\s/g, '')
    const pure = stripDataUrlPrefix(head)
    return truncateBase64(pure)
    // decodedUrl 变化时（解码成功后）才重算
  }, [mode, pureBase64, decodedUrl, decodedMime])

  const sampleMime = mode === 'image-to-base64' ? imageMime : decodedMime
  const sampleHasData =
    mode === 'image-to-base64' ? !!pureBase64 : !!decodedUrl

  /**
   * 用 useDeferredValue 把代码示例更新推到低优先级
   * - 用户输入/拖拽/切换格式时，代码示例区不会拖累交互
   */
  const deferredTruncated = useDeferredValue(sampleTruncatedBase64)
  const deferredMime = useDeferredValue(sampleMime)
  const deferredHasData = useDeferredValue(sampleHasData)

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
          Base64 与图片转换
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          支持拖拽 / 粘贴 / 双向转换 · 自动识别 MIME 类型 · 含多语言代码示例
        </p>
      </header>

      {/* 模式切换 */}
      <div className="flex justify-center mb-6 px-4">
        <div
          role="tablist"
          aria-label="转换模式"
          className="inline-flex"
          style={{
            background: 'var(--bg-secondary)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px',
            gap: '4px',
          }}
        >
          {(
            [
              { key: 'image-to-base64', label: '图片 → Base64' },
              { key: 'base64-to-image', label: 'Base64 → 图片' },
            ] as { key: Mode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={mode === tab.key}
              onClick={() => setMode(tab.key)}
              className="cursor-pointer"
              style={{
                padding: '8px 18px',
                fontSize: '14px',
                fontWeight: mode === tab.key ? 600 : 500,
                fontFamily: 'var(--font-body)',
                background: mode === tab.key ? 'var(--bg-surface)' : 'transparent',
                color: mode === tab.key ? 'var(--accent-1)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'calc(var(--radius-sm) - 4px)',
                transition: 'var(--transition)',
                boxShadow: mode === tab.key ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 32px' }}>
        {/* 编码 tab：始终 mount，仅切换 display 以保留输入状态（textarea 是非受控） */}
        <section
          className="grid gap-6"
          style={{
            gridTemplateColumns: 'minmax(0, 1fr)',
            display: mode === 'image-to-base64' ? 'grid' : 'none',
          }}
        >
            {/* 上传区 */}
            <div
              ref={dropZoneRef}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
              role="button"
              tabIndex={0}
              aria-label="上传图片或拖拽到此区域"
              className="cursor-pointer"
              style={{
                padding: '40px 24px',
                background: isDragging ? 'color-mix(in srgb, var(--accent-1) 8%, var(--bg-secondary))' : 'var(--bg-secondary)',
                border: `2px dashed ${isDragging ? 'var(--accent-1)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
                transition: 'var(--transition)',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {isDragging ? '松开以上传' : '点击选择图片，或拖拽到此处'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                也可直接 <kbd style={kbdStyle}>Ctrl/⌘ + V</kbd> 从剪贴板粘贴 · 支持 PNG / JPEG / GIF / WebP / BMP / SVG · 单个文件 ≤ {formatBytes(DEFAULT_MAX_SIZE)}
              </div>
            </div>

            {/* 预览 + 输出 */}
            {previewUrl && (
              <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                {/* 元信息 */}
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    padding: '12px 16px',
                    background: 'var(--bg-secondary)',
                    border: 'var(--border-width) solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Meta label="文件名" value={fileName || '—'} />
                  <Meta label="MIME" value={detectedMime || '—'} />
                  <Meta label="原始大小" value={formatBytes(fileSize)} />
                  <Meta
                    label="Base64 长度"
                    value={
                      encoding
                        ? '编码中...'
                        : pureBase64
                        ? `${output.length.toLocaleString()} 字符`
                        : '—'
                    }
                  />
                  {imageDims && <Meta label="尺寸" value={`${imageDims.w} × ${imageDims.h}`} />}
                </div>

                <div
                  className="base64-preview-grid grid gap-6"
                  style={{
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
                    alignItems: 'stretch',
                  }}
                >
                  {/* 图片预览 */}
                  <div className="flex flex-col" style={{ minHeight: 0, height: PREVIEW_HEIGHT }}>
                    <div className="flex items-center justify-between mb-2" style={{ flexShrink: 0, height: '28px' }}>
                      <label style={labelStyle}>图片预览</label>
                      <button className="theme-btn" style={smallBtnStyle} onClick={handleClearImage}>清空</button>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        padding: '12px',
                        background: 'var(--bg-secondary)',
                        border: 'var(--border-width) solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt="预览"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Base64 输出 */}
                  <div className="flex flex-col" style={{ minHeight: 0, height: PREVIEW_HEIGHT }}>
                    <div className="flex items-center justify-between mb-2 gap-3 flex-wrap" style={{ flexShrink: 0, minHeight: '28px' }}>
                      <label style={labelStyle}>
                        Base64 输出
                        {encoding && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            编码中...
                          </span>
                        )}
                        {isOutputTruncated && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--color-warning)' }}>
                            · 已截断显示
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={outputFormat}
                          onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                          className="theme-input"
                          style={{ padding: '4px 10px', fontSize: '12px', height: 'auto', width: 'auto' }}
                        >
                          <option value="dataurl">Data URL</option>
                          <option value="pure">纯 Base64</option>
                        </select>
                        {output.length > TEXTAREA_DISPLAY_LIMIT && (
                          <button
                            className="theme-btn"
                            style={smallBtnStyle}
                            onClick={() => setShowFullOutput((v) => !v)}
                            title={showFullOutput ? '折叠以提升性能' : '展开完整内容（可能短暂卡顿）'}
                          >
                            {showFullOutput ? '折叠' : '显示完整'}
                          </button>
                        )}
                        <button
                          className="theme-btn"
                          style={smallBtnStyle}
                          onClick={handleCopyBase64}
                          disabled={!pureBase64 || encoding}
                        >
                          复制
                        </button>
                      </div>
                    </div>
                    <textarea
                      readOnly
                      value={encoding ? '正在编码，请稍候...' : displayedOutput}
                      className="theme-input"
                      style={{
                        width: '100%',
                        flex: 1,
                        minHeight: 0,
                        boxSizing: 'border-box',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        lineHeight: 1.5,
                        resize: 'none',
                        wordBreak: 'break-all',
                      }}
                      onFocus={(e) => {
                        // 大文本自动 select 会卡顿，仅小输出时才 select
                        if (!encoding && output.length <= TEXTAREA_DISPLAY_LIMIT) {
                          ;(e.target as HTMLTextAreaElement).select()
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

        {/* 解码 tab：同样始终 mount */}
        <section
          className="grid gap-6"
          style={{
            gridTemplateColumns: 'minmax(0, 1fr)',
            display: mode === 'base64-to-image' ? 'grid' : 'none',
          }}
        >
            <div>
              <div className="flex items-center justify-between mb-2">
                <label style={labelStyle}>Base64 输入（支持 Data URL 或纯 Base64）</label>
                <div className="flex items-center gap-2">
                  <button
                    className="theme-btn theme-btn-primary"
                    style={smallBtnStyle}
                    onClick={handleDecode}
                    disabled={decoding}
                  >
                    {decoding ? '解码中...' : '解码并预览'}
                  </button>
                  <button className="theme-btn" style={smallBtnStyle} onClick={handleClearDecode}>清空</button>
                </div>
              </div>
              <textarea
                ref={base64InputRef}
                defaultValue=""
                onInput={updateInputStats}
                placeholder={'例如：\ndata:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...\n或直接粘贴纯 Base64 字符串'}
                className="theme-input"
                style={{
                  width: '100%',
                  minHeight: '180px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  wordBreak: 'break-all',
                }}
                spellCheck={false}
              />
              <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                字符数：{inputStats.length.toLocaleString()} · 估算解码后大小：{formatBytes(decodedSize)}
              </div>
            </div>

            {decodeError && (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-danger)',
                  fontSize: '13px',
                }}
              >
                <strong>解码失败：</strong>{decodeError}
              </div>
            )}

            {decodedUrl && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label style={labelStyle}>预览（{decodedMime}）</label>
                  <button className="theme-btn" style={smallBtnStyle} onClick={handleDownloadDecoded}>下载图片</button>
                </div>
                <div
                  style={{
                    padding: '16px',
                    background: 'var(--bg-secondary)',
                    border: 'var(--border-width) solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '280px',
                  }}
                >
                  <img
                    src={decodedUrl}
                    alt="解码结果"
                    style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: 'var(--radius-sm)' }}
                    onError={() => {
                      setDecodeError('图片渲染失败，可能是 Base64 数据已损坏')
                      if (decodedObjectUrlRef.current) {
                        URL.revokeObjectURL(decodedObjectUrlRef.current)
                        decodedObjectUrlRef.current = ''
                      }
                      setDecodedUrl('')
                    }}
                  />
                </div>
              </div>
            )}
          </section>

        {/* 代码示例：自动注入当前数据；编码模式用本地图片，解码模式用解码结果 */}
        <CodeExamples
          truncatedBase64={deferredTruncated}
          mime={deferredMime}
          hasData={deferredHasData}
        />
      </main>

      {/* 响应式：窄屏改为上下排列，避免左右挤压 */}
      <style>{`
        @media (max-width: 768px) {
          .base64-preview-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}

// ============ 辅助组件与样式 ============

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-body)',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: '12px',
  height: 'auto',
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  margin: '0 2px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  color: 'var(--text-secondary)',
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '13px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          marginTop: '2px',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ============ 代码示例 ============

interface CodeSample {
  key: string
  label: string
  code: string
}

/** 用于代码示例的最大展示长度（避免上百 KB 数据塞进示例里） */
const SAMPLE_MAX_BASE64_LEN = 80

/**
 * 截断 base64：超长则保留首尾，中间替换为 ...省略 N 字符...
 * 这样既能让用户复制后立即可见结构，又不会复制几十 MB 字符串
 */
function truncateBase64(b64: string, max = SAMPLE_MAX_BASE64_LEN): string {
  if (!b64) return ''
  if (b64.length <= max) return b64
  const head = b64.slice(0, Math.floor(max * 0.6))
  return `${head}...`
}

interface SampleContext {
  /** 是否有真实数据（决定占位文案与示例标签） */
  hasData: boolean
  /** 纯 base64（已截断展示版） */
  truncated: string
  /** MIME 类型，例如 image/png */
  mime: string
  /** 文件扩展名，例如 png */
  ext: string
}

function buildSamples(ctx: SampleContext): CodeSample[] {
  const hasData = ctx.hasData
  const dataUrlSnippet = hasData
    ? `data:${ctx.mime};base64,${ctx.truncated}`
    : 'data:image/png;base64,iVBORw0KGgo...'
  const fileName = `logo.${ctx.ext || 'png'}`

  return [
    {
      key: 'html',
      label: 'HTML / CSS',
      code: `<!-- 直接在 <img> 中使用 Data URL -->
<img src="${dataUrlSnippet}" alt="logo" />

<!-- CSS 背景图 -->
<div style="background-image: url('${dataUrlSnippet}');
            background-size: cover;"></div>`,
    },
    {
      key: 'js-encode',
      label: 'JS 编码',
      code: `// 浏览器：File / Blob 转 Base64（Data URL）
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // 含 data:image/...;base64, 前缀
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// 使用：从 <input type="file"> 读取
document.querySelector('input[type=file]').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const dataUrl = await fileToBase64(file);
  console.log(dataUrl);
  // ${hasData ? `当前结果：${dataUrlSnippet}` : '形如 data:image/png;base64,iVBORw0...'}
});`,
    },
    {
      key: 'js-decode',
      label: 'JS 解码',
      code: `// Base64 → Blob → ObjectURL（高效，避免长字符串占用 DOM）
function base64ToBlob(base64, mime = '${ctx.mime || 'image/png'}') {
  // 兼容带或不带 Data URL 前缀
  const pure = base64.replace(/^data:[^;]+;base64,/, '');
  const bin = atob(pure);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const dataUrl = "${dataUrlSnippet}";
const blob = base64ToBlob(dataUrl);
const url = URL.createObjectURL(blob);
document.querySelector('img').src = url;
// 用完释放：URL.revokeObjectURL(url);`,
    },
    {
      key: 'react',
      label: 'React',
      code: `import { useState } from 'react'

export function ImageUploader() {
  const [src, setSrc] = useState(${hasData ? `'${dataUrlSnippet}'` : "''"})

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setSrc(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFile} />
      {src && <img src={src} alt="preview" style={{ maxWidth: 320 }} />}
    </div>
  )
}`,
    },
    {
      key: 'node',
      label: 'Node.js',
      code: `import { readFile, writeFile } from 'node:fs/promises'

// 文件 → Base64
const buf = await readFile('./${fileName}')
const base64 = buf.toString('base64')
const dataUrl = \`data:${ctx.mime || 'image/png'};base64,\${base64}\`
// ${hasData ? `当前结果：${dataUrlSnippet}` : ''}

// Base64 → 文件
const pure = dataUrl.replace(/^data:[^;]+;base64,/, '')
await writeFile('./out.${ctx.ext || 'png'}', Buffer.from(pure, 'base64'))`,
    },
    {
      key: 'python',
      label: 'Python',
      code: `import base64
from pathlib import Path

# 文件 → Base64
with open('${fileName}', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('ascii')
data_url = f'data:${ctx.mime || 'image/png'};base64,{b64}'
# ${hasData ? `当前结果：${dataUrlSnippet}` : ''}

# Base64 → 文件
pure = data_url.split(',', 1)[-1]
Path('out.${ctx.ext || 'png'}').write_bytes(base64.b64decode(pure))`,
    },
    {
      key: 'java',
      label: 'Java',
      code: `import java.nio.file.*;
import java.util.Base64;

// 文件 → Base64
byte[] bytes = Files.readAllBytes(Path.of("${fileName}"));
String base64 = Base64.getEncoder().encodeToString(bytes);
String dataUrl = "data:${ctx.mime || 'image/png'};base64," + base64;
// ${hasData ? `当前结果：${dataUrlSnippet}` : ''}

// Base64 → 文件
String pure = dataUrl.replaceFirst("^data:[^;]+;base64,", "");
byte[] decoded = Base64.getDecoder().decode(pure);
Files.write(Path.of("out.${ctx.ext || 'png'}"), decoded);`,
    },
  ]
}

interface CodeExamplesProps {
  /** 已截断的纯 Base64（≤ SAMPLE_MAX_BASE64_LEN 字符），用于在示例中展示 */
  truncatedBase64: string
  /** MIME 类型 */
  mime: string
  /** 是否有真实数据（用于显示「已填入当前数据」标签与切换占位） */
  hasData: boolean
}

/** 用 memo 包裹：当父组件因其它 state 重渲染时，只要 props 不变就跳过 */
const CodeExamples = memo(function CodeExamplesInner({ truncatedBase64, mime, hasData }: CodeExamplesProps) {
  const [activeKey, setActiveKey] = useState<string>('html')
  const [copiedKey, setCopiedKey] = useState<string>('')

  const samples = useMemo(() => {
    const ext = mime ? mimeToExtension(mime) : 'png'
    return buildSamples({
      hasData,
      truncated: truncatedBase64,
      mime,
      ext,
    })
  }, [hasData, truncatedBase64, mime])

  const active = samples.find((s) => s.key === activeKey) || samples[0]

  const handleCopy = async () => {
    try {
      await copyToClipboard(active.code)
      setCopiedKey(active.key)
      setTimeout(() => setCopiedKey(''), 1500)
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <section
      style={{
        marginTop: '32px',
        padding: '20px',
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
          代码示例
          {hasData && (
            <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: 500, color: 'var(--accent-1)' }}>
              · 已填入当前数据（已截断）
            </span>
          )}
        </h2>
        <button className="theme-btn" style={smallBtnStyle} onClick={handleCopy}>
          {copiedKey === active.key ? '已复制 ✓' : '复制代码'}
        </button>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2 mb-3">
        {samples.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={s.key === activeKey}
            onClick={() => setActiveKey(s.key)}
            className="cursor-pointer"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: s.key === activeKey ? 600 : 500,
              fontFamily: 'var(--font-body)',
              background: s.key === activeKey ? 'var(--bg-surface)' : 'transparent',
              color: s.key === activeKey ? 'var(--accent-1)' : 'var(--text-secondary)',
              border: `1px solid ${s.key === activeKey ? 'var(--accent-1)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-sm)',
              transition: 'var(--transition)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <pre
        style={{
          margin: 0,
          padding: '16px',
          background: 'var(--bg-surface)',
          border: 'var(--border-width) solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12.5px',
          lineHeight: 1.65,
          color: 'var(--text-primary)',
          overflow: 'auto',
          maxHeight: '420px',
        }}
      >
        <code>{active.code}</code>
      </pre>

      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>提示：</strong>
        Base64 体积比原图大约 ~33%，仅适合小图片（图标、占位图、邮件内联）。
        大图建议走 CDN 或 ObjectURL 以减少 HTML / CSS / JSON 文件体积，提升解析与缓存效率。
      </div>
    </section>
  )
})
