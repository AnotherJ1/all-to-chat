import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toolRegistry } from '../../registry/tools'
import { searchTools } from '../../lib/searchTools'
import { useCommandPaletteStore } from '../../stores/commandPaletteStore'
import { toast } from '../../stores/toastStore'

const MAX_RESULTS = 8

export default function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open)
  const setOpen = useCommandPaletteStore((s) => s.setOpen)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(
    () => searchTools(query, toolRegistry).slice(0, MAX_RESULTS),
    [query],
  )

  // 打开时清空状态并聚焦输入
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // results 变化时把选中索引夹回合法范围
  useEffect(() => {
    setSelectedIndex((i) => (results.length === 0 ? 0 : Math.min(i, results.length - 1)))
  }, [results.length])

  if (!open) return null

  const handleSelect = (index: number) => {
    const tool = results[index]
    if (!tool) return
    if (tool.disabled) {
      toast.info('该功能暂未开放，敬请期待')
      setOpen(false)
      return
    }
    navigate(tool.route)
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-label="命令面板"
      aria-modal="true"
      className="theme-palette-backdrop"
      onClick={() => setOpen(false)}
    >
      <div onClick={(e) => e.stopPropagation()} className="theme-palette">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入关键字搜索工具..."
          aria-label="命令面板搜索框"
          className="theme-palette-input"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSelectedIndex((i) => (results.length ? (i + 1) % results.length : 0))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSelectedIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              handleSelect(selectedIndex)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
            }
          }}
        />

        <ul role="listbox" className="theme-palette-list">
          {results.length === 0 ? (
            <li className="theme-palette-empty">没有找到相关工具</li>
          ) : (
            results.map((tool, i) => (
              <li
                key={tool.id}
                role="option"
                aria-selected={i === selectedIndex}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => handleSelect(i)}
                className="theme-palette-item"
                style={{ opacity: tool.disabled ? 0.6 : 1 }}
              >
                <span className="theme-palette-item-name">{tool.name}</span>
                <span className="theme-palette-item-desc">{tool.description}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
