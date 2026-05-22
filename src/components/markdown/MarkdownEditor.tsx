import { useCallback, useMemo, useRef } from 'react'

interface MarkdownEditorProps {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** 编辑器顶部右侧标签,如 "MARKDOWN" 或 "HTML" */
  label?: string
  /** 是否禁用编辑(只读模式) */
  readOnly?: boolean
}

/**
 * Markdown 编辑器
 *
 * 特性:
 * - 行号侧栏(左侧),与 textarea 同步滚动
 * - Tab 键插入 2 空格(而非切焦点)
 * - 主题感知,使用 CSS 变量
 *
 * 关键算法:
 * - 行号: 监听 value 变化时按 \n 分割得到行数,逐行渲染数字
 * - Tab 缩进: keydown 拦截 Tab,在选区位置插入 '  ' 并把光标后移 2 位
 */
export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  label,
  readOnly = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const gutterRef = useRef<HTMLDivElement | null>(null)

  // 行号数组:按 \n 切割,空内容也至少有 1 行
  const lineNumbers = useMemo(() => {
    const lines = value.length === 0 ? 1 : value.split('\n').length
    return Array.from({ length: lines }, (_, i) => i + 1)
  }, [value])

  // 处理 Tab 键:插入 2 个空格而非切焦点
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = value.slice(0, start) + '  ' + value.slice(end)
      onChange(next)
      // 关键算法: 异步把光标移到插入后的新位置
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    },
    [value, onChange],
  )

  // textarea 滚动时同步行号侧栏
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current
    const gutter = gutterRef.current
    if (ta && gutter) {
      gutter.scrollTop = ta.scrollTop
    }
  }, [])

  return (
    <div
      className="flex flex-col min-w-0 h-full"
      style={{
        background: 'var(--bg-surface)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      {label && (
        <div
          className="px-3 py-1.5 text-xs font-bold flex-shrink-0"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            borderBottom: 'var(--border-width) solid var(--border-color)',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </div>
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 行号侧栏 */}
        <div
          ref={gutterRef}
          className="select-none text-right overflow-hidden flex-shrink-0"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            borderRight: 'var(--border-width) solid var(--border-color)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            lineHeight: '1.6',
            padding: '12px 8px',
            minWidth: '3em',
          }}
          aria-hidden="true"
        >
          {lineNumbers.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        {/* 编辑区 */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={false}
          className="flex-1 min-w-0 resize-none outline-none"
          style={{
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            lineHeight: '1.6',
            padding: '12px',
            border: 'none',
          }}
        />
      </div>
    </div>
  )
}
