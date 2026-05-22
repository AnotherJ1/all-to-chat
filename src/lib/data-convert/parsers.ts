/**
 * 数据格式互转 — 解析器（format → 中间表示 IR）
 *
 * IR 约定：JS plain object/array/标量。
 * 所有第三方解析器一律 await import() 懒加载，主包零增量。
 */

import type { ParseResult } from './types'

/** Prototype Pollution 黑名单：禁止把这些键写入 IR */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** 安全包装：捕获异常并返回 ParseResult */
function safe(fn: () => unknown, warnings?: string[]): ParseResult {
  try {
    const ir = fn()
    return { ok: true, ir, warnings }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ============== JSON ==============

/** JSON parse → IR */
export function parseJson(text: string): ParseResult {
  return safe(() => JSON.parse(text))
}

// ============== YAML ==============

/** YAML parse → IR（懒加载 js-yaml） */
export async function parseYaml(text: string): Promise<ParseResult> {
  try {
    const yaml = await import('js-yaml')
    const ir = yaml.load(text)
    return { ok: true, ir: ir ?? null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ============== TOML ==============

/** TOML parse → IR（懒加载 @iarna/toml） */
export async function parseToml(text: string): Promise<ParseResult> {
  try {
    const toml = await import('@iarna/toml')
    // @iarna/toml 默认导出包含 parse
    const parser = (toml.default ?? toml) as { parse: (s: string) => unknown }
    const ir = parser.parse(text)
    return { ok: true, ir }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ============== XML ==============

/** XML 输入硬上限：5 MiB，防 Billion-Laughs / OOM / ReDoS */
const XML_MAX_BYTES = 5 * 1024 * 1024

/** XML parse → IR（懒加载 fast-xml-parser；属性以 @_ 前缀保留）
 *
 * 安全加固：
 *  1. 输入大小硬上限 5MB，超出直接拒绝，避免 OOM / 慢路径 ReDoS
 *  2. processEntities=false：关闭实体展开，杜绝 Billion-Laughs / XXE
 *     （fast-xml-parser 不解析外部 DTD，但仍会展开内部 ENTITY 引用）
 */
export async function parseXml(text: string): Promise<ParseResult> {
  // 输入大小防御：超过阈值直接拒绝，绝不进入解析器
  if (typeof text !== 'string') {
    return { ok: false, error: 'XML 输入必须是字符串' }
  }
  if (text.length > XML_MAX_BYTES) {
    return {
      ok: false,
      error: `XML 输入过大（${text.length} 字节，上限 ${XML_MAX_BYTES} 字节），已拒绝以避免 OOM/ReDoS`,
    }
  }
  try {
    const mod = await import('fast-xml-parser')
    const Parser = mod.XMLParser
    const parser = new Parser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
      // 关闭实体展开：阻断 Billion-Laughs / 内部实体炸弹
      processEntities: false,
    })
    const ir = parser.parse(text)
    return { ok: true, ir }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ============== .env ==============

/**
 * 解析 .env 文件
 *
 * 规则（极简、贴近 dotenv 语义）：
 *  - # 起始行视为注释
 *  - 形如 KEY=VALUE，KEY 必须 [A-Za-z_][A-Za-z0-9_]*
 *  - VALUE 可被 "..." 或 '...' 包裹；双引号内 \n \t \" \\ 转义
 *  - 行尾 # 注释（当 VALUE 未带引号时）
 *  - export KEY=VALUE 的 export 前缀允许
 *
 * 返回 IR：扁平 Record<string, string>
 */
export function parseEnv(text: string): ParseResult {
  const out: Record<string, string> = {}
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    // 去掉前导空白
    line = line.replace(/^\s+/, '')
    if (!line || line.startsWith('#')) continue
    // 兼容 export 前缀
    if (line.startsWith('export ')) line = line.slice(7).replace(/^\s+/, '')
    const eq = line.indexOf('=')
    if (eq <= 0) {
      return { ok: false, error: `第 ${i + 1} 行缺少 = 或 KEY 为空：${lines[i]}` }
    }
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return { ok: false, error: `第 ${i + 1} 行非法 KEY：${key}` }
    }
    // 防 Prototype Pollution：禁止敏感键写入 IR
    if (FORBIDDEN_KEYS.has(key)) {
      return { ok: false, error: `第 ${i + 1} 行使用了禁止的 KEY：${key}` }
    }
    let raw = line.slice(eq + 1)
    // 去除前导空白
    raw = raw.replace(/^\s+/, '')
    let value = ''
    if (raw.startsWith('"')) {
      // 双引号字符串：处理转义
      let j = 1
      while (j < raw.length) {
        const c = raw[j]
        if (c === '\\' && j + 1 < raw.length) {
          const n = raw[j + 1]
          if (n === 'n') value += '\n'
          else if (n === 't') value += '\t'
          else if (n === 'r') value += '\r'
          else if (n === '"') value += '"'
          else if (n === '\\') value += '\\'
          else value += n
          j += 2
          continue
        }
        if (c === '"') break
        value += c
        j++
      }
    } else if (raw.startsWith("'")) {
      // 单引号字符串：所有字符按字面量
      const close = raw.indexOf("'", 1)
      value = close > 0 ? raw.slice(1, close) : raw.slice(1)
    } else {
      // 无引号：行尾 # 是注释
      const hash = raw.indexOf('#')
      value = (hash >= 0 ? raw.slice(0, hash) : raw).trim()
    }
    out[key] = value
  }
  return { ok: true, ir: out }
}

// ============== .properties ==============

/**
 * 解析 Java .properties 文件
 *
 * 规则（贴近 java.util.Properties）：
 *  - # 或 ! 起始行视为注释
 *  - KEY = VALUE 或 KEY : VALUE，等号 / 冒号都可作为分隔符
 *  - KEY 与 VALUE 之间可有空白
 *  - 行尾 \ 续行（合并下一行的前导空白后内容）
 *  - VALUE 内 \n \t \r \\ \= \: 转义
 *
 * 返回 IR：扁平 Record<string, string>
 */
export function parseProperties(text: string): ParseResult {
  const out: Record<string, string> = {}
  const rawLines = text.split(/\r?\n/)
  // 处理续行：以未转义反斜杠结尾合并下一行
  const lines: string[] = []
  let buf = ''
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i]
    // 计算结尾反斜杠数量
    let bs = 0
    for (let k = cur.length - 1; k >= 0 && cur[k] === '\\'; k--) bs++
    if (bs % 2 === 1) {
      // 续行：去掉末尾反斜杠
      buf += cur.slice(0, -1)
    } else {
      buf += cur
      lines.push(buf)
      buf = ''
    }
  }
  if (buf) lines.push(buf)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^\s+/, '')
    if (!line || line.startsWith('#') || line.startsWith('!')) continue
    // 找首个未转义的 = / : / 空白
    let sep = -1
    for (let j = 0; j < line.length; j++) {
      const c = line[j]
      if (c === '\\') { j++; continue }
      if (c === '=' || c === ':' || c === ' ' || c === '\t') {
        sep = j
        break
      }
    }
    if (sep < 0) {
      // 整行作为 key，value 为空
      const lineKey = unescapeProp(line.trim())
      if (FORBIDDEN_KEYS.has(lineKey)) {
        return { ok: false, error: `第 ${i + 1} 行使用了禁止的 KEY：${lineKey}` }
      }
      out[lineKey] = ''
      continue
    }
    const key = unescapeProp(line.slice(0, sep))
    // 防 Prototype Pollution：禁止敏感键写入 IR
    if (FORBIDDEN_KEYS.has(key)) {
      return { ok: false, error: `第 ${i + 1} 行使用了禁止的 KEY：${key}` }
    }
    // 跳过分隔符与其后的空白（含一个 = 或 :）
    let k = sep
    while (k < line.length && (line[k] === ' ' || line[k] === '\t')) k++
    if (k < line.length && (line[k] === '=' || line[k] === ':')) k++
    while (k < line.length && (line[k] === ' ' || line[k] === '\t')) k++
    const value = unescapeProp(line.slice(k))
    out[key] = value
  }
  return { ok: true, ir: out }
}

/** 解 .properties 转义：\n \t \r \\ \= \: \uXXXX */
function unescapeProp(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '\\') { out += c; continue }
    if (i + 1 >= s.length) { out += '\\'; break }
    const n = s[i + 1]
    if (n === 'n') { out += '\n'; i++ }
    else if (n === 't') { out += '\t'; i++ }
    else if (n === 'r') { out += '\r'; i++ }
    else if (n === '\\') { out += '\\'; i++ }
    else if (n === '=' || n === ':' || n === ' ') { out += n; i++ }
    else if (n === 'u' && i + 5 < s.length) {
      const hex = s.slice(i + 2, i + 6)
      const code = parseInt(hex, 16)
      if (!Number.isNaN(code)) {
        out += String.fromCharCode(code)
        i += 5
      } else {
        out += n; i++
      }
    } else {
      out += n; i++
    }
  }
  return out
}

// ============== 统一入口 ==============

import type { DataFormat } from './types'

/** 按格式 dispatch 到对应解析器 */
export async function parseByFormat(format: DataFormat, text: string): Promise<ParseResult> {
  switch (format) {
    case 'json': return parseJson(text)
    case 'yaml': return parseYaml(text)
    case 'toml': return parseToml(text)
    case 'xml': return parseXml(text)
    case 'env': return parseEnv(text)
    case 'properties': return parseProperties(text)
  }
}
