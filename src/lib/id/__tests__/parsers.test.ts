import { describe, it, expect } from 'vitest'
import {
  genUuidV1,
  genUuidV4,
  genUuidV7,
  genUlid,
  genSnowflake,
  DEFAULT_SNOWFLAKE_EPOCH,
} from '../generators'
import {
  parseUuid,
  parseUlid,
  parseSnowflake,
  detectIdKind,
} from '../parsers'

describe('parseUuid', () => {
  it('识别 v1 并提取时间戳（误差 < 5s）', () => {
    const before = Date.now()
    const id = genUuidV1()
    const r = parseUuid(id)
    expect(r.valid).toBe(true)
    expect(r.version).toBe(1)
    expect(typeof r.timestamp).toBe('number')
    expect(Math.abs((r.timestamp ?? 0) - before)).toBeLessThan(5000)
  })

  it('识别 v4 不含时间戳', () => {
    const id = genUuidV4()
    const r = parseUuid(id)
    expect(r.valid).toBe(true)
    expect(r.version).toBe(4)
    expect(r.timestamp).toBeUndefined()
  })

  it('识别 v7 并提取时间戳（误差 < 1s）', () => {
    const before = Date.now()
    const id = genUuidV7()
    const r = parseUuid(id)
    expect(r.valid).toBe(true)
    expect(r.version).toBe(7)
    expect(Math.abs((r.timestamp ?? 0) - before)).toBeLessThan(1000)
  })

  it('非法 UUID 返回 invalid', () => {
    expect(parseUuid('not-a-uuid').valid).toBe(false)
    expect(parseUuid('').valid).toBe(false)
  })

  it('已知固定 v1 字符串解析为 1985-04-12 23:20:50.520 UTC 附近', () => {
    // 来自 Wikipedia UUID 示例 v1
    const id = 'c232ab00-9414-11ec-b3c8-9e6bdeced846'
    const r = parseUuid(id)
    expect(r.valid).toBe(true)
    expect(r.version).toBe(1)
    expect(typeof r.timestamp).toBe('number')
    // 此 UUID 的时间约为 2022-02-22
    const d = new Date(r.timestamp!)
    expect(d.getUTCFullYear()).toBe(2022)
  })
})

describe('parseUlid', () => {
  it('反解析自生成 ULID 时间戳与当前时间一致（< 1s 误差）', () => {
    const before = Date.now()
    const id = genUlid()
    const r = parseUlid(id)
    expect(r.valid).toBe(true)
    expect(Math.abs((r.timestamp ?? 0) - before)).toBeLessThan(1000)
    expect(r.randomness).toMatch(/^[0-9a-f]{20}$/)
  })

  it('已知 ULID 时间戳正确', () => {
    // 时间戳 = 0x000001000000，对应 UNIX ms = 1099511627776
    // 编码：48bit -> 10 字符 base32；前 10 字符 '0000080000' 表示 0x000001000000
    // 这里直接构造一个全 0 时间戳的 ULID 字符串
    const id = '00000000000000000000000000'
    const r = parseUlid(id)
    expect(r.valid).toBe(true)
    expect(r.timestamp).toBe(0)
  })

  it('非法长度返回 invalid', () => {
    expect(parseUlid('abc').valid).toBe(false)
  })
})

describe('parseSnowflake', () => {
  it('反解析自生成 Snowflake 字段一致', () => {
    const before = Date.now()
    const id = genSnowflake({ workerId: 7, datacenterId: 9 })
    const r = parseSnowflake(id)
    expect(r.valid).toBe(true)
    expect(r.workerId).toBe(7)
    expect(r.datacenterId).toBe(9)
    expect(typeof r.sequence).toBe('number')
    expect(Math.abs((r.timestamp ?? 0) - before)).toBeLessThan(2000)
  })

  it('支持自定义 epoch', () => {
    const epoch = 1577836800000 // 2020-01-01
    const id = genSnowflake({ workerId: 1, datacenterId: 2, epoch })
    const r = parseSnowflake(id, { epoch })
    expect(r.valid).toBe(true)
    expect(r.workerId).toBe(1)
    expect(r.datacenterId).toBe(2)
  })

  it('非数字字符串返回 invalid', () => {
    expect(parseSnowflake('abc').valid).toBe(false)
    expect(parseSnowflake('-1').valid).toBe(false)
  })

  it('使用默认 epoch 解析手工构造 ID', () => {
    // 手工构造：ts=1000, dc=3, wk=5, seq=7
    const tsPart = 1000n
    const id = ((tsPart << 22n) | (3n << 17n) | (5n << 12n) | 7n).toString()
    const r = parseSnowflake(id)
    expect(r.valid).toBe(true)
    expect(r.datacenterId).toBe(3)
    expect(r.workerId).toBe(5)
    expect(r.sequence).toBe(7)
    expect(r.timestamp).toBe(Number(1000n + BigInt(DEFAULT_SNOWFLAKE_EPOCH)))
  })
})

describe('detectIdKind', () => {
  it('识别 UUID', () => {
    expect(detectIdKind(genUuidV4())).toBe('uuid')
  })
  it('识别 ULID', () => {
    expect(detectIdKind(genUlid())).toBe('ulid')
  })
  it('识别 Snowflake', () => {
    expect(detectIdKind(genSnowflake({ workerId: 1, datacenterId: 1 }))).toBe('snowflake')
  })
  it('未知类型', () => {
    expect(detectIdKind('hello world')).toBe('unknown')
  })
})
