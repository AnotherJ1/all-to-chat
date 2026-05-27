/**
 * Property 4: 工具注册表结构完整性
 * Validates: Requirements 3.1, 2.4
 *
 * 对于 toolRegistry 数组中的任何条目，该条目应包含所有必需字段的非空值：
 * id、name、description、icon 和 route。
 */
import { describe, it, expect } from 'vitest'
import { toolRegistry } from '../registry/tools'

describe('Property 4: 工具注册表结构完整性', () => {
  it('注册表应为非空数组', () => {
    expect(Array.isArray(toolRegistry)).toBe(true)
    expect(toolRegistry.length).toBeGreaterThan(0)
  })

  it.each(toolRegistry)('条目 "$id" 应包含非空的 id 字段', (entry) => {
    expect(typeof entry.id).toBe('string')
    expect(entry.id.trim().length).toBeGreaterThan(0)
  })

  it.each(toolRegistry)('条目 "$id" 应包含非空的 name 字段', (entry) => {
    expect(typeof entry.name).toBe('string')
    expect(entry.name.trim().length).toBeGreaterThan(0)
  })

  it.each(toolRegistry)('条目 "$id" 应包含非空的 description 字段', (entry) => {
    expect(typeof entry.description).toBe('string')
    expect(entry.description.trim().length).toBeGreaterThan(0)
  })

  it.each(toolRegistry)('条目 "$id" 的 icon 应为函数（React 组件）', (entry) => {
    expect(typeof entry.icon).toBe('function')
  })

  it.each(toolRegistry)('条目 "$id" 的 route 应为以 "/" 开头的非空字符串', (entry) => {
    expect(typeof entry.route).toBe('string')
    expect(entry.route.trim().length).toBeGreaterThan(0)
    expect(entry.route.startsWith('/')).toBe(true)
  })

  it.each(toolRegistry)('条目 "$id" 的 component 应已定义（懒加载组件）', (entry) => {
    expect(entry.component).toBeDefined()
  })

  it('不应存在重复的 id', () => {
    const ids = toolRegistry.map((entry) => entry.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('不应存在重复的 route', () => {
    const routes = toolRegistry.map((entry) => entry.route)
    const uniqueRoutes = new Set(routes)
    expect(uniqueRoutes.size).toBe(routes.length)
  })

  it('应包含 ai-chat 条目且 route 为 /chat', () => {
    const chatEntry = toolRegistry.find((entry) => entry.id === 'ai-chat')
    expect(chatEntry).toBeDefined()
    expect(chatEntry!.route).toBe('/chat')
  })

  it('应包含 image-gen 条目且 route 为 /image', () => {
    const imageEntry = toolRegistry.find((entry) => entry.id === 'image-gen')
    expect(imageEntry).toBeDefined()
    expect(imageEntry!.route).toBe('/image')
  })

  it.each(toolRegistry)('条目 "$id" 的 category 应为合法值', (entry) => {
    expect(['ai', 'text-data', 'dev', 'image', 'encode']).toContain(entry.category)
  })

  it('每个 categoryRegistry 中的分类都至少有一个工具归属', async () => {
    const { categoryRegistry } = await import('../registry/categories')
    for (const cat of categoryRegistry) {
      const has = toolRegistry.some((t) => t.category === cat.id)
      expect(has, `category ${cat.id} should have at least one tool`).toBe(true)
    }
  })
})
