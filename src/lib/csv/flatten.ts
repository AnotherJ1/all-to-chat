/**
 * 嵌套对象 ↔ 扁平点路径互转
 *
 * 用途：CSV 行天然是平的字符串键值，无法直接表达嵌套对象。
 * 因此 JSON → CSV 时必须先把 {a:{b:1}} 展平成 {'a.b': 1}；
 * CSV → JSON 时再可选地把 'a.b' 还原成 {a:{b:1}}。
 *
 * 数组处理约定：
 * - 展平：`{list: [1, 2]}` → `{'list.0': 1, 'list.1': 2}`，键末段是纯数字索引
 * - 反向：检测父节点下所有子键都是连续从 0 开始的数字时，还原为数组；否则按对象处理
 *
 * 边界：
 * - null / undefined / 原始值：直接保留（叶子节点）
 * - 空对象 {} / 空数组 []：直接保留（不再展开）
 * - 循环引用：通过 WeakSet 截断，避免栈溢出
 */

/** Prototype Pollution 黑名单：禁止把这些键写入对象 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** 是否为可继续展开的"对象/数组"节点 */
function isExpandable(v: unknown): v is Record<string, unknown> | unknown[] {
  return v !== null && typeof v === 'object'
}

/**
 * 展平嵌套对象为单层点路径键
 *
 * @param input  待展平对象（顶层可以是数组或对象，数组会保留顶层键为索引）
 * @param sep    路径分隔符，默认 '.'
 */
export function flatten(
  input: Record<string, unknown> | unknown[],
  sep = '.',
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const seen = new WeakSet<object>()

  // 递归核心：把 (prefix, value) 写入 result
  const walk = (prefix: string, value: unknown): void => {
    if (!isExpandable(value)) {
      result[prefix] = value
      return
    }

    // 循环引用兜底：直接当成叶子写入，避免无限递归
    if (seen.has(value as object)) {
      result[prefix] = '[Circular]'
      return
    }
    seen.add(value as object)

    if (Array.isArray(value)) {
      // 空数组保留为叶子节点
      if (value.length === 0) {
        result[prefix] = []
        return
      }
      value.forEach((item, idx) => {
        const nextKey = prefix ? `${prefix}${sep}${idx}` : String(idx)
        walk(nextKey, item)
      })
      return
    }

    const keys = Object.keys(value)
    if (keys.length === 0) {
      result[prefix] = {}
      return
    }
    for (const k of keys) {
      // 防 Prototype Pollution：跳过敏感键
      if (FORBIDDEN_KEYS.has(k)) continue
      const nextKey = prefix ? `${prefix}${sep}${k}` : k
      walk(nextKey, (value as Record<string, unknown>)[k])
    }
  }

  // 顶层 input 自身也要进 seen，避免根级别自引用（如 a.self = a）漏过循环检测
  seen.add(input as object)

  if (Array.isArray(input)) {
    input.forEach((item, idx) => walk(String(idx), item))
  } else {
    for (const k of Object.keys(input)) {
      // 防 Prototype Pollution：跳过敏感键
      if (FORBIDDEN_KEYS.has(k)) continue
      walk(k, input[k])
    }
  }
  return result
}

/**
 * 反向还原：单层点路径键 → 嵌套对象
 *
 * 关键算法：
 * 1. 把每个键按 sep 切成路径段
 * 2. 沿路径逐段下钻，缺失节点按"下一段是数字"决定建数组还是对象
 * 3. 完成后做一遍 collapse：扫描所有对象节点，若键集合是连续 [0..n-1] 的数字串，转成数组
 *
 * 注意：这里不在创建阶段强制建数组，而是事后归一化，避免乱序键导致结果不稳定。
 */
export function unflatten(
  flat: Record<string, unknown>,
  sep = '.',
): Record<string, unknown> | unknown[] {
  const root: Record<string, unknown> = {}

  for (const fullKey of Object.keys(flat)) {
    const segments = fullKey.split(sep)
    // 防 Prototype Pollution：路径中任一段命中黑名单则跳过整条 key
    if (segments.some((seg) => FORBIDDEN_KEYS.has(seg))) continue
    let cursor: Record<string, unknown> = root

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]
      const next = cursor[seg]
      if (!isExpandable(next)) {
        // 中间节点缺失或被原始值占用：用对象兜底；最后 collapse 阶段会决定数组化
        cursor[seg] = {}
      }
      cursor = cursor[seg] as Record<string, unknown>
    }
    cursor[segments[segments.length - 1]] = flat[fullKey]
  }

  // 二次扫描：把"键全是连续数字索引"的对象转成数组
  const collapse = (node: unknown): unknown => {
    if (!isExpandable(node)) return node
    if (Array.isArray(node)) return node.map(collapse)

    const obj = node as Record<string, unknown>
    const keys = Object.keys(obj)

    // 先递归处理子节点
    for (const k of keys) {
      obj[k] = collapse(obj[k])
    }

    // 判断是否可数组化：键全是非负整数 + 形成 [0..n-1]
    if (keys.length === 0) return obj
    const indices = keys.map((k) => Number(k))
    const allIntegers = indices.every((n) => Number.isInteger(n) && n >= 0 && String(n) === keys[indices.indexOf(n)])
    if (!allIntegers) return obj
    indices.sort((a, b) => a - b)
    for (let i = 0; i < indices.length; i++) {
      if (indices[i] !== i) return obj
    }
    // 严格连续：转为数组
    const arr: unknown[] = new Array(indices.length)
    for (let i = 0; i < indices.length; i++) {
      arr[i] = obj[String(i)]
    }
    return arr
  }

  return collapse(root) as Record<string, unknown> | unknown[]
}
