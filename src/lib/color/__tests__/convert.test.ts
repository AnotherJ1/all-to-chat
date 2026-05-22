import { describe, it, expect } from 'vitest'
import {
  hexToRgba, rgbToHex, rgbaToHex,
  rgbToHsl, hslToRgb,
  rgbToHsv, hsvToRgb,
  rgbToCmyk, cmykToRgb,
  rgbToOklch, oklchToRgb,
  formatRgb, formatHsl, formatOklch,
  parseColor,
} from '../convert'

/** 容差比较:RGB 因 OKLCH 来回换算可能有 ±1 误差 */
function rgbClose(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, tol = 1) {
  expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(tol)
  expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(tol)
  expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(tol)
}

describe('hex 解析与生成', () => {
  it('#FF0000 解析为纯红', () => {
    expect(hexToRgba('#FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })
  it('短 hex #f00 等价于 #FF0000', () => {
    expect(hexToRgba('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })
  it('8 位 hex 含 alpha', () => {
    expect(hexToRgba('#FF000080')?.a).toBeCloseTo(0.5, 1)
  })
  it('无效 hex 返回 null', () => {
    expect(hexToRgba('#xyz')).toBeNull()
  })
  it('rgbToHex 对纯红输出 #FF0000', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#FF0000')
  })
  it('rgbaToHex 含透明通道', () => {
    expect(rgbaToHex({ r: 255, g: 0, b: 0, a: 0.5 })).toMatch(/^#FF000080$/i)
  })
})

describe('RGB ↔ HSL', () => {
  it('#FF0000 → HSL(0, 100%, 50%)', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 })
    expect(hsl.h).toBeCloseTo(0, 1)
    expect(hsl.s).toBeCloseTo(100, 1)
    expect(hsl.l).toBeCloseTo(50, 1)
  })
  it('HSL(0, 100, 50) → 纯红', () => {
    expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 })
  })
  it('HSL(120, 100, 50) → 纯绿', () => {
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 })
  })
  it('HSL(240, 100, 50) → 纯蓝', () => {
    expect(hslToRgb({ h: 240, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 })
  })
  it('白色 HSL(*, 0, 100)', () => {
    const hsl = rgbToHsl({ r: 255, g: 255, b: 255 })
    expect(hsl.s).toBeCloseTo(0, 1)
    expect(hsl.l).toBeCloseTo(100, 1)
  })
  it('黑色 HSL(*, 0, 0)', () => {
    const hsl = rgbToHsl({ r: 0, g: 0, b: 0 })
    expect(hsl.l).toBeCloseTo(0, 1)
  })
})

describe('RGB ↔ HSV', () => {
  it('#FF0000 → HSV(0, 100, 100)', () => {
    const hsv = rgbToHsv({ r: 255, g: 0, b: 0 })
    expect(hsv.h).toBeCloseTo(0, 1)
    expect(hsv.s).toBeCloseTo(100, 1)
    expect(hsv.v).toBeCloseTo(100, 1)
  })
  it('HSV(180, 100, 100) → 青色', () => {
    expect(hsvToRgb({ h: 180, s: 100, v: 100 })).toEqual({ r: 0, g: 255, b: 255 })
  })
})

describe('RGB ↔ CMYK', () => {
  it('#FF0000 → CMYK(0, 100, 100, 0)', () => {
    const cmyk = rgbToCmyk({ r: 255, g: 0, b: 0 })
    expect(cmyk.c).toBeCloseTo(0, 1)
    expect(cmyk.m).toBeCloseTo(100, 1)
    expect(cmyk.y).toBeCloseTo(100, 1)
    expect(cmyk.k).toBeCloseTo(0, 1)
  })
  it('黑色 → CMYK(0, 0, 0, 100)', () => {
    expect(rgbToCmyk({ r: 0, g: 0, b: 0 })).toEqual({ c: 0, m: 0, y: 0, k: 100 })
  })
  it('CMYK(0, 100, 100, 0) → 纯红(往返一致)', () => {
    rgbClose(cmykToRgb({ c: 0, m: 100, y: 100, k: 0 }), { r: 255, g: 0, b: 0 })
  })
})

describe('OKLCH 标准向量', () => {
  // 参考值:CSS Color Module 4 / oklch.com
  // #FF0000 ≈ oklch(0.6280 0.2577 29.23)
  it('#FF0000 → OKLCH ≈ (0.628, 0.258, 29.23)', () => {
    const ok = rgbToOklch({ r: 255, g: 0, b: 0 })
    expect(ok.l).toBeCloseTo(0.628, 2)
    expect(ok.c).toBeCloseTo(0.258, 2)
    expect(ok.h).toBeCloseTo(29.23, 1)
  })
  it('白色 → OKLCH(L=1, C≈0)', () => {
    const ok = rgbToOklch({ r: 255, g: 255, b: 255 })
    expect(ok.l).toBeCloseTo(1, 2)
    expect(ok.c).toBeLessThan(0.01)
  })
  it('黑色 → OKLCH(L=0, C=0)', () => {
    const ok = rgbToOklch({ r: 0, g: 0, b: 0 })
    expect(ok.l).toBeCloseTo(0, 2)
    expect(ok.c).toBeLessThan(0.01)
  })
  it('OKLCH 往返:#FF0000 → OKLCH → RGB ≈ 原值', () => {
    const ok = rgbToOklch({ r: 255, g: 0, b: 0 })
    rgbClose(oklchToRgb(ok), { r: 255, g: 0, b: 0 })
  })
  it('OKLCH 往返:#3366CC', () => {
    const orig = { r: 0x33, g: 0x66, b: 0xcc }
    rgbClose(oklchToRgb(rgbToOklch(orig)), orig)
  })
})

describe('字符串格式化', () => {
  it('formatRgb', () => {
    expect(formatRgb({ r: 255, g: 0, b: 0 })).toBe('rgb(255, 0, 0)')
  })
  it('formatHsl 基本', () => {
    expect(formatHsl({ h: 0, s: 100, l: 50 })).toMatch(/^hsl\(0, 100%, 50%\)$/)
  })
  it('formatOklch 含百分号', () => {
    expect(formatOklch({ l: 0.628, c: 0.258, h: 29.23 })).toMatch(/oklch\(62\.8% 0\.258 29\.23\)/)
  })
})

describe('parseColor 多格式入口', () => {
  it('解析 hex', () => {
    expect(parseColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })
  it('解析 rgb()', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })
  it('解析 rgba()', () => {
    const out = parseColor('rgba(255, 0, 0, 0.5)')
    expect(out?.r).toBe(255)
    expect(out?.a).toBeCloseTo(0.5, 2)
  })
  it('解析 hsl()', () => {
    rgbClose(parseColor('hsl(0, 100%, 50%)')!, { r: 255, g: 0, b: 0 })
  })
  it('解析 hsv()', () => {
    rgbClose(parseColor('hsv(0, 100%, 100%)')!, { r: 255, g: 0, b: 0 })
  })
  it('解析 oklch() 百分比', () => {
    const out = parseColor('oklch(62.8% 0.258 29.23)')
    rgbClose(out!, { r: 255, g: 0, b: 0 }, 3)
  })
  it('非法字符串返回 null', () => {
    expect(parseColor('not a color')).toBeNull()
  })
})
