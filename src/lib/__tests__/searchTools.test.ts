import { describe, it, expect } from 'vitest'
import { searchTools } from '../searchTools'
import type { ToolMeta } from '../../types'

function fakeTool(over: Partial<ToolMeta> & Pick<ToolMeta, 'id' | 'name'>): ToolMeta {
  return {
    description: '',
    icon: (() => null) as unknown as ToolMeta['icon'],
    route: '/' + over.id,
    component: {} as ToolMeta['component'],
    category: 'dev',
    ...over,
  }
}

describe('searchTools', () => {
  const tools: ToolMeta[] = [
    fakeTool({ id: 'json', name: 'JSON 格式化', description: 'JSON 压缩与美化', keywords: ['jsn', '格式化'] }),
    fakeTool({ id: 'csv', name: 'CSV ↔ JSON', description: 'CSV 与 JSON 互转' }),
    fakeTool({ id: 'curl', name: 'cURL 工具', description: 'cURL 转 fetch / axios' }),
  ]

  it('空 query 返回全部', () => {
    expect(searchTools('', tools)).toHaveLength(3)
  })

  it('仅空白的 query 返回全部', () => {
    expect(searchTools('   ', tools)).toHaveLength(3)
  })

  it('按 name 命中（大小写不敏感）', () => {
    const r = searchTools('json', tools)
    expect(r.map((t) => t.id).sort()).toEqual(['csv', 'json'])
  })

  it('按 description 命中', () => {
    const r = searchTools('fetch', tools)
    expect(r.map((t) => t.id)).toEqual(['curl'])
  })

  it('按 keywords 命中', () => {
    const r = searchTools('jsn', tools)
    expect(r.map((t) => t.id)).toEqual(['json'])
  })

  it('中文命中', () => {
    const r = searchTools('压缩', tools)
    expect(r.map((t) => t.id)).toEqual(['json'])
  })

  it('未命中返回空数组', () => {
    expect(searchTools('xxxxxx', tools)).toEqual([])
  })

  it('大小写无关', () => {
    expect(searchTools('JSON', tools).map((t) => t.id).sort()).toEqual(['csv', 'json'])
  })

  it('不修改原数组', () => {
    const copy = [...tools]
    searchTools('json', tools)
    expect(tools).toEqual(copy)
  })
})
