/**
 * 结构化模板字符串构造与反向解析（worker-3）
 *
 * 提供 5 种主流二维码模板的纯函数构造器：
 *   - WiFi (`WIFI:T:WPA;S:ssid;P:pass;H:true;;`，对 ; , : \ " 做转义)
 *   - vCard 3.0
 *   - SMS (`SMSTO:phone:body`)
 *   - Email (使用 `mailto:` —— 兼容性最好；MATMSG 仅少数日系扫码 App 解析)
 *   - Geo (`geo:lat,lng?q=query`)
 *
 * 同时提供 parseTemplate(raw) 反向识别，用于解析端展示结构化卡片。
 *
 * 所有函数均为纯函数：不抛异常、不依赖 DOM、可在测试环境直接运行。
 */

import type {
  EmailTemplate,
  GeoTemplate,
  QrTemplateType,
  SmsTemplate,
  VCardTemplate,
  WifiTemplate,
} from '../types'

// ===== 公共工具 =====

/**
 * WiFi 字段转义：根据规范 `;`, `,`, `:`, `\`, `"` 必须用反斜杠转义
 * 见 https://en.wikipedia.org/wiki/QR_code#WiFi
 */
export function escapeWifiField(value: string): string {
  if (!value) return ''
  return value.replace(/([\\;,:"])/g, '\\$1')
}

/** vCard 字段转义：`,` `;` `\` `\n` 都必须转义 */
function escapeVCardField(value: string): string {
  if (!value) return ''
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

/** WiFi 反向解析时的反转义 */
function unescapeWifiField(value: string): string {
  return value.replace(/\\([\\;,:"])/g, '$1')
}

// ===== buildWifi =====

/**
 * 构造 WiFi 二维码字符串
 * 输出形如 `WIFI:T:WPA;S:MyNet;P:p\;ass;H:true;;`
 * - encryption='nopass' 时省略 P 字段
 * - hidden 缺省或 false 不输出 H 字段（提高扫码兼容性）
 */
export function buildWifi(input: WifiTemplate): string {
  const ssid = escapeWifiField(input.ssid ?? '')
  const password = escapeWifiField(input.password ?? '')
  const encryption = input.encryption || 'nopass'

  const parts: string[] = []
  parts.push(`T:${encryption}`)
  parts.push(`S:${ssid}`)
  if (encryption !== 'nopass') {
    parts.push(`P:${password}`)
  }
  if (input.hidden) {
    parts.push('H:true')
  }
  // WiFi 规范要求结尾以 `;;` 结束
  return `WIFI:${parts.join(';')};;`
}

// ===== buildVCard =====

/**
 * 构造 vCard 3.0 字符串。
 * 仅输出有值的字段，避免空 ENTRY 干扰扫码器解析。
 */
export function buildVCard(input: VCardTemplate): string {
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0']

  const name = escapeVCardField(input.name ?? '')
  if (name) {
    // FN（Formatted Name）必须有
    lines.push(`FN:${name}`)
    // N（Structured Name）：Last;First;Middle;Prefix;Suffix
    // 这里只把姓名整体放在 Last 段，避免猜测
    lines.push(`N:${name};;;;`)
  }

  if (input.org) lines.push(`ORG:${escapeVCardField(input.org)}`)
  if (input.title) lines.push(`TITLE:${escapeVCardField(input.title)}`)
  if (input.phone) lines.push(`TEL;TYPE=CELL:${escapeVCardField(input.phone)}`)
  if (input.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardField(input.email)}`)
  if (input.url) lines.push(`URL:${escapeVCardField(input.url)}`)
  if (input.address) {
    // ADR: PO box;Extended;Street;Locality;Region;Postal code;Country
    lines.push(`ADR;TYPE=HOME:;;${escapeVCardField(input.address)};;;;`)
  }

  lines.push('END:VCARD')
  return lines.join('\r\n')
}

// ===== buildSms =====

/** SMSTO:phone:body  —— 主流 Android 扫码 App 直接打开短信草稿 */
export function buildSms(input: SmsTemplate): string {
  const phone = (input.phone ?? '').trim()
  const body = input.body ?? ''
  if (!phone) return ''
  // body 中的 `:` 不会引发解析歧义（规范以第一个冒号断开）
  return body ? `SMSTO:${phone}:${body}` : `SMSTO:${phone}:`
}

// ===== buildEmail =====

/**
 * 构造邮件链接 —— 使用 `mailto:` 协议
 * 兼容性说明：mailto 在所有主流二维码 App、所有平台原生相机均能识别并启动邮箱客户端；
 * 而 `MATMSG:TO:...;SUB:...;BODY:...;;` 仅少数日系老 App 支持。综合体验选 mailto。
 */
export function buildEmail(input: EmailTemplate): string {
  const to = (input.to ?? '').trim()
  if (!to) return ''
  const params: string[] = []
  if (input.subject) params.push(`subject=${encodeURIComponent(input.subject)}`)
  if (input.body) params.push(`body=${encodeURIComponent(input.body)}`)
  return params.length ? `mailto:${to}?${params.join('&')}` : `mailto:${to}`
}

// ===== buildGeo =====

/** geo:lat,lng?q=query —— RFC 5870；Android/iOS 均能唤起地图应用 */
export function buildGeo(input: GeoTemplate): string {
  const lat = Number(input.lat)
  const lng = Number(input.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
  const base = `geo:${lat},${lng}`
  if (input.query && input.query.trim()) {
    return `${base}?q=${encodeURIComponent(input.query.trim())}`
  }
  return base
}

// ===== parseTemplate =====

export type ParsedTemplate =
  | { type: 'wifi'; fields: WifiTemplate }
  | { type: 'vcard'; fields: VCardTemplate }
  | { type: 'sms'; fields: SmsTemplate }
  | { type: 'email'; fields: EmailTemplate }
  | { type: 'geo'; fields: GeoTemplate }
  | { type: 'url'; fields: { url: string } }
  | { type: 'text'; fields: { text: string } }

/**
 * 反向识别一段二维码内容是哪种结构化模板。
 * 优先匹配最特征化的协议前缀，最后回退 url/text。
 */
export function parseTemplate(raw: string | null | undefined): ParsedTemplate | null {
  if (raw == null) return null
  const text = String(raw)
  if (!text) return null

  const trimmed = text.trim()

  // ----- WiFi -----
  if (/^WIFI:/i.test(trimmed)) {
    return { type: 'wifi', fields: parseWifi(trimmed) }
  }

  // ----- vCard -----
  if (/^BEGIN:VCARD/i.test(trimmed)) {
    return { type: 'vcard', fields: parseVCard(trimmed) }
  }

  // ----- SMS -----
  if (/^SMSTO:/i.test(trimmed) || /^smsto:/i.test(trimmed)) {
    const rest = trimmed.slice('SMSTO:'.length)
    const idx = rest.indexOf(':')
    if (idx >= 0) {
      return { type: 'sms', fields: { phone: rest.slice(0, idx), body: rest.slice(idx + 1) } }
    }
    return { type: 'sms', fields: { phone: rest, body: '' } }
  }
  if (/^sms:/i.test(trimmed)) {
    // sms:phone?body=xxx
    const rest = trimmed.slice('sms:'.length)
    const qIdx = rest.indexOf('?')
    if (qIdx < 0) return { type: 'sms', fields: { phone: rest, body: '' } }
    const phone = rest.slice(0, qIdx)
    const params = parseQuery(rest.slice(qIdx + 1))
    return { type: 'sms', fields: { phone, body: params.body ?? '' } }
  }

  // ----- Email -----
  if (/^mailto:/i.test(trimmed)) {
    const rest = trimmed.slice('mailto:'.length)
    const qIdx = rest.indexOf('?')
    if (qIdx < 0) return { type: 'email', fields: { to: rest, subject: '', body: '' } }
    const to = rest.slice(0, qIdx)
    const params = parseQuery(rest.slice(qIdx + 1))
    return {
      type: 'email',
      fields: { to, subject: params.subject ?? '', body: params.body ?? '' },
    }
  }
  if (/^MATMSG:/i.test(trimmed)) {
    return { type: 'email', fields: parseMatmsg(trimmed) }
  }

  // ----- Geo -----
  if (/^geo:/i.test(trimmed)) {
    const rest = trimmed.slice('geo:'.length)
    const qIdx = rest.indexOf('?')
    const coords = qIdx < 0 ? rest : rest.slice(0, qIdx)
    const [latStr, lngStr] = coords.split(',')
    const lat = Number(latStr)
    const lng = Number(lngStr)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      let query = ''
      if (qIdx >= 0) {
        const params = parseQuery(rest.slice(qIdx + 1))
        query = params.q ?? ''
      }
      return { type: 'geo', fields: { lat, lng, query } }
    }
  }

  // ----- URL -----
  if (/^https?:\/\//i.test(trimmed)) {
    return { type: 'url', fields: { url: trimmed } }
  }

  // ----- 兜底：纯文本 -----
  return { type: 'text', fields: { text } }
}

// ===== 内部解析辅助 =====

/** 解析 WIFI:...;...;;  —— 处理转义字符 */
function parseWifi(raw: string): WifiTemplate {
  const body = raw.replace(/^WIFI:/i, '').replace(/;;\s*$/, '')
  // 按未转义的 `;` 切分
  const segments: string[] = []
  let buf = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '\\' && i + 1 < body.length) {
      buf += ch + body[i + 1]
      i++
      continue
    }
    if (ch === ';') {
      segments.push(buf)
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf) segments.push(buf)

  const out: WifiTemplate = { ssid: '', password: '', encryption: 'nopass', hidden: false }
  for (const seg of segments) {
    const cIdx = seg.indexOf(':')
    if (cIdx < 0) continue
    const key = seg.slice(0, cIdx).toUpperCase()
    const val = unescapeWifiField(seg.slice(cIdx + 1))
    if (key === 'T') {
      const up = val.toUpperCase()
      if (up === 'WPA' || up === 'WEP' || up === 'NOPASS') {
        out.encryption = up === 'NOPASS' ? 'nopass' : (up as 'WPA' | 'WEP')
      }
    } else if (key === 'S') {
      out.ssid = val
    } else if (key === 'P') {
      out.password = val
    } else if (key === 'H') {
      out.hidden = /^true$/i.test(val)
    }
  }
  return out
}

/** 解析 vCard 关键字段；忽略未识别项 */
function parseVCard(raw: string): VCardTemplate {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const out: VCardTemplate = { name: '' }

  for (const line of lines) {
    if (/^BEGIN:VCARD$/i.test(line) || /^END:VCARD$/i.test(line) || /^VERSION:/i.test(line)) {
      continue
    }
    const cIdx = line.indexOf(':')
    if (cIdx < 0) continue
    const head = line.slice(0, cIdx).toUpperCase()
    const value = unescapeVCardField(line.slice(cIdx + 1))
    // head 可能是 "TEL;TYPE=CELL"，取分号前作为 key
    const key = head.split(';')[0]
    if (key === 'FN' && !out.name) out.name = value
    else if (key === 'N' && !out.name) out.name = value.replace(/;+$/, '').replace(/;/g, ' ').trim()
    else if (key === 'ORG') out.org = value
    else if (key === 'TITLE') out.title = value
    else if (key === 'TEL') out.phone = value
    else if (key === 'EMAIL') out.email = value
    else if (key === 'URL') out.url = value
    else if (key === 'ADR') {
      // ADR 字段以 `;` 分隔七段，取非空段拼接
      const parts = value.split(/(?<!\\);/).map((p) => p.trim()).filter(Boolean)
      out.address = parts.join(', ')
    }
  }

  return out
}

function unescapeVCardField(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** 解析 MATMSG:TO:xx;SUB:yy;BODY:zz;; */
function parseMatmsg(raw: string): EmailTemplate {
  const body = raw.replace(/^MATMSG:/i, '').replace(/;;\s*$/, '')
  const out: EmailTemplate = { to: '', subject: '', body: '' }
  // 简化处理：按 `;KEY:` 模式切分
  const re = /(TO|SUB|BODY):([\s\S]*?)(?=;(?:TO|SUB|BODY):|$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const k = m[1].toUpperCase()
    const v = m[2].replace(/;$/, '')
    if (k === 'TO') out.to = v
    else if (k === 'SUB') out.subject = v
    else if (k === 'BODY') out.body = v
  }
  return out
}

/** 解析 query string，返回普通对象 */
function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!qs) return out
  for (const pair of qs.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    if (eq < 0) {
      out[decodeURIComponent(pair)] = ''
    } else {
      const k = decodeURIComponent(pair.slice(0, eq))
      const v = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '))
      out[k] = v
    }
  }
  return out
}

/** 把内部 ParsedTemplate 类型映射回 QrTemplateType */
export function parsedToTemplateType(p: ParsedTemplate): QrTemplateType {
  return p.type
}
