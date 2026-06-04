import { describe, it, expect } from 'vitest'
import { parseCron } from '../cron-parser'

describe('parseCron — 日/周 OR 语义', () => {
  // 标准 cron（Vixie cron）：当「日」「周」都被限定时，二者为 OR 关系
  it('当 dom 和 dow 都被限定时，满足其一即触发（OR）', () => {
    // 每月 13 号 或 每周五（2024 年从 1 月 1 日起）
    const from = new Date(2024, 0, 1, 0, 0, 0)
    const res = parseCron('0 0 13 * 5', 10, from)
    expect(res.valid).toBe(true)
    const runs = res.nextRuns!
    expect(runs.length).toBeGreaterThan(0)

    // 应包含 1 月的每个周五
    const jan2024Fridays = [5, 12, 19, 26]
    for (const d of jan2024Fridays) {
      expect(runs.some((r) => r.getMonth() === 0 && r.getDate() === d)).toBe(true)
    }
    // 也应包含 1 月 13 号（周六，不是周五）—— 证明是 OR 而非 AND
    expect(runs.some((r) => r.getMonth() === 0 && r.getDate() === 13)).toBe(true)
  })

  it('仅 dom 被限定时按 AND（dow 为通配不参与）', () => {
    const from = new Date(2024, 0, 1, 0, 0, 0)
    const res = parseCron('0 0 15 * *', 3, from)
    expect(res.valid).toBe(true)
    // 应当全部是每月 15 号
    expect(res.nextRuns!.every((r) => r.getDate() === 15)).toBe(true)
  })

  it('仅 dow 被限定时按 AND（dom 为通配不参与）', () => {
    const from = new Date(2024, 0, 1, 0, 0, 0)
    const res = parseCron('0 0 * * 1', 3, from)
    expect(res.valid).toBe(true)
    // 应当全部是周一
    expect(res.nextRuns!.every((r) => r.getDay() === 1)).toBe(true)
  })

  it('? 视作通配，不触发 OR 分支', () => {
    const from = new Date(2024, 0, 1, 0, 0, 0)
    const res = parseCron('0 0 15 * ?', 3, from)
    expect(res.valid).toBe(true)
    expect(res.nextRuns!.every((r) => r.getDate() === 15)).toBe(true)
  })
})
