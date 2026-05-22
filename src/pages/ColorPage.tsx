import { useMemo, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import ColorPicker from '../components/color/ColorPicker'
import ContrastPanel from '../components/color/ContrastPanel'
import PalettePanel from '../components/color/PalettePanel'
import { toast } from '../stores/toastStore'
import {
  rgbToHex, rgbToHsl, rgbToHsv, rgbToCmyk, rgbToOklch,
  formatRgb, formatRgba, formatHsl, formatHsv, formatOklch, formatCmyk,
  parseColor,
} from '../lib/color/convert'
import type { RGB } from '../lib/color/convert'

/**
 * 颜色工具页
 * 上方:取色器(input + HSV 圆盘) + 7 格式输入框,任一改动其它实时同步
 * 下方:Tab 切换 对比度面板 / 调色板面板
 */

type Tab = 'contrast' | 'palette'

const DEFAULT_COLOR: RGB = { r: 99, g: 102, b: 241 } // #6366F1 indigo

export default function ColorPage() {
  // 主色:在画布/输入框/默认按钮间共享
  const [main, setMain] = useState<RGB>(DEFAULT_COLOR)
  // 对比度第二色(背景):默认白
  const [bg, setBg] = useState<RGB>({ r: 255, g: 255, b: 255 })
  const [tab, setTab] = useState<Tab>('contrast')

  // 7 种格式字符串(单向派生)
  const formats = useMemo(() => {
    return {
      hex: rgbToHex(main),
      rgb: formatRgb(main),
      rgba: formatRgba({ ...main, a: 1 }),
      hsl: formatHsl(rgbToHsl(main)),
      hsv: formatHsv(rgbToHsv(main)),
      oklch: formatOklch(rgbToOklch(main)),
      cmyk: formatCmyk(rgbToCmyk(main)),
    }
  }, [main])

  /** 通用:用户在某一格式输入框敲入文本 → 解析 → 同步到 main */
  const handleFormatChange = (raw: string) => {
    const parsed = parseColor(raw)
    if (parsed) {
      setMain({ r: parsed.r, g: parsed.g, b: parsed.b })
    }
    // 解析失败时不刷新主色,但允许用户继续编辑
  }

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
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>颜色工具</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          HEX / RGB / HSL / HSV / OKLCH / CMYK 互转 · WCAG 对比度 · 5 套配色方案
        </p>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 16px 32px' }}>
        {/* 上方:取色器 + 七格式输入 */}
        <section className="theme-card color-top-grid" style={{ padding: '20px 24px', cursor: 'default' }}>
          <div>
            <ColorPicker value={main} onChange={setMain} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <FormatRow label="HEX" value={formats.hex} onChange={handleFormatChange} onCopy={copy} />
            <FormatRow label="RGB" value={formats.rgb} onChange={handleFormatChange} onCopy={copy} />
            <FormatRow label="RGBA" value={formats.rgba} onChange={handleFormatChange} onCopy={copy} />
            <FormatRow label="HSL" value={formats.hsl} onChange={handleFormatChange} onCopy={copy} />
            <FormatRow label="HSV" value={formats.hsv} onChange={handleFormatChange} onCopy={copy} />
            <FormatRow label="OKLCH" value={formats.oklch} onChange={handleFormatChange} onCopy={copy} />
            <FormatRow label="CMYK" value={formats.cmyk} onChange={handleFormatChange} onCopy={copy} />
          </div>
        </section>

        {/* 下方:Tab */}
        <div style={{ display: 'flex', gap: '8px', margin: '24px 0 16px' }}>
          <button
            className={`theme-btn ${tab === 'contrast' ? 'theme-btn-primary' : ''}`}
            onClick={() => setTab('contrast')}
          >
            对比度
          </button>
          <button
            className={`theme-btn ${tab === 'palette' ? 'theme-btn-primary' : ''}`}
            onClick={() => setTab('palette')}
          >
            调色板
          </button>
        </div>

        {tab === 'contrast' && (
          <section className="theme-card" style={{ padding: '20px 24px', cursor: 'default' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
              <SwatchRow label="前景" rgb={main} onChange={setMain} />
              <SwatchRow label="背景" rgb={bg} onChange={setBg} />
              <button
                className="theme-btn"
                style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '12px' }}
                onClick={() => { const tmp = main; setMain(bg); setBg(tmp) }}
                title="交换前景/背景"
              >
                交换
              </button>
            </div>
            <ContrastPanel fg={main} bg={bg} />
          </section>
        )}

        {tab === 'palette' && (
          <section className="theme-card" style={{ padding: '20px 24px', cursor: 'default' }}>
            <PalettePanel base={main} />
          </section>
        )}
      </main>

      {/* 局部样式:桌面双栏,移动端纵向堆叠 */}
      <style>{`
        .color-top-grid {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .color-top-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

/** 单行格式输入:label + input + 复制按钮
 *  - 显示由父级派生的 value
 *  - 用户聚焦时进入 draft 模式;失焦后回到 value
 */
function FormatRow({
  label, value, onChange, onCopy,
}: {
  label: string
  value: string
  onChange: (raw: string) => void
  onCopy: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: '8px', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <input
        className="theme-input"
        value={editing ? draft : value}
        onFocus={() => { setDraft(value); setEditing(true) }}
        onChange={(e) => {
          const v = e.target.value
          setDraft(v)
          onChange(v)
        }}
        onBlur={() => setEditing(false)}
        spellCheck={false}
        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', padding: '8px 12px' }}
      />
      <button
        className="theme-btn"
        style={{ padding: '6px 10px', fontSize: '12px' }}
        onClick={() => onCopy(value)}
      >
        复制
      </button>
    </div>
  )
}

/** 色块 + 当前 hex 显示,点击色块用作前景/背景源 */
function SwatchRow({
  label, rgb, onChange,
}: {
  label: string
  rgb: RGB
  onChange: (rgb: RGB) => void
}) {
  const hex = rgbToHex(rgb)
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '32px' }}>{label}</span>
      <input
        type="color"
        value={hex.toLowerCase()}
        onChange={(e) => {
          const v = e.target.value
          onChange({
            r: parseInt(v.slice(1, 3), 16),
            g: parseInt(v.slice(3, 5), 16),
            b: parseInt(v.slice(5, 7), 16),
          })
        }}
        style={{
          width: '36px',
          height: '32px',
          border: 'var(--border-width) solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: 0,
          background: 'transparent',
          cursor: 'pointer',
        }}
      />
      <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{hex}</code>
    </label>
  )
}
