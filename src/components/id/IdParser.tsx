import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  detectIdKind,
  parseSnowflake,
  parseUlid,
  parseUuid,
} from '../../lib/id/parsers'
import { DEFAULT_SNOWFLAKE_EPOCH } from '../../lib/id/generators'

/**
 * ID 反解析输入框
 * - 粘贴/输入后自动识别类型
 * - 显示版本、时间戳（人类可读）、workerId 等
 */

function fmtTs(ts: number | undefined): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '-'
  try {
    return format(new Date(ts), 'yyyy-MM-dd HH:mm:ss.SSS')
  } catch {
    return String(ts)
  }
}

interface RowProps {
  label: string
  value: string
  mono?: boolean
}
function Row({ label, value, mono }: RowProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '6px 0',
        borderBottom: '1px dashed var(--border-color)',
        fontSize: '13px',
      }}
    >
      <span style={{ color: 'var(--text-muted)', minWidth: '110px' }}>{label}</span>
      <span
        style={{
          color: 'var(--text-primary)',
          fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export default function IdParser() {
  const [input, setInput] = useState('')
  const [epoch, setEpoch] = useState<number>(DEFAULT_SNOWFLAKE_EPOCH)

  const kind = useMemo(() => detectIdKind(input), [input])

  const result = useMemo(() => {
    if (!input.trim()) return null
    if (kind === 'uuid') return { type: 'uuid' as const, data: parseUuid(input) }
    if (kind === 'ulid') return { type: 'ulid' as const, data: parseUlid(input) }
    if (kind === 'snowflake')
      return { type: 'snowflake' as const, data: parseSnowflake(input, { epoch }) }
    return { type: 'unknown' as const }
  }, [input, kind, epoch])

  return (
    <section className="theme-card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <h2 className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          反解析
        </h2>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          粘贴 UUID / ULID / Snowflake，自动识别
        </span>
      </div>

      <textarea
        className="theme-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="例如：01HABC...（ULID） / 6ba7b810-9dad-11d1-80b4-00c04fd430c8（UUID v1）"
        rows={2}
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '14px',
          resize: 'vertical',
          minHeight: '60px',
        }}
      />

      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            border: 'var(--border-width) solid var(--border-color)',
          }}
        >
          识别：{kind}
        </span>
        {kind === 'snowflake' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Epoch
            <input
              type="number"
              className="theme-input"
              value={epoch}
              onChange={(e) => setEpoch(Number(e.target.value) || 0)}
              style={{ width: '180px', padding: '4px 8px', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" }}
            />
          </label>
        )}
      </div>

      {result && result.type === 'uuid' && (
        <div style={{ marginTop: '12px' }}>
          {result.data.valid ? (
            <>
              <Row label="版本" value={`v${result.data.version}`} />
              <Row label="变体" value={result.data.variant ?? '-'} />
              <Row label="时间戳" value={fmtTs(result.data.timestamp)} mono />
              <Row label="原始值" value={result.data.raw} mono />
            </>
          ) : (
            <ErrorBox message={result.data.error ?? '解析失败'} />
          )}
        </div>
      )}

      {result && result.type === 'ulid' && (
        <div style={{ marginTop: '12px' }}>
          {result.data.valid ? (
            <>
              <Row label="时间戳" value={fmtTs(result.data.timestamp)} mono />
              <Row label="时间戳(ms)" value={String(result.data.timestamp)} mono />
              <Row label="随机部分" value={result.data.randomness ?? '-'} mono />
              <Row label="原始值" value={result.data.raw} mono />
            </>
          ) : (
            <ErrorBox message={result.data.error ?? '解析失败'} />
          )}
        </div>
      )}

      {result && result.type === 'snowflake' && (
        <div style={{ marginTop: '12px' }}>
          {result.data.valid ? (
            <>
              <Row label="时间戳" value={fmtTs(result.data.timestamp)} mono />
              <Row label="时间戳(ms)" value={String(result.data.timestamp)} mono />
              <Row label="数据中心 ID" value={String(result.data.datacenterId)} mono />
              <Row label="Worker ID" value={String(result.data.workerId)} mono />
              <Row label="序列号" value={String(result.data.sequence)} mono />
              <Row label="原始值" value={result.data.raw} mono />
            </>
          ) : (
            <ErrorBox message={result.data.error ?? '解析失败'} />
          )}
        </div>
      )}

      {result && result.type === 'unknown' && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#eab308',
            fontSize: '13px',
          }}
        >
          无法识别类型：请确认是 UUID / ULID / Snowflake
        </div>
      )}
    </section>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 'var(--radius-sm)',
        color: '#ef4444',
        fontSize: '13px',
      }}
    >
      解析失败：{message}
    </div>
  )
}
