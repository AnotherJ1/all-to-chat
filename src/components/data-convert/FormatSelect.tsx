/**
 * 数据格式下拉选择器（6 选 1）
 *
 * 与项目主题 CSS 变量风格一致
 */

import type { DataFormat } from '../../lib/data-convert/types'
import { ALL_FORMATS, FORMAT_LABELS } from '../../lib/data-convert/types'

export interface FormatSelectProps {
  /** 当前选中的格式 */
  value: DataFormat
  /** 变更回调 */
  onChange: (v: DataFormat) => void
  /** 可选的 aria-label */
  ariaLabel?: string
  /** 可选 className */
  className?: string
}

export default function FormatSelect({ value, onChange, ariaLabel, className }: FormatSelectProps) {
  return (
    <select
      className={`theme-input ${className ?? ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value as DataFormat)}
      aria-label={ariaLabel}
      style={{ padding: '6px 10px', minWidth: '110px', fontSize: '14px' }}
    >
      {ALL_FORMATS.map((f) => (
        <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
      ))}
    </select>
  )
}
