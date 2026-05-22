import { useEffect, useRef } from 'react'
import type { RGB } from '../../lib/color/convert'
import { hsvToRgb, rgbToHsv } from '../../lib/color/convert'

/**
 * 颜色选择器
 * - 顶部:原生 <input type="color"> 快速选色
 * - 下方:自绘 HSV 圆盘(Canvas 200×200)
 *   - 角度 = 色相 H(0-360)
 *   - 半径 = 饱和度 S(0-100)
 *   - 亮度 V 通过下方滑块控制
 *   - 圆盘上小圆环标识当前色相+饱和度位置
 *
 * 圆盘渲染采用极坐标遍历像素 + putImageData,200×200 体量在桌面浏览器单帧 < 5ms
 */

interface Props {
  value: RGB
  onChange: (rgb: RGB) => void
}

const SIZE = 200
const RADIUS = SIZE / 2

export default function ColorPicker({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hsv = rgbToHsv(value)

  // 当 V 改变时重绘圆盘(H/S 由用户在画布上点击,不需要重绘)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawWheel(ctx, hsv.v)
  }, [hsv.v])

  /** 渲染 HSV 圆盘 */
  const drawWheel = (ctx: CanvasRenderingContext2D, v: number) => {
    const img = ctx.createImageData(SIZE, SIZE)
    const data = img.data
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = x - RADIUS
        const dy = y - RADIUS
        const dist = Math.sqrt(dx * dx + dy * dy)
        const idx = (y * SIZE + x) * 4
        if (dist > RADIUS) {
          // 圆外透明
          data[idx + 3] = 0
          continue
        }
        const angle = Math.atan2(dy, dx) * 180 / Math.PI
        const h = (angle + 360) % 360
        const s = Math.min(1, dist / RADIUS) * 100
        const { r, g, b } = hsvToRgb({ h, s, v })
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  /** Canvas 点击/拖动 → 反推 HSV */
  const pickFromCanvas = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (clientX - rect.left) * (SIZE / rect.width)
    const y = (clientY - rect.top) * (SIZE / rect.height)
    const dx = x - RADIUS
    const dy = y - RADIUS
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > RADIUS) return
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    const h = (angle + 360) % 360
    const s = Math.min(1, dist / RADIUS) * 100
    onChange(hsvToRgb({ h, s, v: hsv.v }))
  }

  // 当前色环指示器位置(基于当前 H/S)
  const indicatorAngle = hsv.h * Math.PI / 180
  const indicatorDist = (hsv.s / 100) * RADIUS
  const indicatorX = RADIUS + Math.cos(indicatorAngle) * indicatorDist
  const indicatorY = RADIUS + Math.sin(indicatorAngle) * indicatorDist

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <input
        type="color"
        value={rgbToHexShort(value)}
        onChange={(e) => {
          const hex = e.target.value
          const r = parseInt(hex.slice(1, 3), 16)
          const g = parseInt(hex.slice(3, 5), 16)
          const b = parseInt(hex.slice(5, 7), 16)
          onChange({ r, g, b })
        }}
        style={{
          width: '100%',
          height: '40px',
          padding: 0,
          border: 'var(--border-width) solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          background: 'transparent',
          cursor: 'pointer',
        }}
        title="系统取色器"
      />

      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            boxShadow: 'var(--shadow-md)',
            cursor: 'crosshair',
            touchAction: 'none',
          }}
          onMouseDown={(e) => {
            pickFromCanvas(e.clientX, e.clientY)
            const move = (ev: MouseEvent) => pickFromCanvas(ev.clientX, ev.clientY)
            const up = () => {
              window.removeEventListener('mousemove', move)
              window.removeEventListener('mouseup', up)
            }
            window.addEventListener('mousemove', move)
            window.addEventListener('mouseup', up)
          }}
          onTouchStart={(e) => {
            const t = e.touches[0]
            pickFromCanvas(t.clientX, t.clientY)
          }}
          onTouchMove={(e) => {
            e.preventDefault()
            const t = e.touches[0]
            pickFromCanvas(t.clientX, t.clientY)
          }}
        />
        {/* 当前色指示环 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `calc(${(indicatorX / SIZE) * 100}% - 8px)`,
            top: `calc(${(indicatorY / SIZE) * 100}% - 8px)`,
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        />
      </div>

      <label style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <span style={{ minWidth: '60px' }}>亮度 V</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(hsv.v)}
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange(hsvToRgb({ h: hsv.h, s: hsv.s, v }))
          }}
          style={{ flex: 1 }}
        />
        <span style={{ minWidth: '40px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
          {Math.round(hsv.v)}%
        </span>
      </label>
    </div>
  )
}

/** 内部短 hex(不依赖 convert.ts 的 toUpperCase,因 input[type=color] 要小写) */
function rgbToHexShort({ r, g, b }: RGB): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
