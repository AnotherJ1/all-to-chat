import { useMemo, useState } from 'react'
import { diffJson, summarizeDiff, type DiffEntry } from '../../lib/diff/json-diff'
import { toast } from '../../stores/toastStore'

/**
 * JSON 结构化对比视图
 * - 树形展开 / 折叠
 * - 颜色标注：+(绿) -(红) ~(黄) =(灰)
 * - 点击节点复制完整 path
 * - 相同子树折叠按钮
 */

interface Props {
  left: unknown
  right: unknown
  sortArrayKeys?: boolean
  /** 触发外部错误显示（深度爆炸等） */
  onError?: (msg: string) => void
}

const COLORS = {
  add: '#22c55e',
  remove: '#ef4444',
  change: '#eab308',
  equal: 'var(--text-muted)',
}

const SIGNS = {
  add: '+',
  remove: '-',
  change: '~',
  equal: '=',
} as const

export default function JsonDiffView({ left, right, sortArrayKeys = false, onError }: Props) {
  const [collapseEqual, setCollapseEqual] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 缓存差异结果；递归深度爆炸时给出友好提示
  const entries = useMemo<DiffEntry[]>(() => {
    try {
      const r = diffJson(left, right, { sortKeys: sortArrayKeys })
      setErrorMsg(null)
      return r
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(msg)
      onError?.(msg)
      return []
    }
  }, [left, right, sortArrayKeys, onError])

  const stat = useMemo(() => summarizeDiff(entries), [entries])

  // collapseEqual: 若打开则隐藏"等价子树"——即被外层 equal 容器覆盖到的所有 equal 子节点
  const visible = useMemo(() => {
    if (!collapseEqual) return entries
    // 维护一个 stack：当前正在折叠的容器路径前缀
    const out: DiffEntry[] = []
    let collapsePrefix: string | null = null
    for (const e of entries) {
      if (collapsePrefix !== null) {
        // 还在被折叠的子树内
        if (e.path === collapsePrefix || e.path.startsWith(collapsePrefix + '.') || e.path.startsWith(collapsePrefix + '[')) {
          // 跳过子节点（容器自身已在 out 中保留为占位）
          if (e.path === collapsePrefix) {
            // 容器自身已 push，跳过
          }
          continue
        } else {
          collapsePrefix = null
        }
      }
      // 新条目：判断是否为可折叠容器
      const isContainer =
        e.type === 'equal' && (Array.isArray(e.leftValue) || (e.leftValue !== null && typeof e.leftValue === 'object'))
      if (isContainer) {
        out.push(e)
        collapsePrefix = e.path
      } else {
        out.push(e)
      }
    }
    return out
  }, [entries, collapseEqual])

  const handleCopy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path || '<root>')
      toast.success(path ? `已复制 path: ${path}` : '已复制根路径')
    } catch {
      toast.error('复制失败')
    }
  }

  if (errorMsg) {
    return (
      <div style={{ padding: '24px 16px', color: COLORS.remove, fontSize: '13px', textAlign: 'center' }}>
        ⚠️ {errorMsg}
        <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
          建议切换到「文本模式」查看原始内容。
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        无可对比内容
      </div>
    )
  }

  return (
    <div>
      {/* 顶部统计栏 */}
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap',
          borderBottom: 'var(--border-width) solid var(--border-color)',
          fontSize: '12px',
          background: 'var(--bg-secondary)',
        }}
      >
        <span style={{ color: COLORS.add, fontWeight: 600 }}>+ {stat.add}</span>
        <span style={{ color: COLORS.remove, fontWeight: 600 }}>- {stat.remove}</span>
        <span style={{ color: COLORS.change, fontWeight: 600 }}>~ {stat.change}</span>
        <span style={{ color: 'var(--text-muted)' }}>= {stat.equal}</span>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={collapseEqual}
            onChange={(e) => setCollapseEqual(e.target.checked)}
          />
          折叠相同子树
        </label>
      </div>

      {/* 树形列表 */}
      <div
        style={{
          maxHeight: '700px',
          overflow: 'auto',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '13px',
        }}
      >
        {visible.map((e, idx) => (
          <DiffRow key={`${idx}-${e.path}`} entry={e} onCopyPath={handleCopy} />
        ))}
      </div>
    </div>
  )
}

function DiffRow({ entry, onCopyPath }: { entry: DiffEntry; onCopyPath: (p: string) => void }) {
  const color = COLORS[entry.type]
  const sign = SIGNS[entry.type]
  // 路径缩进：按 . 与 [ 的总数
  const depth = entry.path ? (entry.path.match(/\.|\[/g) || []).length : 0
  const indent = depth * 14

  const bg =
    entry.type === 'add'
      ? 'rgba(34,197,94,0.10)'
      : entry.type === 'remove'
        ? 'rgba(239,68,68,0.10)'
        : entry.type === 'change'
          ? 'rgba(234,179,8,0.10)'
          : 'transparent'

  return (
    <div
      onClick={() => onCopyPath(entry.path)}
      title={`点击复制路径: ${entry.path || '<root>'}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '3px 12px 3px 12px',
        background: bg,
        borderBottom: '1px solid var(--border-color)',
        cursor: 'pointer',
        wordBreak: 'break-all',
      }}
    >
      <span style={{ color, fontWeight: 700, width: '14px', flexShrink: 0, userSelect: 'none' }}>{sign}</span>
      <span style={{ paddingLeft: `${indent}px`, color: 'var(--text-secondary)', flexShrink: 0, userSelect: 'none' }}>
        {entry.path || '<root>'}
      </span>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)' }}>
        <ValueRender entry={entry} />
      </span>
    </div>
  )
}

function ValueRender({ entry }: { entry: DiffEntry }) {
  if (entry.type === 'add') {
    return <code style={{ color: COLORS.add }}>{stringifyShort(entry.rightValue)}</code>
  }
  if (entry.type === 'remove') {
    return <code style={{ color: COLORS.remove }}>{stringifyShort(entry.leftValue)}</code>
  }
  if (entry.type === 'change') {
    return (
      <span>
        <code style={{ color: COLORS.remove, textDecoration: 'line-through' }}>{stringifyShort(entry.leftValue)}</code>
        <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
        <code style={{ color: COLORS.add }}>{stringifyShort(entry.rightValue)}</code>
      </span>
    )
  }
  // equal：折叠时容器自身只显示类型摘要
  return <code style={{ color: 'var(--text-muted)' }}>{summaryOf(entry.leftValue)}</code>
}

/** 短显示：基础类型直接 stringify；容器显示摘要 */
function stringifyShort(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  const t = typeof v
  if (t === 'string') return JSON.stringify(v)
  if (t === 'number' || t === 'boolean') return String(v)
  if (Array.isArray(v)) return `[Array(${v.length})]`
  if (t === 'object') {
    const keys = Object.keys(v as object)
    return `{${keys.length} keys}`
  }
  return String(v)
}

function summaryOf(v: unknown): string {
  if (Array.isArray(v)) return `[Array(${v.length})] (相同)`
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v as object).length} keys} (相同)`
  }
  return stringifyShort(v) + ' (相同)'
}
