/**
 * 调色板生成 — 5 种经典色彩搭配方案
 * 全部基于 HSL 色相旋转,亮度/饱和度保持不变,确保整组视觉协调
 *
 * - complementary  互补色:    h, h+180
 * - triadic        三色占:    h, h+120, h+240
 * - analogous      类似色:    h-30, h, h+30
 * - splitComp      分裂互补:  h, h+150, h+210
 * - tetradic       四色:      h, h+90, h+180, h+270
 */

import type { RGB } from './convert'
import { rgbToHsl, hslToRgb } from './convert'

export type SchemeId = 'complementary' | 'triadic' | 'analogous' | 'splitComp' | 'tetradic'

export interface Scheme {
  id: SchemeId
  /** 中文显示名 */
  name: string
  /** 该方案理论色块数量 */
  count: number
  /** 用于生成的色相偏移量(度) */
  offsets: number[]
}

export const SCHEMES: Scheme[] = [
  { id: 'complementary', name: '互补色', count: 2, offsets: [0, 180] },
  { id: 'triadic', name: '三色占', count: 3, offsets: [0, 120, 240] },
  { id: 'analogous', name: '类似色', count: 3, offsets: [-30, 0, 30] },
  { id: 'splitComp', name: '分裂互补', count: 3, offsets: [0, 150, 210] },
  { id: 'tetradic', name: '四色', count: 4, offsets: [0, 90, 180, 270] },
]

/**
 * 基于主色生成指定方案的调色板
 * @param base 主色 RGB
 * @param scheme 方案 id
 */
export function buildPalette(base: RGB, scheme: SchemeId): RGB[] {
  const cfg = SCHEMES.find((s) => s.id === scheme)
  if (!cfg) throw new Error(`未知调色板方案: ${scheme}`)
  const hsl = rgbToHsl(base)
  return cfg.offsets.map((off) => {
    const h = ((hsl.h + off) % 360 + 360) % 360
    return hslToRgb({ h, s: hsl.s, l: hsl.l })
  })
}

/** 一次性生成全部 5 套方案,UI 直接渲染 */
export function buildAllPalettes(base: RGB): Array<{ scheme: Scheme; colors: RGB[] }> {
  return SCHEMES.map((scheme) => ({ scheme, colors: buildPalette(base, scheme.id) }))
}
