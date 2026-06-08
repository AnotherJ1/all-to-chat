import { describe, it, expect } from 'vitest'
import { RAMPS, imageDataToAscii, computeRows } from '../image-to-ascii'

/** 构造单像素 RGBA 的 ImageData 数组 */
function px(r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, a])
}

describe('ascii/image-to-ascii · imageDataToAscii', () => {
  it('全黑像素映射到最暗字符（ramp 首字符）', () => {
    const ramp = RAMPS.simple // '@%#*+=-:. '
    const out = imageDataToAscii(px(0, 0, 0), 1, 1, ramp, false)
    expect(out).toBe(ramp[0])
  })

  it('全白像素映射到最亮字符（ramp 末字符）', () => {
    const ramp = RAMPS.simple
    const out = imageDataToAscii(px(255, 255, 255), 1, 1, ramp, false)
    expect(out).toBe(ramp[ramp.length - 1])
  })

  it('反色把黑像素映射到最亮字符', () => {
    const ramp = RAMPS.simple
    const out = imageDataToAscii(px(0, 0, 0), 1, 1, ramp, true)
    expect(out).toBe(ramp[ramp.length - 1])
  })

  it('完全透明像素视为最亮（背景）', () => {
    const ramp = RAMPS.simple
    const out = imageDataToAscii(px(0, 0, 0, 0), 1, 1, ramp, false)
    expect(out).toBe(ramp[ramp.length - 1])
  })

  it('多行输出以换行分隔，行数=height', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4).fill(0)
    for (let i = 3; i < data.length; i += 4) data[i] = 255 // alpha
    const out = imageDataToAscii(data, 2, 2, RAMPS.simple, false)
    expect(out.split('\n')).toHaveLength(2)
    expect(out.split('\n')[0]).toHaveLength(2)
  })

  it('零尺寸返回空串', () => {
    expect(imageDataToAscii(new Uint8ClampedArray(), 0, 0, RAMPS.simple, false)).toBe('')
  })
})

describe('ascii/image-to-ascii · computeRows', () => {
  it('正方形图按字符高宽比 0.5 折算', () => {
    // 100x100，columns=100 → rows = 100 * 0.5 = 50
    expect(computeRows(100, 100, 100, 0.5)).toBe(50)
  })

  it('宽图行数更少', () => {
    expect(computeRows(200, 100, 100, 0.5)).toBe(25)
  })

  it('至少返回 1 行', () => {
    expect(computeRows(1000, 1, 10, 0.5)).toBe(1)
  })

  it('非法宽度回退 1', () => {
    expect(computeRows(0, 100, 100)).toBe(1)
  })
})
