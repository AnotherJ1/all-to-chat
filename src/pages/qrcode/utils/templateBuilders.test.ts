/**
 * templateBuilders 单元测试（worker-3）
 *
 * 覆盖：
 *  - WiFi 转义（密码含 ; , : \ "）
 *  - vCard 必填校验与可选字段裁剪
 *  - SMS / Email / Geo 构造
 *  - parseTemplate 对 5 种类型的反向识别 + url/text 兜底
 *  - 边界：空字段、超长字段（>500 字）
 */
import { describe, it, expect } from 'vitest'
import {
  buildWifi,
  buildVCard,
  buildSms,
  buildEmail,
  buildGeo,
  parseTemplate,
  escapeWifiField,
} from './templateBuilders'

describe('escapeWifiField', () => {
  it('对 ; , : \\ " 进行反斜杠转义', () => {
    expect(escapeWifiField('a;b,c:d\\e"f')).toBe('a\\;b\\,c\\:d\\\\e\\"f')
  })
  it('空字符串返回空', () => {
    expect(escapeWifiField('')).toBe('')
  })
})

describe('buildWifi', () => {
  it('生成标准 WPA 字符串', () => {
    expect(buildWifi({ ssid: 'MyNet', password: 'pass', encryption: 'WPA' })).toBe(
      'WIFI:T:WPA;S:MyNet;P:pass;;'
    )
  })

  it('hidden=true 输出 H:true', () => {
    expect(buildWifi({ ssid: 'X', password: 'y', encryption: 'WPA', hidden: true })).toBe(
      'WIFI:T:WPA;S:X;P:y;H:true;;'
    )
  })

  it('encryption=nopass 时省略 P 字段', () => {
    expect(buildWifi({ ssid: 'OpenAP', password: '', encryption: 'nopass' })).toBe(
      'WIFI:T:nopass;S:OpenAP;;'
    )
  })

  it('密码包含特殊字符 ; , : \\ 时正确转义', () => {
    const out = buildWifi({ ssid: 's;s', password: 'p;a,b:c\\d', encryption: 'WPA' })
    expect(out).toBe('WIFI:T:WPA;S:s\\;s;P:p\\;a\\,b\\:c\\\\d;;')
  })

  it('反向解析能复原原字段', () => {
    const raw = buildWifi({ ssid: 'ssid;1', password: 'p:w\\d', encryption: 'WPA', hidden: true })
    const parsed = parseTemplate(raw)
    expect(parsed?.type).toBe('wifi')
    if (parsed?.type === 'wifi') {
      expect(parsed.fields.ssid).toBe('ssid;1')
      expect(parsed.fields.password).toBe('p:w\\d')
      expect(parsed.fields.encryption).toBe('WPA')
      expect(parsed.fields.hidden).toBe(true)
    }
  })
})

describe('buildVCard', () => {
  it('仅有姓名时生成最小 vCard', () => {
    const out = buildVCard({ name: '张三' })
    expect(out).toContain('BEGIN:VCARD')
    expect(out).toContain('VERSION:3.0')
    expect(out).toContain('FN:张三')
    expect(out).toContain('END:VCARD')
  })

  it('包含可选字段时按行输出', () => {
    const out = buildVCard({
      name: 'Alice',
      org: 'ACME',
      title: 'CEO',
      phone: '+8613800000000',
      email: 'a@b.com',
      url: 'https://a.com',
      address: 'Beijing',
    })
    expect(out).toContain('ORG:ACME')
    expect(out).toContain('TITLE:CEO')
    expect(out).toContain('TEL;TYPE=CELL:+8613800000000')
    expect(out).toContain('EMAIL;TYPE=INTERNET:a@b.com')
    expect(out).toContain('URL:https://a.com')
    expect(out).toContain('ADR;TYPE=HOME:;;Beijing;;;;')
  })

  it('反向解析识别 vCard 并提取主要字段', () => {
    const raw = buildVCard({ name: 'Bob', org: 'X Co.', email: 'b@x.com' })
    const parsed = parseTemplate(raw)
    expect(parsed?.type).toBe('vcard')
    if (parsed?.type === 'vcard') {
      expect(parsed.fields.name).toBe('Bob')
      expect(parsed.fields.org).toBe('X Co.')
      expect(parsed.fields.email).toBe('b@x.com')
    }
  })

  it('字段含 ; , 时转义不破坏 vCard 结构', () => {
    const out = buildVCard({ name: 'Last;First', org: 'A,B' })
    // ; 与 , 必须被转义
    expect(out).toMatch(/FN:Last\\;First/)
    expect(out).toMatch(/ORG:A\\,B/)
  })
})

describe('buildSms', () => {
  it('生成 SMSTO:phone:body', () => {
    expect(buildSms({ phone: '+8613800000000', body: '你好' })).toBe('SMSTO:+8613800000000:你好')
  })
  it('body 缺省仍带尾冒号', () => {
    expect(buildSms({ phone: '110', body: '' })).toBe('SMSTO:110:')
  })
  it('phone 为空返回空字符串', () => {
    expect(buildSms({ phone: '', body: 'hi' })).toBe('')
  })

  it('反向解析 SMSTO', () => {
    const parsed = parseTemplate('SMSTO:138:hello')
    expect(parsed).toEqual({ type: 'sms', fields: { phone: '138', body: 'hello' } })
  })
})

describe('buildEmail', () => {
  it('生成 mailto 链接（无参数）', () => {
    expect(buildEmail({ to: 'a@b.com' })).toBe('mailto:a@b.com')
  })
  it('subject/body 进行 URL 编码', () => {
    expect(buildEmail({ to: 'a@b.com', subject: '你好 world', body: 'a&b=c' })).toBe(
      'mailto:a@b.com?subject=' +
        encodeURIComponent('你好 world') +
        '&body=' +
        encodeURIComponent('a&b=c')
    )
  })
  it('to 为空返回空字符串', () => {
    expect(buildEmail({ to: '' })).toBe('')
  })

  it('反向解析 mailto', () => {
    const raw = buildEmail({ to: 'a@b.com', subject: 'Hi', body: 'World' })
    const parsed = parseTemplate(raw)
    expect(parsed?.type).toBe('email')
    if (parsed?.type === 'email') {
      expect(parsed.fields.to).toBe('a@b.com')
      expect(parsed.fields.subject).toBe('Hi')
      expect(parsed.fields.body).toBe('World')
    }
  })
})

describe('buildGeo', () => {
  it('生成 geo:lat,lng', () => {
    expect(buildGeo({ lat: 39.9, lng: 116.4 })).toBe('geo:39.9,116.4')
  })
  it('带 query 参数 URL 编码', () => {
    expect(buildGeo({ lat: 39.9, lng: 116.4, query: '故宫' })).toBe(
      'geo:39.9,116.4?q=' + encodeURIComponent('故宫')
    )
  })
  it('非法坐标返回空字符串', () => {
    expect(buildGeo({ lat: NaN, lng: 0 })).toBe('')
    expect(buildGeo({ lat: 0, lng: Number('abc') })).toBe('')
  })

  it('反向解析 geo', () => {
    const parsed = parseTemplate('geo:1.5,2.5?q=Park')
    expect(parsed?.type).toBe('geo')
    if (parsed?.type === 'geo') {
      expect(parsed.fields.lat).toBe(1.5)
      expect(parsed.fields.lng).toBe(2.5)
      expect(parsed.fields.query).toBe('Park')
    }
  })
})

describe('parseTemplate 综合', () => {
  it('http(s) URL 识别为 url', () => {
    expect(parseTemplate('https://example.com')?.type).toBe('url')
    expect(parseTemplate('http://x.io/path?q=1')?.type).toBe('url')
  })
  it('其他文本兜底为 text', () => {
    expect(parseTemplate('随便一段文字')?.type).toBe('text')
  })
  it('空输入返回 null', () => {
    expect(parseTemplate('')).toBeNull()
    expect(parseTemplate(null)).toBeNull()
    expect(parseTemplate(undefined)).toBeNull()
  })
  it('5 种结构化类型全部能反向识别', () => {
    expect(parseTemplate(buildWifi({ ssid: 'a', password: 'b', encryption: 'WPA' }))?.type).toBe(
      'wifi'
    )
    expect(parseTemplate(buildVCard({ name: 'X' }))?.type).toBe('vcard')
    expect(parseTemplate(buildSms({ phone: '110', body: 'x' }))?.type).toBe('sms')
    expect(parseTemplate(buildEmail({ to: 'a@b.com' }))?.type).toBe('email')
    expect(parseTemplate(buildGeo({ lat: 1, lng: 2 }))?.type).toBe('geo')
  })
})

describe('边界：空字段 / 超长字段', () => {
  it('全空 WiFi 仍能输出协议头与尾', () => {
    expect(buildWifi({ ssid: '', password: '', encryption: 'nopass' })).toBe('WIFI:T:nopass;S:;;')
  })

  it('超长字段（>500 字）能正确构造与解析', () => {
    const longText = 'a'.repeat(800)
    const raw = buildWifi({ ssid: longText, password: longText, encryption: 'WPA' })
    expect(raw.length).toBeGreaterThan(1600)
    const parsed = parseTemplate(raw)
    expect(parsed?.type).toBe('wifi')
    if (parsed?.type === 'wifi') {
      expect(parsed.fields.ssid).toBe(longText)
      expect(parsed.fields.password).toBe(longText)
    }
  })

  it('vCard 超长 NOTE-like 字段可正常嵌入', () => {
    const longBody = 'b'.repeat(600)
    const raw = buildEmail({ to: 'a@b.com', body: longBody })
    expect(raw.startsWith('mailto:a@b.com?body=')).toBe(true)
    const parsed = parseTemplate(raw)
    if (parsed?.type === 'email') {
      expect(parsed.fields.body).toBe(longBody)
    }
  })
})
