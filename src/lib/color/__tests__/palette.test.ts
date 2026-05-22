import { describe, it, expect } from 'vitest'
import { buildPalette, buildAllPalettes, SCHEMES } from '../palette'
import { rgbToHsl } from '../convert'

const RED = { r: 255, g: 0, b: 0 } // hue=0,饱和 100%,亮度 50%

describe('buildPalette 各方案产出色块数量正确', () => {
  for (const s of SCHEMES) {
    it(`${s.id} 输出 ${s.count} 个色块`, () => {
      expect(buildPalette(RED, s.id)).toHaveLength(s.count)
    })
  }
})

describe('buildPalette 色相旋转正确', () => {
  it('互补色:第二色色相 ≈ 180', () => {
    const palette = buildPalette(RED, 'complementary')
    const h2 = rgbToHsl(palette[1]).h
    expect(h2).toBeCloseTo(180, 0)
  })

  it('三色占:120 与 240', () => {
    const palette = buildPalette(RED, 'triadic')
    expect(rgbToHsl(palette[1]).h).toBeCloseTo(120, 0)
    expect(rgbToHsl(palette[2]).h).toBeCloseTo(240, 0)
  })

  it('类似色:-30 / 0 / +30 → 330, 0, 30', () => {
    const palette = buildPalette(RED, 'analogous')
    expect(rgbToHsl(palette[0]).h).toBeCloseTo(330, 0)
    expect(rgbToHsl(palette[1]).h).toBeCloseTo(0, 0)
    expect(rgbToHsl(palette[2]).h).toBeCloseTo(30, 0)
  })

  it('分裂互补:0, 150, 210', () => {
    const palette = buildPalette(RED, 'splitComp')
    expect(rgbToHsl(palette[1]).h).toBeCloseTo(150, 0)
    expect(rgbToHsl(palette[2]).h).toBeCloseTo(210, 0)
  })

  it('四色:0, 90, 180, 270', () => {
    const palette = buildPalette(RED, 'tetradic')
    expect(rgbToHsl(palette[1]).h).toBeCloseTo(90, 0)
    expect(rgbToHsl(palette[2]).h).toBeCloseTo(180, 0)
    expect(rgbToHsl(palette[3]).h).toBeCloseTo(270, 0)
  })
})

describe('buildAllPalettes 一次性返回 5 套方案', () => {
  it('返回 5 组', () => {
    const all = buildAllPalettes(RED)
    expect(all).toHaveLength(5)
    expect(all.map((x) => x.scheme.id)).toEqual([
      'complementary', 'triadic', 'analogous', 'splitComp', 'tetradic',
    ])
  })
})

describe('未知方案抛错', () => {
  it('未知 id 抛 Error', () => {
    // @ts-expect-error 故意传错验证防御
    expect(() => buildPalette(RED, 'unknown')).toThrow()
  })
})
