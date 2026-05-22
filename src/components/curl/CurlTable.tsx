import type { CurlCommand } from '../../lib/curl/parser'

/**
 * 表格化展示一个解析后的 cURL 命令
 * 字段：method/url/query/headers/body/auth/cookies
 */
export default function CurlTable({ cmd }: { cmd: CurlCommand }) {
  const rowStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--border-color)',
    verticalAlign: 'top',
  }
  const labelStyle: React.CSSProperties = {
    width: '100px',
    padding: '8px 12px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 500,
  }
  const valueStyle: React.CSSProperties = {
    padding: '8px 12px',
    color: 'var(--text-primary)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12.5px',
    lineHeight: 1.6,
    wordBreak: 'break-all',
  }

  const renderKv = (obj: Record<string, string>) => {
    const keys = Object.keys(obj)
    if (keys.length === 0) {
      return <span style={{ color: 'var(--text-muted)' }}>—</span>
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {keys.map((k) => (
          <div key={k}>
            <span style={{ color: 'var(--accent-1)' }}>{k}</span>
            <span style={{ color: 'var(--text-muted)' }}>: </span>
            <span>{obj[k]}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <tbody>
          <tr style={rowStyle}>
            <td style={labelStyle}>Method</td>
            <td style={valueStyle}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(99,102,241,0.1)',
                  color: 'var(--accent-1)',
                  fontWeight: 600,
                }}
              >
                {cmd.method}
              </span>
            </td>
          </tr>
          <tr style={rowStyle}>
            <td style={labelStyle}>URL</td>
            <td style={valueStyle}>{cmd.url || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
          </tr>
          <tr style={rowStyle}>
            <td style={labelStyle}>Query</td>
            <td style={valueStyle}>{renderKv(cmd.query)}</td>
          </tr>
          <tr style={rowStyle}>
            <td style={labelStyle}>Headers</td>
            <td style={valueStyle}>{renderKv(cmd.headers)}</td>
          </tr>
          <tr style={rowStyle}>
            <td style={labelStyle}>Cookies</td>
            <td style={valueStyle}>{renderKv(cmd.cookies)}</td>
          </tr>
          <tr style={rowStyle}>
            <td style={labelStyle}>Auth</td>
            <td style={valueStyle}>
              {cmd.auth
                ? `Basic ${cmd.auth.user}:${cmd.auth.password ? '••••' : ''}`
                : <span style={{ color: 'var(--text-muted)' }}>—</span>}
            </td>
          </tr>
          <tr>
            <td style={labelStyle}>Body</td>
            <td style={valueStyle}>
              {cmd.body.type === 'none' ? (
                <span style={{ color: 'var(--text-muted)' }}>—</span>
              ) : (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(16,185,129,0.1)',
                      color: '#10b981',
                      fontSize: '11px',
                      marginBottom: '4px',
                    }}
                  >
                    {cmd.body.type}
                  </span>
                  <pre
                    style={{
                      margin: 0,
                      padding: '8px',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      fontSize: '12px',
                      maxHeight: '200px',
                      overflow: 'auto',
                    }}
                  >
                    {cmd.body.content}
                  </pre>
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
