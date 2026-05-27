import type { ToolCategory } from '../types'

export interface CategoryMeta {
  id: ToolCategory
  /** 中文显示名 */
  name: string
  /** 渲染顺序 */
  order: number
}

export const categoryRegistry: CategoryMeta[] = [
  { id: 'ai',        name: 'AI 智能',     order: 1 },
  { id: 'text-data', name: '文本与数据',   order: 2 },
  { id: 'dev',       name: '开发辅助',     order: 3 },
  { id: 'image',     name: '图像处理',     order: 4 },
  { id: 'encode',    name: '编码与时间',   order: 5 },
]

/** 按 order 升序的分类列表（防御性副本） */
export function getOrderedCategories(): CategoryMeta[] {
  return [...categoryRegistry].sort((a, b) => a.order - b.order)
}
