import { useEffect, useMemo, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import { toast } from '../stores/toastStore'

/**
 * 时间戳转换工具
 * - Unix 时间戳（秒/毫秒）↔ 日期时间双向转换
 * - 当前时间实时刷新
 * - 多时区显示
 * - 相对时间（多久之前/之后）
 */

type Unit = 's' | 'ms'

/**
 * 自动识别时间戳单位
 * - 阈值 1e11 = 1973-03-03 09:46:40 (秒)
 * - 该阈值之下当作秒（1970~5138 年），之上当作毫秒（1973~2286 年）
 * - 几乎覆盖所有真实业务场景，且不会把 0/小数字识别错
 */
function detectUnit(value: string): Unit | null {
  const trimmed = value.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  return Math.abs(n) >= 1e11 ? 'ms' : 's'
}

const COMMON_TZS = [
  { label: 'UTC (+00:00)', offset: 0 },
  { label: '北京 / 上海 (+08:00)', offset: 8 },
  { label: '东京 (+09:00)', offset: 9 },
  { label: '纽约 (-05:00)', offset: -5 },
  { label: '伦敦 (+00:00 / +01:00)', offset: 0, dst: true },
  { label: '洛杉矶 (-08:00)', offset: -8 },
]

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, '0')
}

/** 把 Date 按照固定时区偏移（小时）格式化为 YYYY-MM-DD HH:mm:ss */
function formatInOffset(date: Date, offsetHours: number): string {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000
  const local = new Date(utcMs + offsetHours * 60 * 60 * 1000)
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`
}

/** 解析用户输入的日期字符串（支持多种格式） */
function parseDateInput(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // 兼容 "2024-01-01 12:00:00" 和 ISO 格式
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : trimmed
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatRelative(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime()
  const abs = Math.abs(diffMs)
  const future = diffMs >= 0

  const sec = 1000
  const min = 60 * sec
  const hour = 60 * min
  const day = 24 * hour

  let text: string
  if (abs < min) text = `${Math.round(abs / sec)} 秒`
  else if (abs < hour) text = `${Math.round(abs / min)} 分钟`
  else if (abs < day) text = `${Math.round(abs / hour)} 小时`
  else if (abs < 30 * day) text = `${Math.round(abs / day)} 天`
  else if (abs < 365 * day) text = `${Math.round(abs / (30 * day))} 个月`
  else text = `${(abs / (365 * day)).toFixed(1)} 年`

  return future ? `${text}后` : `${text}前`
}

export default function TimestampPage() {
  const [now, setNow] = useState(() => new Date())
  const [tsInput, setTsInput] = useState(() => Math.floor(Date.now() / 1000).toString())
  const [tsUnit, setTsUnit] = useState<Unit>('s')
  const [dateInput, setDateInput] = useState(() => formatInOffset(new Date(), -new Date().getTimezoneOffset() / 60))

  // 实时刷新「当前时间」
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // 自动识别：输入变化时根据数值大小切换秒/毫秒
  // 用户仍可手动修改下拉框，下次输入变化时会被重新识别覆盖
  useEffect(() => {
    const detected = detectUnit(tsInput)
    if (detected && detected !== tsUnit) {
      setTsUnit(detected)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tsInput])

  // 时间戳 → 日期
  const timestampParse = useMemo(() => {
    const trimmed = tsInput.trim()
    if (!trimmed) return null
    if (!/^-?\d+$/.test(trimmed)) return { error: '请输入纯数字时间戳' }
    const n = Number(trimmed)
    if (!Number.isFinite(n)) return { error: '数字超出范围' }
    const ms = tsUnit === 's' ? n * 1000 : n
    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) return { error: '无效时间戳' }
    return { date }
  }, [tsInput, tsUnit])

  // 日期 → 时间戳
  const dateParse = useMemo(() => {
    const date = parseDateInput(dateInput)
    if (!date) return { error: '无效日期格式（例：2024-01-01 12:00:00）' }
    return { date }
  }, [dateInput])

  const localOffsetHours = -now.getTimezoneOffset() / 60

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  const useNow = () => {
    setTsInput(tsUnit === 's' ? Math.floor(Date.now() / 1000).toString() : Date.now().toString())
    setDateInput(formatInOffset(new Date(), localOffsetHours))
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>时间戳转换</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          Unix 时间戳 ↔ 日期时间，支持多时区与相对时间
        </p>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 16px 32px' }}>
        {/* 当前时间面板 */}
        <section
          className="theme-card"
          style={{ padding: '20px 24px', marginBottom: '24px' }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '24px' }}>
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>当前时间</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', marginTop: '4px' }}>
                {formatInOffset(now, localOffsetHours)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>秒级时间戳</div>
              <button
                className="theme-btn"
                style={{ marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}
                onClick={() => copy(Math.floor(now.getTime() / 1000).toString())}
              >
                {Math.floor(now.getTime() / 1000)}
              </button>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>毫秒级时间戳</div>
              <button
                className="theme-btn"
                style={{ marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}
                onClick={() => copy(now.getTime().toString())}
              >
                {now.getTime()}
              </button>
            </div>
            <button className="theme-btn theme-btn-primary" style={{ marginLeft: 'auto' }} onClick={useNow}>
              填入当前时间
            </button>
          </div>
        </section>

        {/* 双向转换 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {/* 左：时间戳 → 日期 */}
          <section className="theme-card" style={{ padding: '20px 24px' }}>
            <h2 className="font-semibold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
              时间戳 → 日期
            </h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                className="theme-input"
                value={tsInput}
                onChange={(e) => setTsInput(e.target.value)}
                placeholder="例如 1700000000"
                style={{ fontFamily: "'JetBrains Mono', monospace", flex: 1 }}
              />
              <select
                className="theme-input"
                style={{ width: '90px', flex: 'none' }}
                value={tsUnit}
                onChange={(e) => setTsUnit(e.target.value as Unit)}
                title="自动识别单位，可手动覆盖"
              >
                <option value="s">秒</option>
                <option value="ms">毫秒</option>
              </select>
            </div>
            {timestampParse?.error && (
              <div style={{ color: '#ef4444', fontSize: '13px' }}>{timestampParse.error}</div>
            )}
            {timestampParse?.date && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Row label="本地时间" value={formatInOffset(timestampParse.date, localOffsetHours)} onCopy={copy} />
                <Row label="ISO 8601" value={timestampParse.date.toISOString()} onCopy={copy} />
                <Row label="相对时间" value={formatRelative(timestampParse.date, now)} />
                <details style={{ marginTop: '4px' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    多时区显示
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    {COMMON_TZS.map((tz) => (
                      <Row key={tz.label} label={tz.label} value={formatInOffset(timestampParse.date!, tz.offset)} onCopy={copy} />
                    ))}
                  </div>
                </details>
              </div>
            )}
          </section>

          {/* 右：日期 → 时间戳 */}
          <section className="theme-card" style={{ padding: '20px 24px' }}>
            <h2 className="font-semibold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
              日期 → 时间戳
            </h2>
            <input
              className="theme-input"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              placeholder="2024-01-01 12:00:00"
              style={{ fontFamily: "'JetBrains Mono', monospace", marginBottom: '12px' }}
            />
            {dateParse?.error && (
              <div style={{ color: '#ef4444', fontSize: '13px' }}>{dateParse.error}</div>
            )}
            {dateParse?.date && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Row label="秒级" value={Math.floor(dateParse.date.getTime() / 1000).toString()} onCopy={copy} />
                <Row label="毫秒级" value={dateParse.date.getTime().toString()} onCopy={copy} />
                <Row label="ISO 8601" value={dateParse.date.toISOString()} onCopy={copy} />
                <Row label="相对时间" value={formatRelative(dateParse.date, now)} />
              </div>
            )}
          </section>
        </div>

        {/* 速查表 */}
        <section className="theme-card" style={{ padding: '20px 24px' }}>
          <h2 className="font-semibold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>常用换算</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <div>1 分钟 = 60 秒</div>
            <div>1 小时 = 3,600 秒</div>
            <div>1 天 = 86,400 秒</div>
            <div>1 周 = 604,800 秒</div>
            <div>1 月（30天）= 2,592,000 秒</div>
            <div>1 年（365天）= 31,536,000 秒</div>
          </div>
        </section>
      </main>
    </div>
  )
}

/** 标签 + 值 + 复制按钮的一行 */
function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '88px', flex: 'none' }}>{label}</span>
      <code style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', wordBreak: 'break-all' }}>
        {value}
      </code>
      {onCopy && (
        <button
          className="theme-btn"
          style={{ padding: '4px 10px', fontSize: '12px', flex: 'none' }}
          onClick={() => onCopy(value)}
          title="复制"
        >
          复制
        </button>
      )}
    </div>
  )
}
