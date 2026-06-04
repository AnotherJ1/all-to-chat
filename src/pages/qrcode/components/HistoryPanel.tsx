/**
 * 历史记录面板（折叠）
 *
 * - 默认折叠，点击展开显示最近 N 条
 * - 每条记录展示截断的 text + 相对时间 + 颜色色块预览
 * - 操作：恢复、删除
 * - 顶部："清空历史" 带二次确认（点两次按钮）
 *
 * 设计取舍：
 * - 内部直接 useQrHistory()，避免改动 lead 的 stub
 * - "恢复" 通过 useQrCodeContext().generator 回写
 * - 时间相对值用 Intl.RelativeTimeFormat（不引入 date-fns 减少耦合，
 *   虽然项目里有 date-fns，但对外接口稳定优先）
 */
import { useMemo, useRef, useState } from 'react'
import { useQrCodeContext } from '../QrCodeContext'
import { useQrHistory } from '../hooks/useQrHistory'
import { toast } from '../../../stores/toastStore'
import type { QrHistoryItem } from '../types'

/** 截断显示文本 */
function truncate(s: string, n = 40): string {
  if (s.length <= n) return s
  return s.slice(0, n) + '…'
}

/**
 * 把时间戳格式化为"刚刚 / N 分钟前 / N 小时前 / N 天前 / yyyy-MM-dd"
 * 不依赖 Intl.RelativeTimeFormat，jsdom 老版本兼容
 */
function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function HistoryPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const { generator } = useQrCodeContext()
  const { history, removeItem, clearAll } = useQrHistory()

  const [open, setOpen] = useState<boolean>(false)
  // embedded 模式下内容区恒展开，不渲染折叠头
  const expanded = embedded || open
  /** 二次确认：第一次点变为"再点一次确认"，3 秒未点取消 */
  const [confirmClear, setConfirmClear] = useState<boolean>(false)
  const confirmTimerRef = useRef<number | null>(null)

  const count = history.length
  const isEmpty = count === 0

  /** 把一条历史回写到 generator */
  const handleRestore = (item: QrHistoryItem) => {
    try {
      generator.setText(item.text)
      generator.setSize(item.options.size)
      generator.setFgColor(item.options.fgColor)
      generator.setBgColor(item.options.bgColor)
      generator.setErrorLevel(item.options.errorLevel)
      // logo 历史里不存，提示用户
      toast.success('已恢复历史配置')
    } catch (err) {
      console.error('[HistoryPanel] 恢复失败:', err)
      toast.error('恢复失败')
    }
  }

  /** 二次确认清空 */
  const handleClearAll = () => {
    if (typeof window === 'undefined') return
    if (!confirmClear) {
      setConfirmClear(true)
      toast.warning('再次点击"清空历史"确认操作')
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current)
      }
      confirmTimerRef.current = window.setTimeout(() => {
        setConfirmClear(false)
        confirmTimerRef.current = null
      }, 3000)
      return
    }
    clearAll()
    setConfirmClear(false)
    if (confirmTimerRef.current !== null) {
      window.clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    toast.success('已清空历史')
  }

  const sorted = useMemo(
    () => [...history].sort((a, b) => b.createdAt - a.createdAt),
    [history],
  )

  return (
    <section
      className="mt-6"
      data-testid="history-panel"
      style={{
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius)',
      }}
    >
      {/* 折叠头（非 embedded 时渲染，保留原折叠交互） */}
      {!embedded && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="qr-history-list"
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          <span className="flex items-center gap-2 font-semibold">
            <span style={{ color: 'var(--accent-1)' }}>🕘</span>
            历史记录
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              {count}
            </span>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
        </button>
      )}

      {/* embedded 模式下用静态标题行替代被隐藏的折叠头，保持视觉完整 */}
      {embedded && (
        <div
          className="flex items-center gap-2 px-4 py-3 font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          <span style={{ color: 'var(--accent-1)' }}>🕘</span>
          历史记录
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
            }}
          >
            {count}
          </span>
        </div>
      )}

      {expanded && (
        <div id="qr-history-list" className="px-4 pb-4">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              className="theme-btn"
              onClick={handleClearAll}
              disabled={isEmpty}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                borderColor: confirmClear ? 'var(--color-danger)' : 'var(--border-color)',
                color: confirmClear ? 'var(--color-danger)' : 'var(--text-secondary)',
              }}
            >
              {confirmClear ? '再次点击确认' : '清空历史'}
            </button>
          </div>

          {isEmpty ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              暂无历史记录，生成几次二维码后会自动保存到这里。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sorted.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {/* 颜色块预览 */}
                  <div
                    className="w-8 h-8 rounded flex-shrink-0"
                    style={{
                      background: item.options.bgColor,
                      border: `2px solid ${item.options.fgColor}`,
                    }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm truncate"
                      style={{ color: 'var(--text-primary)' }}
                      title={item.text}
                    >
                      {truncate(item.text, 40)}
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {formatRelative(item.createdAt)} · {item.options.size}px ·{' '}
                      {item.options.errorLevel}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      className="theme-btn"
                      onClick={() => handleRestore(item)}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      aria-label="恢复此条历史"
                    >
                      恢复
                    </button>
                    <button
                      type="button"
                      className="theme-btn"
                      onClick={() => removeItem(item.id)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        borderColor: 'var(--color-danger)',
                        color: 'var(--color-danger)',
                      }}
                      aria-label="删除此条历史"
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
