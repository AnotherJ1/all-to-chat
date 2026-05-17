/**
 * 轻量级行级文本 diff
 * 基于 LCS（最长公共子序列）算法，时间 O(M*N)，空间 O(M*N)
 * 对于绝大多数代码/文本对比场景足够使用
 */

export type DiffOp = 'equal' | 'add' | 'remove'

export interface DiffLine {
  op: DiffOp
  /** 左侧行号（仅 equal/remove 有值，1-indexed） */
  leftNo?: number
  /** 右侧行号（仅 equal/add 有值，1-indexed） */
  rightNo?: number
  /** 行内容 */
  content: string
}

export interface DiffStat {
  added: number
  removed: number
  unchanged: number
}

export interface DiffResult {
  lines: DiffLine[]
  stat: DiffStat
}

/**
 * 行级文本对比
 * @param ignoreCase 忽略大小写
 * @param ignoreWhitespace 忽略前后空白
 */
export function diffText(
  left: string,
  right: string,
  options: { ignoreCase?: boolean; ignoreWhitespace?: boolean } = {},
): DiffResult {
  const { ignoreCase = false, ignoreWhitespace = false } = options

  const leftLines = left.split('\n')
  const rightLines = right.split('\n')

  const norm = (s: string) => {
    let v = s
    if (ignoreWhitespace) v = v.trim()
    if (ignoreCase) v = v.toLowerCase()
    return v
  }

  const m = leftLines.length
  const n = rightLines.length

  // 防御：超大文本时切到简化模式（>5000 行直接顺序对比）
  if (m * n > 5_000_000) {
    return fallbackDiff(leftLines, rightLines, norm)
  }

  // LCS DP
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (norm(leftLines[i]) === norm(rightLines[j])) {
        dp[i + 1][j + 1] = dp[i][j] + 1
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  // 回溯生成 diff
  const lines: DiffLine[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && norm(leftLines[i - 1]) === norm(rightLines[j - 1])) {
      lines.unshift({ op: 'equal', leftNo: i, rightNo: j, content: leftLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      lines.unshift({ op: 'add', rightNo: j, content: rightLines[j - 1] })
      j--
    } else if (i > 0) {
      lines.unshift({ op: 'remove', leftNo: i, content: leftLines[i - 1] })
      i--
    }
  }

  const stat: DiffStat = { added: 0, removed: 0, unchanged: 0 }
  for (const line of lines) {
    if (line.op === 'add') stat.added++
    else if (line.op === 'remove') stat.removed++
    else stat.unchanged++
  }

  return { lines, stat }
}

/** 超大文本退化方案：纯顺序对比 */
function fallbackDiff(
  leftLines: string[],
  rightLines: string[],
  norm: (s: string) => string,
): DiffResult {
  const max = Math.max(leftLines.length, rightLines.length)
  const lines: DiffLine[] = []
  const stat: DiffStat = { added: 0, removed: 0, unchanged: 0 }
  for (let k = 0; k < max; k++) {
    const l = leftLines[k]
    const r = rightLines[k]
    if (l !== undefined && r !== undefined) {
      if (norm(l) === norm(r)) {
        lines.push({ op: 'equal', leftNo: k + 1, rightNo: k + 1, content: l })
        stat.unchanged++
      } else {
        lines.push({ op: 'remove', leftNo: k + 1, content: l })
        lines.push({ op: 'add', rightNo: k + 1, content: r })
        stat.removed++
        stat.added++
      }
    } else if (l !== undefined) {
      lines.push({ op: 'remove', leftNo: k + 1, content: l })
      stat.removed++
    } else if (r !== undefined) {
      lines.push({ op: 'add', rightNo: k + 1, content: r })
      stat.added++
    }
  }
  return { lines, stat }
}
