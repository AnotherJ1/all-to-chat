import { useCallback, useEffect, useRef, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import { toast } from '../stores/toastStore'
import {
  RAMPS,
  DEFAULT_ASCII_OPTIONS,
  imageToAscii,
  type AsciiOptions,
  type RampName,
} from '../lib/ascii/image-to-ascii'
import { FONTS, DEFAULT_FONT, renderBanner } from '../lib/ascii/text-banner'

/**
 * ASCII Art 工具页
 * - 图片转字符：上传图片 → Canvas 亮度采样 → 字符画，可调列数/字符集/反色
 * - 文字横幅：输入文字 → figlet 多字体 ASCII 艺术字
 * 两个 Tab 共用底部输出区（等宽预览 + 复制 + 下载 .txt）
 */
type Tab = 'image' | 'banner'

const RAMP_LABELS: Record<RampName, string> = {
  standard: '标准（70 级）',
  simple: '简洁（10 级）',
  blocks: '块字符',
}

export default function AsciiArtPage() {
  const [tab, setTab] = useState<Tab>('image')

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>ASCII Art 工具</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          图片转字符画 · 文字转 ASCII 艺术横幅
        </p>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 16px 32px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button className={`theme-btn ${tab === 'image' ? 'theme-btn-primary' : ''}`} onClick={() => setTab('image')}>
            图片转字符
          </button>
          <button className={`theme-btn ${tab === 'banner' ? 'theme-btn-primary' : ''}`} onClick={() => setTab('banner')}>
            文字横幅
          </button>
        </div>

        {tab === 'image' ? <ImagePanel /> : <BannerPanel />}
      </main>
    </div>
  )
}

/* ============================= 输出区（共用） ============================= */

function OutputArea({ value, fontSize = 8 }: { value: string; fontSize?: number }) {
  const copy = async () => {
    if (!value) {
      toast.error('暂无可复制内容')
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      toast.success('已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  const download = () => {
    if (!value) {
      toast.error('暂无可下载内容')
      return
    }
    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ascii-art.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="theme-btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={copy} disabled={!value}>复制</button>
        <button className="theme-btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={download} disabled={!value}>下载 .txt</button>
      </div>
      <pre
        data-testid="ascii-output"
        style={{
          margin: 0,
          padding: '12px',
          background: '#0b0b0b',
          color: '#e6e6e6',
          borderRadius: 'var(--radius-sm)',
          border: 'var(--border-width) solid var(--border-color)',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          overflow: 'auto',
          maxHeight: '480px',
          whiteSpace: 'pre',
        }}
      >
        {value || '（输出将显示在这里）'}
      </pre>
    </div>
  )
}

/* ============================= 图片转字符 ============================= */

function ImagePanel() {
  const [opts, setOpts] = useState<AsciiOptions>(DEFAULT_ASCII_OPTIONS)
  const [output, setOutput] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const imgRef = useRef<HTMLImageElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  // 重新生成（图片已加载时，参数变化即重算）
  const regenerate = useCallback((options: AsciiOptions) => {
    const img = imgRef.current
    if (!img || !img.complete || !img.naturalWidth) return
    setOutput(imageToAscii(img, options))
  }, [])

  const loadFile = useCallback((file: File, options: AsciiOptions) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url })
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setOutput(imageToAscii(img, options))
    }
    img.onerror = () => toast.error('图片加载失败')
    img.src = url
  }, [])

  const updateOpts = (patch: Partial<AsciiOptions>) => {
    setOpts((prev) => {
      const next = { ...prev, ...patch }
      regenerate(next)
      return next
    })
  }

  return (
    <section className="theme-card" style={{ padding: '20px 24px', cursor: 'default', display: 'grid', gap: '16px' }}>
      {/* 上传区 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f, opts) }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '24px', borderRadius: 'var(--radius-sm)', border: '2px dashed var(--border-color)',
          background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>点击选择 / 拖拽图片到此处</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f, opts); e.target.value = '' }}
        />
      </div>

      {previewUrl && (
        <div style={{ textAlign: 'center' }}>
          <img src={previewUrl} alt="原图预览" style={{ maxHeight: '120px', borderRadius: 'var(--radius-sm)', border: 'var(--border-width) solid var(--border-color)' }} />
        </div>
      )}

      {/* 参数 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: 600 }}>列数：{opts.columns}</span>
          <input type="range" min={30} max={220} step={2} value={opts.columns}
            onChange={(e) => updateOpts({ columns: Number(e.target.value) })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: 600 }}>字符集</span>
          <select className="theme-select" value={opts.ramp}
            onChange={(e) => updateOpts({ ramp: e.target.value as RampName })}
            style={{ padding: '6px 10px', fontSize: '12px' }}>
            {(Object.keys(RAMPS) as RampName[]).map((r) => (
              <option key={r} value={r}>{RAMP_LABELS[r]}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <input type="checkbox" checked={opts.invert} onChange={(e) => updateOpts({ invert: e.target.checked })} />
          反色
        </label>
      </div>

      <OutputArea value={output} fontSize={6} />
    </section>
  )
}

/* ============================= 文字横幅 ============================= */

function BannerPanel() {
  const [text, setText] = useState('Hello')
  const [font, setFont] = useState(DEFAULT_FONT)
  const [output, setOutput] = useState('')
  const [note, setNote] = useState('')

  // 防抖重算
  useEffect(() => {
    let cancelled = false
    const id = setTimeout(async () => {
      const res = await renderBanner(text, font)
      if (cancelled) return
      setOutput(res.text)
      setNote(res.ok ? (res.message ?? '') : (res.message ?? '生成失败'))
    }, 150)
    return () => { cancelled = true; clearTimeout(id) }
  }, [text, font])

  return (
    <section className="theme-card" style={{ padding: '20px 24px', cursor: 'default', display: 'grid', gap: '16px' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>文字内容</span>
        <input
          className="theme-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入要转换的文字（建议英文/数字）"
          spellCheck={false}
          style={{ fontSize: '14px', padding: '10px 12px' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '280px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>字体</span>
        <select className="theme-select" value={font} onChange={(e) => setFont(e.target.value)}
          style={{ padding: '8px 12px', fontSize: '13px' }}>
          {FONTS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>

      {note && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{note}</p>}

      <OutputArea value={output} fontSize={10} />
    </section>
  )
}
