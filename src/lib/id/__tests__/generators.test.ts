import { describe, it, expect } from 'vitest'
import {
  genUuidV1,
  genUuidV4,
  genUuidV7,
  genNanoid,
  genUlid,
  genSnowflake,
  genRandom,
  DEFAULT_SNOWFLAKE_EPOCH,
} from '../generators'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('genUuidV1', () => {
  it('生成符合 UUID 格式且版本位为 1', () => {
    const id = genUuidV1()
    expect(id).toMatch(UUID_RE)
    expect(id[14]).toBe('1')
  })
  it('两次生成结果不同', () => {
    expect(genUuidV1()).not.toBe(genUuidV1())
  })
})

describe('genUuidV4', () => {
  it('生成符合 UUID 格式且版本位为 4', () => {
    const id = genUuidV4()
    expect(id).toMatch(UUID_RE)
    expect(id[14]).toBe('4')
  })
  it('多次生成全部唯一', () => {
    const set = new Set<string>()
    for (let i = 0; i < 50; i++) set.add(genUuidV4())
    expect(set.size).toBe(50)
  })
})

describe('genUuidV7', () => {
  it('生成符合 UUID 格式且版本位为 7', () => {
    const id = genUuidV7()
    expect(id).toMatch(UUID_RE)
    expect(id[14]).toBe('7')
  })
  it('时间戳前缀单调递增（同一毫秒内允许相等）', () => {
    const a = genUuidV7()
    // 强制跨毫秒
    const t = Date.now()
    while (Date.now() === t) { /* spin */ }
    const b = genUuidV7()
    const aHex = a.replace(/-/g, '').slice(0, 12)
    const bHex = b.replace(/-/g, '').slice(0, 12)
    expect(BigInt('0x' + bHex) >= BigInt('0x' + aHex)).toBe(true)
  })
})

describe('genNanoid', () => {
  it('默认长度 21', () => {
    expect(genNanoid().length).toBe(21)
  })
  it('自定义长度生效', () => {
    expect(genNanoid(10).length).toBe(10)
  })
  it('自定义字符集仅包含给定字符', () => {
    const id = genNanoid(40, '0123456789')
    expect(id).toMatch(/^[0-9]{40}$/)
  })
})

describe('genUlid', () => {
  it('长度为 26 且为 Crockford Base32', () => {
    const id = genUlid()
    expect(id.length).toBe(26)
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/)
  })
  it('两次生成结果不同', () => {
    expect(genUlid()).not.toBe(genUlid())
  })
})

describe('genSnowflake', () => {
  it('返回十进制字符串且非负', () => {
    const id = genSnowflake({ workerId: 1, datacenterId: 2 })
    expect(id).toMatch(/^\d+$/)
    expect(BigInt(id) >= 0n).toBe(true)
  })
  it('同进程内连续生成保持单调递增', () => {
    const ids: bigint[] = []
    for (let i = 0; i < 200; i++) {
      ids.push(BigInt(genSnowflake({ workerId: 3, datacenterId: 4 })))
    }
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] > ids[i - 1]).toBe(true)
    }
  })
  it('workerId 越界抛错', () => {
    expect(() => genSnowflake({ workerId: 32, datacenterId: 0 })).toThrow()
    expect(() => genSnowflake({ workerId: -1, datacenterId: 0 })).toThrow()
  })
  it('datacenterId 越界抛错', () => {
    expect(() => genSnowflake({ workerId: 0, datacenterId: 32 })).toThrow()
  })
  it('使用自定义 epoch 生成成功', () => {
    const id = genSnowflake({ workerId: 1, datacenterId: 1, epoch: DEFAULT_SNOWFLAKE_EPOCH })
    expect(id).toMatch(/^\d+$/)
  })
  it('同毫秒内高频调用（5000 次）能正常完成或在序列耗尽时抛出可识别错误，绝不死循环', () => {
    // 用独立 worker/datacenter 维度，避免污染其它用例的内部状态
    const opts = { workerId: 7, datacenterId: 7, epoch: DEFAULT_SNOWFLAKE_EPOCH }
    // 冻结 Date.now：让所有调用都落在同一毫秒，逼出 4096 序列耗尽 + 自旋上限路径
    const realNow = Date.now
    const frozen = realNow()
    Date.now = () => frozen
    let ok = 0
    let exhaustedErr: Error | null = null
    try {
      for (let i = 0; i < 5000; i++) {
        try {
          genSnowflake(opts)
          ok++
        } catch (e) {
          exhaustedErr = e as Error
          break
        }
      }
    } finally {
      Date.now = realNow
    }
    // 由于时钟被冻结，自旋必然达到硬上限 → 必须抛错且包含中文提示
    expect(exhaustedErr).not.toBeNull()
    expect(exhaustedErr?.message).toMatch(/Snowflake 序列耗尽/)
    // 抛错前至少成功生成接近 4096 个 ID（12bit 序列空间）
    expect(ok).toBeGreaterThan(0)
    expect(ok).toBeLessThanOrEqual(4096)
  })
  it('正常调用（每次间隔 ≥1ms）仍能稳定生成且单调递增（回归）', async () => {
    const ids: bigint[] = []
    for (let i = 0; i < 10; i++) {
      ids.push(BigInt(genSnowflake({ workerId: 9, datacenterId: 9 })))
      // 跨毫秒：保证序列归零路径与正常时间戳推进路径都不会触发自旋上限
      const t = Date.now()
      while (Date.now() === t) { /* spin 1ms */ }
    }
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] > ids[i - 1]).toBe(true)
    }
  })
})

describe('genRandom', () => {
  it('生成长度匹配且字符在字符集内', () => {
    const id = genRandom(32, 'abc')
    expect(id.length).toBe(32)
    expect(id).toMatch(/^[abc]+$/)
  })
  it('长度非法或字符集为空抛错', () => {
    expect(() => genRandom(0, 'a')).toThrow()
    expect(() => genRandom(10, '')).toThrow()
  })
})
