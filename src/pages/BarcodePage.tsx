import { useCallback, useEffect, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import BackToHome from '../components/common/BackToHome'
import BarcodeCameraScanner from '../components/barcode/BarcodeCameraScanner'
import { toast } from '../stores/toastStore'
import {
  FORMATS,
  DEFAULT_OPTIONS,
  getFormatMeta,
  validateValue,
  render,
  type BarcodeFormat,
  type RenderOptions,
} from '../lib/barcode/generate'
import { decodeImageFile, type DecodeResult } from '../lib/barcode/decode'
import { usePasteImage } from '../lib/usePasteImage'

/**
 * 条形码工具页
 * - 生成 Tab：输入文本 + 选码制/尺寸/颜色 → 实时预览 SVG，下载 PNG / SVG
 * - 解析 Tab：上传图片 / 摄像头扫描 → 显示文本 + 码制（基于 @zxing/library）
 */
type Tab = 'generate' | 'decode'

export default function BarcodePage() {
  const [tab, setTab] = useState<Tab>('generate')

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>条形码工具</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          生成 Code128 / EAN / UPC 等一维码 · 上传图片或摄像头扫描解析
        </p>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '0 16px 32px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className={`theme-btn ${tab === 'generate' ? 'theme-btn-primary' : ''}`}
            onClick={() => setTab('generate')}
          >
            生成
          </button>
          <button
            className={`theme-btn ${tab === 'decode' ? 'theme-btn-primary' : ''}`}
            onClick={() => setTab('decode')}
          >
            解析
          </button>
        </div>

        {tab === 'generate' ? <GeneratePanel /> : <DecodePanel />}
      </main>
    </div>
  )
}

/* ============================= 生成面板 ============================= */

function GeneratePanel() {
  const [value, setValue] = useState('Hello-123')
  const [opts, setOpts] = useState<RenderOptions>(DEFAULT_OPTIONS)
  const [error, setError] = useState('')

  const svgRef = useRef<SVGSVGElement | null>(null)
  const meta = getFormatMeta(opts.format)

  // value / opts 任一变化即重绘
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const pre = validateValue(opts.format, value)
    if (!pre.ok) {
      setError(pre.message ?? '输入无效')
      // 清空之前渲染，避免残留
      while (svg.firstChild) svg.removeChild(svg.firstChild)
      return
    }
    const res = render(svg, value, opts)
    setError(res.ok ? '' : res.message ?? '生成失败')
  }, [value, opts])

  const updateFormat = (format: BarcodeFormat) => {
    setOpts((o) => ({ ...o, format }))
    // 切换码制时填入对应示例，减少“无效输入”空窗
    setValue(getFormatMeta(format).placeholder)
  }

  const downloadSvg = useCallback(() => {
    const svg = svgRef.current
    if (!svg || error) {
      toast.error('当前没有可下载的条形码')
      return
    }
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: 'image/svg+xml;charset=utf-8' })
    saveAs(blob, `barcode-${opts.format}.svg`)
  }, [error, opts.format])

  const downloadPng = useCallback(() => {
    const svg = svgRef.current
    if (!svg || error) {
      toast.error('当前没有可下载的条形码')
      return
    }
    const xml = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 2 // 2x 提升清晰度
      const canvas = document.createElement('canvas')
      canvas.width = (img.width || 300) * scale
      canvas.height = (img.height || 150) * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        toast.error('PNG 导出失败')
        return
      }
      ctx.fillStyle = opts.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) saveAs(blob, `barcode-${opts.format}.png`)
        else toast.error('PNG 导出失败')
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error('PNG 导出失败')
    }
    img.src = url
  }, [error, opts.format, opts.background])

  return (
    <section className="theme-card" style={{ padding: '20px 24px', cursor: 'default' }}>
      <div style={{ display: 'grid', gap: '14px' }}>
        {/* 码制选择 */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>码制</span>
          <select
            className="theme-select"
            value={opts.format}
            onChange={(e) => updateFormat(e.target.value as BarcodeFormat)}
            style={{ padding: '8px 12px', fontSize: '13px' }}
          >
            {FORMATS.map((f) => (
              <option key={f.format} value={f.format}>{f.label}</option>
            ))}
          </select>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{meta.hint}</span>
        </label>

        {/* 内容输入 */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>内容</span>
          <input
            className="theme-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={meta.placeholder}
            spellCheck={false}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', padding: '10px 12px' }}
          />
        </label>

        {/* 参数行 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <SliderField label="条宽" min={1} max={4} step={0.5} value={opts.width}
            onChange={(v) => setOpts((o) => ({ ...o, width: v }))} suffix="px" />
          <SliderField label="高度" min={40} max={200} step={10} value={opts.height}
            onChange={(v) => setOpts((o) => ({ ...o, height: v }))} suffix="px" />
          <ColorField label="前景" value={opts.lineColor}
            onChange={(v) => setOpts((o) => ({ ...o, lineColor: v }))} />
          <ColorField label="背景" value={opts.background}
            onChange={(v) => setOpts((o) => ({ ...o, background: v }))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={opts.displayValue}
              onChange={(e) => setOpts((o) => ({ ...o, displayValue: e.target.checked }))}
            />
            显示文本
          </label>
        </div>

        {/* 预览 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '160px',
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            border: 'var(--border-width) solid var(--border-color)',
            background: '#fff',
            overflow: 'auto',
          }}
        >
          {/* JsBarcode 渲染目标 */}
          <svg ref={svgRef} data-testid="barcode-svg" style={{ display: error ? 'none' : 'block', maxWidth: '100%' }} />
          {error && <span style={{ color: 'var(--color-danger)', fontSize: '13px' }}>⚠ {error}</span>}
        </div>

        {/* 下载 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="theme-btn theme-btn-primary" onClick={downloadPng} disabled={!!error}>下载 PNG</button>
          <button className="theme-btn" onClick={downloadSvg} disabled={!!error}>下载 SVG</button>
        </div>
      </div>
    </section>
  )
}

/* ============================= 解析面板 ============================= */

function DecodePanel() {
  const [result, setResult] = useState<DecodeResult | null>(null)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 卸载时回收预览 URL
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
    try {
      const res = await decodeImageFile(file)
      if (res) {
        setResult(res)
        toast.success('识别成功')
      } else {
        setError('未在图片中识别到条形码')
      }
    } catch {
      setError('图片解析失败，请确认文件是有效图片')
    } finally {
      setBusy(false)
    }
  }, [])

  const onCameraResult = useCallback((res: DecodeResult) => {
    setResult(res)
    setError('')
    toast.success('扫描成功')
  }, [])

  // 支持 Ctrl/⌘ + V 直接粘贴图片解析
  usePasteImage(useCallback((files: File[]) => { void handleFile(files[0]) }, [handleFile]))

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <section className="theme-card" style={{ padding: '20px 24px', cursor: 'default', display: 'grid', gap: '16px' }}>
      {/* 上传区 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) void handleFile(f)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '28px',
          borderRadius: 'var(--radius-sm)',
          border: '2px dashed var(--border-color)',
          background: 'var(--bg-secondary)',
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          点击选择 / 拖拽 / Ctrl+V 粘贴图片解析
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>支持 PNG / JPEG / WebP 等</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {/* 摄像头扫描 */}
      <BarcodeCameraScanner onResult={onCameraResult} />

      {/* 预览图 */}
      {previewUrl && (
        <div style={{ textAlign: 'center' }}>
          <img
            src={previewUrl}
            alt="待解析图片"
            style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: 'var(--radius-sm)', border: 'var(--border-width) solid var(--border-color)' }}
          />
        </div>
      )}

      {busy && <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>解析中…</p>}

      {/* 结果 */}
      {result && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'var(--border-width) solid var(--border-color)',
            background: 'var(--bg-secondary)',
            display: 'grid',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            码制：<code style={{ fontFamily: 'var(--font-mono)' }}>{result.format}</code>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <code
              data-testid="barcode-decode-text"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', wordBreak: 'break-all', flex: 1 }}
            >
              {result.text}
            </code>
            <button className="theme-btn" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => copy(result.text)}>
              复制
            </button>
          </div>
        </div>
      )}

      {error && (
        <p data-testid="barcode-decode-error" style={{ color: 'var(--color-danger)', fontSize: '13px', textAlign: 'center' }}>⚠ {error}</p>
      )}
    </section>
  )
}

/* ============================= 小控件 ============================= */

function SliderField({
  label, min, max, step, value, onChange, suffix,
}: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; suffix?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
      <span style={{ fontWeight: 600 }}>{label}：{value}{suffix}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '32px', height: '28px', padding: 0, border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }}
      />
    </label>
  )
}
