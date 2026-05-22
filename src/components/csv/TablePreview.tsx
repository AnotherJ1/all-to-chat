import { memo, useMemo } from 'react'

/** TablePreview 渲染上限：超过此行数仅渲染前 N 行 + "还有 X 行"提示，避免 DOM 过大卡顿 */
export const TABLE_PREVIEW_LIMIT = 200

interface TablePreviewProps {
  /** 解析后的对象数组（同源 fields 顺序由 columns 控制，此处不再做并集计算） */
  rows: Record<string, unknown>[]
  /** 显示的列序；省略时按首行键 */
  columns?: string[]
  /** 渲染上限，默认 TABLE_PREVIEW_LIMIT */
  limit?: number
}

/**
 * 把任意值转成单元格可显示的字符串
 * - 对象/数组：JSON.stringify（避免 [object Object]）
 * - null/undefined：空串
 */
function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

/**
 * 表格预览组件
 *
 * 性能策略：
 * - 受控行数（默认 200），超出仅展示前 N 条 + 计数提示
 * - 单元格字符串化通过 useMemo 计算一次（依赖 rows / columns / limit）
 * - 用 memo 包裹，父组件其它 state 变化不会触发重渲染
 */
const TablePreview = memo(function TablePreviewInner({
  rows,
  columns,
  limit = TABLE_PREVIEW_LIMIT,
}: TablePreviewProps) {
  const cols = useMemo<string[]>(() => {
    if (columns && columns.length > 0) return columns
    if (rows.length === 0) return []
    // 自动收集首行键作为列
    return Object.keys(rows[0])
  }, [columns, rows])

  const visibleRows = useMemo(() => rows.slice(0, limit), [rows, limit])
  const hidden = Math.max(0, rows.length - visibleRows.length)

  if (rows.length === 0 || cols.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
          background: 'var(--bg-secondary)',
          border: 'var(--border-width) solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        暂无数据
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'auto',
        maxHeight: '420px',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12.5px',
        }}
      >
        <thead
          style={{
            position: 'sticky',
            top: 0,
            background: 'var(--bg-surface)',
            zIndex: 1,
          }}
        >
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  borderBottom: 'var(--border-width) solid var(--border-color)',
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{
                background:
                  rIdx % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
              }}
            >
              {cols.map((c) => (
                <td
                  key={c}
                  style={{
                    padding: '6px 12px',
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent)',
                    maxWidth: '320px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={cellToString(row[c])}
                >
                  {cellToString(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            background: 'var(--bg-surface)',
            borderTop: 'var(--border-width) solid var(--border-color)',
            textAlign: 'center',
          }}
        >
          还有 {hidden.toLocaleString()} 行未显示（仅渲染前 {visibleRows.length.toLocaleString()} 行以保障性能）
        </div>
      )}
    </div>
  )
})

export default TablePreview
