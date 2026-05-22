/**
 * WCAG 2.1 对比度计算
 * - 相对亮度: L = 0.2126*R + 0.7152*G + 0.0722*B (R/G/B 经 sRGB → linear 转换)
 * - 对比度比值: (L1 + 0.05) / (L2 + 0.05),L1 为较亮者
 * - 判定阈值:
 *   - 普通文本 AA: ≥ 4.5,AAA: ≥ 7
 *   - 大文本(≥18pt 或 14pt 加粗) AA: ≥ 3,AAA: ≥ 4.5
 *   - 非文本 UI 组件 AA: ≥ 3
 *
 * 参考: https://www.w3.org/TR/WCAG21/#contrast-minimum
 */

import type { RGB } from './convert'

/** sRGB(0-1) gamma → linear-light */
function channelToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

/** WCAG 相对亮度(0-1),0=纯黑 1=纯白 */
export function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

/** 两色 WCAG 对比度比值,范围 1:1 ~ 21:1 */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export interface ContrastVerdict {
  ratio: number
  /** 普通文本 AA */
  aaNormal: boolean
  /** 普通文本 AAA */
  aaaNormal: boolean
  /** 大文本(≥18pt / 14pt 粗体) AA */
  aaLarge: boolean
  /** 大文本 AAA */
  aaaLarge: boolean
  /** 非文本 UI 组件 AA(图标/边框等) */
  uiComponent: boolean
}

/** 完整 WCAG 判定 */
export function evaluateContrast(fg: RGB, bg: RGB): ContrastVerdict {
  const ratio = contrastRatio(fg, bg)
  return {
    ratio: Math.round(ratio * 100) / 100,
    aaNormal: ratio >= 4.5,
    aaaNormal: ratio >= 7,
    aaLarge: ratio >= 3,
    aaaLarge: ratio >= 4.5,
    uiComponent: ratio >= 3,
  }
}

/**
 * 给出某个等级的人话标签
 * 返回 'AAA' | 'AA' | 'AA Large' | 'Fail'
 */
export function ratioGrade(ratio: number): 'AAA' | 'AA' | 'AA Large' | 'Fail' {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA Large'
  return 'Fail'
}
