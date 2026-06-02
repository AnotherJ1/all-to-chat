// src/components/filetransfer/SignalExchange.tsx
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from '../../stores/toastStore'

interface Props {
  /** 本端生成的连接码（供对方扫/贴）；空则不显示 */
  localCode: string
  /** 是否需要让用户粘贴对端连接码 */
  needPaste: boolean
  /** 粘贴框标题 */
  pasteLabel: string
  /** 提交对端连接码 */
  onSubmit: (code: string) => void
  /** 本端连接码区标题 */
  localLabel: string
}

/** 信令交换：本端码（文本+二维码+复制） + 对端码粘贴 */
export default function SignalExchange({ localCode, needPaste, pasteLabel, onSubmit, localLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [paste, setPaste] = useState('')

  // 连接码 -> 二维码（连接码可能较长，用低容错等级提高容量）
  useEffect(() => {
    if (!localCode || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, localCode, { errorCorrectionLevel: 'L', width: 220, margin: 1 })
      .catch(() => { /* 内容过长无法生成二维码时静默，文本码仍可用 */ })
  }, [localCode])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(localCode)
      toast.success('连接码已复制')
    } catch {
      toast.error('复制失败，请手动选择文本复制')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {localCode && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {localLabel}
          </label>
          <div className="flex flex-col items-center gap-3 p-4 rounded-lg"
            style={{ background: 'var(--bg-secondary)', border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius)' }}>
            <div className="p-2 rounded" style={{ background: '#fff' }}>
              <canvas ref={canvasRef} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              对方可扫码，或复制下方连接码粘贴
            </p>
          </div>
          <textarea
            className="theme-input font-mono"
            readOnly
            value={localCode}
            onFocus={(e) => e.currentTarget.select()}
            style={{ minHeight: 72, fontSize: 12, resize: 'vertical', wordBreak: 'break-all' }}
          />
          <button className="theme-btn theme-btn-primary self-start" onClick={copy} style={{ fontSize: 13, padding: '8px 18px' }}>
            复制连接码
          </button>
        </div>
      )}

      {needPaste && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {pasteLabel}
          </label>
          <textarea
            className="theme-input font-mono"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="粘贴对方提供的连接码..."
            style={{ minHeight: 72, fontSize: 12, resize: 'vertical', wordBreak: 'break-all' }}
            spellCheck={false}
          />
          <button
            className="theme-btn theme-btn-primary self-start"
            onClick={() => onSubmit(paste.trim())}
            disabled={!paste.trim()}
            style={{ fontSize: 13, padding: '8px 18px' }}
          >
            确认连接码
          </button>
        </div>
      )}
    </div>
  )
}