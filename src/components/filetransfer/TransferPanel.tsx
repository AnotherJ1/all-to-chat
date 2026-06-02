// src/components/filetransfer/TransferPanel.tsx
import { useRef, useState } from 'react'
import type { TransferItem } from '../../lib/filetransfer/types'
import { LARGE_FILE_THRESHOLD } from '../../lib/filetransfer/transfer'
import { toast } from '../../stores/toastStore'

interface Props {
  items: TransferItem[]
  onSendFiles: (files: FileList | File[]) => void
  onSendText: (content: string) => void
  onDownload: (item: TransferItem) => void
}

/** 人类可读文件大小 */
function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function TransferPanel({ items, onSendFiles, onSendText, onDownload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [text, setText] = useState('')

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.some((f) => f.size > LARGE_FILE_THRESHOLD)) {
      toast.info('文件较大，传输可能较慢，请保持页面在前台')
    }
    onSendFiles(list)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 文件拖拽区 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="拖拽或点击选择文件发送"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true) }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files) }}
        className="flex flex-col items-center justify-center border-2 border-dashed p-8 text-center cursor-pointer"
        style={{
          borderColor: dragging ? 'var(--accent-1)' : 'var(--border-color)',
          background: dragging ? 'color-mix(in srgb, var(--accent-1) 10%, transparent)' : 'var(--bg-secondary)',
          borderRadius: 'var(--radius)', outline: 'none',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }}
        />
        <div className="text-4xl mb-2" style={{ color: 'var(--accent-1)' }}>📤</div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {dragging ? '松开以发送' : '拖拽文件到这里，或点击选择'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>支持多文件</p>
      </div>

      {/* 文本片段 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>发送文本片段</label>
        <textarea
          className="theme-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入要发送的文字 / 链接..."
          style={{ minHeight: 64, fontSize: 13, resize: 'vertical' }}
        />
        <button
          className="theme-btn self-start"
          disabled={!text.trim()}
          onClick={() => { onSendText(text.trim()); setText('') }}
          style={{ fontSize: 13, padding: '8px 18px' }}
        >
          发送文本
        </button>
      </div>

      {/* 收发进度列表 */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>传输记录</label>
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.id} className="p-3 rounded-lg flex flex-col gap-2"
                style={{ background: 'var(--bg-secondary)', border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <span aria-hidden>{it.direction === 'send' ? '↑' : '↓'}</span>
                    <span className="truncate">{it.name}</span>
                  </span>
                  <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    {it.kind === 'file' ? fmtSize(it.size) : '文本'}
                  </span>
                </div>

                {/* 进度条（文件展示；文本即时完成不展示） */}
                {it.kind === 'file' && it.status !== 'done' && (
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                    <div className="h-full" style={{ width: `${Math.round(it.progress * 100)}%`, background: 'var(--accent-1)', transition: 'width 0.2s' }} />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs" style={{
                    color: it.status === 'failed' ? 'var(--color-danger)'
                      : it.status === 'done' ? 'var(--color-success)' : 'var(--text-muted)',
                  }}>
                    {it.status === 'failed' ? '失败'
                      : it.status === 'done' ? '完成'
                      : `${Math.round(it.progress * 100)}%`}
                  </span>

                  {/* 接收完成的文件可下载 */}
                  {it.direction === 'recv' && it.kind === 'file' && it.status === 'done' && it.blob && (
                    <button className="theme-btn theme-btn-primary" onClick={() => onDownload(it)} style={{ fontSize: 12, padding: '4px 12px' }}>
                      下载
                    </button>
                  )}
                  {/* 接收的文本可复制 */}
                  {it.kind === 'text' && it.content && (
                    <button className="theme-btn" onClick={async () => {
                      try { await navigator.clipboard.writeText(it.content!); toast.success('已复制') }
                      catch { toast.error('复制失败') }
                    }} style={{ fontSize: 12, padding: '4px 12px' }}>
                      复制文本
                    </button>
                  )}
                </div>

                {/* 文本内容预览 */}
                {it.kind === 'text' && it.content && (
                  <div className="text-xs font-mono p-2 rounded break-all"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', maxHeight: 96, overflow: 'auto' }}>
                    {it.content}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}