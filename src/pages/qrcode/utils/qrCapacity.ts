/**
 * 二维码容量评估工具
 *
 * 用于在 UI 中实时显示当前内容相对于二维码版本最大字节容量的占用率，
 * 提示用户在内容过长时主动降低容错等级或精简内容。
 *
 * 数据来源：ISO/IEC 18004 标准中 byte 模式（8-bit）下，各容错等级
 * (L/M/Q/H) 在版本 1-40 上可承载的最大字节数。
 *
 * 注意：
 * - 这里使用 byte 模式容量；如果内容是纯数字或纯字母数字，实际可承载
 *   的"字符数"会更高，但作为字节占用估算这是较保守的下限。
 * - 我们以 UTF-8 字节长度衡量内容（中文一般 3 字节/字），这与 qrcode
 *   库的实际编码近似。
 */

import type { QrErrorLevel } from '../types'

/**
 * QR 各版本各容错等级在 byte 模式下的最大字节数（ISO/IEC 18004 表 7）。
 * 索引：QR_BYTE_CAPACITY[version - 1][errorLevel]
 */
const QR_BYTE_CAPACITY: ReadonlyArray<Readonly<Record<QrErrorLevel, number>>> = [
  /* v1 */ { L: 17, M: 14, Q: 11, H: 7 },
  /* v2 */ { L: 32, M: 26, Q: 20, H: 14 },
  /* v3 */ { L: 53, M: 42, Q: 32, H: 24 },
  /* v4 */ { L: 78, M: 62, Q: 46, H: 34 },
  /* v5 */ { L: 106, M: 84, Q: 60, H: 44 },
  /* v6 */ { L: 134, M: 106, Q: 74, H: 58 },
  /* v7 */ { L: 154, M: 122, Q: 86, H: 64 },
  /* v8 */ { L: 192, M: 152, Q: 108, H: 84 },
  /* v9 */ { L: 230, M: 180, Q: 130, H: 98 },
  /* v10 */ { L: 271, M: 213, Q: 151, H: 119 },
  /* v11 */ { L: 321, M: 251, Q: 177, H: 137 },
  /* v12 */ { L: 367, M: 287, Q: 203, H: 155 },
  /* v13 */ { L: 425, M: 331, Q: 241, H: 177 },
  /* v14 */ { L: 458, M: 362, Q: 258, H: 194 },
  /* v15 */ { L: 520, M: 412, Q: 292, H: 220 },
  /* v16 */ { L: 586, M: 450, Q: 322, H: 250 },
  /* v17 */ { L: 644, M: 504, Q: 364, H: 280 },
  /* v18 */ { L: 718, M: 560, Q: 394, H: 310 },
  /* v19 */ { L: 792, M: 624, Q: 442, H: 338 },
  /* v20 */ { L: 858, M: 666, Q: 482, H: 382 },
  /* v21 */ { L: 929, M: 711, Q: 509, H: 403 },
  /* v22 */ { L: 1003, M: 779, Q: 565, H: 439 },
  /* v23 */ { L: 1091, M: 857, Q: 611, H: 461 },
  /* v24 */ { L: 1171, M: 911, Q: 661, H: 511 },
  /* v25 */ { L: 1273, M: 997, Q: 715, H: 535 },
  /* v26 */ { L: 1367, M: 1059, Q: 751, H: 593 },
  /* v27 */ { L: 1465, M: 1125, Q: 805, H: 625 },
  /* v28 */ { L: 1528, M: 1190, Q: 868, H: 658 },
  /* v29 */ { L: 1628, M: 1264, Q: 908, H: 698 },
  /* v30 */ { L: 1732, M: 1370, Q: 982, H: 742 },
  /* v31 */ { L: 1840, M: 1452, Q: 1030, H: 790 },
  /* v32 */ { L: 1952, M: 1538, Q: 1112, H: 842 },
  /* v33 */ { L: 2068, M: 1628, Q: 1168, H: 898 },
  /* v34 */ { L: 2188, M: 1722, Q: 1228, H: 958 },
  /* v35 */ { L: 2303, M: 1809, Q: 1283, H: 983 },
  /* v36 */ { L: 2431, M: 1911, Q: 1351, H: 1051 },
  /* v37 */ { L: 2563, M: 1989, Q: 1423, H: 1093 },
  /* v38 */ { L: 2699, M: 2099, Q: 1499, H: 1139 },
  /* v39 */ { L: 2809, M: 2213, Q: 1579, H: 1219 },
  /* v40 */ { L: 2953, M: 2331, Q: 1663, H: 1273 },
] as const

/** 容量评估结果 */
export interface QrCapacityInfo {
  /** 内容的 UTF-8 字节长度 */
  byteLength: number
  /**
   * 估算可容纳该字节数的最小 QR 版本（1-40）。
   * 如果内容超过 v40 在该容错等级下的最大值，返回 40 并将 percentUsed > 100。
   */
  version: number
  /** 该 version + errorLevel 下的最大可承载字节数 */
  maxBytes: number
  /** byteLength / maxBytes * 100，可能 > 100 表示超出容量 */
  percentUsed: number
}

/**
 * 计算文本在指定容错等级下的 UTF-8 字节长度
 */
function getByteLength(text: string): number {
  if (typeof text !== 'string' || text.length === 0) return 0
  // 优先使用 TextEncoder（更准确，也兼容 Surrogate Pair）
  if (typeof TextEncoder !== 'undefined') {
    try {
      return new TextEncoder().encode(text).length
    } catch {
      // 极端环境异常时降级
    }
  }
  // 降级：手动按 UTF-8 编码估算
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      // 高代理对，与下一个低代理一起算 4 字节
      bytes += 4
      i++
    } else bytes += 3
  }
  return bytes
}

/**
 * 估算二维码容量信息
 *
 * @param text       要编码的文本
 * @param errorLevel 容错等级 L/M/Q/H
 * @returns          字节数 / 推断版本 / 容量上限 / 占用百分比
 */
export function getQrCapacityInfo(
  text: string,
  errorLevel: QrErrorLevel,
): QrCapacityInfo {
  const byteLength = getByteLength(text)

  // 找到第一个能装下 byteLength 的版本
  let version = QR_BYTE_CAPACITY.length // 默认指向 v40
  for (let i = 0; i < QR_BYTE_CAPACITY.length; i++) {
    if (QR_BYTE_CAPACITY[i][errorLevel] >= byteLength) {
      version = i + 1
      break
    }
  }

  const maxBytes = QR_BYTE_CAPACITY[version - 1][errorLevel]
  // 占用百分比按当前版本上限计算；未超容量时通常 <= 100
  const percentUsed = maxBytes === 0 ? 0 : Math.round((byteLength / maxBytes) * 1000) / 10

  return { byteLength, version, maxBytes, percentUsed }
}

/** 暴露给单元测试用的版本表（不在生产代码使用） */
export const __QR_BYTE_CAPACITY_FOR_TEST__ = QR_BYTE_CAPACITY
