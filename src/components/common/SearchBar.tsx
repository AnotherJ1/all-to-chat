import { useEffect, useState } from 'react'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  /** 点击右侧 ⌘K 徽标时调用 */
  onOpenPalette?: () => void
  placeholder?: string
}

/**
 * 顶部受控搜索框 + ⌘K / Ctrl+K 提示徽标。
 * 仅做视觉与受控转发；过滤逻辑由调用方处理。
 */
export default function SearchBar({ value, onChange, onOpenPalette, placeholder = '搜索工具...' }: SearchBarProps) {
  const [isMac, setIsMac] = useState(false)
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/mac/i.test(navigator.platform))
    }
  }, [])

  return (
    <div
      className="flex items-center w-full max-w-2xl mx-auto rounded-xl px-4 py-3 gap-3"
      style={{
        background: 'var(--surface-elevated, var(--bg-secondary))',
        border: '1px solid var(--border-color, rgba(127,127,127,0.2))',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="搜索工具"
        className="flex-1 bg-transparent outline-none"
        style={{ color: 'inherit', fontSize: '0.95rem' }}
      />

      {onOpenPalette && (
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="打开命令面板"
          className="px-2 py-1 rounded-md text-xs opacity-70 hover:opacity-100"
          style={{ border: '1px solid var(--border-color, rgba(127,127,127,0.25))' }}
        >
          {isMac ? '⌘K' : 'Ctrl K'}
        </button>
      )}
    </div>
  )
}
