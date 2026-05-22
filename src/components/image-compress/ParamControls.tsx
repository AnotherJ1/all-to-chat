import type { ImageOutputFormat } from '../../lib/image/compress'

/**
 * 单图 / 多图共用的参数控制条
 *
 * 包含：
 * - 输出格式（PNG / JPEG / WebP）
 * - 质量滑杆（0-100，PNG 模式禁用并提示无损）
 * - 最大边长滑杆（128-4096）
 *
 * 设计：
 * - 不直接持有状态：受控组件，所有值由父组件提供
 * - 滑杆本身有边界，越界值由父组件保证（默认值常量见 ImageCompressPage）
 */
export interface ParamControlsValue {
  format: ImageOutputFormat
  /** 0-100 整数，组件内部映射为 quality 0-1 */
  quality: number
  /** 128-4096 整数 */
  maxDim: number
}

export interface ParamControlsProps {
  value: ParamControlsValue
  onChange: (v: ParamControlsValue) => void
  /** 标题（可选，例如「全局参数」/ 「压缩参数」） */
  title?: string
  /** 是否禁用整组（处理中防误改） */
  disabled?: boolean
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-body)',
}

const valueStyle: React.CSSProperties = {
  fontSize: '12px',
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text-primary)',
  marginLeft: '8px',
}

export default function ParamControls({ value, onChange, title, disabled }: ParamControlsProps) {
  const isPng = value.format === 'image/png'

  return (
    <div
      style={{
        display: 'grid',
        gap: '14px',
        padding: '14px 16px',
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {title && (
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          {title}
        </div>
      )}

      {/* 输出格式 */}
      <div className="flex items-center gap-3 flex-wrap">
        <label style={labelStyle}>输出格式</label>
        <select
          value={value.format}
          onChange={(e) => onChange({ ...value, format: e.target.value as ImageOutputFormat })}
          className="theme-input"
          style={{ padding: '4px 10px', fontSize: '12px', height: 'auto', width: 'auto' }}
        >
          <option value="image/jpeg">JPEG（最佳压缩比）</option>
          <option value="image/webp">WebP（现代格式 / 体积更小）</option>
          <option value="image/png">PNG（无损 / 忽略质量）</option>
        </select>
      </div>

      {/* 质量滑杆 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label style={labelStyle}>
            质量
            {isPng && (
              <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                · PNG 无损，忽略此参数
              </span>
            )}
          </label>
          <span style={valueStyle}>{value.quality}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value.quality}
          disabled={isPng}
          onChange={(e) => onChange({ ...value, quality: Number(e.target.value) })}
          style={{ width: '100%', cursor: isPng ? 'not-allowed' : 'pointer' }}
        />
      </div>

      {/* 最大边长 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label style={labelStyle}>最大边长（px）</label>
          <span style={valueStyle}>{value.maxDim}</span>
        </div>
        <input
          type="range"
          min={128}
          max={4096}
          step={32}
          value={value.maxDim}
          onChange={(e) => onChange({ ...value, maxDim: Number(e.target.value) })}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          较长边按此值等比缩放；原图较小则保持原尺寸不放大
        </div>
      </div>
    </div>
  )
}
