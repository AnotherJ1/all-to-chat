/**
 * 数据格式互转 — 类型定义
 *
 * 6 种格式：JSON / YAML / TOML / XML / env / properties
 * 共用 IR：JS plain object（递归任意嵌套）
 */

export type DataFormat = 'json' | 'yaml' | 'toml' | 'xml' | 'env' | 'properties'

/** parse / serialize 统一返回结果 */
export interface ConvertResult {
  /** 是否成功 */
  ok: boolean
  /** 成功时的字符串输出 */
  output?: string
  /** 失败时的错误描述 */
  error?: string
  /** 有损或退化警告（如 env/properties 展平嵌套） */
  warnings?: string[]
}

/** parse 阶段返回（成功为 IR object，失败为 error） */
export interface ParseResult {
  ok: boolean
  /** 中间表示：JS 普通对象/数组/标量 */
  ir?: unknown
  error?: string
  warnings?: string[]
}

/** 6 种格式对应的中文显示名 */
export const FORMAT_LABELS: Record<DataFormat, string> = {
  json: 'JSON',
  yaml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  env: '.env',
  properties: 'properties',
}

/** 全部格式列表（页面下拉用） */
export const ALL_FORMATS: DataFormat[] = ['json', 'yaml', 'toml', 'xml', 'env', 'properties']
