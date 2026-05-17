import { useState, useEffect, useMemo } from 'react'
import { useConfigStore } from '../../stores/configStore'
import { IconChevronDown, IconSettings } from '../common/Icons'
import { toast } from '../../stores/toastStore'
import { PROMPT_PRESETS } from '../../lib/prompt-presets'

export default function SystemPromptInput() {
  const { protocol, getCurrentConfig, setSystemPrompt } = useConfigStore()
  const currentPrompt = getCurrentConfig().systemPrompt ?? ''
  const [isExpanded, setIsExpanded] = useState(false)
  const [localPrompt, setLocalPrompt] = useState<string>(currentPrompt)

  // protocol 切换或外部更新 currentPrompt 时同步本地草稿（除非用户正在编辑且有未保存变化）
  useEffect(() => {
    setLocalPrompt(currentPrompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol])

  useEffect(() => {
    if (!isExpanded && localPrompt !== currentPrompt) {
      setLocalPrompt(currentPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrompt, isExpanded])

  // 当前 localPrompt 是否完全匹配某个预设（用于高亮选中态）
  const matchedPresetId = useMemo(
    () => PROMPT_PRESETS.find((p) => p.content === localPrompt)?.id,
    [localPrompt]
  )

  // 是否有未保存的修改
  const isDirty = localPrompt !== currentPrompt

  const handleSave = () => {
    setSystemPrompt(localPrompt)
    toast.success('System Prompt 已保存')
  }

  const handleClear = () => {
    setLocalPrompt('')
    setSystemPrompt('')
    toast.info('System Prompt 已清除')
  }

  const handleApplyPreset = (presetId: string) => {
    const preset = PROMPT_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setLocalPrompt(preset.content)
    setSystemPrompt(preset.content)
    toast.success(`已应用预设：${preset.label}`)
  }

  return (
    <div style={{ borderBottom: 'var(--border-width) solid var(--border-color)' }}>
      <button
        onClick={() => {
          setIsExpanded(!isExpanded)
          if (!isExpanded) setLocalPrompt(getCurrentConfig().systemPrompt ?? '')
        }}
        className="w-full px-3 sm:px-6 py-3 flex items-center justify-between text-sm cursor-pointer"
        style={{ color: 'var(--text-muted)', transition: 'var(--transition)', background: 'transparent', border: 'none' }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <IconSettings className="w-4 h-4 flex-shrink-0" />
          <span style={{ fontFamily: 'var(--font-body)' }}>System Prompt</span>
          {currentPrompt && (
            <span
              className="px-2 py-0.5 text-xs font-semibold flex-shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--accent-1) 15%, transparent)',
                color: 'var(--accent-1)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-1)',
              }}
            >
              {matchedPresetId
                ? PROMPT_PRESETS.find((p) => p.id === matchedPresetId)?.label
                : '已设置'}
            </span>
          )}
        </span>
        <IconChevronDown
          className="w-4 h-4 flex-shrink-0"
          style={{ transition: 'var(--transition)', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {isExpanded && (
        <div className="px-3 sm:px-6 pb-4 space-y-3">
          {/* 预设选择区 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                预设模板（点击应用，可在下方继续编辑）
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_PRESETS.map((preset) => {
                const isActive = matchedPresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.id)}
                    className={isActive ? 'theme-btn theme-btn-primary' : 'theme-btn'}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    title={preset.description}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 编辑区 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                自定义内容
              </span>
              {isDirty && (
                <span className="text-xs" style={{ color: 'var(--accent-2, #f97316)' }}>
                  有未保存修改
                </span>
              )}
            </div>
            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder={`为 ${protocol.toUpperCase()} 设置 System Prompt，或从上方选择预设`}
              className="theme-input resize-none"
              style={{ height: '140px', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
            />
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={handleSave}
                disabled={!isDirty}
                className="theme-btn theme-btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', opacity: isDirty ? 1 : 0.5 }}
              >
                保存
              </button>
              <button
                onClick={handleClear}
                className="theme-btn"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                清除
              </button>
              <span
                className="ml-auto text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {localPrompt.length} 字符
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
