import { CHARSET_PRESETS } from '../../lib/id/generators'

/**
 * ID 类型 → 参数表单（受控组件）
 */

export type IdKindKey = 'uuid-v1' | 'uuid-v4' | 'uuid-v7' | 'nanoid' | 'snowflake' | 'ulid' | 'random'

export interface IdControlsState {
  // NanoID
  nanoidLength: number
  nanoidAlphabet: string
  // Snowflake
  workerId: number
  datacenterId: number
  epoch: number
  // 随机串
  randomLength: number
  randomCharset: string
}

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_CONTROLS: IdControlsState = {
  nanoidLength: 21,
  nanoidAlphabet: '',
  workerId: 1,
  datacenterId: 1,
  epoch: 1288834974657,
  randomLength: 16,
  randomCharset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
}

interface Props {
  kind: IdKindKey
  state: IdControlsState
  onChange: (next: IdControlsState) => void
}

/**
 * 通用数字输入：受控、限定范围
 *
 * 布局策略：
 * - flex: 1 1 200px → 同行内三个输入等宽撑开，不会因为某些项有 hint 而高度不一
 * - hint 用固定行高的占位区域（即使没 hint 也保留 14px 高度），确保 input 底边对齐
 */
function NumberInput(props: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  label: string
  hint?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px', minWidth: '160px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{props.label}</span>
      <input
        type="number"
        className="theme-input"
        value={Number.isFinite(props.value) ? props.value : ''}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) props.onChange(n)
        }}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      />
      {/* 占位高度恒定 14px，无论有无 hint，保证多个 NumberInput 同行底边严格对齐 */}
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          minHeight: '14px',
          lineHeight: '14px',
        }}
      >
        {props.hint ?? ''}
      </span>
    </label>
  )
}

export default function IdControls({ kind, state, onChange }: Props) {
  // 工具函数：派生更新
  const patch = (p: Partial<IdControlsState>) => onChange({ ...state, ...p })

  if (kind === 'nanoid') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        <NumberInput
          label="长度"
          value={state.nanoidLength}
          min={1}
          max={256}
          onChange={(n) => patch({ nanoidLength: Math.max(1, Math.min(256, Math.floor(n))) })}
        />
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '2 1 280px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            自定义字符集（留空使用默认 URL-safe）
          </span>
          <input
            className="theme-input"
            value={state.nanoidAlphabet}
            onChange={(e) => patch({ nanoidAlphabet: e.target.value })}
            placeholder="如 0123456789ABCDEF"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
            {CHARSET_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => patch({ nanoidAlphabet: p.value })}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'var(--border-width) solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </label>
      </div>
    )
  }

  if (kind === 'snowflake') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>
        <NumberInput
          label="Worker ID (0-31)"
          value={state.workerId}
          min={0}
          max={31}
          onChange={(n) => patch({ workerId: Math.max(0, Math.min(31, Math.floor(n))) })}
        />
        <NumberInput
          label="Datacenter ID (0-31)"
          value={state.datacenterId}
          min={0}
          max={31}
          onChange={(n) => patch({ datacenterId: Math.max(0, Math.min(31, Math.floor(n))) })}
        />
        <NumberInput
          label="Epoch (毫秒)"
          value={state.epoch}
          min={0}
          onChange={(n) => patch({ epoch: Math.max(0, Math.floor(n)) })}
          hint="默认 Twitter 1288834974657"
        />
      </div>
    )
  }

  if (kind === 'random') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        <NumberInput
          label="长度"
          value={state.randomLength}
          min={1}
          max={4096}
          onChange={(n) => patch({ randomLength: Math.max(1, Math.min(4096, Math.floor(n))) })}
        />
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '2 1 280px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>字符集</span>
          <input
            className="theme-input"
            value={state.randomCharset}
            onChange={(e) => patch({ randomCharset: e.target.value })}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
            {CHARSET_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => patch({ randomCharset: p.value })}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'var(--border-width) solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </label>
      </div>
    )
  }

  // UUID v1 / v4 / v7 / ULID 无额外参数
  return (
    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
      此类型无额外参数，直接生成。
    </div>
  )
}
