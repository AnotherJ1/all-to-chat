/**
 * MyBatis 日志解析器
 * 将 MyBatis 控制台日志中的 Preparing + Parameters 解析为可执行 SQL
 */

/** 解析结果接口 */
export interface ParseResult {
  /** 替换参数后的完整 SQL */
  sql: string
  /** 提取的参数值列表 */
  params: string[]
  /** 原始 Preparing 行 */
  rawPreparing: string
  /** 原始 Parameters 行 */
  rawParameters: string
}

/** 需要加单引号的类型 */
const QUOTED_TYPES = new Set(['String', 'Date', 'Timestamp'])

/**
 * 解析单个参数字符串，如 "John(String)" 或 "1(Integer)" 或 "null"
 * 返回替换到 SQL 中的值
 */
function formatParamValue(raw: string): string {
  const trimmed = raw.trim()

  // 处理 null 参数
  if (trimmed === 'null') {
    return 'NULL'
  }

  // 匹配 value(Type) 格式
  const match = trimmed.match(/^(.*)\((\w+)\)$/)
  if (!match) {
    // 无法识别格式，原样返回
    return trimmed
  }

  const value = match[1]
  const type = match[2]

  // 根据类型决定是否加引号
  if (QUOTED_TYPES.has(type)) {
    return `'${value}'`
  }

  return value
}

/**
 * 解析参数行，提取所有参数
 * 参数格式：value(Type), value(Type), null, ...
 */
function parseParameters(paramStr: string): string[] {
  if (!paramStr.trim()) {
    return []
  }

  const params: string[] = []
  let current = ''
  let parenDepth = 0

  for (let i = 0; i < paramStr.length; i++) {
    const ch = paramStr[i]

    if (ch === '(') {
      parenDepth++
      current += ch
    } else if (ch === ')') {
      parenDepth--
      current += ch
    } else if (ch === ',' && parenDepth === 0) {
      params.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }

  // 最后一个参数
  if (current.trim()) {
    params.push(current.trim())
  }

  return params
}

/**
 * 将 SQL 模板中的 ? 占位符替换为实际参数值
 */
function replacePlaceholders(sql: string, params: string[]): string {
  let result = sql
  for (const param of params) {
    const formattedValue = formatParamValue(param)
    result = result.replace('?', formattedValue)
  }
  return result
}

/**
 * 解析 MyBatis 日志，提取 SQL 和参数
 * 支持多种格式：
 * 1. 标准格式：==>  Preparing: SQL \n ==> Parameters: params
 * 2. 纯SQL+Parameters格式：SQL行（含?占位符）\n Parameters行
 * 3. 带复杂前缀的格式（时间戳|线程|traceId等）
 *
 * @param input - MyBatis 日志文本
 * @returns 解析结果数组
 */
export function parseMybatisLog(input: string): ParseResult[] {
  const results: ParseResult[] = []
  const lines = input.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)

  // 匹配 Preparing 行的正则（支持前缀如时间戳、类名等）
  const preparingRegex = /==>[\s]*Preparing:\s*(.+)/
  // 匹配 Parameters 行的正则（支持各种前缀格式）
  const parametersRegex = /(?:==>[\s]*Parameters:|Parameters:)\s*(.*)/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 格式1：标准 ==> Preparing: 格式
    const preparingMatch = line.match(preparingRegex)
    if (preparingMatch) {
      const sqlTemplate = preparingMatch[1].trim()
      const rawPreparing = line

      let rawParameters = ''
      let params: string[] = []

      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const parametersMatch = nextLine.match(parametersRegex)
        if (parametersMatch) {
          rawParameters = nextLine
          params = parseParameters(parametersMatch[1])
          i++
        }
      }

      const sql = replacePlaceholders(sqlTemplate, params)
      results.push({ sql, params, rawPreparing, rawParameters })
      continue
    }

    // 格式2：纯SQL行（包含?占位符）+ 下一行是 Parameters
    // 检测当前行是否包含SQL关键字和?占位符
    if (containsSqlWithPlaceholders(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      const parametersMatch = nextLine.match(parametersRegex)
      if (parametersMatch) {
        // 提取SQL部分（去掉可能的日志前缀）
        const sqlTemplate = extractSqlFromLine(line)
        const rawPreparing = line
        const rawParameters = nextLine
        const params = parseParameters(parametersMatch[1])
        i++

        const sql = replacePlaceholders(sqlTemplate, params)
        results.push({ sql, params, rawPreparing, rawParameters })
        continue
      }
    }
  }

  return results
}

/** SQL 关键字列表 */
const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|SET|INTO|VALUES|JOIN|LEFT|RIGHT|INNER|ORDER|GROUP|HAVING|LIMIT|AND|OR|IN|CREATE|ALTER|DROP)\b/i

/**
 * 检测一行是否包含带?占位符的SQL语句
 */
function containsSqlWithPlaceholders(line: string): boolean {
  return line.includes('?') && SQL_KEYWORDS.test(line)
}

/**
 * 从带前缀的日志行中提取SQL部分
 * 支持格式如：
 * - 纯SQL
 * - 2026-05-14 17:16:36|...|DEBUG|...|[0]==> SQL
 * - com.example.Mapper - SQL
 */
function extractSqlFromLine(line: string): string {
  // 尝试匹配 ==> 后面的内容（不含 Preparing:）
  const arrowMatch = line.match(/==>[\s]*(.+)/)
  if (arrowMatch) {
    return arrowMatch[1].trim()
  }

  // 尝试匹配 ] 后面的SQL（日志格式如 [0]select ...）
  const bracketMatch = line.match(/\]\s*((?:SELECT|INSERT|UPDATE|DELETE)\b.+)/i)
  if (bracketMatch) {
    return bracketMatch[1].trim()
  }

  // 尝试匹配 - 后面的SQL
  const dashMatch = line.match(/-\s*((?:SELECT|INSERT|UPDATE|DELETE)\b.+)/i)
  if (dashMatch) {
    return dashMatch[1].trim()
  }

  // 尝试匹配 | 后面的SQL（竖线分隔的日志格式）
  const pipeMatch = line.match(/\|\s*((?:SELECT|INSERT|UPDATE|DELETE)\b.+)/i)
  if (pipeMatch) {
    return pipeMatch[1].trim()
  }

  // 如果行本身以SQL关键字开头
  const sqlStartMatch = line.match(/^\s*((?:SELECT|INSERT|UPDATE|DELETE)\b.+)/i)
  if (sqlStartMatch) {
    return sqlStartMatch[1].trim()
  }

  // 兜底：返回整行
  return line
}
