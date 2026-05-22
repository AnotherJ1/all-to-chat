/**
 * cURL 命令解析器
 * 把任意 curl 字符串解析为结构化 CurlCommand
 *
 * 支持：
 *  - -X / --request 方法
 *  - -H / --header 多个请求头
 *  - -d / --data / --data-raw / --data-binary / --data-urlencode 请求体
 *  - -F / --form 表单
 *  - -u / --user 基本认证
 *  - -b / --cookie cookie 字符串
 *  - 多行反斜杠续行 (\)
 *  - 单引号 / 双引号 / 转义字符
 *  - URL query string 自动分离到 query 字段
 */

/** body 的语义类型 */
export type CurlBodyType = 'none' | 'raw' | 'json' | 'form' | 'urlencoded'

/** body 数据 */
export interface CurlBody {
  type: CurlBodyType
  /** 原始内容；type=form 时为 "k1=v1&k2=v2" 形式 */
  content: string
}

/** Basic 鉴权 */
export interface CurlBasicAuth {
  type: 'basic'
  user: string
  password: string
}

/** 解析后的结构化 cURL 命令 */
export interface CurlCommand {
  method: string
  url: string
  query: Record<string, string>
  headers: Record<string, string>
  body: CurlBody
  auth?: CurlBasicAuth
  cookies: Record<string, string>
}

// ============ shell-quote tokenizer ============

/**
 * 把一行（多行已合并）的 shell 字符串切分为 token 数组
 * 严格按照 POSIX shell 的 quoting 规则：
 *  - 单引号内一切按字面量
 *  - 双引号内反斜杠仅转义 " \ $ `
 *  - 引号外反斜杠转义下一字符
 *  - 空白分隔（多个连续空白视为一个分隔符）
 */
export function tokenizeShell(input: string): string[] {
  const tokens: string[] = []
  // 当前 token 缓存与是否已开始（处理 "" '' 之类空 token）
  let buf = ''
  let started = false
  let i = 0

  /** 把当前缓存推入 token 列表 */
  const flush = () => {
    if (started) {
      tokens.push(buf)
      buf = ''
      started = false
    }
  }

  while (i < input.length) {
    const c = input[i]

    // 空白：分隔符
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      flush()
      i++
      continue
    }

    // 单引号：直至下一单引号都按字面量
    if (c === "'") {
      started = true
      i++
      while (i < input.length && input[i] !== "'") {
        buf += input[i]
        i++
      }
      // 跳过闭合单引号（若缺失则容错）
      if (i < input.length) i++
      continue
    }

    // 双引号：反斜杠仅对若干字符生效
    if (c === '"') {
      started = true
      i++
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
          const next = input[i + 1]
          // POSIX：双引号内反斜杠仅对 \" \\ \$ \` \n 生效，其他保持字面量
          if (next === '"' || next === '\\' || next === '$' || next === '`') {
            buf += next
            i += 2
            continue
          }
          if (next === '\n') {
            // 续行
            i += 2
            continue
          }
          buf += '\\'
          i++
          continue
        }
        buf += input[i]
        i++
      }
      if (i < input.length) i++
      continue
    }

    // 反斜杠：转义下一字符（行尾续行）
    if (c === '\\') {
      if (i + 1 < input.length) {
        const next = input[i + 1]
        if (next === '\n' || next === '\r') {
          // 续行：吃掉换行
          i += 2
          // 兼容 \r\n
          if (next === '\r' && input[i] === '\n') i++
          continue
        }
        started = true
        buf += next
        i += 2
        continue
      }
      // 末尾孤立反斜杠
      i++
      continue
    }

    // 普通字符
    started = true
    buf += c
    i++
  }
  flush()
  return tokens
}

// ============ 主解析逻辑 ============

/** 把多行字符串预处理：去掉首尾空白，统一换行 */
function preprocess(raw: string): string {
  // 去掉前导 $ 提示符（一些复制场景）
  let s = raw.trim()
  if (s.startsWith('$')) s = s.slice(1).trimStart()
  return s
}

/** 把 URL 中的 ?a=b&c=d 拆出来到 query 字典里 */
function splitQuery(url: string): { url: string; query: Record<string, string> } {
  const idx = url.indexOf('?')
  if (idx < 0) return { url, query: {} }
  const base = url.slice(0, idx)
  const qs = url.slice(idx + 1)
  const query: Record<string, string> = {}
  if (qs) {
    for (const seg of qs.split('&')) {
      if (!seg) continue
      const eq = seg.indexOf('=')
      if (eq < 0) {
        try {
          query[decodeURIComponent(seg)] = ''
        } catch {
          query[seg] = ''
        }
      } else {
        const k = seg.slice(0, eq)
        const v = seg.slice(eq + 1)
        try {
          query[decodeURIComponent(k)] = decodeURIComponent(v)
        } catch {
          query[k] = v
        }
      }
    }
  }
  return { url: base, query }
}

/** 解析 Cookie 头形如 "a=1; b=2" */
function parseCookieHeader(value: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of value.split(';')) {
    const seg = part.trim()
    if (!seg) continue
    const eq = seg.indexOf('=')
    if (eq < 0) {
      out[seg] = ''
    } else {
      out[seg.slice(0, eq).trim()] = seg.slice(eq + 1).trim()
    }
  }
  return out
}

/** 检测 body 是否为 JSON 内容 */
function isLikelyJson(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (!(t.startsWith('{') || t.startsWith('['))) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

/** form-data: 把多个 -F a=b -F c=d 合并成 "a=b&c=d" */
function joinForm(parts: string[]): string {
  return parts.join('&')
}

/**
 * 解析 cURL 字符串
 * @throws Error 当输入为空或不以 curl 起头
 */
export function parseCurl(raw: string): CurlCommand {
  const text = preprocess(raw)
  if (!text) {
    throw new Error('cURL 命令为空')
  }

  const tokens = tokenizeShell(text)
  if (tokens.length === 0) {
    throw new Error('cURL 命令为空')
  }

  // 跳过开头的 curl
  let start = 0
  if (tokens[0].toLowerCase() === 'curl') start = 1
  const args = tokens.slice(start)

  let method = ''
  let url = ''
  const headers: Record<string, string> = {}
  let auth: CurlBasicAuth | undefined
  const cookieEntries: Record<string, string> = {}
  // body 收集：data 与 form 分别累加
  const dataParts: string[] = []
  let dataIsRaw = false // --data-raw / --data-binary 不解码
  const formParts: string[] = []

  /** 取下一个值参数 */
  const need = (idx: number, flag: string): string => {
    if (idx >= args.length) throw new Error(`参数 ${flag} 缺少值`)
    return args[idx]
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]

    // -X METHOD / --request METHOD / -XMETHOD
    if (a === '-X' || a === '--request') {
      method = need(++i, a).toUpperCase()
      continue
    }
    if (a.startsWith('-X') && a.length > 2) {
      method = a.slice(2).toUpperCase()
      continue
    }

    // -H "K: V" / --header
    if (a === '-H' || a === '--header') {
      const v = need(++i, a)
      const eq = v.indexOf(':')
      if (eq > 0) {
        const key = v.slice(0, eq).trim()
        const value = v.slice(eq + 1).trim()
        if (key.toLowerCase() === 'cookie') {
          Object.assign(cookieEntries, parseCookieHeader(value))
        } else {
          headers[key] = value
        }
      }
      continue
    }

    // -d / --data / --data-ascii
    if (a === '-d' || a === '--data' || a === '--data-ascii') {
      dataParts.push(need(++i, a))
      continue
    }
    // --data-raw / --data-binary：保持原样（不展开 @file）
    if (a === '--data-raw' || a === '--data-binary') {
      dataParts.push(need(++i, a))
      dataIsRaw = true
      continue
    }
    // --data-urlencode：原样推入，由后续判断
    if (a === '--data-urlencode') {
      dataParts.push(need(++i, a))
      continue
    }

    // -F / --form
    if (a === '-F' || a === '--form') {
      formParts.push(need(++i, a))
      continue
    }

    // -u user:pass / --user
    if (a === '-u' || a === '--user') {
      const v = need(++i, a)
      const colon = v.indexOf(':')
      if (colon < 0) {
        auth = { type: 'basic', user: v, password: '' }
      } else {
        auth = { type: 'basic', user: v.slice(0, colon), password: v.slice(colon + 1) }
      }
      continue
    }

    // -b / --cookie
    if (a === '-b' || a === '--cookie') {
      const v = need(++i, a)
      // 若是 name=value 形式则解析为字典；若是文件路径忽略
      if (v.includes('=')) {
        Object.assign(cookieEntries, parseCookieHeader(v))
      }
      continue
    }

    // 一些常见无值 flag，吃掉避免被识别成 url
    if (a === '--compressed' || a === '-k' || a === '--insecure' ||
        a === '-s' || a === '--silent' || a === '-v' || a === '--verbose' ||
        a === '-i' || a === '--include' || a === '-L' || a === '--location' ||
        a === '--http1.1' || a === '--http2' || a === '-g' || a === '--globoff') {
      continue
    }

    // 一些常见带值但与请求结构无关的 flag，吃掉一个值
    if (a === '-A' || a === '--user-agent' || a === '-e' || a === '--referer' ||
        a === '-o' || a === '--output' || a === '--max-time' || a === '--connect-timeout' ||
        a === '--retry' || a === '--cacert' || a === '--cert' || a === '--key') {
      i++
      continue
    }

    // 其它带等号长选项：吃自身
    if (a.startsWith('--') && a.includes('=')) {
      continue
    }

    // 未识别的短选项：跳过
    if (a.startsWith('-') && a.length > 1) {
      continue
    }

    // 否则视为 URL（取第一个出现的）
    if (!url) url = a
  }

  if (!url) {
    throw new Error('未能在命令中识别到 URL')
  }

  // 处理 URL 中的 query
  const split = splitQuery(url)
  url = split.url
  const query = split.query

  // 决定 body
  let body: CurlBody = { type: 'none', content: '' }
  if (formParts.length > 0) {
    body = { type: 'form', content: joinForm(formParts) }
  } else if (dataParts.length > 0) {
    const merged = dataParts.join('&')
    // 显式 Content-Type 优先
    const ct = (headers['Content-Type'] || headers['content-type'] || '').toLowerCase()
    if (ct.includes('application/json') || isLikelyJson(merged)) {
      body = { type: 'json', content: merged }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      body = { type: 'urlencoded', content: merged }
    } else if (dataIsRaw) {
      body = { type: 'raw', content: merged }
    } else {
      // -d 默认 urlencoded
      body = { type: 'urlencoded', content: merged }
    }
  }

  // 推断 method
  if (!method) {
    if (body.type !== 'none') method = 'POST'
    else method = 'GET'
  }

  return {
    method,
    url,
    query,
    headers,
    body,
    auth,
    cookies: cookieEntries,
  }
}
