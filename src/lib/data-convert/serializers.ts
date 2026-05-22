/**
 * 数据格式互转 — 序列化器（IR → format）
 *
 * 输入：parsers 输出的 IR（JS plain object/array/标量）
 * 第三方库一律 await import() 懒加载
 *
 * 有损警告：
 *  - env / properties 不支持嵌套，遇到嵌套对象时按 . 路径展平，warnings 中提示
 *  - XML：根节点缺失时自动包裹一层 <root>
 */

import type { ConvertResult } from './types'

// ============== JSON ==============

/** IR → JSON（默认 2 空格缩进） */
export function serializeJson(ir: unknown, indent = 2): ConvertResult {
  try {
    return { ok: true, output: JSON.stringify(ir, null, indent) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ============== YAML ==============

/** IR → YAML（懒加载 js-yaml） */
export async function serializeYaml(ir: unknown): Promise<ConvertResult> {
  try {
    const yaml = await import('js-yaml')
    const output = yaml.dump(ir, { indent: 2, lineWidth: 120, noRefs: true })
    return { ok: true, output }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ============== TOML ==============

/**
 * IR → TOML（懒加载 @iarna/toml）
 *
 * 限制：TOML 顶层必须是对象（table），数组/标量需要包一层
 */
export async function serializeToml(ir: unknown): Promise<ConvertResult> {
  try {
    if (ir === null || typeof ir !== 'object' || Array.isArray(ir)) {
      return {
        ok: false,
        error: 'TOML 顶层必须是对象（table），无法序列化数组或标量',
      }
    }
    const mod = await import('@iarna/toml')
    const stringify = ((mod.default ?? mod) as { stringify: (o: object) => string }).stringify
    // @iarna/toml 不接受 undefined / null 值；先做一次清理
    const cleaned = removeNullish(ir as Record<string, unknown>)
    const output = stringify(cleaned as Record<string, unknown>)
    return { ok: true, output }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 递归剔除 undefined/null 值（@iarna/toml 不支持） */
function removeNullish(v: unknown): unknown {
  if (Array.isArray(v)) return v.filter((x) => x !== undefined && x !== null).map(removeNullish)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === undefined || val === null) continue
      out[k] = removeNullish(val)
    }
    return out
  }
  return v
}

// ============== XML ==============

/**
 * IR → XML（懒加载 fast-xml-parser）
 *
 * 约定：
 *  - 顶层若是对象但有多个 root key，按原结构包裹；若顶层为数组/标量，包一层 <root>
 *  - 属性走 @_ 前缀（与 parser 互逆）
 */
export async function serializeXml(ir: unknown): Promise<ConvertResult> {
  try {
    const mod = await import('fast-xml-parser')
    const Builder = mod.XMLBuilder
    const builder = new Builder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: false,
    })
    let target: unknown = ir
    // 顶层非对象：包一层 <root>
    if (target === null || typeof target !== 'object' || Array.isArray(target)) {
      target = { root: target }
    }
    const output = builder.build(target)
    return { ok: true, output: typeof output === 'string' ? output : String(output) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ============== .env ==============

/**
 * IR → .env 文本
 *
 * 限制：env 不支持嵌套结构。遇到嵌套对象 / 数组时按 `.` 路径展平。
 * 若发生展平，warnings 中提示「将以 `.` 路径展平为扁平 KEY」。
 *
 * 转义：值中含 \n / \t / " 时用双引号包裹并转义；含空格 / # 时用双引号包裹。
 */
export function serializeEnv(ir: unknown): ConvertResult {
  if (ir === null || typeof ir !== 'object' || Array.isArray(ir)) {
    return { ok: false, error: '.env 顶层必须是对象' }
  }
  const warnings: string[] = []
  const flat = flattenForEnv(ir as Record<string, unknown>, warnings)
  const lines: string[] = []
  for (const [k, v] of Object.entries(flat)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
      return { ok: false, error: `KEY 不合法（仅允许字母/数字/下划线，且不以数字起头）：${k}` }
    }
    lines.push(`${k}=${envQuote(v)}`)
  }
  return {
    ok: true,
    output: lines.join('\n') + (lines.length ? '\n' : ''),
    warnings: warnings.length ? warnings : undefined,
  }
}

/** 依据 value 是否含特殊字符决定是否加双引号 */
function envQuote(v: string): string {
  // 含空格 / # / 引号 / 换行：双引号 + 转义
  if (/[\s#"'\\\n\t\r]/.test(v)) {
    const esc = v
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r')
    return `"${esc}"`
  }
  return v
}

/**
 * 展平嵌套对象 → 扁平字符串字典
 * - 数组：按索引 a.0, a.1
 * - 嵌套对象：a.b.c
 * - 标量：转字符串
 *
 * 任何展平动作都会推送 warning。
 */
function flattenForEnv(
  obj: Record<string, unknown>,
  warnings: string[],
  prefix = '',
  flatNote = false,
): Record<string, string> {
  const out: Record<string, string> = {}
  let noted = flatNote
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v === null || v === undefined) {
      out[envSanitizeKey(key)] = ''
      continue
    }
    if (typeof v === 'object') {
      if (!noted) {
        warnings.push('.env / properties 不支持嵌套结构，已按 `.` 路径展平为扁平 KEY')
        noted = true
      }
      if (Array.isArray(v)) {
        v.forEach((item, idx) => {
          const sub = flattenForEnv({ [String(idx)]: item }, warnings, key, true)
          Object.assign(out, sub)
        })
      } else {
        const sub = flattenForEnv(v as Record<string, unknown>, warnings, key, true)
        Object.assign(out, sub)
      }
      continue
    }
    out[envSanitizeKey(key)] = String(v)
  }
  return out
}

/** 把 . 路径键转成合法 env KEY：. → _，非法字符 → _ */
function envSanitizeKey(k: string): string {
  // env KEY 不能包含 .，全部替换成 _
  return k.replace(/\./g, '_').replace(/[^A-Za-z0-9_]/g, '_')
}

// ============== .properties ==============

/**
 * IR → .properties 文本
 *
 * 与 env 同样限制嵌套，但 KEY 允许 . 直接保留（这是 properties 的天然语义）。
 * 发生展平时 warnings 提示。
 */
export function serializeProperties(ir: unknown): ConvertResult {
  if (ir === null || typeof ir !== 'object' || Array.isArray(ir)) {
    return { ok: false, error: '.properties 顶层必须是对象' }
  }
  const warnings: string[] = []
  const flat = flattenForProperties(ir as Record<string, unknown>, warnings)
  const lines: string[] = []
  for (const [k, v] of Object.entries(flat)) {
    lines.push(`${escapePropKey(k)}=${escapePropValue(v)}`)
  }
  return {
    ok: true,
    output: lines.join('\n') + (lines.length ? '\n' : ''),
    warnings: warnings.length ? warnings : undefined,
  }
}

function flattenForProperties(
  obj: Record<string, unknown>,
  warnings: string[],
  prefix = '',
  flatNote = false,
): Record<string, string> {
  const out: Record<string, string> = {}
  let noted = flatNote
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v === null || v === undefined) {
      out[key] = ''
      continue
    }
    if (typeof v === 'object') {
      if (!noted) {
        warnings.push('.properties 不支持嵌套结构，已按 `.` 路径展平为扁平 KEY')
        noted = true
      }
      if (Array.isArray(v)) {
        v.forEach((item, idx) => {
          const sub = flattenForProperties({ [String(idx)]: item }, warnings, key, true)
          Object.assign(out, sub)
        })
      } else {
        const sub = flattenForProperties(v as Record<string, unknown>, warnings, key, true)
        Object.assign(out, sub)
      }
      continue
    }
    out[key] = String(v)
  }
  return out
}

/** properties KEY 转义：空白 / = / : / # / ! */
function escapePropKey(k: string): string {
  return k.replace(/([\s=:#!\\])/g, '\\$1')
}

/** properties VALUE 转义：\\ \n \r \t */
function escapePropValue(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

// ============== 统一入口 ==============

import type { DataFormat } from './types'

/** 按格式 dispatch 到对应序列化器 */
export async function serializeByFormat(format: DataFormat, ir: unknown): Promise<ConvertResult> {
  switch (format) {
    case 'json': return serializeJson(ir)
    case 'yaml': return serializeYaml(ir)
    case 'toml': return serializeToml(ir)
    case 'xml': return serializeXml(ir)
    case 'env': return serializeEnv(ir)
    case 'properties': return serializeProperties(ir)
  }
}
