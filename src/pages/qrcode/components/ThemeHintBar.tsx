/**
 * 主题提示条
 *
 * 当浏览器/页面主题为暗色（document.documentElement 的 data-theme="dark" 或
 * .dark class 或 prefers-color-scheme），但用户当前生成的二维码使用浅色背景时，
 * 提示一行温和文案："建议在打印/分享时使用白底版本"。
 *
 * 检测策略（任一为真即视为暗色）：
 * 1. document.documentElement.dataset.theme === 'dark'
 * 2. document.documentElement.classList.contains('dark')
 * 3. window.matchMedia('(prefers-color-scheme: dark)').matches
 *
 * 浅色背景判定：bgColor 在 sRGB 下相对亮度 > 0.7
 */
import { useEffect, useState } from 'react'
import { useQrCodeContext } from '../QrCodeContext'
import { isValidHexColor } from '../utils/qrUtils'

/** 把 #RGB / #RRGGBB / #RRGGBBAA 归一为 #RRGGBB */
function normalizeHex(hex: string): string | null {
  if (!isValidHexColor(hex)) return null
  const s = hex.trim()
  if (s.length === 4) {
    return '#' + s.slice(1).split('').map((c) => c + c).join('')
  }
  if (s.length === 9) return s.slice(0, 7)
  return s
}

/** 计算 sRGB 相对亮度（0~1） */
function relativeLuminance(hex: string): number {
  const norm = normalizeHex(hex)
  if (!norm) return 1
  const r = parseInt(norm.slice(1, 3), 16) / 255
  const g = parseInt(norm.slice(3, 5), 16) / 255
  const b = parseInt(norm.slice(5, 7), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** 当前页面是否处于暗色主题 */
function detectDarkTheme(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const root = document.documentElement
    if (root?.dataset?.theme === 'dark') return true
    if (root?.classList?.contains('dark')) return true
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      if (mq && mq.matches) return true
    }
  } catch {
    // 忽略
  }
  return false
}

export function ThemeHintBar() {
  const { generator } = useQrCodeContext()
  const [isDark, setIsDark] = useState<boolean>(() => detectDarkTheme())

  // 监听主题变化（系统级 + 手动切换）
  useEffect(() => {
    if (typeof window === 'undefined') return
    let mq: MediaQueryList | null = null
    const onChange = () => setIsDark(detectDarkTheme())

    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq?.addEventListener?.('change', onChange)
    } catch {
      // 老浏览器
    }

    // 监听 documentElement 上的属性/类变化
    let observer: MutationObserver | null = null
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      observer = new MutationObserver(onChange)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class'],
      })
    }

    return () => {
      mq?.removeEventListener?.('change', onChange)
      observer?.disconnect()
    }
  }, [])

  const lum = relativeLuminance(generator.bgColor)
  const isLightBg = lum > 0.7

  // 仅在 暗主题 + 浅背景 才提示
  if (!isDark || !isLightBg) return null

  return (
    <div
      data-testid="theme-hint-bar"
      role="note"
      className="text-xs px-3 py-2 rounded mt-3 flex items-center gap-2"
      style={{
        background: 'color-mix(in srgb, var(--accent-1) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-1) 30%, transparent)',
        color: 'var(--text-secondary)',
      }}
    >
      <span aria-hidden>💡</span>
      <span>
        当前为暗色主题但二维码使用浅色背景，建议在打印 / 分享时使用白底版本以提高扫描成功率。
      </span>
    </div>
  )
}
