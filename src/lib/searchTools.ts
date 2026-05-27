import type { ToolMeta } from '../types'

/**
 * 按 query 在 name + description + keywords 上做大小写不敏感的 includes 匹配。
 * 空白 query 返回原数组（保序）。
 */
export function searchTools(query: string, tools: ToolMeta[]): ToolMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools
  return tools.filter((t) => {
    const haystack = [t.name, t.description, ...(t.keywords ?? [])]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
