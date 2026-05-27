/**
 * ParsedTemplateView（worker-3）
 *
 * 在解析端，把已识别的结构化模板（WiFi / vCard / SMS / Email / Geo）渲染成卡片视图。
 * 自身根据传入的 raw 字符串调用 parseTemplate；如果识别为 url 或 text 则不展示（让 QrCodePage
 * 自身的"解析成功"区域接管显示）。
 *
 * 调用方：
 *   <ParsedTemplateView raw={parser.parseResult} />
 *
 * 由 team-lead 在 QrCodePage 解析结果区域统一挂入。
 */
import { parseTemplate } from '../utils/templateBuilders'

interface Props {
  raw: string
}

const wrapStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: 'var(--border-width) solid var(--border-color)',
  borderRadius: 'var(--radius)',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-heading)',
  letterSpacing: '0.04em',
}

const valueStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  wordBreak: 'break-all',
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3 py-1">
      <div className="text-xs uppercase w-24 shrink-0" style={labelStyle}>
        {label}
      </div>
      <div className="text-sm flex-1" style={valueStyle}>
        {value}
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded inline-block"
      style={{
        background: 'color-mix(in srgb, var(--accent-1) 15%, transparent)',
        color: 'var(--accent-1)',
        border: '1px solid color-mix(in srgb, var(--accent-1) 30%, transparent)',
        fontFamily: 'var(--font-heading)',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </span>
  )
}

export function ParsedTemplateView({ raw }: Props) {
  const parsed = parseTemplate(raw)
  // 仅展示结构化类型，url/text 不接管
  if (!parsed || parsed.type === 'url' || parsed.type === 'text') return null

  return (
    <div className="p-4 mt-2" style={wrapStyle} data-testid="parsed-template-view">
      <div className="mb-2 flex items-center gap-2">
        <Tag>{typeLabel(parsed.type)}</Tag>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          已识别为结构化数据
        </span>
      </div>

      {parsed.type === 'wifi' && (
        <>
          <Row label="SSID" value={parsed.fields.ssid || '(空)'} />
          <Row label="加密方式" value={encryptionLabel(parsed.fields.encryption)} />
          {parsed.fields.encryption !== 'nopass' && (
            <Row label="密码" value={parsed.fields.password || '(空)'} />
          )}
          {parsed.fields.hidden && <Row label="隐藏网络" value="是" />}
        </>
      )}

      {parsed.type === 'vcard' && (
        <>
          <Row label="姓名" value={parsed.fields.name} />
          <Row label="公司" value={parsed.fields.org} />
          <Row label="职位" value={parsed.fields.title} />
          <Row label="电话" value={parsed.fields.phone} />
          <Row label="邮箱" value={parsed.fields.email} />
          <Row label="主页" value={parsed.fields.url} />
          <Row label="地址" value={parsed.fields.address} />
        </>
      )}

      {parsed.type === 'sms' && (
        <>
          <Row label="手机号" value={parsed.fields.phone} />
          <Row label="短信内容" value={parsed.fields.body} />
        </>
      )}

      {parsed.type === 'email' && (
        <>
          <Row label="收件人" value={parsed.fields.to} />
          <Row label="主题" value={parsed.fields.subject} />
          <Row label="正文" value={parsed.fields.body} />
        </>
      )}

      {parsed.type === 'geo' && (
        <>
          <Row label="纬度" value={String(parsed.fields.lat)} />
          <Row label="经度" value={String(parsed.fields.lng)} />
          <Row label="地点" value={parsed.fields.query} />
        </>
      )}
    </div>
  )
}

function typeLabel(t: string): string {
  switch (t) {
    case 'wifi':
      return 'WiFi 网络'
    case 'vcard':
      return 'vCard 名片'
    case 'sms':
      return '短信'
    case 'email':
      return '邮件'
    case 'geo':
      return '位置'
    default:
      return t.toUpperCase()
  }
}

function encryptionLabel(enc: 'WPA' | 'WEP' | 'nopass'): string {
  switch (enc) {
    case 'WPA':
      return 'WPA / WPA2'
    case 'WEP':
      return 'WEP'
    case 'nopass':
      return '无密码（开放网络）'
    default:
      return enc
  }
}

export default ParsedTemplateView
