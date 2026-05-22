import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../stores/toastStore'
import {
  compressImage,
  formatBytes,
  formatToExtension,
  SUPPORTED_INPUT_MIMES,
  type CompressResult,
  type ImageOutputFormat,
} from '../../lib/image/compress'
import ParamControls, { type ParamControlsValue } from './ParamControls'

/**
 * 单图实时压缩面板
 *
 * 交互：
 * - 拖拽 / 点击选择 / Ctrl+V 粘贴
 * - 左右双栏：原图 / 压缩后
 * - 滑杆改动 -> 节流（180ms）后自动重压缩
 * - 自动管理 ObjectURL 生命周期，组件卸载或切图时 revoke 旧 URL
 */

interface SinglePaneProps {
  /** 父组件懒加载并复用的 Worker 实例（≥1MB 走 Worker） */
  getWorker: () => Worker
}

const PREVIEW_HEIGHT = '320px'

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-body)',
}
const smallBtnStyle: React.CSSProperties = { padding: '4px 12px', fontSize: '12px', height: 'auto' }
const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  margin: '0 2px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '11px',
  color: 'var(--text-secondary)',
}

export default function SinglePane({ getWorker }: SinglePaneProps) {
  // 当前文件
  const [file, setFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState('')
  const [originalDims, setOriginalDims] = useState<{ w: number; h: number } | null>(null)

  // 压缩参数（受控）
  const [params, setParams] = useState<ParamControlsValue>({
    format: 'image/jpeg',
    quality: 80,
    maxDim: 1920,
  })

  // 压缩结果
  const [result, setResult] = useState<CompressResult | null>(null)
  const [resultUrl, setResultUrl] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ObjectURL 生命周期管理：保存当前 URL，下一次切换前 revoke
  const originalUrlRef = useRef('')
  const resultUrlRef = useRef('')
  const recompressTimerRef = useRef<number>(0)
  // 抢占式：每次发起新压缩 +1，结果回来时若 ID 不匹配则丢弃（旧请求结果）
  const compressJobRef = useRef(0)

  // 组件卸载：释放所有 ObjectURL，清理定时器
  useEffect(() => {
    return () => {
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current)
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
      if (recompressTimerRef.current) {
        window.clearTimeout(recompressTimerRef.current)
      }
    }
  }, [])

  /** 装载新文件：建立预览，读取原图尺寸，立刻触发首次压缩 */
  const handleFile = useCallback((f: File) => {
    setErrMsg('')
    if (!SUPPORTED_INPUT_MIMES.includes(f.type as (typeof SUPPORTED_INPUT_MIMES)[number])) {
      toast.error(`不支持的格式：${f.type || '未知'}（仅 PNG / JPEG / WebP）`)
      return
    }

    // 释放旧 URL
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ''
    setResultUrl('')
    setResult(null)

    const url = URL.createObjectURL(f)
    originalUrlRef.current = url
    setOriginalUrl(url)
    setFile(f)
    setOriginalDims(null)

    // 关键修复：默认输出格式跟随原图
    // 之前硬编码 JPEG → PNG/优化过的 JPG 重压一律变大；现在保持原格式更符合"压缩"语义。
    // 用户仍可手动切换格式探索其他体积。
    const sourceMime = f.type as ImageOutputFormat
    if (sourceMime === 'image/png' || sourceMime === 'image/jpeg' || sourceMime === 'image/webp') {
      setParams((prev) => (prev.format === sourceMime ? prev : { ...prev, format: sourceMime }))
    }

    // 异步获取原图尺寸（不阻塞压缩）
    const img = new Image()
    img.onload = () => setOriginalDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setOriginalDims(null)
    img.src = url
  }, [])

  /** 节流执行压缩：滑杆/格式变更 180ms 后才发起一次（避免拖动滑杆时连发上百次） */
  const scheduleCompress = useCallback(
    (f: File, p: ParamControlsValue) => {
      if (recompressTimerRef.current) {
        window.clearTimeout(recompressTimerRef.current)
      }
      recompressTimerRef.current = window.setTimeout(() => {
        recompressTimerRef.current = 0
        const jobId = ++compressJobRef.current
        setCompressing(true)
        setErrMsg('')
        compressImage(
          f,
          { targetFormat: p.format, quality: p.quality / 100, maxDim: p.maxDim },
          getWorker()
        )
          .then((r) => {
            // 抢占判定：本次 jobId 不是最新一次则丢弃
            if (jobId !== compressJobRef.current) return
            // 释放旧结果 URL
            if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
            const u = URL.createObjectURL(r.blob)
            resultUrlRef.current = u
            setResultUrl(u)
            setResult(r)
          })
          .catch((e) => {
            if (jobId !== compressJobRef.current) return
            setErrMsg(e instanceof Error ? e.message : '压缩失败')
            setResult(null)
          })
          .finally(() => {
            if (jobId === compressJobRef.current) setCompressing(false)
          })
      }, 180) as unknown as number
    },
    [getWorker]
  )

  // 文件 / 参数变化 -> 重新压缩
  useEffect(() => {
    if (!file) return
    scheduleCompress(file, params)
  }, [file, params, scheduleCompress])

  // 全局 Ctrl+V 粘贴
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) {
            handleFile(f)
            e.preventDefault()
            return
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFile])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  const handleDownload = () => {
    if (!result || !resultUrl || !file) return
    const ext = formatToExtension(params.format)
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `${baseName}-compressed.${ext}`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleClear = () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    originalUrlRef.current = ''
    resultUrlRef.current = ''
    setOriginalUrl('')
    setResultUrl('')
    setFile(null)
    setOriginalDims(null)
    setResult(null)
    setErrMsg('')
    compressJobRef.current++ // 失效任何 in-flight 任务
  }

  // 衍生展示
  const ratioPercent = useMemo(() => {
    if (!result || result.before === 0) return null
    const pct = (1 - result.after / result.before) * 100
    return pct
  }, [result])

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* 拖放区 */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
        }}
        role="button"
        tabIndex={0}
        aria-label="选择或拖拽图片"
        className="cursor-pointer"
        style={{
          padding: '32px 24px',
          background: isDragging
            ? 'color-mix(in srgb, var(--accent-1) 8%, var(--bg-secondary))'
            : 'var(--bg-secondary)',
          border: `2px dashed ${isDragging ? 'var(--accent-1)' : 'var(--border-color)'}`,
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center',
          transition: 'var(--transition)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handlePick}
          style={{ display: 'none' }}
        />
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}
        >
          {isDragging ? '松开以上传' : '点击选择图片，或拖拽到此处'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          支持 PNG / JPEG / WebP · 也可 <kbd style={kbdStyle}>Ctrl/⌘ + V</kbd> 粘贴
        </div>
      </div>

      {/* 参数 */}
      <ParamControls value={params} onChange={setParams} title="压缩参数（实时生效）" />

      {/* 错误提示 */}
      {errMsg && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#ef4444',
            fontSize: '13px',
          }}
        >
          <strong>压缩失败：</strong>
          {errMsg}
        </div>
      )}

      {/* 双栏对比 */}
      {file && (
        <div
          className="image-compress-preview-grid grid gap-6"
          style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'stretch' }}
        >
          {/* 原图 */}
          <PreviewBox
            title={`原图 · ${formatBytes(file.size)}`}
            subtitle={
              originalDims
                ? `${originalDims.w} × ${originalDims.h} · ${file.type}`
                : file.type || '—'
            }
            src={originalUrl}
            actionRight={
              <button className="theme-btn" style={smallBtnStyle} onClick={handleClear}>
                清空
              </button>
            }
          />
          {/* 压缩后 */}
          <PreviewBox
            title={
              compressing
                ? '压缩中...'
                : result
                  ? `压缩后 · ${formatBytes(result.after)}`
                  : '压缩后'
            }
            subtitle={
              result
                ? `${result.width} × ${result.height} · ${params.format}${
                    ratioPercent !== null
                      ? ratioPercent >= 0
                        ? ` · 体积减少 ${ratioPercent.toFixed(1)}%`
                        : ` · 体积反而 +${(-ratioPercent).toFixed(1)}%（${
                            file && file.type === 'image/png' && params.format === 'image/png'
                              ? '原图已被高度优化，可尝试切换 JPEG/WebP 或降低尺寸'
                              : params.quality >= 90
                                ? '当前质量过高，可降低 quality（如 75-85）'
                                : '原图已较优，建议保留原图或换格式'
                          }）`
                      : ''
                  }`
                : '等待压缩'
            }
            src={resultUrl}
            actionRight={
              <button
                className="theme-btn theme-btn-primary"
                style={smallBtnStyle}
                onClick={handleDownload}
                disabled={!result || compressing}
              >
                下载
              </button>
            }
          />
        </div>
      )}
    </div>
  )
}

/** 单格预览框（标题 + 副标题 + 右上操作 + 图片） */
function PreviewBox({
  title,
  subtitle,
  src,
  actionRight,
}: {
  title: string
  subtitle: string
  src: string
  actionRight?: React.ReactNode
}) {
  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      <div
        className="flex items-center justify-between mb-2 gap-2"
        style={{ flexShrink: 0, height: '28px' }}
      >
        <label style={labelStyle}>{title}</label>
        {actionRight}
      </div>
      <div
        style={{
          height: PREVIEW_HEIGHT,
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
        {src ? (
          <img
            src={src}
            alt={title}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
        )}
      </div>
      <div
        style={{
          marginTop: '6px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {subtitle}
      </div>
    </div>
  )
}

// 让 ImageOutputFormat / ParamControlsValue 在外部不再被未使用警告
export type { ImageOutputFormat }
