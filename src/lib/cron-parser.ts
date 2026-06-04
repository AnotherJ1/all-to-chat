/**
 * 轻量级 Cron 表达式解析器
 * 支持 5 段（分 时 日 月 周）和 6 段（秒 分 时 日 月 周）
 * 支持 *、, 、- 、 / 、? 通配符
 */

export interface CronField {
  raw: string
  values: number[]
  description: string
}

export interface CronParseResult {
  valid: boolean
  error?: string
  fields?: {
    second?: CronField
    minute: CronField
    hour: CronField
    dayOfMonth: CronField
    month: CronField
    dayOfWeek: CronField
  }
  description?: string
  nextRuns?: Date[]
}

const FIELD_RANGES = {
  second: { min: 0, max: 59 },
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 6 }, // 0=周日, 6=周六
}

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/**
 * 解析单个字段（如 "*"、"5"、"0,15,30,45"、"9-17"、"星号/5"）
 */
function parseField(raw: string, range: { min: number; max: number }): number[] {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '?') {
    // ? 在 cron 中表示「不指定」，行为等同 *
    return rangeArray(range.min, range.max)
  }

  const result = new Set<number>()

  for (const part of trimmed.split(',')) {
    const stepMatch = part.match(/^(.+?)\/(\d+)$/)
    let baseExpr = part
    let step = 1
    if (stepMatch) {
      baseExpr = stepMatch[1]
      step = parseInt(stepMatch[2], 10)
      if (!Number.isFinite(step) || step <= 0) {
        throw new Error(`步长必须是正整数: ${part}`)
      }
    }

    let from: number
    let to: number
    if (baseExpr === '*') {
      from = range.min
      to = range.max
    } else if (baseExpr.includes('-')) {
      const [a, b] = baseExpr.split('-').map((s) => parseInt(s, 10))
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        throw new Error(`非法范围: ${part}`)
      }
      from = a
      to = b
    } else {
      const num = parseInt(baseExpr, 10)
      if (!Number.isFinite(num)) {
        throw new Error(`非法字符: ${part}`)
      }
      from = num
      to = stepMatch ? range.max : num
    }

    if (from < range.min || to > range.max || from > to) {
      throw new Error(`超出范围 [${range.min}-${range.max}]: ${part}`)
    }

    for (let i = from; i <= to; i += step) {
      result.add(i)
    }
  }

  return Array.from(result).sort((a, b) => a - b)
}

function rangeArray(min: number, max: number): number[] {
  const arr: number[] = []
  for (let i = min; i <= max; i++) arr.push(i)
  return arr
}

function describeField(values: number[], range: { min: number; max: number }, raw: string): string {
  const fullSize = range.max - range.min + 1
  if (values.length === fullSize) return '每个值'
  if (values.length === 1) return `值 ${values[0]}`
  if (raw.includes('/')) return `每隔 ${raw.split('/')[1]} 个`
  if (raw.includes('-')) return `范围 ${raw}`
  return values.join(', ')
}

/**
 * 计算给定起始时间之后的下 N 次执行时间
 * 简化实现：从下一秒/分钟开始逐步遍历，最大尝试 4 年防止死循环
 */
function calculateNextRuns(
  fields: NonNullable<CronParseResult['fields']>,
  count: number,
  from: Date,
): Date[] {
  const results: Date[] = []
  const hasSecond = !!fields.second

  // 「日」「周」是否被限定（非通配 * / ?）—— 决定二者取 OR 还是 AND
  const isWildcard = (raw: string) => {
    const t = raw.trim()
    return t === '*' || t === '?'
  }
  const domRestricted = !isWildcard(fields.dayOfMonth.raw)
  const dowRestricted = !isWildcard(fields.dayOfWeek.raw)

  // 起始时间：从 from 的下一秒（有秒字段）或下一分钟开始
  const cursor = new Date(from)
  if (hasSecond) {
    cursor.setMilliseconds(0)
    cursor.setSeconds(cursor.getSeconds() + 1)
  } else {
    cursor.setMilliseconds(0)
    cursor.setSeconds(0)
    cursor.setMinutes(cursor.getMinutes() + 1)
  }

  // 4 年的最大尝试次数（按秒/分为单位）
  const maxIterations = hasSecond ? 60 * 60 * 24 * 366 * 4 : 60 * 24 * 366 * 4

  let iter = 0
  while (results.length < count && iter < maxIterations) {
    iter++
    const sec = cursor.getSeconds()
    const min = cursor.getMinutes()
    const hour = cursor.getHours()
    const dom = cursor.getDate()
    const mon = cursor.getMonth() + 1
    const dow = cursor.getDay()

    const secOk = hasSecond ? fields.second!.values.includes(sec) : sec === 0
    const minOk = fields.minute.values.includes(min)
    const hourOk = fields.hour.values.includes(hour)
    const monOk = fields.month.values.includes(mon)
    const domOk = fields.dayOfMonth.values.includes(dom)
    const dowOk = fields.dayOfWeek.values.includes(dow)

    // 标准 cron（Vixie cron）语义：当「日」和「周」都被限定（都不是 * / ?）时，
    // 二者为 OR 关系（满足其一即触发）；否则为 AND（被限定的一方生效）。
    const dayOk = domRestricted && dowRestricted ? domOk || dowOk : domOk && dowOk

    if (secOk && minOk && hourOk && monOk && dayOk) {
      results.push(new Date(cursor))
    }

    if (hasSecond) {
      cursor.setSeconds(cursor.getSeconds() + 1)
    } else {
      cursor.setMinutes(cursor.getMinutes() + 1)
    }
  }

  return results
}

/**
 * 解析 cron 表达式
 */
export function parseCron(expression: string, runCount = 5, from = new Date()): CronParseResult {
  const trimmed = expression.trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    return { valid: false, error: '表达式不能为空' }
  }

  const parts = trimmed.split(' ')
  if (parts.length !== 5 && parts.length !== 6) {
    return { valid: false, error: `期望 5 或 6 个字段，实际收到 ${parts.length} 个` }
  }

  try {
    const hasSecond = parts.length === 6
    const offset = hasSecond ? 1 : 0
    const secondRaw = hasSecond ? parts[0] : undefined
    const minuteRaw = parts[offset]
    const hourRaw = parts[offset + 1]
    const domRaw = parts[offset + 2]
    const monthRaw = parts[offset + 3]
    const dowRaw = parts[offset + 4]

    const fields: NonNullable<CronParseResult['fields']> = {
      minute: {
        raw: minuteRaw,
        values: parseField(minuteRaw, FIELD_RANGES.minute),
        description: '',
      },
      hour: {
        raw: hourRaw,
        values: parseField(hourRaw, FIELD_RANGES.hour),
        description: '',
      },
      dayOfMonth: {
        raw: domRaw,
        values: parseField(domRaw, FIELD_RANGES.dayOfMonth),
        description: '',
      },
      month: {
        raw: monthRaw,
        values: parseField(monthRaw, FIELD_RANGES.month),
        description: '',
      },
      dayOfWeek: {
        raw: dowRaw,
        values: parseField(dowRaw, FIELD_RANGES.dayOfWeek),
        description: '',
      },
    }

    if (hasSecond) {
      fields.second = {
        raw: secondRaw!,
        values: parseField(secondRaw!, FIELD_RANGES.second),
        description: '',
      }
      fields.second.description = describeField(fields.second.values, FIELD_RANGES.second, secondRaw!)
    }

    fields.minute.description = describeField(fields.minute.values, FIELD_RANGES.minute, minuteRaw)
    fields.hour.description = describeField(fields.hour.values, FIELD_RANGES.hour, hourRaw)
    fields.dayOfMonth.description = describeField(fields.dayOfMonth.values, FIELD_RANGES.dayOfMonth, domRaw)
    fields.month.description = describeField(fields.month.values, FIELD_RANGES.month, monthRaw)
    fields.dayOfWeek.description = describeField(fields.dayOfWeek.values, FIELD_RANGES.dayOfWeek, dowRaw)

    const description = buildHumanReadable(fields, hasSecond)
    const nextRuns = calculateNextRuns(fields, runCount, from)

    return { valid: true, fields, description, nextRuns }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { valid: false, error: msg }
  }
}

function buildHumanReadable(fields: NonNullable<CronParseResult['fields']>, hasSecond: boolean): string {
  const parts: string[] = []

  // 时间部分
  const second = fields.second
  const minute = fields.minute
  const hour = fields.hour

  const allMin = minute.values.length === 60
  const allHour = hour.values.length === 24
  const allSec = !hasSecond || second!.values.length === 60

  if (hasSecond && allSec && allMin && allHour) {
    parts.push('每秒')
  } else if (!hasSecond && allMin && allHour) {
    parts.push('每分钟')
  } else if (allHour && minute.values.length === 1) {
    parts.push(`每小时第 ${minute.values[0]} 分钟`)
  } else if (hour.values.length === 1 && minute.values.length === 1) {
    const sec = hasSecond && second!.values.length === 1 ? `:${pad(second!.values[0])}` : ''
    parts.push(`每天 ${pad(hour.values[0])}:${pad(minute.values[0])}${sec}`)
  } else if (hour.values.length === 1) {
    parts.push(`每天 ${pad(hour.values[0])} 点的 ${minute.raw} 分`)
  } else {
    parts.push(`时:${hour.raw}, 分:${minute.raw}${hasSecond ? `, 秒:${second!.raw}` : ''}`)
  }

  // 月份
  if (fields.month.values.length !== 12) {
    if (fields.month.values.length <= 3) {
      parts.push(`${fields.month.values.map((m) => MONTH_NAMES[m - 1]).join('、')}`)
    } else {
      parts.push(`月:${fields.month.raw}`)
    }
  }

  // 日 / 周
  const allDom = fields.dayOfMonth.values.length === 31
  const allDow = fields.dayOfWeek.values.length === 7

  if (!allDom && allDow) {
    if (fields.dayOfMonth.values.length <= 3) {
      parts.push(`每月 ${fields.dayOfMonth.values.join('、')} 日`)
    } else {
      parts.push(`日:${fields.dayOfMonth.raw}`)
    }
  } else if (allDom && !allDow) {
    if (fields.dayOfWeek.values.length <= 3) {
      parts.push(fields.dayOfWeek.values.map((d) => WEEK_NAMES[d]).join('、'))
    } else {
      parts.push(`周:${fields.dayOfWeek.raw}`)
    }
  } else if (!allDom && !allDow) {
    parts.push(`日:${fields.dayOfMonth.raw} 或 周:${fields.dayOfWeek.raw}`)
  }

  return parts.join('，')
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** 常用 cron 表达式预设 */
export const CRON_PRESETS: Array<{ label: string; expression: string }> = [
  { label: '每分钟', expression: '* * * * *' },
  { label: '每 5 分钟', expression: '*/5 * * * *' },
  { label: '每小时', expression: '0 * * * *' },
  { label: '每天 0 点', expression: '0 0 * * *' },
  { label: '每天 9 点', expression: '0 9 * * *' },
  { label: '每周一 9 点', expression: '0 9 * * 1' },
  { label: '工作日 9 点', expression: '0 9 * * 1-5' },
  { label: '每月 1 号 0 点', expression: '0 0 1 * *' },
  { label: '每年 1 月 1 号', expression: '0 0 1 1 *' },
  { label: '每 30 秒（6段）', expression: '*/30 * * * * *' },
]
