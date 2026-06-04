import { useCallback, useEffect, useRef, useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { toast } from '../../stores/toastStore'
import {
  compressImage,
  formatBytes,
  formatToExtension,
  SUPPORTED_INPUT_MIMES,
  type CompressResult,
} from '../../lib/image/compress'
import ParamControls, { type ParamControlsValue } from './ParamControls'

/**
 * 多图批量压缩面板
 *
 * 交互：
 * - 多文件选择 / 拖拽（一次多张）
 * - 全局参数（一组）应用到所有图片
 * - 「压缩全部」按顺序处理（防止并发争抢 Worker），实时更新进度
 * - 「下载全部 ZIP」用 jszip + file-saver
 */

interface BatchPaneProps {
  getWorker: () => Worker
}

interface BatchItem {
  id: string
  file: File
  status: 'pending' | 'compressing' | 'done' | 'error'
  result?: CompressResult
  /** 结果 ObjectURL（用于显示压缩后大小或预览缩略图） */
  resultUrl?: string
  errorMsg?: string
}

const smallBtnStyle: React.CSSProperties = { padding: '4px 12px', fontSize: '12px', height: 'auto' }

let _idSeq = 0
const nextId = () => `bi_${Date.now()}_${++_idSeq}`

export default function BatchPane({ getWorker }: BatchPaneProps) {
  const [items, setItems] = useState<BatchItem[]>([])
  const [params, setParams] = useState<ParamControlsValue>({
    format: 'image/jpeg',
    quality: 80,
    maxDim: 1920,
  })
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  // 持有所有结果 ObjectURL，组件卸载或清空时统一释放
  const resultUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const set = resultUrlsRef.current
    return () => {
      set.forEach((u) => URL.revokeObjectURL(u))
      set.clear()
    }
  }, [])

  /** 追加文件到列表（去重靠 id，过滤不支持的类型） */
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    const accepted: BatchItem[] = []
    let skipped = 0
    for (const f of arr) {
      if (!SUPPORTED_INPUT_MIMES.includes(f.type as (typeof SUPPORTED_INPUT_MIMES)[number])) {
        skipped++
        continue
      }
      accepted.push({ id: nextId(), file: f, status: 'pending' })
    }
    if (skipped > 0) toast.warning(`已跳过 ${skipped} 个不支持的文件（仅 PNG / JPEG / WebP）`)
    if (accepted.length > 0) setItems((prev) => [...prev, ...accepted])
  }, [])

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id)
      if (it?.resultUrl) {
        URL.revokeObjectURL(it.resultUrl)
        resultUrlsRef.current.delete(it.resultUrl)
      }
      return prev.filter((x) => x.id !== id)
    })
  }

  const handleClearAll = () => {
    items.forEach((it) => {
      if (it.resultUrl) {
        URL.revokeObjectURL(it.resultUrl)
        resultUrlsRef.current.delete(it.resultUrl)
      }
    })
    setItems([])
    setProgress({ done: 0, total: 0 })
  }

  /** 串行压缩所有 pending（避免与同一 Worker 并发竞争） */
  const handleRun = async () => {
    if (running) return
    const pending = items.filter((it) => it.status === 'pending' || it.status === 'error')
    if (pending.length === 0) {
      toast.info('没有待处理的图片')
      return
    }
    setRunning(true)
    setProgress({ done: 0, total: pending.length })

    let done = 0
    for (const item of pending) {
      // 标记 compressing
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, status: 'compressing', errorMsg: '' } : x))
      )
      try {
        const r = await compressImage(
          item.file,
          { targetFormat: params.format, quality: params.quality / 100, maxDim: params.maxDim },
          getWorker()
        )
        const url = URL.createObjectURL(r.blob)
        resultUrlsRef.current.add(url)
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, status: 'done', result: r, resultUrl: url } : x
          )
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : '压缩失败'
        setItems((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, status: 'error', errorMsg: msg } : x))
        )
      }
      done++
      setProgress({ done, total: pending.length })
    }
    setRunning(false)
    toast.success(`批量压缩完成（${done} / ${pending.length}）`)
  }

  /** 打包 ZIP 下载所有 done 项 */
  const handleDownloadZip = async () => {
    const ok = items.filter((it) => it.status === 'done' && it.result)
    if (ok.length === 0) {
      toast.info('暂无已完成的压缩结果')
      return
    }
    const zip = new JSZip()
    const ext = formatToExtension(params.format)
    // 处理重名：保证 zip 内每个文件名唯一，冲突时追加 -2、-3… 后缀
    const usedNames = new Set<string>()
    for (const it of ok) {
      const baseName = it.file.name.replace(/\.[^.]+$/, '') || 'image'
      const stem = `${baseName}-compressed`
      let final = `${stem}.${ext}`
      let n = 1
      while (usedNames.has(final)) {
        n++
        final = `${stem}-${n}.${ext}`
      }
      usedNames.add(final)
      // result 必存在（filter 已保证）
      zip.file(final, it.result!.blob)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, `images-compressed-${Date.now()}.zip`)
    toast.success(`已打包 ${ok.length} 张图片`)
  }

  // 汇总统计
  const totalBefore = items.reduce(
    (s, it) => s + (it.status === 'done' && it.result ? it.result.before : 0),
    0
  )
  const totalAfter = items.reduce(
    (s, it) => s + (it.status === 'done' && it.result ? it.result.after : 0),
    0
  )
  const overallRatio =
    totalBefore > 0 ? ((1 - totalAfter / totalBefore) * 100).toFixed(1) : null

  const progressPct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* 拖放 / 选择 */}
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
        aria-label="批量选择或拖拽图片"
        className="cursor-pointer"
        style={{
          padding: '28px 24px',
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
          multiple
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
          {isDragging ? '松开以加入' : '点击选择多张图片，或拖拽到此处'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          支持 PNG / JPEG / WebP · 一次可选多张
        </div>
      </div>

      {/* 全局参数 */}
      <ParamControls
        value={params}
        onChange={setParams}
        title="全局压缩参数（应用到所有图片）"
        disabled={running}
      />

      {/* 操作栏 + 进度 */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{
          padding: '12px 14px',
          background: 'var(--bg-secondary)',
          border: 'var(--border-width) solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <button
          className="theme-btn theme-btn-primary"
          style={smallBtnStyle}
          onClick={handleRun}
          disabled={running || items.length === 0}
        >
          {running ? `压缩中 ${progress.done}/${progress.total}...` : '压缩全部'}
        </button>
        <button
          className="theme-btn"
          style={smallBtnStyle}
          onClick={handleDownloadZip}
          disabled={running || items.every((it) => it.status !== 'done')}
        >
          下载全部 ZIP
        </button>
        <button
          className="theme-btn"
          style={smallBtnStyle}
          onClick={handleClearAll}
          disabled={running || items.length === 0}
        >
          清空列表
        </button>
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
          共 {items.length} 张 · 已完成{' '}
          {items.filter((it) => it.status === 'done').length}
          {overallRatio !== null && (
            <>
              {' · 累计减少 '}
              <span style={{ color: 'var(--accent-1)' }}>{overallRatio}%</span>
            </>
          )}
        </div>
      </div>

      {/* 进度条（运行时显示） */}
      {running && (
        <div
          aria-label="批量进度"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            width: '100%',
            height: '6px',
            background: 'var(--bg-secondary)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'var(--accent-1)',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      )}

      {/* 文件列表 */}
      {items.length > 0 ? (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '40px minmax(0, 2fr) 100px 100px 110px 80px',
              gap: '10px',
              padding: '10px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              borderBottom: 'var(--border-width) solid var(--border-color)',
              fontFamily: 'var(--font-body)',
            }}
            className="batch-row-header"
          >
            <div>#</div>
            <div>文件名</div>
            <div>原始</div>
            <div>压缩后</div>
            <div>状态</div>
            <div>操作</div>
          </div>
          {items.map((it, idx) => (
            <BatchRow key={it.id} item={it} index={idx + 1} onRemove={() => handleRemove(it.id)} />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
          请先添加图片
        </div>
      )}

      {/* 移动端：列表换简化布局 */}
      <style>{`
        @media (max-width: 768px) {
          .batch-row-header {
            display: none !important;
          }
          .batch-row {
            grid-template-columns: 32px minmax(0, 1fr) 80px !important;
          }
          .batch-row-original,
          .batch-row-status {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}

function BatchRow({
  item,
  index,
  onRemove,
}: {
  item: BatchItem
  index: number
  onRemove: () => void
}) {
  const status = item.status
  const beforeBytes = item.file.size
  const afterBytes = item.result?.after ?? 0
  const ratio = item.result ? (1 - afterBytes / beforeBytes) * 100 : null

  const statusLabel = (() => {
    switch (status) {
      case 'pending':
        return '待处理'
      case 'compressing':
        return '压缩中...'
      case 'done':
        return ratio !== null ? `-${ratio.toFixed(1)}%` : '完成'
      case 'error':
        return `失败：${item.errorMsg || '未知错误'}`
    }
  })()

  const statusColor =
    status === 'done'
      ? 'var(--accent-1)'
      : status === 'error'
        ? '#ef4444'
        : status === 'compressing'
          ? 'var(--accent-2)'
          : 'var(--text-muted)'

  const handleDownloadOne = () => {
    if (!item.result || !item.resultUrl) return
    const ext = item.result.blob.type.split('/')[1] || 'bin'
    const baseName = item.file.name.replace(/\.[^.]+$/, '') || 'image'
    const a = document.createElement('a')
    a.href = item.resultUrl
    a.download = `${baseName}-compressed.${ext === 'jpeg' ? 'jpg' : ext}`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div
      className="batch-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '40px minmax(0, 2fr) 100px 100px 110px 80px',
        gap: '10px',
        padding: '10px 12px',
        fontSize: '12px',
        color: 'var(--text-primary)',
        borderTop: 'var(--border-width) solid var(--border-color)',
        alignItems: 'center',
      }}
    >
      <div style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
        {index}
      </div>
      <div
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={item.file.name}
      >
        {item.file.name}
      </div>
      <div className="batch-row-original" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {formatBytes(beforeBytes)}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {status === 'done' ? formatBytes(afterBytes) : '—'}
      </div>
      <div
        className="batch-row-status"
        style={{
          color: statusColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={statusLabel}
      >
        {statusLabel}
      </div>
      <div className="flex items-center gap-1">
        {status === 'done' && (
          <button
            className="theme-btn"
            style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
            onClick={handleDownloadOne}
          >
            下载
          </button>
        )}
        <button
          className="theme-btn"
          style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </div>
  )
}
