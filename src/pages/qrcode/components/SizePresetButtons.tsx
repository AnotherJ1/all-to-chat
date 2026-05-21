/**
 * SizePresetButtons - 二维码尺寸预设按钮组
 *
 * 4 个常用尺寸（256/512/1024/2048 px）一键切换：
 *  - 点击后调用 generator.setSize(...)
 *  - toast 提示
 *  - 当前尺寸对应按钮高亮
 *
 * 数据通过 useQrCodeContext 拿到 generator，避免 prop drilling。
 */
import { useQrCodeContext } from '../QrCodeContext'
import { toast } from '../../../stores/toastStore'

const SIZE_PRESETS: ReadonlyArray<number> = [256, 512, 1024, 2048]

export function SizePresetButtons(): JSX.Element {
  const { generator } = useQrCodeContext()
  const { size, setSize } = generator

  const handleSelect = (next: number) => {
    if (next === size) return
    setSize(next)
    toast.success(`已切换尺寸为 ${next}px`)
  }

  return (
    <div
      className="flex flex-wrap gap-2 mt-2"
      role="group"
      aria-label="二维码尺寸预设"
      data-testid="size-preset-buttons"
    >
      {SIZE_PRESETS.map((preset) => {
        const active = preset === size
        return (
          <button
            key={preset}
            type="button"
            onClick={() => handleSelect(preset)}
            aria-pressed={active}
            className="theme-btn"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              // 当前尺寸高亮
              borderColor: active ? 'var(--accent-1)' : 'var(--border-color)',
              color: active ? 'var(--accent-1)' : 'var(--text-secondary)',
              background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
            }}
          >
            {preset}px
          </button>
        )
      })}
    </div>
  )
}
