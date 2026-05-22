/**
 * JSON 结构化对比
 * - 递归按 key path 对比两个 JS 值，输出每个叶子/差异节点
 * - 支持数组 reorder 容差（sortKeys: 递归稳定排序后再对比）
 * - 递归深度上限 100，超出抛错
 *
 * 注意：本模块零外部依赖，纯函数式 API
 */

/** 单条差异条目 */
export interface DiffEntry {
  /** 完整路径，如 'a.b[0].c'；根节点用空字符串 */
  path: string
  /** 节点关系类型 */
  type: 'add' | 'remove' | 'change' | 'equal'
  /** 左侧值（add 时缺省） */
  leftValue?: unknown
  /** 右侧值（remove 时缺省） */
  rightValue?: unknown
}

export interface JsonDiffOptions {
  /**
   * 数组 reorder 容差：
   * - 打开后递归对所有数组按 stable JSON 字符串排序，再按下标对比
   * - 默认 false：数组按下标对比
   */
  sortKeys?: boolean
  /** 递归深度上限，默认 100 */
  maxDepth?: number
}

/** 递归深度爆炸异常 */
export class JsonDiffDepthError extends Error {
  constructor(depth: number) {
    super(`JSON diff 递归深度超过限制 ${depth}，疑似环或超深嵌套，请切换文本模式`)
    this.name = 'JsonDiffDepthError'
  }
}

const DEFAULT_MAX_DEPTH = 100

/**
 * 主入口：递归对比 left / right，返回展平的差异列表
 * - 顺序为深度优先、按 key 字典序
 * - 叶子节点（基础类型 / null）会单独输出 equal/change/add/remove
 * - 容器节点（对象 / 数组）若整体相等也会输出一个 equal（path 为容器路径）
 */
export function diffJson(
  left: unknown,
  right: unknown,
  options: JsonDiffOptions = {},
): DiffEntry[] {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const sortKeys = options.sortKeys ?? false

  const entries: DiffEntry[] = []
  // 关键算法：递归收集差异，传入当前 path 与递归深度
  walk(left, right, '', entries, 0, maxDepth, sortKeys)
  return entries
}

/**
 * 类型分类：用于决定走容器对比还是值对比
 * - 'object' 仅指普通对象（plain object），数组单独归类
 * - 其他全部归 'primitive'（含 null/undefined/Date/Map/Set/函数等）
 */
type Kind = 'object' | 'array' | 'primitive'

function kindOf(v: unknown): Kind {
  if (Array.isArray(v)) return 'array'
  if (v !== null && typeof v === 'object' && Object.getPrototypeOf(v) !== null) {
    // 限定 plain object：兼容 Object.create(null) 与字面量
    const proto = Object.getPrototypeOf(v)
    if (proto === Object.prototype) return 'object'
    return 'primitive'
  }
  if (v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === null) {
    return 'object'
  }
  return 'primitive'
}

/** 把容器整体标记为某 type，递归填充其所有子节点 */
function fillSubtree(
  value: unknown,
  basePath: string,
  type: 'add' | 'remove',
  entries: DiffEntry[],
  depth: number,
  maxDepth: number,
): void {
  if (depth > maxDepth) throw new JsonDiffDepthError(maxDepth)

  const k = kindOf(value)
  if (k === 'primitive') {
    entries.push({
      path: basePath,
      type,
      ...(type === 'remove' ? { leftValue: value } : { rightValue: value }),
    })
    return
  }

  // 容器自身先入条目
  entries.push({
    path: basePath,
    type,
    ...(type === 'remove' ? { leftValue: value } : { rightValue: value }),
  })

  if (k === 'array') {
    const arr = value as unknown[]
    arr.forEach((item, idx) => {
      fillSubtree(item, `${basePath}[${idx}]`, type, entries, depth + 1, maxDepth)
    })
  } else {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    for (const key of keys) {
      fillSubtree(obj[key], joinPath(basePath, key), type, entries, depth + 1, maxDepth)
    }
  }
}

/** 路径拼接：根 + key */
function joinPath(base: string, key: string): string {
  if (!base) return key
  return `${base}.${key}`
}

/**
 * 稳定 JSON 字符串：按 key 排序，递归
 * 关键：depth 必须由调用方传入"当前节点所在的真实深度"，而不是恒为 0。
 * 因为本函数会被 stableSortValue 的 sort 回调反复调用，每次比较都从 0 起步会绕过
 * maxDepth 防御，让超深嵌套（>100 层）的数组在排序阶段悄悄通过。
 */
function stableStringify(v: unknown, depth: number, maxDepth: number): string {
  if (depth > maxDepth) throw new JsonDiffDepthError(maxDepth)
  const k = kindOf(v)
  if (k === 'primitive') {
    if (v === undefined) return '__undefined__'
    return JSON.stringify(v) ?? 'null'
  }
  if (k === 'array') {
    const arr = (v as unknown[]).map((x) => stableStringify(x, depth + 1, maxDepth))
    return `[${arr.join(',')}]`
  }
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const parts = keys.map((kk) => `${JSON.stringify(kk)}:${stableStringify(obj[kk], depth + 1, maxDepth)}`)
  return `{${parts.join(',')}}`
}

/** 递归稳定排序：用于 sortKeys 选项；返回新值，不改原值 */
function stableSortValue(v: unknown, depth: number, maxDepth: number): unknown {
  if (depth > maxDepth) throw new JsonDiffDepthError(maxDepth)
  const k = kindOf(v)
  if (k === 'primitive') return v
  if (k === 'array') {
    // 关键：sort 回调中调用 stableStringify 时必须传入"当前数组元素所在的深度"（即 depth + 1）
    // 而不是从 0 重新起步——否则每次比较都重置深度计数，maxDepth 防御会被绕过，
    // 攻击者可以构造超深嵌套数组（>100 层）让 stableStringify 实际递归到极深而不抛错
    const childDepth = depth + 1
    const sorted = (v as unknown[])
      .map((x) => stableSortValue(x, childDepth, maxDepth))
      .slice()
      .sort((a, b) => {
        // 此处 a/b 是排序后的子节点，本身处于 childDepth 层，
        // 因此 stableStringify 必须从 childDepth 继续向下计数
        const sa = stableStringify(a, childDepth, maxDepth)
        const sb = stableStringify(b, childDepth, maxDepth)
        return sa < sb ? -1 : sa > sb ? 1 : 0
      })
    return sorted
  }
  const obj = v as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const kk of Object.keys(obj)) {
    out[kk] = stableSortValue(obj[kk], depth + 1, maxDepth)
  }
  return out
}

/** 严格相等：区分 null / undefined；NaN 视为相等 */
function strictEqual(a: unknown, b: unknown): boolean {
  if (Number.isNaN(a) && Number.isNaN(b)) return true
  return a === b
}

/** 核心递归 */
function walk(
  left: unknown,
  right: unknown,
  path: string,
  entries: DiffEntry[],
  depth: number,
  maxDepth: number,
  sortKeys: boolean,
): void {
  if (depth > maxDepth) throw new JsonDiffDepthError(maxDepth)

  // sortKeys 仅在最外层做一次预处理，避免重复计算
  if (sortKeys && depth === 0) {
    left = stableSortValue(left, 0, maxDepth)
    right = stableSortValue(right, 0, maxDepth)
  }

  const lk = kindOf(left)
  const rk = kindOf(right)

  // 类型不一致：整体视为 change
  if (lk !== rk) {
    entries.push({ path, type: 'change', leftValue: left, rightValue: right })
    return
  }

  if (lk === 'primitive') {
    if (strictEqual(left, right)) {
      entries.push({ path, type: 'equal', leftValue: left, rightValue: right })
    } else {
      entries.push({ path, type: 'change', leftValue: left, rightValue: right })
    }
    return
  }

  if (lk === 'array') {
    const la = left as unknown[]
    const ra = right as unknown[]
    const max = Math.max(la.length, ra.length)
    // 容器自身：等长 + 全相等子节点 → 后面再回填 equal；先递归
    const allEqualBefore: number = entries.length
    for (let i = 0; i < max; i++) {
      const child = `${path}[${i}]`
      const lhas = i < la.length
      const rhas = i < ra.length
      if (lhas && rhas) {
        walk(la[i], ra[i], child, entries, depth + 1, maxDepth, sortKeys)
      } else if (lhas) {
        fillSubtree(la[i], child, 'remove', entries, depth + 1, maxDepth)
      } else {
        fillSubtree(ra[i], child, 'add', entries, depth + 1, maxDepth)
      }
    }
    // 容器自身节点：所有子节点 type 都为 equal 才输出 equal，否则不输出（差异已被子节点表达）
    const subEntries = entries.slice(allEqualBefore)
    const allEqual = subEntries.length > 0 && subEntries.every((e) => e.type === 'equal')
    if (allEqual && la.length === ra.length) {
      // 在所有子节点之前插入容器自身的 equal 标记
      entries.splice(allEqualBefore, 0, { path, type: 'equal', leftValue: la, rightValue: ra })
    }
    return
  }

  // object
  const lo = left as Record<string, unknown>
  const ro = right as Record<string, unknown>
  const keySet = new Set<string>([...Object.keys(lo), ...Object.keys(ro)])
  const keys = Array.from(keySet).sort()

  const containerStart = entries.length
  for (const key of keys) {
    const child = joinPath(path, key)
    const lhas = Object.prototype.hasOwnProperty.call(lo, key)
    const rhas = Object.prototype.hasOwnProperty.call(ro, key)
    if (lhas && rhas) {
      walk(lo[key], ro[key], child, entries, depth + 1, maxDepth, sortKeys)
    } else if (lhas) {
      fillSubtree(lo[key], child, 'remove', entries, depth + 1, maxDepth)
    } else {
      fillSubtree(ro[key], child, 'add', entries, depth + 1, maxDepth)
    }
  }

  const subEntries = entries.slice(containerStart)
  const allEqual = subEntries.length > 0 && subEntries.every((e) => e.type === 'equal')
  if (allEqual && Object.keys(lo).length === Object.keys(ro).length) {
    entries.splice(containerStart, 0, { path, type: 'equal', leftValue: lo, rightValue: ro })
  }
}

/** 工具函数：统计 add/remove/change/equal 数量 */
export function summarizeDiff(entries: DiffEntry[]) {
  const stat = { add: 0, remove: 0, change: 0, equal: 0 }
  for (const e of entries) stat[e.type]++
  return stat
}

/** 安全 JSON 解析：返回 [value, error] 元组 */
export function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!text.trim()) return { ok: false, error: '空字符串' }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
