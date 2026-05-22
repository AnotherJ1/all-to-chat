import { useMemo } from 'react'
import type { RGB } from '../../lib/color/convert'
import { rgbToHex } from '../../lib/color/convert'
import { evaluateContrast, ratioGrade } from '../../lib/color/contrast'

/**
 * 对比度面板
 * - 实时计算前景/背景两色的 WCAG 对比度
 * - 显示等级徽章 AA / AAA / AA Large / Fail
 * - 提供文本/UI 组件示例
 */

interface Props {
  fg: RGB
  bg: RGB
}

export default function ContrastPanel({ fg, bg }: Props) {
  const verdict = useMemo(() => evaluateContrast(fg, bg), [fg, bg])
  const grade = ratioGrade(verdict.ratio)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 比值与总评 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '40px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
          {verdict.ratio.toFixed(2)}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>对比度 (1:1 ~ 21:1)</div>
        <GradeBadge grade={grade} />
      </div>

      {/* 各等级判定 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
        <Cell label="普通文本 AA" pass={verdict.aaNormal} threshold="≥ 4.5" />
        <Cell label="普通文本 AAA" pass={verdict.aaaNormal} threshold="≥ 7" />
        <Cell label="大文本 AA" pass={verdict.aaLarge} threshold="≥ 3" />
        <Cell label="大文本 AAA" pass={verdict.aaaLarge} threshold="≥ 4.5" />
        <Cell label="UI 组件 AA" pass={verdict.uiComponent} threshold="≥ 3" />
      </div>

      {/* 文本预览 */}
      <div
        style={{
          background: rgbToHex(bg),
          color: rgbToHex(fg),
          padding: '20px',
          borderRadius: 'var(--radius-sm)',
          border: 'var(--border-width) solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '24px', fontWeight: 700 }}>大标题示例 Large Heading</div>
        <div style={{ fontSize: '14px' }}>
          这是一段普通的正文示例。The quick brown fox jumps over the lazy dog.
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>辅助说明文本 / Secondary caption</div>
      </div>
    </div>
  )
}

function GradeBadge({ grade }: { grade: 'AAA' | 'AA' | 'AA Large' | 'Fail' }) {
  const map: Record<typeof grade, { bg: string; fg: string }> = {
    AAA: { bg: '#16a34a', fg: '#fff' },
    AA: { bg: '#2563eb', fg: '#fff' },
    'AA Large': { bg: '#f59e0b', fg: '#1a1a1a' },
    Fail: { bg: '#dc2626', fg: '#fff' },
  }
  const c = map[grade]
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        padding: '4px 12px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.05em',
      }}
    >
      {grade}
    </span>
  )
}

function Cell({ label, pass, threshold }: { label: string; pass: boolean; threshold: string }) {
  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <span
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: pass ? '#16a34a' : '#dc2626',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          flex: 'none',
        }}
        aria-label={pass ? '通过' : '未通过'}
      >
        {pass ? '✓' : '✕'}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>阈值 {threshold}</span>
      </div>
    </div>
  )
}
