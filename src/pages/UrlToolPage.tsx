import { useMemo, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import { toast } from '../stores/toastStore'

/**
 * URL 工具页：编解码 + Query 解析编辑
 */

type Mode = 'encode' | 'decode' | 'parse'

interface QueryItem {
  key: string
  value: string
}

interface ParsedUrl {
  protocol: string
  host: string
  pathname: string
  hash: string
  query: QueryItem[]
}

function parseUrl(input: string): ParsedUrl | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    // 兼容只输入 query 的情况
    const target = /^https?:\/\//i.test(trimmed) ? trimmed : `http://placeholder.local${trimmed.startsWith('?') ? trimmed : '?' + trimmed}`
    const u = new URL(target)
    const items: QueryItem[] = []
    u.searchParams.forEach((v, k) => items.push({ key: k, value: v }))
    return {
      protocol: u.protocol,
      host: u.host,
      pathname: u.pathname,
      hash: u.hash,
      query: items,
    }
  } catch {
    return null
  }
}

function buildUrl(parsed: ParsedUrl): string {
  const params = new URLSearchParams()
  for (const { key, value } of parsed.query) {
    if (key) params.append(key, value)
  }
  const qs = params.toString()
  const isPlaceholder = parsed.host === 'placeholder.local'
  if (isPlaceholder) {
    return qs ? `?${qs}` : ''
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}${qs ? '?' + qs : ''}${parsed.hash}`
}

export default function UrlToolPage() {
  const [mode, setMode] = useState<Mode>('parse')

  // 编码/解码模式
  const [text, setText] = useState('')
  const [encodeComponent, setEncodeComponent] = useState(true)

  const codecResult = useMemo(() => {
    if (!text) return ''
    try {
      if (mode === 'encode') {
        return encodeComponent ? encodeURIComponent(text) : encodeURI(text)
      }
      if (mode === 'decode') {
        return encodeComponent ? decodeURIComponent(text) : decodeURI(text)
      }
      return ''
    } catch (e) {
      return `错误: ${e instanceof Error ? e.message : String(e)}`
    }
  }, [text, mode, encodeComponent])

  // 解析模式
  const [urlInput, setUrlInput] = useState('')
  const [parsed, setParsed] = useState<ParsedUrl | null>(null)
  const [parseError, setParseError] = useState('')

  const handleParse = () => {
    if (!urlInput.trim()) {
      setParsed(null)
      setParseError('')
      return
    }
    const result = parseUrl(urlInput)
    if (result) {
      setParsed(result)
      setParseError('')
    } else {
      setParsed(null)
      setParseError('无法解析为合法 URL')
    }
  }

  const updateQuery = (next: QueryItem[]) => {
    if (!parsed) return
    const updated = { ...parsed, query: next }
    setParsed(updated)
    setUrlInput(buildUrl(updated))
  }

  const copy = async (value: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success('已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>URL 工具</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          URL 编解码 + Query 参数可视化解析
        </p>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 16px 32px' }}>
        {/* 模式切换 Tab */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(
            [
              { id: 'parse', label: 'URL 解析' },
              { id: 'encode', label: '编码' },
              { id: 'decode', label: '解码' },
            ] as Array<{ id: Mode; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              className={`theme-btn ${mode === tab.id ? 'theme-btn-primary' : ''}`}
              onClick={() => setMode(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode !== 'parse' && (
          <section className="theme-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                输入文本
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={encodeComponent}
                  onChange={(e) => setEncodeComponent(e.target.checked)}
                />
                Component 模式（保留 / : 等保留字符不编码 → 否）
              </label>
            </div>
            <textarea
              className="theme-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === 'encode' ? '需要编码的文本...' : '需要解码的文本...'}
              style={{ minHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '13px', resize: 'vertical' }}
              spellCheck={false}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 8px' }}>
              <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>结果</label>
              <button
                className="theme-btn"
                style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '12px' }}
                onClick={() => copy(codecResult)}
                disabled={!codecResult}
              >
                复制
              </button>
              <button
                className="theme-btn"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => { setText(codecResult); }}
                disabled={!codecResult || codecResult.startsWith('错误')}
              >
                结果替换输入
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: '14px',
                minHeight: '120px',
                background: 'var(--bg-secondary)',
                border: 'var(--border-width) solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: codecResult.startsWith('错误') ? 'var(--color-danger)' : 'var(--text-primary)',
              }}
            >
              {codecResult || <span style={{ color: 'var(--text-muted)' }}>输出将显示在这里...</span>}
            </pre>
          </section>
        )}

        {mode === 'parse' && (
          <section className="theme-card" style={{ padding: '20px 24px' }}>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>URL 输入</label>
            <textarea
              className="theme-input"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onBlur={handleParse}
              placeholder="https://example.com/path?foo=bar&baz=qux"
              style={{ minHeight: '90px', fontFamily: 'var(--font-mono)', fontSize: '13px', resize: 'vertical' }}
              spellCheck={false}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button className="theme-btn theme-btn-primary" onClick={handleParse}>
                解析
              </button>
              <button
                className="theme-btn"
                onClick={() => copy(urlInput)}
                disabled={!urlInput}
              >
                复制 URL
              </button>
              <button
                className="theme-btn"
                onClick={() => { setUrlInput(''); setParsed(null); setParseError('') }}
              >
                清空
              </button>
            </div>

            {parseError && (
              <div style={{ marginTop: '12px', color: 'var(--color-danger)', fontSize: '13px' }}>{parseError}</div>
            )}

            {parsed && (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* URL 各部分 */}
                <div>
                  <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>URL 组成</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px 16px' }}>
                    {parsed.host !== 'placeholder.local' && (
                      <>
                        <UrlPart label="协议" value={parsed.protocol} />
                        <UrlPart label="主机" value={parsed.host} />
                        <UrlPart label="路径" value={parsed.pathname} />
                        <UrlPart label="Hash" value={parsed.hash || '(空)'} />
                      </>
                    )}
                  </div>
                </div>

                {/* Query 参数表 */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Query 参数（{parsed.query.length}）
                    </div>
                    <button
                      className="theme-btn"
                      style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => updateQuery([...parsed.query, { key: '', value: '' }])}
                    >
                      + 新增
                    </button>
                  </div>

                  {parsed.query.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      无 Query 参数
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {parsed.query.map((item, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(180px, 2fr) auto', gap: '8px' }}>
                          <input
                            className="theme-input"
                            value={item.key}
                            placeholder="key"
                            onChange={(e) => {
                              const next = [...parsed.query]
                              next[idx] = { ...next[idx], key: e.target.value }
                              updateQuery(next)
                            }}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '8px 12px' }}
                          />
                          <input
                            className="theme-input"
                            value={item.value}
                            placeholder="value"
                            onChange={(e) => {
                              const next = [...parsed.query]
                              next[idx] = { ...next[idx], value: e.target.value }
                              updateQuery(next)
                            }}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '8px 12px' }}
                          />
                          <button
                            className="theme-btn"
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                            onClick={() => {
                              const next = parsed.query.filter((_, i) => i !== idx)
                              updateQuery(next)
                            }}
                          >
                            删除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

function UrlPart({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '48px' }}>{label}</span>
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', wordBreak: 'break-all' }}>{value}</code>
    </div>
  )
}
