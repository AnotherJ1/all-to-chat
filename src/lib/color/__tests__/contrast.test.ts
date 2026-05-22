import { describe, it, expect } from 'vitest'
import { contrastRatio, evaluateContrast, ratioGrade, relativeLuminance } from '../contrast'

describe('relativeLuminance 极值', () => {
  it('白色相对亮度 = 1', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 4)
  })
  it('黑色相对亮度 = 0', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 4)
  })
})

describe('contrastRatio', () => {
  it('黑白对比度 = 21', () => {
    const r = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
    expect(r).toBeCloseTo(21, 1)
  })
  it('白对白对比度 = 1', () => {
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2)
  })
  it('对比度对称:swap 不改变结果', () => {
    const a = { r: 12, g: 34, b: 56 }
    const b = { r: 200, g: 220, b: 240 }
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 4)
  })
})

describe('evaluateContrast 等级判定', () => {
  it('黑白:全部通过且 ratio≈21', () => {
    const v = evaluateContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
    expect(v.aaNormal).toBe(true)
    expect(v.aaaNormal).toBe(true)
    expect(v.aaLarge).toBe(true)
    expect(v.aaaLarge).toBe(true)
    expect(v.uiComponent).toBe(true)
    expect(v.ratio).toBeGreaterThanOrEqual(20)
  })
  it('已知 AAA 通过对:#000 / #DDD 比值 > 7', () => {
    const v = evaluateContrast({ r: 0, g: 0, b: 0 }, { r: 0xdd, g: 0xdd, b: 0xdd })
    expect(v.aaaNormal).toBe(true)
  })
  it('低对比度 #777 / #888 不达 AA', () => {
    const v = evaluateContrast({ r: 0x77, g: 0x77, b: 0x77 }, { r: 0x88, g: 0x88, b: 0x88 })
    expect(v.aaNormal).toBe(false)
    expect(v.aaLarge).toBe(false)
  })
  it('白底深灰文字 #595959 通过 AA Normal(WCAG 经典示例)', () => {
    const v = evaluateContrast({ r: 0x59, g: 0x59, b: 0x59 }, { r: 255, g: 255, b: 255 })
    expect(v.aaNormal).toBe(true)
  })
})

describe('ratioGrade 标签', () => {
  it('21 → AAA', () => {
    expect(ratioGrade(21)).toBe('AAA')
  })
  it('5 → AA', () => {
    expect(ratioGrade(5)).toBe('AA')
  })
  it('3.5 → AA Large', () => {
    expect(ratioGrade(3.5)).toBe('AA Large')
  })
  it('2 → Fail', () => {
    expect(ratioGrade(2)).toBe('Fail')
  })
})
