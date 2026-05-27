/**
 * TemplateBuilder（worker-3）
 *
 * 顶部 Tab 切换：纯文本 / URL / WiFi / vCard / 短信 / 邮件 / 位置
 * 切换 Tab 或修改字段时调用 generator.setText(buildXxx(form))，把生成结果写回 useQrGenerator。
 *
 * 保持 QrCodePage 配色变量与 .theme-input/.theme-select/.theme-btn 风格一致。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQrCodeContext } from '..'
import type { QrTemplateType } from '..'
import {
  buildEmail,
  buildGeo,
  buildSms,
  buildVCard,
  buildWifi,
} from '../utils/templateBuilders'

// ===== 表单 state 类型 =====

interface WifiForm {
  ssid: string
  password: string
  encryption: 'WPA' | 'WEP' | 'nopass'
  hidden: boolean
}
interface VCardForm {
  name: string
  org: string
  title: string
  phone: string
  email: string
  url: string
  address: string
}
interface SmsForm {
  phone: string
  body: string
}
interface EmailForm {
  to: string
  subject: string
  body: string
}
interface GeoForm {
  lat: string
  lng: string
  query: string
}

const TABS: Array<{ key: QrTemplateType; label: string }> = [
  { key: 'text', label: '纯文本' },
  { key: 'url', label: 'URL' },
  { key: 'wifi', label: 'WiFi' },
  { key: 'vcard', label: 'vCard' },
  { key: 'sms', label: '短信' },
  { key: 'email', label: '邮件' },
  { key: 'geo', label: '位置' },
]

const EMPTY_WIFI: WifiForm = { ssid: '', password: '', encryption: 'WPA', hidden: false }
const EMPTY_VCARD: VCardForm = { name: '', org: '', title: '', phone: '', email: '', url: '', address: '' }
const EMPTY_SMS: SmsForm = { phone: '', body: '' }
const EMPTY_EMAIL: EmailForm = { to: '', subject: '', body: '' }
const EMPTY_GEO: GeoForm = { lat: '', lng: '', query: '' }

// ===== 公共样式（用 CSS variables，跟随主题切换） =====

const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)' }
const sectionTitleStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-heading)',
  letterSpacing: '0.04em',
}

/**
 * 主组件：仅依赖 QrCodeContext 的 generator.setText 写回内容。
 * 不再接受 props（worker-1 已做好上下文）。
 */
export function TemplateBuilder() {
  const { generator } = useQrCodeContext()
  const [tab, setTab] = useState<QrTemplateType>('text')

  // 各 tab 独立 state，互不干扰，便于在 tabs 间切换时保留之前输入
  const [textForm, setTextForm] = useState('')
  const [urlForm, setUrlForm] = useState('')
  const [wifiForm, setWifiForm] = useState<WifiForm>(EMPTY_WIFI)
  const [vcardForm, setVcardForm] = useState<VCardForm>(EMPTY_VCARD)
  const [smsForm, setSmsForm] = useState<SmsForm>(EMPTY_SMS)
  const [emailForm, setEmailForm] = useState<EmailForm>(EMPTY_EMAIL)
  const [geoForm, setGeoForm] = useState<GeoForm>(EMPTY_GEO)

  // 密码可见性
  const [showWifiPw, setShowWifiPw] = useState(false)

  // 用户主动操作过模板（避免初次挂载就把 generator 默认 URL 覆盖）
  const [touched, setTouched] = useState(false)

  // 根据当前 tab + form 计算最终二维码字符串
  const generated = useMemo<string>(() => {
    switch (tab) {
      case 'text':
        return textForm
      case 'url':
        return urlForm
      case 'wifi':
        // 没有 ssid 时不生成，让 hook 显示空二维码
        return wifiForm.ssid ? buildWifi(wifiForm) : ''
      case 'vcard':
        return vcardForm.name ? buildVCard(vcardForm) : ''
      case 'sms':
        return smsForm.phone ? buildSms(smsForm) : ''
      case 'email':
        return emailForm.to ? buildEmail(emailForm) : ''
      case 'geo': {
        const lat = Number(geoForm.lat)
        const lng = Number(geoForm.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
        return buildGeo({ lat, lng, query: geoForm.query })
      }
      default:
        return ''
    }
  }, [tab, textForm, urlForm, wifiForm, vcardForm, smsForm, emailForm, geoForm])

  // 把生成结果同步到 generator.setText（仅在用户已操作过时同步）
  useEffect(() => {
    if (!touched) return
    generator.setText(generated)
  }, [touched, generated, generator])

  /** 标记表单已被用户主动操作 */
  const markTouched = useCallback(() => setTouched(true), [])

  /** 一键清空当前 tab 的表单 */
  const clearCurrent = () => {
    markTouched()
    switch (tab) {
      case 'text':
        setTextForm('')
        break
      case 'url':
        setUrlForm('')
        break
      case 'wifi':
        setWifiForm(EMPTY_WIFI)
        break
      case 'vcard':
        setVcardForm(EMPTY_VCARD)
        break
      case 'sms':
        setSmsForm(EMPTY_SMS)
        break
      case 'email':
        setEmailForm(EMPTY_EMAIL)
        break
      case 'geo':
        setGeoForm(EMPTY_GEO)
        break
    }
  }

  return (
    <div
      className="mb-4 p-3 rounded-lg"
      style={{
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius)',
      }}
      data-testid="template-builder"
    >
      {/* === Tab Header === */}
      <div className="flex flex-wrap gap-1 mb-3" role="tablist" aria-label="模板类型">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t.key)
                markTouched()
              }}
              className="theme-btn"
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: active ? 600 : 400,
                background: active ? 'var(--accent-1)' : 'transparent',
                color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                borderColor: active ? 'var(--accent-1)' : 'var(--border-color)',
              }}
            >
              {t.label}
            </button>
          )
        })}
        <span className="flex-1" />
        <button
          onClick={clearCurrent}
          className="theme-btn"
          style={{
            padding: '4px 10px',
            fontSize: '12px',
            color: 'var(--color-danger)',
            borderColor: 'color-mix(in srgb, var(--color-danger) 35%, transparent)',
          }}
          aria-label="清空当前表单"
        >
          清空表单
        </button>
      </div>

      {/* === Tab Body === */}
      {tab === 'text' && (
        <div>
          <label className="text-sm font-medium block mb-1" style={labelStyle}>
            纯文本内容
          </label>
          <textarea
            className="theme-input"
            placeholder="任意文本，回车换行"
            value={textForm}
            onChange={(e) => {
              setTextForm(e.target.value)
              markTouched()
            }}
            style={{ minHeight: '60px', fontSize: '13px', resize: 'vertical' }}
          />
        </div>
      )}

      {tab === 'url' && (
        <div>
          <label className="text-sm font-medium block mb-1" style={labelStyle}>
            URL 地址
          </label>
          <input
            className="theme-input"
            placeholder="https://example.com"
            value={urlForm}
            onChange={(e) => {
              setUrlForm(e.target.value)
              markTouched()
            }}
            style={{ fontSize: '13px' }}
          />
        </div>
      )}

      {tab === 'wifi' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1" style={labelStyle}>
              SSID（网络名称） *
            </label>
            <input
              className="theme-input"
              placeholder="MyHomeWiFi"
              value={wifiForm.ssid}
              onChange={(e) => {
                setWifiForm({ ...wifiForm, ssid: e.target.value })
                markTouched()
              }}
              style={{ fontSize: '13px' }}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1" style={labelStyle}>
              加密方式
            </label>
            <select
              className="theme-select w-full"
              value={wifiForm.encryption}
              onChange={(e) => {
                setWifiForm({
                  ...wifiForm,
                  encryption: e.target.value as 'WPA' | 'WEP' | 'nopass',
                })
                markTouched()
              }}
              style={{ padding: '8px 36px 8px 12px' }}
            >
              <option value="WPA">WPA / WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">无密码</option>
            </select>
          </div>

          {wifiForm.encryption !== 'nopass' && (
            <div className="md:col-span-2">
              <label className="text-sm font-medium block mb-1" style={labelStyle}>
                密码
              </label>
              <div className="flex gap-2 items-center">
                <input
                  className="theme-input flex-1"
                  type={showWifiPw ? 'text' : 'password'}
                  placeholder="密码（含特殊字符将自动转义）"
                  value={wifiForm.password}
                  onChange={(e) => {
                    setWifiForm({ ...wifiForm, password: e.target.value })
                    markTouched()
                  }}
                  style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                />
                <button
                  type="button"
                  className="theme-btn"
                  onClick={() => setShowWifiPw((v) => !v)}
                  aria-label={showWifiPw ? '隐藏密码' : '显示密码'}
                  title={showWifiPw ? '隐藏密码' : '显示密码'}
                  style={{ padding: '6px 10px', fontSize: '14px' }}
                >
                  {showWifiPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="text-sm flex items-center gap-2" style={labelStyle}>
              <input
                type="checkbox"
                checked={wifiForm.hidden}
                onChange={(e) => {
                  setWifiForm({ ...wifiForm, hidden: e.target.checked })
                  markTouched()
                }}
              />
              隐藏网络（H:true）
            </label>
          </div>
        </div>
      )}

      {tab === 'vcard' && (
        <div className="flex flex-col gap-3">
          {/* 联系信息 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={sectionTitleStyle}>
              联系信息
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="theme-input"
                placeholder="姓名 * 例：张三"
                value={vcardForm.name}
                onChange={(e) => {
                  setVcardForm({ ...vcardForm, name: e.target.value })
                  markTouched()
                }}
                style={{ fontSize: '13px' }}
              />
              <input
                className="theme-input"
                placeholder="手机号码 例：+8613800000000"
                value={vcardForm.phone}
                onChange={(e) => {
                  setVcardForm({ ...vcardForm, phone: e.target.value })
                  markTouched()
                }}
                style={{ fontSize: '13px' }}
              />
              <input
                className="theme-input"
                placeholder="邮箱 例：a@b.com"
                value={vcardForm.email}
                onChange={(e) => {
                  setVcardForm({ ...vcardForm, email: e.target.value })
                  markTouched()
                }}
                style={{ fontSize: '13px' }}
              />
              <input
                className="theme-input"
                placeholder="个人主页 https://..."
                value={vcardForm.url}
                onChange={(e) => {
                  setVcardForm({ ...vcardForm, url: e.target.value })
                  markTouched()
                }}
                style={{ fontSize: '13px' }}
              />
            </div>
          </div>

          {/* 工作信息 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={sectionTitleStyle}>
              工作信息
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="theme-input"
                placeholder="公司 / 组织"
                value={vcardForm.org}
                onChange={(e) => {
                  setVcardForm({ ...vcardForm, org: e.target.value })
                  markTouched()
                }}
                style={{ fontSize: '13px' }}
              />
              <input
                className="theme-input"
                placeholder="职位"
                value={vcardForm.title}
                onChange={(e) => {
                  setVcardForm({ ...vcardForm, title: e.target.value })
                  markTouched()
                }}
                style={{ fontSize: '13px' }}
              />
            </div>
          </div>

          {/* 地址 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={sectionTitleStyle}>
              地址
            </div>
            <input
              className="theme-input"
              placeholder="详细地址（自由格式）"
              value={vcardForm.address}
              onChange={(e) => {
                setVcardForm({ ...vcardForm, address: e.target.value })
                markTouched()
              }}
              style={{ fontSize: '13px' }}
            />
          </div>
        </div>
      )}

      {tab === 'sms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="theme-input"
            placeholder="手机号 *  例：+8613800000000"
            value={smsForm.phone}
            onChange={(e) => {
              setSmsForm({ ...smsForm, phone: e.target.value })
              markTouched()
            }}
            style={{ fontSize: '13px' }}
          />
          <input
            className="theme-input"
            placeholder="预填短信内容（可空）"
            value={smsForm.body}
            onChange={(e) => {
              setSmsForm({ ...smsForm, body: e.target.value })
              markTouched()
            }}
            style={{ fontSize: '13px' }}
          />
        </div>
      )}

      {tab === 'email' && (
        <div className="flex flex-col gap-3">
          <input
            className="theme-input"
            placeholder="收件人 *  a@b.com"
            value={emailForm.to}
            onChange={(e) => {
              setEmailForm({ ...emailForm, to: e.target.value })
              markTouched()
            }}
            style={{ fontSize: '13px' }}
          />
          <input
            className="theme-input"
            placeholder="主题（可空）"
            value={emailForm.subject}
            onChange={(e) => {
              setEmailForm({ ...emailForm, subject: e.target.value })
              markTouched()
            }}
            style={{ fontSize: '13px' }}
          />
          <textarea
            className="theme-input"
            placeholder="正文（可空，回车换行）"
            value={emailForm.body}
            onChange={(e) => {
              setEmailForm({ ...emailForm, body: e.target.value })
              markTouched()
            }}
            style={{ minHeight: '60px', fontSize: '13px', resize: 'vertical' }}
          />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            使用 mailto 协议生成；扫码后直接唤起邮箱客户端撰写邮件
          </p>
        </div>
      )}

      {tab === 'geo' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="theme-input"
            placeholder="纬度 lat *  例：39.9042"
            inputMode="decimal"
            value={geoForm.lat}
            onChange={(e) => {
              setGeoForm({ ...geoForm, lat: e.target.value })
              markTouched()
            }}
            style={{ fontSize: '13px' }}
          />
          <input
            className="theme-input"
            placeholder="经度 lng *  例：116.4074"
            inputMode="decimal"
            value={geoForm.lng}
            onChange={(e) => {
              setGeoForm({ ...geoForm, lng: e.target.value })
              markTouched()
            }}
            style={{ fontSize: '13px' }}
          />
          <input
            className="theme-input"
            placeholder="地点名（可空）"
            value={geoForm.query}
            onChange={(e) => {
              setGeoForm({ ...geoForm, query: e.target.value })
              markTouched()
            }}
            style={{ fontSize: '13px' }}
          />
        </div>
      )}
    </div>
  )
}

export default TemplateBuilder
