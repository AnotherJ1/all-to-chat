/**
 * 批量面板：批量生成 / 批量解析
 *
 * Tab 切换：
 * - 批量生成：textarea 多行 → 每行一条 → 逐条 QRCode.toDataURL → ZIP 下载
 * - 批量解析：多文件 input + 拖拽 → useQrParser.decodeFile → 表格 → 导出 CSV
 *
 * 细节：
 * - 批量生成失败的行不会中断整体，最终 toast 汇总
 * - decodeFile 是当前 hook 单例，结果会写到右侧解析区，因此批量解析独立维护一份本地结果
 *   不复用 useQrParser（否则 200 张图会让右侧反复刷新）
 * - 文件名含序号补零（qrcode_001.png）
 * - 命名同名冲突由 zipHelper 自动处理
 */
import { useCallback, useRef, useState } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { toast } from '../../../stores/toastStore'
import {
  generateBatchZip,
  dataUrlToBlob,
  triggerBlobDownload,
  buildCsv,
  padIndex,
} from '../utils/zipHelper'
import { downscaleImage } from '../utils/qrUtils'

type TabKey = 'gen' | 'parse'

/** 批量生成默认参数：跟当前 generator 解耦，使用通用配置（用户更可能批量生成给第三方） */
const BATCH_DEFAULT = {
  size: 256,
  margin: 2,
  fgColor: '#000000',
  bgColor: '#ffffff',
  errorLevel: 'M' as const,
}

/** 单条批量解析结果 */
interface ParseRow {
  filename: string
  result: string
  status: '成功' | '失败'
  message?: string
}

export function BatchPanel() {
  const [tab, setTab] = useState<TabKey>('gen')

  // ===== 批量生成 =====
  const [batchInput, setBatchInput] = useState<string>('')
  const [generating, setGenerating] = useState<boolean>(false)
  const [genProgress, setGenProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  })

  /** 解析 textarea：去空行 / 去前后空白 / 限制最大 500 行防止假死 */
  const parseLines = useCallback((s: string): string[] => {
    const lines = s
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    return lines.slice(0, 500)
  }, [])

  /** 批量生成 → ZIP */
  const handleGenerate = useCallback(async () => {
    if (generating) return
    const lines = parseLines(batchInput)
    if (lines.length === 0) {
      toast.error('请至少输入一行内容')
      return
    }
    setGenerating(true)
    setGenProgress({ done: 0, total: lines.length })

    const items: { name: string; blob: Blob }[] = []
    let failCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      try {
        const dataUrl = await QRCode.toDataURL(line, {
          width: BATCH_DEFAULT.size,
          margin: BATCH_DEFAULT.margin,
          color: { dark: BATCH_DEFAULT.fgColor, light: BATCH_DEFAULT.bgColor },
          errorCorrectionLevel: BATCH_DEFAULT.errorLevel,
        })
        const blob = dataUrlToBlob(dataUrl)
        items.push({
          name: `qrcode_${padIndex(i + 1, lines.length)}.png`,
          blob,
        })
      } catch (err) {
        console.error('[BatchPanel] 生成失败', line, err)
        failCount++
      }
      setGenProgress({ done: i + 1, total: lines.length })
    }

    if (items.length === 0) {
      setGenerating(false)
      toast.error('全部生成失败')
      return
    }

    try {
      const zipBlob = await generateBatchZip(items)
      triggerBlobDownload(zipBlob, `qrcodes_${Date.now()}.zip`)
      if (failCount > 0) {
        toast.warning(`已生成 ${items.length} 条，失败 ${failCount} 条`)
      } else {
        toast.success(`已生成 ${items.length} 条并打包下载`)
      }
    } catch (err) {
      console.error('[BatchPanel] ZIP 打包失败', err)
      toast.error('ZIP 打包失败')
    } finally {
      setGenerating(false)
    }
  }, [batchInput, generating, parseLines])

  // ===== 批量解析 =====
  const [parsing, setParsing] = useState<boolean>(false)
  const [parseRows, setParseRows] = useState<ParseRow[]>([])
  const [isDragOver, setIsDragOver] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 解析单文件：内部用 downscaleImage + jsQR，避免污染右侧 hook 状态 */
  const decodeOne = useCallback(async (file: File): Promise<ParseRow> => {
    if (!file.type.startsWith('image/')) {
      return { filename: file.name, result: '', status: '失败', message: '非图片文件' }
    }
    try {
      const canvas = await downscaleImage(file, 1600)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return { filename: file.name, result: '', status: '失败', message: 'Canvas 不可用' }
      }
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (!code) {
        return { filename: file.name, result: '', status: '失败', message: '未识别到二维码' }
      }
      return { filename: file.name, result: code.data, status: '成功' }
    } catch (err) {
      return {
        filename: file.name,
        result: '',
        status: '失败',
        message: err instanceof Error ? err.message : '解析失败',
      }
    }
  }, [])

  /** 处理一批文件 */
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).slice(0, 200) // 上限保护
      if (arr.length === 0) return
      setParsing(true)
      const rows: ParseRow[] = []
      for (const f of arr) {
        const row = await decodeOne(f)
        rows.push(row)
        setParseRows([...rows])
      }
      const ok = rows.filter((r) => r.status === '成功').length
      if (ok === 0) {
        toast.error(`已处理 ${rows.length} 个文件，全部失败`)
      } else if (ok < rows.length) {
        toast.warning(`已处理 ${rows.length} 个文件，成功 ${ok} 失败 ${rows.length - ok}`)
      } else {
        toast.success(`已成功解析 ${ok} 个文件`)
      }
      setParsing(false)
    },
    [decodeOne],
  )

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = e.target.files
    if (fs && fs.length > 0) void handleFiles(fs)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const fs = e.dataTransfer.files
    if (fs && fs.length > 0) void handleFiles(fs)
  }

  /** 导出 CSV */
  const exportCsv = useCallback(() => {
    if (parseRows.length === 0) {
      toast.error('当前没有可导出的解析结果')
      return
    }
    const blob = buildCsv(
      parseRows.map((r) => ({
        filename: r.filename,
        result: r.result,
        status: r.status,
        message: r.message ?? '',
      })),
      ['filename', 'result', 'status', 'message'],
    )
    triggerBlobDownload(blob, `qr_parse_${Date.now()}.csv`)
    toast.success('CSV 已导出')
  }, [parseRows])

  const clearRows = () => setParseRows([])

  return (
    <section
      className="mt-6"
      data-testid="batch-panel"
      style={{
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius)',
      }}
    >
      <header className="flex items-center justify-between px-4 pt-3">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
          <span style={{ color: 'var(--accent-2)' }}>📦</span>
          批量处理
        </h3>
        <div className="flex gap-1" role="tablist" aria-label="批量处理 Tab">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'gen'}
            onClick={() => setTab('gen')}
            className="theme-btn"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderColor: tab === 'gen' ? 'var(--accent-1)' : 'var(--border-color)',
              color: tab === 'gen' ? 'var(--accent-1)' : 'var(--text-secondary)',
            }}
          >
            批量生成
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'parse'}
            onClick={() => setTab('parse')}
            className="theme-btn"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderColor: tab === 'parse' ? 'var(--accent-1)' : 'var(--border-color)',
              color: tab === 'parse' ? 'var(--accent-1)' : 'var(--text-secondary)',
            }}
          >
            批量解析
          </button>
        </div>
      </header>

      <div className="px-4 pb-4 pt-3">
        {tab === 'gen' && (
          <div className="flex flex-col gap-3">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              每行一条内容（最多 500 行）。生成后将以 ZIP 形式下载。
            </label>
            <textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              className="theme-input"
              placeholder={'https://example.com/a\nhttps://example.com/b\nhello world'}
              spellCheck={false}
              style={{ minHeight: '120px', fontSize: '13px', resize: 'vertical' }}
              aria-label="批量生成输入"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="theme-btn theme-btn-primary"
                onClick={handleGenerate}
                disabled={generating || batchInput.trim().length === 0}
                style={{ padding: '6px 16px', fontSize: '13px' }}
              >
                {generating
                  ? `生成中… ${genProgress.done}/${genProgress.total}`
                  : '批量生成 ZIP'}
              </button>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                默认 256px / M 容错 / 黑白
              </span>
            </div>
          </div>
        )}

        {tab === 'parse' && (
          <div className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setIsDragOver(false)
              }}
              onDrop={onDrop}
              data-testid="batch-dropzone"
              className="border-2 border-dashed rounded p-4 text-center cursor-pointer transition-colors"
              style={{
                borderColor: isDragOver ? 'var(--accent-1)' : 'var(--border-color)',
                background: isDragOver ? 'color-mix(in srgb, var(--accent-1) 10%, transparent)' : 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onFileInputChange}
              />
              {parsing ? '正在批量解析…' : '点击或拖拽多张图片到这里（最多 200 张）'}
            </div>

            {parseRows.length > 0 && (
              <>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    className="theme-btn"
                    onClick={exportCsv}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                  >
                    导出 CSV
                  </button>
                  <button
                    type="button"
                    className="theme-btn"
                    onClick={clearRows}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      borderColor: 'var(--color-danger)',
                      color: 'var(--color-danger)',
                    }}
                  >
                    清空结果
                  </button>
                </div>

                <div
                  className="overflow-auto rounded"
                  style={{
                    border: '1px solid var(--border-color)',
                    maxHeight: '320px',
                  }}
                >
                  <table className="w-full text-xs" style={{ color: 'var(--text-primary)' }}>
                    <thead
                      style={{
                        background: 'var(--bg-surface)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <tr>
                        <th className="text-left px-2 py-1">文件名</th>
                        <th className="text-left px-2 py-1">解析结果</th>
                        <th className="text-left px-2 py-1" style={{ width: '60px' }}>
                          状态
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseRows.map((r, i) => (
                        <tr
                          key={`${r.filename}-${i}`}
                          style={{ borderTop: '1px solid var(--border-color)' }}
                        >
                          <td
                            className="px-2 py-1 break-all"
                            style={{ maxWidth: '180px' }}
                            title={r.filename}
                          >
                            {r.filename}
                          </td>
                          <td className="px-2 py-1 break-all font-mono">
                            {r.status === '成功' ? r.result : (r.message ?? '')}
                          </td>
                          <td className="px-2 py-1">
                            <span
                              style={{
                                color: r.status === '成功' ? 'var(--color-success)' : 'var(--color-danger)',
                                fontWeight: 600,
                              }}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
