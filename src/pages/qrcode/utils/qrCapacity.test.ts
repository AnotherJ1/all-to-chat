/**
 * qrCapacity 单元测试
 * 覆盖：
 *  - 短文本 → 命中 v1
 *  - 中等文本 → 中间版本
 *  - 接近 v40 上限 → percentUsed 接近 100
 *  - 超出 v40 上限 → version 锁定 40 且 percentUsed > 100
 *  - 中文 UTF-8 字节数计算
 *  - 不同容错等级 maxBytes 不同
 */
import { describe, it, expect } from 'vitest'
import { getQrCapacityInfo, __QR_BYTE_CAPACITY_FOR_TEST__ } from './qrCapacity'

describe('getQrCapacityInfo', () => {
  it('短文本（"hi"）应当落在 v1', () => {
    const info = getQrCapacityInfo('hi', 'M')
    expect(info.byteLength).toBe(2)
    expect(info.version).toBe(1)
    expect(info.maxBytes).toBe(14) // v1 M
    expect(info.percentUsed).toBeLessThan(20)
  })

  it('空字符串应返回 byteLength=0 与 v1', () => {
    const info = getQrCapacityInfo('', 'L')
    expect(info.byteLength).toBe(0)
    expect(info.version).toBe(1)
    expect(info.percentUsed).toBe(0)
  })

  it('中文文本应按 UTF-8 计算字节数（每字 3 字节）', () => {
    const info = getQrCapacityInfo('你好世界', 'M')
    // 4 个 BMP 中文字符 → 12 字节
    expect(info.byteLength).toBe(12)
    // v1 M 仅 14 字节，刚好能装 → version=1
    expect(info.version).toBe(1)
  })

  it('稍长文本应升级到更高版本', () => {
    const text = 'A'.repeat(20)
    const info = getQrCapacityInfo(text, 'M')
    // v1 M=14 装不下，应升到 v2 (M=26)
    expect(info.version).toBe(2)
    expect(info.maxBytes).toBe(26)
    expect(info.byteLength).toBe(20)
    expect(info.percentUsed).toBeGreaterThan(70)
    expect(info.percentUsed).toBeLessThanOrEqual(100)
  })

  it('容错等级越高，maxBytes 越低（同等 version）', () => {
    const text = 'A'.repeat(50)
    const infoL = getQrCapacityInfo(text, 'L')
    const infoH = getQrCapacityInfo(text, 'H')
    // L 下能用更低版本承载，H 下需要更高版本
    expect(infoH.version).toBeGreaterThanOrEqual(infoL.version)
  })

  it('恰好等于某 version 上限时落在该 version', () => {
    // v1 L = 17 字节
    const text = 'A'.repeat(17)
    const info = getQrCapacityInfo(text, 'L')
    expect(info.version).toBe(1)
    expect(info.maxBytes).toBe(17)
    expect(info.percentUsed).toBe(100)
  })

  it('超过 v40 H 上限时锁定 v40 且 percentUsed > 100', () => {
    const v40H = __QR_BYTE_CAPACITY_FOR_TEST__[39].H // 1273
    const text = 'A'.repeat(v40H + 100)
    const info = getQrCapacityInfo(text, 'H')
    expect(info.version).toBe(40)
    expect(info.maxBytes).toBe(v40H)
    expect(info.percentUsed).toBeGreaterThan(100)
  })

  it('容量表覆盖 1-40 共 40 个版本', () => {
    expect(__QR_BYTE_CAPACITY_FOR_TEST__).toHaveLength(40)
    // 所有条目都应包含 L/M/Q/H 四个键且数值递增不严格但合理
    for (const row of __QR_BYTE_CAPACITY_FOR_TEST__) {
      expect(row.L).toBeGreaterThanOrEqual(row.M)
      expect(row.M).toBeGreaterThanOrEqual(row.Q)
      expect(row.Q).toBeGreaterThanOrEqual(row.H)
    }
  })
})
