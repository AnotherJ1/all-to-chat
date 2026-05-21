/**
 * StyledQrPanel - 风格化二维码面板
 *
 * 设计：
 *  - 不替换 useQrGenerator 主 canvas（避免破坏复制图片/复制 base64/PNG 下载等流程）
 *  - 折叠开关，开启后才挂载并渲染独立的 qr-code-styling 预览
 *  - 风格参数完全本地 state，通过 useQrCodeContext 取 generator 的内容/颜色/尺寸/容错/Logo
 *  - 单独的"下载风格化 PNG / SVG"按钮，使用 qr-code-styling 自带的 download
 *
 * 支持：
 *  - dotsOptions.type: square / rounded / dots / classy / extra-rounded / classy-rounded
 *  - cornersSquareOptions.type: square / dot / extra-rounded
 *  - cornersDotOptions.type: square / dot
 *  - 渐变开关：linear / radial + 起止色 + 角度
 *  - logoDataUrl 透传 image
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import QRCodeStyling, {
  type DotType,
  type CornerSquareType,
  type CornerDotType,
  type Options as QrStylingOptions,
} from 'qr-code-styling'
import { useQrCodeContext } from '../QrCodeContext'
import { toast } from '../../../stores/toastStore'

// 注意：qr-code-styling 的容错等级取值是 'L' | 'M' | 'Q' | 'H'，与本项目类型一致

const DOT_STYLES: ReadonlyArray<{ value: DotType; label: string }> = [
  { value: 'square', label: '方块' },
  { value: 'rounded', label: '圆角方块' },
  { value: 'dots', label: '圆点' },
  { value: 'classy', label: '经典' },
  { value: 'extra-rounded', label: '超圆角' },
  { value: 'classy-rounded', label: '经典圆角' },
]

const CORNER_SQUARE_STYLES: ReadonlyArray<{ value: CornerSquareType; label: string }> = [
  { value: 'square', label: '方形' },
  { value: 'dot', label: '圆点' },
  { value: 'extra-rounded', label: '超圆角' },
]

const CORNER_DOT_STYLES: ReadonlyArray<{ value: CornerDotType; label: string }> = [
  { value: 'square', label: '方形' },
  { value: 'dot', label: '圆点' },
]

type GradientType = 'linear' | 'radial'

export function StyledQrPanel(): JSX.Element {
  const { generator } = useQrCodeContext()
  const { text, size, fgColor, bgColor, errorLevel, logoDataUrl } = generator

  // === 用户开关 ===
  const [enabled, setEnabled] = useState(false)
  const [dotStyle, setDotStyle] = useState<DotType>('rounded')
  const [cornerSquareStyle, setCornerSquareStyle] = useState<CornerSquareType>('extra-rounded')
  const [cornerDotStyle, setCornerDotStyle] = useState<CornerDotType>('dot')

  // === 渐变 ===
  const [gradientEnabled, setGradientEnabled] = useState(false)
  const [gradientType, setGradientType] = useState<GradientType>('linear')
  const [gradientFrom, setGradientFrom] = useState('#6366f1')
  const [gradientTo, setGradientTo] = useState('#ec4899')
  const [gradientAngle, setGradientAngle] = useState(45)

  // qr-code-styling 实例与挂载点
  const qrRef = useRef<QRCodeStyling | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 计算 qr-code-styling Options
  const options = useMemo<QrStylingOptions>(() => {
    // 渐变方向（弧度），qr-code-styling 角度单位为弧度
    const rotation = gradientEnabled
      ? (gradientAngle * Math.PI) / 180
      : 0

    const dotsOptions: QrStylingOptions['dotsOptions'] = gradientEnabled
      ? {
          type: dotStyle,
          gradient: {
            type: gradientType,
            rotation,
            colorStops: [
              { offset: 0, color: gradientFrom },
              { offset: 1, color: gradientTo },
            ],
          },
        }
      : { type: dotStyle, color: fgColor }

    return {
      width: size,
      height: size,
      type: 'canvas',
      data: text || ' ',
      margin: 8,
      qrOptions: {
        errorCorrectionLevel: errorLevel,
      },
      backgroundOptions: { color: bgColor },
      dotsOptions,
      cornersSquareOptions: { type: cornerSquareStyle },
      cornersDotOptions: { type: cornerDotStyle },
      image: logoDataUrl || undefined,
      imageOptions: logoDataUrl
        ? { crossOrigin: 'anonymous', margin: 4, imageSize: 0.25, hideBackgroundDots: true }
        : undefined,
    }
  }, [
    text, size, fgColor, bgColor, errorLevel, logoDataUrl,
    dotStyle, cornerSquareStyle, cornerDotStyle,
    gradientEnabled, gradientType, gradientFrom, gradientTo, gradientAngle,
  ])

  // 仅在 enabled 后挂载并保持 update
  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    if (!container) return

    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(options)
      // 清空容器后挂载
      container.innerHTML = ''
      qrRef.current.append(container)
    } else {
      qrRef.current.update(options)
    }
  }, [enabled, options])

  // 切回普通模式时回收 DOM（保持下次开启重新创建）
  useEffect(() => {
    if (enabled) return
    if (containerRef.current) containerRef.current.innerHTML = ''
    qrRef.current = null
  }, [enabled])

  /** 下载风格化 PNG */
  const handleDownloadPng = async () => {
    if (!qrRef.current) {
      toast.error('请先开启风格化预览')
      return
    }
    try {
      await qrRef.current.download({ name: `qrcode_styled_${Date.now()}`, extension: 'png' })
      toast.success('已开始下载风格化 PNG')
    } catch {
      toast.error('风格化 PNG 下载失败')
    }
  }

  /** 下载风格化 SVG */
  const handleDownloadSvg = async () => {
    if (!qrRef.current) {
      toast.error('请先开启风格化预览')
      return
    }
    try {
      await qrRef.current.download({ name: `qrcode_styled_${Date.now()}`, extension: 'svg' })
      toast.success('已开始下载风格化 SVG')
    } catch {
      toast.error('风格化 SVG 下载失败')
    }
  }

  return (
    <div
      data-testid="styled-qr-panel"
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
      }}
    >
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            aria-label="开启风格化二维码"
          />
          风格化二维码（实验功能）
        </label>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          独立预览 + 风格化 PNG/SVG 导出
        </span>
      </div>

      {enabled && (
        <>
          {/* 风格选项 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>
                点样式
              </label>
              <select
                className="theme-select w-full"
                value={dotStyle}
                onChange={(e) => setDotStyle(e.target.value as DotType)}
                aria-label="点样式"
                style={{ padding: '6px 28px 6px 10px', fontSize: '12px' }}
              >
                {DOT_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>
                定位框样式
              </label>
              <select
                className="theme-select w-full"
                value={cornerSquareStyle}
                onChange={(e) => setCornerSquareStyle(e.target.value as CornerSquareType)}
                aria-label="定位框样式"
                style={{ padding: '6px 28px 6px 10px', fontSize: '12px' }}
              >
                {CORNER_SQUARE_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>
                定位点样式
              </label>
              <select
                className="theme-select w-full"
                value={cornerDotStyle}
                onChange={(e) => setCornerDotStyle(e.target.value as CornerDotType)}
                aria-label="定位点样式"
                style={{ padding: '6px 28px 6px 10px', fontSize: '12px' }}
              >
                {CORNER_DOT_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 渐变 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={gradientEnabled}
                onChange={(e) => setGradientEnabled(e.target.checked)}
                aria-label="启用渐变前景"
              />
              启用前景渐变（覆盖主色）
            </label>

            {gradientEnabled && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    渐变类型
                  </label>
                  <select
                    className="theme-select w-full"
                    value={gradientType}
                    onChange={(e) => setGradientType(e.target.value as GradientType)}
                    style={{ padding: '6px 28px 6px 10px', fontSize: '12px' }}
                    aria-label="渐变类型"
                  >
                    <option value="linear">线性</option>
                    <option value="radial">径向</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    起始色
                  </label>
                  <input
                    type="color"
                    value={gradientFrom}
                    onChange={(e) => setGradientFrom(e.target.value)}
                    style={{ width: '100%', height: 32, border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                    aria-label="渐变起始色"
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    结束色
                  </label>
                  <input
                    type="color"
                    value={gradientTo}
                    onChange={(e) => setGradientTo(e.target.value)}
                    style={{ width: '100%', height: 32, border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                    aria-label="渐变结束色"
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    角度 {gradientAngle}°
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={gradientAngle}
                    onChange={(e) => setGradientAngle(Number(e.target.value))}
                    disabled={gradientType !== 'linear'}
                    style={{ width: '100%', accentColor: 'var(--accent-1)' }}
                    aria-label="渐变角度"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 预览 + 下载 */}
          <div className="flex flex-col items-center gap-3 mt-2">
            <div
              ref={containerRef}
              data-testid="styled-qr-canvas"
              style={{
                background: bgColor,
                padding: 8,
                borderRadius: 'var(--radius-sm)',
                border: 'var(--border-width) solid var(--border-color)',
                minWidth: 128,
                minHeight: 128,
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="theme-btn theme-btn-primary"
                onClick={handleDownloadPng}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                下载风格化 PNG
              </button>
              <button
                type="button"
                className="theme-btn"
                onClick={handleDownloadSvg}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                下载风格化 SVG
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              提示：风格化预览不会替换上方的标准二维码，复制图片/复制 Base64 仍基于标准版。
            </p>
          </div>
        </>
      )}
    </div>
  )
}
