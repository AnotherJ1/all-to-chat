/**
 * ID 反解析器
 * - parseUuid：识别 UUID v1/v4/v7（v1/v7 提取毫秒时间戳）
 * - parseUlid：拆分 48bit 时间戳 + 80bit 随机段（Crockford Base32）
 * - parseSnowflake：还原时间戳 / datacenter / worker / sequence
 */

import { DEFAULT_SNOWFLAKE_EPOCH } from './generators'

// ============== UUID ==============

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export interface UuidParseResult {
  valid: boolean
  version?: number
  variant?: string
  /** 仅 v1 / v7 包含；毫秒级 Unix 时间 */
  timestamp?: number
  raw: string
  error?: string
}

/** Gregorian → Unix 毫秒：UUID v1 起点 1582-10-15 与 Unix 1970-01-01 的差（100ns 单位） */
const UUID_V1_EPOCH_OFFSET_100NS = 0x01b21dd213814000n

/**
 * 反解析 UUID
 */
export function parseUuid(input: string): UuidParseResult {
  const s = input.trim()
  if (!UUID_RE.test(s)) {
    return { valid: false, raw: input, error: 'UUID 格式不合法（需 8-4-4-4-12 hex）' }
  }
  const hex = s.replace(/-/g, '').toLowerCase()
  // version 在第 13 个 hex 字符
  const version = parseInt(hex[12], 16)
  // variant 在第 17 个 hex 字符高位
  const variantNibble = parseInt(hex[16], 16)
  let variant = 'unknown'
  if ((variantNibble & 0b1000) === 0) variant = 'NCS'
  else if ((variantNibble & 0b1100) === 0b1000) variant = 'RFC 4122/9562'
  else if ((variantNibble & 0b1110) === 0b1100) variant = 'Microsoft'
  else variant = 'Reserved'

  const result: UuidParseResult = { valid: true, version, variant, raw: s }

  if (version === 1) {
    // v1: time_low(8) - time_mid(4) - time_hi_and_version(4) - clock_seq(4) - node(12)
    const timeLow = hex.slice(0, 8)
    const timeMid = hex.slice(8, 12)
    const timeHi = hex.slice(13, 16) // 去掉 version nibble
    const ts100ns = BigInt('0x' + timeHi + timeMid + timeLow)
    const unixMs = Number((ts100ns - UUID_V1_EPOCH_OFFSET_100NS) / 10000n)
    result.timestamp = unixMs
  } else if (version === 7) {
    // v7: 高 48bit 即 unix_ts_ms
    const tsHex = hex.slice(0, 12)
    result.timestamp = Number(BigInt('0x' + tsHex))
  }

  return result
}

// ============== ULID ==============

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CROCKFORD_MAP: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  for (let i = 0; i < CROCKFORD.length; i++) {
    m[CROCKFORD[i]] = i
    m[CROCKFORD[i].toLowerCase()] = i
  }
  // ULID 规范别名
  m['I'] = 1; m['i'] = 1
  m['L'] = 1; m['l'] = 1
  m['O'] = 0; m['o'] = 0
  m['U'] = -1; m['u'] = -1 // 禁用字符
  return m
})()

export interface UlidParseResult {
  valid: boolean
  /** 毫秒级 Unix 时间戳 */
  timestamp?: number
  /** 80bit 随机部分（hex 字符串，20 字符） */
  randomness?: string
  raw: string
  error?: string
}

/**
 * 反解析 ULID（26 字符 Crockford Base32）
 * 前 10 字符 = 48bit 时间戳，后 16 字符 = 80bit 随机
 */
export function parseUlid(input: string): UlidParseResult {
  const s = input.trim().toUpperCase()
  if (s.length !== 26) {
    return { valid: false, raw: input, error: `ULID 长度必须为 26（实际 ${s.length}）` }
  }

  // 解码时间戳部分（前 10 字符 → 50bit，但只用低 48bit；首字符必须 ≤ 7）
  let ts = 0n
  for (let i = 0; i < 10; i++) {
    const v = CROCKFORD_MAP[s[i]]
    if (v === undefined || v < 0) {
      return { valid: false, raw: input, error: `非法字符: ${s[i]}` }
    }
    ts = (ts << 5n) | BigInt(v)
  }
  if (ts > 0xffffffffffffn) {
    return { valid: false, raw: input, error: '时间戳超出 48bit' }
  }

  // 随机部分（16 字符 → 80bit）
  let randBig = 0n
  for (let i = 10; i < 26; i++) {
    const v = CROCKFORD_MAP[s[i]]
    if (v === undefined || v < 0) {
      return { valid: false, raw: input, error: `非法字符: ${s[i]}` }
    }
    randBig = (randBig << 5n) | BigInt(v)
  }

  return {
    valid: true,
    raw: s,
    timestamp: Number(ts),
    randomness: randBig.toString(16).padStart(20, '0'),
  }
}

// ============== Snowflake ==============

export interface SnowflakeParseResult {
  valid: boolean
  /** 毫秒级 Unix 时间戳（已加上 epoch） */
  timestamp?: number
  datacenterId?: number
  workerId?: number
  sequence?: number
  raw: string
  error?: string
}

/**
 * 反解析 Snowflake ID（字符串形式的十进制 64bit 整数）
 */
export function parseSnowflake(
  input: string,
  opts: { epoch?: number } = {},
): SnowflakeParseResult {
  const s = input.trim()
  if (!/^\d+$/.test(s)) {
    return { valid: false, raw: input, error: 'Snowflake 必须为十进制整数字符串' }
  }
  const epoch = opts.epoch ?? DEFAULT_SNOWFLAKE_EPOCH

  let id: bigint
  try {
    id = BigInt(s)
  } catch (e) {
    return { valid: false, raw: input, error: '无法解析为 BigInt: ' + (e as Error).message }
  }
  if (id < 0n) {
    return { valid: false, raw: input, error: 'Snowflake 必须为非负整数' }
  }

  const sequence = Number(id & 0xfffn)
  const workerId = Number((id >> 12n) & 0x1fn)
  const datacenterId = Number((id >> 17n) & 0x1fn)
  const tsPart = (id >> 22n) & 0x1ffffffffffn
  const timestamp = Number(tsPart + BigInt(epoch))

  return {
    valid: true,
    raw: s,
    timestamp,
    datacenterId,
    workerId,
    sequence,
  }
}

// ============== 自动识别 ==============

export type IdKind = 'uuid' | 'ulid' | 'snowflake' | 'unknown'

/** 粗略识别 ID 类型（仅做格式判别，不深入校验） */
export function detectIdKind(input: string): IdKind {
  const s = input.trim()
  if (UUID_RE.test(s)) return 'uuid'
  if (s.length === 26 && /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]+$/.test(s)) return 'ulid'
  if (/^\d{15,20}$/.test(s)) return 'snowflake'
  return 'unknown'
}
