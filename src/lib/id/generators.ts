/**
 * ID 生成器集合
 * - UUID v1 / v4 / v7：基于 uuid 包；v7 若运行时不支持则按 RFC 9562 自写
 * - NanoID：可自定义长度与字符集
 * - ULID：基于 ulid 包
 * - Snowflake：1bit 符号 + 41bit 时间戳 + 5bit 数据中心 + 5bit 机器 + 12bit 序列
 * - 随机串：可指定字符集与长度
 *
 * 注意：Snowflake 内部使用 BigInt，对外统一返回 string，避免 JSON.stringify 报错。
 */

import { v1 as uuidV1, v4 as uuidV4 } from 'uuid'
import { customAlphabet, nanoid as nanoidDefault } from 'nanoid'
import { ulid } from 'ulid'

// ============== UUID ==============

/** 生成 UUID v1（基于时间戳 + MAC 风格随机节点） */
export function genUuidV1(): string {
  return uuidV1()
}

/** 生成 UUID v4（纯随机） */
export function genUuidV4(): string {
  return uuidV4()
}

/**
 * 生成 UUID v7（基于 Unix 毫秒时间戳，单调递增，适合数据库主键）
 * 当前 uuid@14 ESM 命名导出不稳定，统一按 RFC 9562 §5.7 自写实现
 */
export function genUuidV7(): string {
  // 16 字节缓冲：48bit unix_ts_ms | 4bit ver=7 | 12bit rand_a | 2bit var=10 | 62bit rand_b
  const ms = BigInt(Date.now())
  const bytes = new Uint8Array(16)
  // 高 6 字节：unix_ts_ms（big-endian）
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn)
  }
  // 后 10 字节随机
  const rand = new Uint8Array(10)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(rand)
  } else {
    for (let i = 0; i < 10; i++) rand[i] = Math.floor(Math.random() * 256)
  }
  bytes.set(rand, 6)
  // 设置 version = 0b0111
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  // 设置 variant = 0b10
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ============== NanoID ==============

/**
 * 生成 NanoID
 * @param length 长度，默认 21
 * @param alphabet 自定义字符集；不传则使用 nanoid 默认 URL-safe 字符集
 */
export function genNanoid(length = 21, alphabet?: string): string {
  if (length <= 0) throw new Error('NanoID 长度必须为正整数')
  if (alphabet && alphabet.length > 0) {
    return customAlphabet(alphabet, length)()
  }
  return nanoidDefault(length)
}

// ============== ULID ==============

/** 生成 ULID（48bit 时间戳 + 80bit 随机，Crockford Base32，单调递增） */
export function genUlid(): string {
  return ulid()
}

// ============== Snowflake ==============

export interface SnowflakeOptions {
  /** 机器 ID：0-31 */
  workerId: number
  /** 数据中心 ID：0-31 */
  datacenterId: number
  /** 起始纪元（毫秒），默认 Twitter epoch 2010-11-04 01:42:54.657 UTC */
  epoch?: number
}

/** Twitter Snowflake 默认 epoch（毫秒） */
export const DEFAULT_SNOWFLAKE_EPOCH = 1288834974657

// 内部生成器状态（按 workerId+datacenterId+epoch 维度隔离），保证单进程内序列单调
const _state = new Map<string, { lastTs: bigint; seq: bigint }>()

/**
 * Snowflake 自旋等待硬上限：超出后直接抛错，避免浏览器单线程死循环卡住 UI
 * - SPIN_MAX_ITERS：最大循环次数（防止 Date.now 精度异常时空转）
 * - SPIN_MAX_MS：最大等待毫秒数（典型情况下 1-2ms 即可跨入下一毫秒）
 * 实际终止条件取两者之较小者（先到先停）。
 */
const SNOWFLAKE_SPIN_MAX_ITERS = 50
const SNOWFLAKE_SPIN_MAX_MS = 5

/**
 * 生成 Snowflake ID（字符串形式的 64 位整数）
 * 位布局（高位 → 低位）：
 *   1bit 符号(恒 0) | 41bit 时间戳偏移 | 5bit 数据中心 | 5bit 机器 | 12bit 序列
 *
 * 性能 budget（浏览器场景重要约束）：
 * - 同一毫秒内最多 4096 个 ID（12bit 序列上限），溢出会触发自旋等待下一毫秒
 * - 浏览器单线程下，紧凑自旋会阻塞主线程直到下一 tick；为避免 UI 冻结，
 *   本实现引入硬上限（最多 50 次循环 / 5ms），超时直接抛错而不是无限自旋
 * - 不建议在前端高频（>4096/ms）调用本函数；批量生成请改用 v7 / ULID
 */
export function genSnowflake(opts: SnowflakeOptions): string {
  const { workerId, datacenterId } = opts
  const epoch = opts.epoch ?? DEFAULT_SNOWFLAKE_EPOCH

  if (!Number.isInteger(workerId) || workerId < 0 || workerId > 31) {
    throw new Error('workerId 必须在 0-31 之间')
  }
  if (!Number.isInteger(datacenterId) || datacenterId < 0 || datacenterId > 31) {
    throw new Error('datacenterId 必须在 0-31 之间')
  }
  if (!Number.isFinite(epoch) || epoch < 0) {
    throw new Error('epoch 必须是非负整数')
  }

  const key = `${workerId}-${datacenterId}-${epoch}`
  let st = _state.get(key)
  if (!st) {
    st = { lastTs: -1n, seq: 0n }
    _state.set(key, st)
  }

  let now = BigInt(Date.now())
  if (now < st.lastTs) {
    // 时钟回拨：等待到上次时间，避免重复 ID
    now = st.lastTs
  }

  if (now === st.lastTs) {
    st.seq = (st.seq + 1n) & 0xfffn // 12bit 掩码
    if (st.seq === 0n) {
      // 当前毫秒序列耗尽（同毫秒已发出 4096 个 ID），自旋等到下一毫秒。
      // 加入硬上限，避免浏览器单线程下因系统时钟不前进或极端高频调用导致主线程死锁。
      const spinStartMs = Date.now()
      let iters = 0
      while (BigInt(Date.now()) <= st.lastTs) {
        iters++
        // 任一上限达到即放弃自旋，回滚序列号并抛出可识别错误，交由调用方降频或换算法
        if (iters >= SNOWFLAKE_SPIN_MAX_ITERS || Date.now() - spinStartMs >= SNOWFLAKE_SPIN_MAX_MS) {
          // 回滚刚刚 +1 后又溢出归 0 的序列号到溢出前的 0xfff，保持状态一致
          st.seq = 0xfffn
          throw new Error(
            'Snowflake 序列耗尽：同毫秒内已生成 4096 个 ID，请降低生成频率或换 v7/ULID',
          )
        }
      }
      now = BigInt(Date.now())
    }
  } else {
    st.seq = 0n
  }
  st.lastTs = now

  const tsPart = (now - BigInt(epoch)) & 0x1ffffffffffn // 41bit 掩码
  const dcPart = BigInt(datacenterId) & 0x1fn
  const wkPart = BigInt(workerId) & 0x1fn

  const id = (tsPart << 22n) | (dcPart << 17n) | (wkPart << 12n) | st.seq
  return id.toString()
}

// ============== 随机串 ==============

/**
 * 生成自定义字符集随机串
 * @param length 长度
 * @param charset 字符集（不能为空）
 */
export function genRandom(length: number, charset: string): string {
  if (!Number.isInteger(length) || length <= 0) throw new Error('长度必须为正整数')
  if (!charset || charset.length === 0) throw new Error('字符集不能为空')

  const out: string[] = []
  const n = charset.length
  // 拒绝采样确保均匀分布
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const max = 256 - (256 % n)
    const buf = new Uint8Array(length * 2)
    let filled = 0
    while (filled < length) {
      crypto.getRandomValues(buf)
      for (let i = 0; i < buf.length && filled < length; i++) {
        if (buf[i] < max) {
          out.push(charset[buf[i] % n])
          filled++
        }
      }
    }
  } else {
    for (let i = 0; i < length; i++) {
      out.push(charset[Math.floor(Math.random() * n)])
    }
  }
  return out.join('')
}

/** 常用字符集预设 */
export const CHARSET_PRESETS: Array<{ label: string; value: string }> = [
  { label: '数字', value: '0123456789' },
  { label: '小写字母', value: 'abcdefghijklmnopqrstuvwxyz' },
  { label: '大写字母', value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { label: '字母数字', value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' },
  { label: 'Hex', value: '0123456789abcdef' },
  { label: 'Base58', value: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz' },
  { label: 'URL-Safe', value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-' },
]
