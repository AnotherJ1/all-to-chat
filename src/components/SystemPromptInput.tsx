import { useState } from 'react'
import { useConfigStore } from '../stores/configStore'

interface SystemPromptInputProps {
  onClose?: () => void
}

export default function SystemPromptInput({ onClose }: SystemPromptInputProps) {
  const { protocol } = useConfigStore()
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSave = () => {
    localStorage.setItem(`systemPrompt-${protocol}`, systemPrompt)
    onClose?.()
  }

  const handleClear = () => {
    localStorage.removeItem(`systemPrompt-${protocol}`)
    setSystemPrompt('')
  }

  return (
    <div className="glass border-b border-white/10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-3 flex items-center justify-between text-sm text-white/50 hover:text-white/80 transition-all cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          System Prompt
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="输入 System Prompt 来控制 AI 的行为..."
            className="input-aurora h-24 resize-none"
          />
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleSave}
              className="btn-aurora btn-aurora-primary text-sm py-2 px-4"
            >
              保存
            </button>
            <button
              onClick={handleClear}
              className="btn-aurora text-sm py-2 px-4 hover:bg-white/5"
            >
              清除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
