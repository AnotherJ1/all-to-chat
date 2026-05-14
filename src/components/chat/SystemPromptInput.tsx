import { useState, useEffect } from 'react'
import { useConfigStore } from '../../stores/configStore'
import { IconChevronDown, IconSettings } from '../common/Icons'
import { toast } from '../../stores/toastStore'

export default function SystemPromptInput() {
  const { protocol, getCurrentConfig, setSystemPrompt } = useConfigStore()
  const { systemPrompt } = getCurrentConfig()
  const [isExpanded, setIsExpanded] = useState(false)
  const [localPrompt, setLocalPrompt] = useState(systemPrompt)

  const currentPrompt = getCurrentConfig().systemPrompt
  useEffect(() => {
    if (!isExpanded && localPrompt !== currentPrompt) {
      setLocalPrompt(currentPrompt)
    }
  }, [currentPrompt, isExpanded])

  const handleSave = () => {
    setSystemPrompt(localPrompt)
    toast.success('System Prompt 已保存')
  }

  const handleClear = () => {
    setLocalPrompt('')
    setSystemPrompt('')
    toast.info('System Prompt 已清除')
  }

  return (
    <div style={{ borderBottom: 'var(--border-width) solid var(--border-color)' }}>
      <button
        onClick={() => {
          setIsExpanded(!isExpanded)
          if (!isExpanded) setLocalPrompt(getCurrentConfig().systemPrompt)
        }}
        className="w-full px-6 py-3 flex items-center justify-between text-sm cursor-pointer"
        style={{ color: 'var(--text-muted)', transition: 'var(--transition)', background: 'transparent', border: 'none' }}
      >
        <span className="flex items-center gap-2">
          <IconSettings className="w-4 h-4" />
          <span style={{ fontFamily: 'var(--font-body)' }}>System Prompt</span>
          {currentPrompt && (
            <span
              className="px-2 py-0.5 text-xs font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--accent-1) 15%, transparent)',
                color: 'var(--accent-1)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-1)',
              }}
            >
              已设置
            </span>
          )}
        </span>
        <IconChevronDown
          className="w-4 h-4"
          style={{ transition: 'var(--transition)', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder={`为 ${protocol.toUpperCase()} 设置 System Prompt...`}
            className="theme-input h-24 resize-none"
          />
          <div className="flex gap-3 mt-3">
            <button onClick={handleSave} className="theme-btn theme-btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              保存
            </button>
            <button onClick={handleClear} className="theme-btn" style={{ padding: '8px 16px', fontSize: '13px' }}>
              清除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
