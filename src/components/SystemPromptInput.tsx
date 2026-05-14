import { useState } from 'react'
import { useConfigStore } from '../stores/configStore'
import { IconChevronDown, IconSettings } from './Icons'
import { toast } from '../stores/toastStore'

export default function SystemPromptInput() {
  const { protocol, getCurrentConfig, setSystemPrompt } = useConfigStore()
  const { systemPrompt } = getCurrentConfig()
  const [isExpanded, setIsExpanded] = useState(false)
  const [localPrompt, setLocalPrompt] = useState(systemPrompt)

  // 切换协议时同步
  const currentPrompt = getCurrentConfig().systemPrompt
  if (localPrompt !== currentPrompt && !isExpanded) {
    setLocalPrompt(currentPrompt)
  }

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
    <div className="border-b border-[var(--border-color)]">
      <button
        onClick={() => {
          setIsExpanded(!isExpanded)
          if (!isExpanded) setLocalPrompt(getCurrentConfig().systemPrompt)
        }}
        className="w-full px-6 py-3 flex items-center justify-between text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <IconSettings className="w-4 h-4" />
          <span>System Prompt</span>
          {currentPrompt && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-cyan-400/10 text-cyan-400/70">
              已设置
            </span>
          )}
        </span>
        <IconChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder={`为 ${protocol.toUpperCase()} 设置 System Prompt...`}
            className="input-aurora h-24 resize-none"
          />
          <div className="flex gap-3 mt-3">
            <button onClick={handleSave} className="btn-aurora btn-aurora-primary text-sm py-2 px-4">
              保存
            </button>
            <button onClick={handleClear} className="btn-aurora text-sm py-2 px-4">
              清除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
