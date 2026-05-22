/**
 * CSV ↔ JSON 转换包装层
 *
 * 设计目标：
 * - 第三方 papaparse 通过 `await import()` 懒加载，主包零增量
 * - 暴露稳定的 csvToJson / jsonToCsv 接口，UI 与测试都不直接依赖 papaparse 类型
 * - 自动检测分隔符（逗号 / 分号 / 制表符），无需用户手填
 * - 可选 camelCase 表头，常见场景一键转驼峰
 * - JSON → CSV 默认对嵌套对象按 . 路径展平，避免列丢数据
 */

import { flatten } from './flatten'

/** csvToJson 选项 */
export interface CsvToJsonOptions {
  /** 是否把首行当表头，默认 true */
  header?: boolean
  /**
   * 显式分隔符；省略或传 'auto' 时由 papaparse 自动检测，
   * 只在常见三种之间挑（, ; \t），失败回落到逗号
   */
  delimiter?: string | 'auto'
  /** 是否把表头转换为 camelCase，默认 false */
  camelCase?: boolean
  /** 是否跳过空行，默认 true */
  skipEmptyLines?: boolean
  /**
   * 是否动态类型推断：把 "1" → 1, "true" → true。默认 false，
   * 默认全部当字符串以保留原文，避免 "01" 被吞 0 等坑
   */
  dynamicTyping?: boolean
}

/** jsonToCsv 选项 */
export interface JsonToCsvOptions {
  /** 输出分隔符，默认 ',' */
  delimiter?: string
  /**
   * 是否对嵌套对象做 . 路径展平，默认 true
   * 关闭时遇到嵌套会被 papaparse 序列化成 [object Object]，谨慎使用
   */
  flatten?: boolean
  /** 显式列序；省略时根据所有行的键并集自动收集 */
  columns?: string[]
  /** 是否输出表头行，默认 true */
  header?: boolean
}

/** csvToJson 结果（顺带把 papaparse 的 errors / 检测到的 delimiter 透出） */
export interface CsvParseResult {
  data: Record<string, unknown>[]
  errors: { type: string; code: string; message: string; row?: number }[]
  meta: {
    delimiter: string
    fields: string[]
  }
}

/**
 * 表头转 camelCase：'first name' / 'first_name' / 'First-Name' → 'firstName'
 * 关键：不依赖 lodash，单遍正则即可；空字符串原样返回
 */
function toCamelCase(input: string): string {
  if (!input) return input
  // 把所有非字母数字位置的下一个字母大写
  const trimmed = input.trim()
  return trimmed
    // 首段保留小写
    .replace(/[-_\s]+(.)?/g, (_, ch: string | undefined) => (ch ? ch.toUpperCase() : ''))
    // 防御：开头若是大写也降为小写（避免 PascalCase）
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
}

/**
 * 自动嗅探 CSV 分隔符
 *
 * papaparse 自身的 delimitersToGuess 已经够用，但默认会把空格也算上，
 * 在 base64 / URL 等内容里很容易误判。这里限定到三种最常见分隔符。
 */
const GUESS_DELIMITERS = [',', ';', '\t']

/**
 * CSV → JSON 行数组
 *
 * 失败时不抛错，把错误塞到 errors 字段，调用方自行决定是否提示
 */
export async function csvToJson(
  text: string,
  opts: CsvToJsonOptions = {},
): Promise<CsvParseResult> {
  const {
    header = true,
    delimiter = 'auto',
    camelCase = false,
    skipEmptyLines = true,
    dynamicTyping = false,
  } = opts

  // 懒加载 papaparse，避免主包打包进 ~45KB gzip
  const papa = (await import('papaparse')).default

  // papaparse delimiter='' 时启用自动检测
  const parsed = papa.parse<Record<string, unknown> | unknown[]>(text, {
    header,
    delimiter: delimiter === 'auto' ? '' : delimiter,
    delimitersToGuess: GUESS_DELIMITERS,
    skipEmptyLines,
    dynamicTyping,
    // 关键：transformHeader 只在 header=true 时生效
    transformHeader: camelCase ? (h: string) => toCamelCase(h) : undefined,
  })

  // 没有 header 时 data 是 unknown[][]，统一包装为 {col0, col1, ...}
  let data: Record<string, unknown>[]
  let fields: string[] = []
  if (header) {
    data = (parsed.data as Record<string, unknown>[]).filter(
      (row) => row && typeof row === 'object' && Object.keys(row).length > 0,
    )
    fields = parsed.meta.fields ?? []
  } else {
    const rows = parsed.data as unknown[][]
    // 统一列数（按最长行）
    const width = rows.reduce((m, r) => Math.max(m, r?.length ?? 0), 0)
    fields = Array.from({ length: width }, (_, i) => `col${i + 1}`)
    data = rows
      .filter((r) => Array.isArray(r) && r.length > 0)
      .map((r) => {
        const obj: Record<string, unknown> = {}
        for (let i = 0; i < width; i++) obj[fields[i]] = r[i] ?? ''
        return obj
      })
  }

  return {
    data,
    errors: parsed.errors.map((e) => ({
      type: e.type,
      code: e.code,
      message: e.message,
      row: e.row,
    })),
    meta: {
      delimiter: parsed.meta.delimiter || (delimiter === 'auto' ? ',' : delimiter),
      fields,
    },
  }
}

/**
 * JSON 数组 → CSV 字符串
 *
 * 关键约定：
 * - 输入必须是数组；不是数组直接抛错
 * - 数组元素若是原始值（如纯字符串数组），统一塞到列名 'value'
 * - 嵌套对象默认走 flatten（避免序列化为 [object Object]）
 */
export async function jsonToCsv(
  arr: unknown[],
  opts: JsonToCsvOptions = {},
): Promise<string> {
  if (!Array.isArray(arr)) {
    throw new Error('jsonToCsv: 输入必须是数组')
  }
  const { delimiter = ',', flatten: doFlatten = true, columns, header = true } = opts

  // 1) 归一化每行为对象
  const rows: Record<string, unknown>[] = arr.map((item) => {
    if (item === null || item === undefined) return { value: '' }
    if (typeof item !== 'object') return { value: item }
    if (Array.isArray(item)) {
      // 数组元素：展平后转字符串列名 0,1,2...
      return doFlatten
        ? (flatten(item) as Record<string, unknown>)
        : { value: JSON.stringify(item) }
    }
    return doFlatten
      ? flatten(item as Record<string, unknown>)
      : (item as Record<string, unknown>)
  })

  // 2) 收集列：显式 columns 优先，否则按出现顺序取并集
  let fields: string[]
  if (columns && columns.length > 0) {
    fields = columns
  } else {
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const row of rows) {
      for (const k of Object.keys(row)) {
        if (!seen.has(k)) {
          seen.add(k)
          ordered.push(k)
        }
      }
    }
    fields = ordered
  }
  // 极端情况：空数组或所有行都是空对象，回落 ['value']
  if (fields.length === 0) fields = ['value']

  // 3) 调 papaparse 序列化（unparse 自带引号/转义/换行兼容）
  const papa = (await import('papaparse')).default
  return papa.unparse(
    {
      fields,
      data: rows.map((row) =>
        fields.map((f) => {
          const v = row[f]
          // 复合类型在 doFlatten=false 时仍可能出现，序列化保护
          if (v && typeof v === 'object') return JSON.stringify(v)
          return v ?? ''
        }),
      ),
    },
    {
      delimiter,
      header,
      newline: '\n',
    },
  )
}

/**
 * 尝试把 CSV 文本里逐单元格的字符串值转成更准确的 JS 类型
 * （仅在 UI 需要时调用，避免 csvToJson 默认 dynamicTyping=false 的情况下也能"手工开关"）
 */
export function inferCellTypes(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const next: Record<string, unknown> = {}
    for (const k of Object.keys(row)) {
      const raw = row[k]
      if (typeof raw !== 'string') {
        next[k] = raw
        continue
      }
      const trimmed = raw.trim()
      if (trimmed === '') {
        next[k] = ''
      } else if (trimmed === 'true' || trimmed === 'false') {
        next[k] = trimmed === 'true'
      } else if (/^-?\d+(?:\.\d+)?$/.test(trimmed) && !/^0\d/.test(trimmed)) {
        // 纯数字、且不是 "01" 这种被截断风险的串
        next[k] = Number(trimmed)
      } else {
        next[k] = raw
      }
    }
    return next
  })
}
