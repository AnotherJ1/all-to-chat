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

/**
 * 需要加单引号的类型集合
 * 涵盖 MyBatis/JDBC 常见的字符串、时间、二进制、JSON、UUID 等需要字面量引号的类型
 */
const QUOTED_TYPES = new Set([
  // 字符串相关
  'String',
  'Character',
  'Char',
  'NString',
  'NChar',
  'NVarchar',
  'Varchar',
  'Clob',
  'NClob',
  'LongVarChar',
  'LongNVarChar',
  // JDK8 时间类型
  'LocalDate',
  'LocalTime',
  'LocalDateTime',
  'OffsetDateTime',
  'OffsetTime',
  'ZonedDateTime',
  'Instant',
  'Year',
  'YearMonth',
  'MonthDay',
  // 经典时间类型
  'Date',
  'Time',
  'Timestamp',
  'SqlDate',
  'SqlTime',
  'SqlTimestamp',
  // 二进制类型（按字符串字面量处理，便于查看）
  'Blob',
  'Clob ',
  'Bytes',
  'ByteArray',
  // 其他需要引号的类型
  'UUID',
  'JSON',
  'Json',
  'Jsonb',
  'Object',
  'Enum',
  'Url',
  'URI',
])

/** 数值类型集合（不加引号） */
const NUMERIC_TYPES = new Set([
  'Byte',
  'Short',
  'Integer',
  'Int',
  'Long',
  'Float',
  'Double',
  'BigDecimal',
  'BigInteger',
  'Number',
  'Decimal',
  'Numeric',
  'Real',
  'TinyInt',
  'SmallInt',
  'MediumInt',
  'BigInt',
])

/** 布尔类型集合（不加引号） */
const BOOLEAN_TYPES = new Set(['Boolean', 'Bool', 'Bit'])

/**
 * 转义 SQL 字符串字面量中的单引号，防止破坏 SQL 结构
 */
function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''")
}

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

  // 数值/布尔类型直接返回，不加引号
  if (NUMERIC_TYPES.has(type) || BOOLEAN_TYPES.has(type)) {
    return value
  }

  // 已知的需加引号类型
  if (QUOTED_TYPES.has(type)) {
    return `'${escapeSqlString(value)}'`
  }

  // 未知类型兜底策略：
  // 1) 纯数字（含负号、小数）当作数值不加引号
  // 2) true/false 当作布尔不加引号
  // 3) 其他一律按字符串处理，加引号，避免破坏 SQL 可执行性（如 LocalDateTime、自定义 TypeHandler 等）
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return value
  }
  if (value === 'true' || value === 'false') {
    return value
  }
  return `'${escapeSqlString(value)}'`
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
  const parts = sql.split('?')
  let result = parts[0]
  for (let i = 0; i < params.length && i < parts.length - 1; i++) {
    const formattedValue = formatParamValue(params[i])
    result += formattedValue + parts[i + 1]
  }
  // 兜底处理：如果参数比问号少，将剩余的问号保留
  for (let i = params.length; i < parts.length - 1; i++) {
    result += '?' + parts[i + 1]
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
