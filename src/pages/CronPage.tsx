import { useEffect, useMemo, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import { CRON_PRESETS, parseCron } from '../lib/cron-parser'
import { toast } from '../stores/toastStore'

/**
 * Cron 表达式可视化工具
 * - 支持 5 段（分 时 日 月 周）和 6 段（秒 分 时 日 月 周）
 * - 实时解析、人类可读描述、未来 N 次执行时间预览
 * - 内置常用表达式速查
 */

const FIELD_LABELS_5 = ['分钟', '小时', '日', '月', '星期']
const FIELD_LABELS_6 = ['秒', '分钟', '小时', '日', '月', '星期']

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatRelative(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return '已过去'
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `${sec} 秒后`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟后`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时${min % 60 ? ` ${min % 60} 分钟` : ''}后`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天后`
  const month = Math.floor(day / 30)
  return `约 ${month} 个月后`
}

export default function CronPage() {
  const [expression, setExpression] = useState('0 9 * * 1-5')
  const [runCount, setRunCount] = useState(8)

  // 每秒刷新当前时间，保证「X 分钟后」相对时间持续准确
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const result = useMemo(() => parseCron(expression, runCount, now), [expression, runCount, now])

  const fieldLabels = expression.trim().split(/\s+/).length === 6 ? FIELD_LABELS_6 : FIELD_LABELS_5
  const parts = expression.trim().split(/\s+/)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>Cron 表达式可视化</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          解析定时表达式 → 查看下次执行时间
        </p>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 表达式输入 */}
        <section className="theme-card" style={{ padding: '20px 24px' }}>
          <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
            Cron 表达式
          </label>
          <input
            className="theme-input"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="例如：0 9 * * 1-5（工作日 9 点）"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '15px' }}
          />

          {/* 字段拆解 */}
          {parts.length === 5 || parts.length === 6 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {parts.map((p, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    border: 'var(--border-width) solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    minWidth: '90px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {fieldLabels[i]}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', marginTop: '2px' }}>
                    {p}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <button className="theme-btn" onClick={() => copy(expression)} disabled={!expression}>
              复制表达式
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '8px' }}>
              支持 * / , - 通配符；? 视作 *
            </span>
          </div>
        </section>

        {/* 解析结果 */}
        {result.valid ? (
          <section className="theme-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <h2 className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                自然语言描述
              </h2>
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  background: 'color-mix(in srgb, var(--color-success) 18%, transparent)',
                  color: 'var(--color-success)',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                有效
              </span>
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>
              {result.description}
            </div>

            {/* 字段细节 */}
            {result.fields && (
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  字段细节
                </summary>
                <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {result.fields.second && (
                    <div>秒：{result.fields.second.description}（{result.fields.second.values.length} 个值）</div>
                  )}
                  <div>分：{result.fields.minute.description}（{result.fields.minute.values.length} 个值）</div>
                  <div>时：{result.fields.hour.description}（{result.fields.hour.values.length} 个值）</div>
                  <div>日：{result.fields.dayOfMonth.description}（{result.fields.dayOfMonth.values.length} 个值）</div>
                  <div>月：{result.fields.month.description}（{result.fields.month.values.length} 个值）</div>
                  <div>周：{result.fields.dayOfWeek.description}（{result.fields.dayOfWeek.values.length} 个值）</div>
                </div>
              </details>
            )}
          </section>
        ) : (
          <section
            style={{
              padding: '14px 18px',
              background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-danger)',
              fontSize: '14px',
            }}
          >
            <strong>解析失败：</strong>{result.error}
          </section>
        )}

        {/* 下次执行时间 */}
        {result.valid && result.nextRuns && (
          <section className="theme-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
              <h2 className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                未来 {result.nextRuns.length} 次执行时间
              </h2>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>显示</span>
                <select
                  className="theme-input"
                  style={{ width: '70px', padding: '6px 10px', fontSize: '13px' }}
                  value={runCount}
                  onChange={(e) => setRunCount(Number(e.target.value))}
                >
                  {[5, 8, 12, 20, 50].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>次</span>
              </div>
            </div>

            {result.nextRuns.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                未来 4 年内无匹配时间（请检查表达式）
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {result.nextRuns.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: i === 0 ? 'color-mix(in srgb, var(--accent-1) 10%, transparent)' : 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      border: 'var(--border-width) solid var(--border-color)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '24px' }}>
                      #{i + 1}
                    </span>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', flex: 1 }}>
                      {formatDate(d)}
                    </code>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {formatRelative(d, now)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 常用预设 */}
        <section className="theme-card" style={{ padding: '20px 24px' }}>
          <h2 className="font-semibold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>常用表达式</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.expression}
                className="theme-btn"
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                onClick={() => setExpression(preset.expression)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', width: '100%' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{preset.label}</span>
                  <code style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {preset.expression}
                  </code>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
