import { useMemo, useState } from 'react'
import type { CurlCommand } from '../../lib/curl/parser'
import { generateCurlString } from '../../lib/curl/generators'

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
const BODY_TYPES: Array<CurlCommand['body']['type']> = ['none', 'json', 'urlencoded', 'form', 'raw']

/** 表单 header 行结构 */
interface HeaderRow {
  key: string
  value: string
}

interface Props {
  /** 用户点击"应用到左侧"时回调 */
  onApply?: (curlString: string) => void
}

/**
 * 反向构建器：表单 → cURL 字符串
 * 不持久化，仅本地 state；点击"复制"或"应用"后传递结果
 */
export default function CurlBuilder({ onApply }: Props) {
  const [method, setMethod] = useState<string>('GET')
  const [url, setUrl] = useState<string>('https://api.example.com/path')
  const [headers, setHeaders] = useState<HeaderRow[]>([
    { key: 'Content-Type', value: 'application/json' },
  ])
  const [bodyType, setBodyType] = useState<CurlCommand['body']['type']>('none')
  const [body, setBody] = useState<string>('')
  const [authUser, setAuthUser] = useState('')
  const [authPwd, setAuthPwd] = useState('')

  /** 实时聚合为 CurlCommand 并生成 cURL 字符串 */
  const curlString = useMemo(() => {
    // 把表单 header 行收成字典（忽略空 key）
    const headerMap: Record<string, string> = {}
    for (const r of headers) {
      if (r.key.trim()) headerMap[r.key.trim()] = r.value
    }
    const cmd: CurlCommand = {
      method: method || 'GET',
      url,
      query: {},
      headers: headerMap,
      body: { type: bodyType, content: body },
      auth: authUser ? { type: 'basic', user: authUser, password: authPwd } : undefined,
      cookies: {},
    }
    try {
      return generateCurlString(cmd)
    } catch (e) {
      // 输出空安全：异常时返回错误注释
      return `# 生成失败：${e instanceof Error ? e.message : String(e)}`
    }
  }, [method, url, headers, bodyType, body, authUser, authPwd])

  const updateHeader = (idx: number, patch: Partial<HeaderRow>) => {
    setHeaders((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  const addHeader = () => setHeaders((rows) => [...rows, { key: '', value: '' }])
  const removeHeader = (idx: number) =>
    setHeaders((rows) => rows.filter((_, i) => i !== idx))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select
          className="theme-select"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          style={{ width: '120px' }}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="theme-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/api"
          style={{ flex: 1 }}
        />
      </div>

      {/* Headers 表格 */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Headers
          </span>
          <button className="theme-btn" onClick={addHeader} style={{ padding: '2px 10px', fontSize: '12px' }}>
            + 添加
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {headers.length === 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>暂无 Header</span>
          )}
          {headers.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px' }}>
              <input
                className="theme-input"
                value={row.key}
                onChange={(e) => updateHeader(idx, { key: e.target.value })}
                placeholder="Key"
                style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' }}
              />
              <input
                className="theme-input"
                value={row.value}
                onChange={(e) => updateHeader(idx, { value: e.target.value })}
                placeholder="Value"
                style={{ flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' }}
              />
              <button
                className="theme-btn"
                onClick={() => removeHeader(idx)}
                style={{ padding: '2px 10px', fontSize: '12px', color: '#ef4444' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Body
          </span>
          <select
            className="theme-select"
            value={bodyType}
            onChange={(e) => setBodyType(e.target.value as CurlCommand['body']['type'])}
            style={{ padding: '4px 28px 4px 8px', fontSize: '12px' }}
          >
            {BODY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {bodyType !== 'none' && (
          <textarea
            className="theme-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              bodyType === 'json'
                ? '{"key":"value"}'
                : bodyType === 'urlencoded'
                  ? 'a=1&b=2'
                  : '原始内容...'
            }
            style={{
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12.5px',
            }}
            spellCheck={false}
          />
        )}
      </div>

      {/* Basic Auth */}
      <div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>
          Basic Auth（可选）
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            className="theme-input"
            value={authUser}
            onChange={(e) => setAuthUser(e.target.value)}
            placeholder="user"
            style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' }}
          />
          <input
            className="theme-input"
            type="password"
            value={authPwd}
            onChange={(e) => setAuthPwd(e.target.value)}
            placeholder="password"
            style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px' }}
          />
        </div>
      </div>

      {/* 输出预览 */}
      <div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>
          生成的 cURL
        </div>
        <pre
          style={{
            margin: 0,
            padding: '10px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12.5px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: 'var(--text-primary)',
            maxHeight: '160px',
            overflow: 'auto',
          }}
        >
          {curlString}
        </pre>
        {onApply && (
          <button
            className="theme-btn theme-btn-primary"
            onClick={() => onApply(curlString)}
            style={{ marginTop: '8px', padding: '6px 16px', fontSize: '12px' }}
          >
            应用到左侧输入
          </button>
        )}
      </div>
    </div>
  )
}
