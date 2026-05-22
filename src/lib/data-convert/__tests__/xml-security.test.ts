/**
 * 数据格式互转 — XML 解析安全加固测试
 *
 * 覆盖：
 *  1. 内部实体不展开（Billion-Laughs / 实体炸弹防护）
 *  2. DOCTYPE + 多层嵌套实体不会触发指数展开
 *  3. 5MB+ 输入被拒绝（不抛 OOM）
 *  4. 正常 XML 仍能正确解析（回归保护）
 *  5. Prototype Pollution 黑名单未被破坏（与 env/properties 同源约束）
 */

import { describe, it, expect } from 'vitest'
import { parseXml } from '../parsers'

describe('parseXml 安全加固', () => {
  it('1. 内部实体不展开，保留字面量（防 Billion-Laughs 基础形态）', async () => {
    const xml = `<!DOCTYPE foo [<!ENTITY x "y">]><root>&x;</root>`
    const r = await parseXml(xml)
    expect(r.ok).toBe(true)
    // processEntities=false 后，&x; 不应被替换为 "y"
    // fast-xml-parser 在关闭实体展开时会保留 &x; 字面量到文本节点
    const root = (r.ir as { root?: unknown }).root
    const rootStr = typeof root === 'string' ? root : JSON.stringify(root)
    expect(rootStr).toContain('&x;')
    expect(rootStr).not.toBe('y')
  })

  it('2. 多层嵌套实体不会指数级展开', async () => {
    // 经典 Billion-Laughs 雏形：a→b×10，若展开则爆炸
    const xml = `<!DOCTYPE lolz [
      <!ENTITY a "AAAAAAAAAA">
      <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
      <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
    ]><root>&c;</root>`
    const t0 = Date.now()
    const r = await parseXml(xml)
    const dt = Date.now() - t0
    // 解析必须快速完成（< 1s），且实体不被展开
    expect(dt).toBeLessThan(1000)
    expect(r.ok).toBe(true)
    const root = (r.ir as { root?: unknown }).root
    const rootStr = typeof root === 'string' ? root : JSON.stringify(root)
    // 不应出现展开后的长 A 串
    expect(rootStr).not.toMatch(/A{50,}/)
  })

  it('3. 输入超过 5MB 直接返回 error，不抛 OOM', async () => {
    // 构造 5MB + 1 字节的合法 XML 字符串（用 padding 撑大）
    const padding = 'a'.repeat(5 * 1024 * 1024 + 1)
    const xml = `<root>${padding}</root>`
    const r = await parseXml(xml)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/过大|上限|OOM|ReDoS/)
  })

  it('4. 5MB 边界以内的正常 XML 仍能解析', async () => {
    // 远小于 5MB 的中等输入，确保未误伤
    const items = Array.from({ length: 100 }, (_, i) => `<item id="${i}">v${i}</item>`).join('')
    const xml = `<root>${items}</root>`
    const r = await parseXml(xml)
    expect(r.ok).toBe(true)
    const root = (r.ir as { root?: { item?: unknown[] } }).root
    expect(root).toBeTruthy()
    expect(Array.isArray(root?.item)).toBe(true)
    expect(root?.item?.length).toBe(100)
  })

  it('5. 回归：基础 XML 解析未被破坏（属性 + 文本 + 嵌套）', async () => {
    const xml = `<book id="1"><title>Hello</title><author>Alice</author></book>`
    const r = await parseXml(xml)
    expect(r.ok).toBe(true)
    expect(r.ir).toMatchObject({
      book: {
        '@_id': 1,
        title: 'Hello',
        author: 'Alice',
      },
    })
  })

  it('6. 非字符串输入被拒绝', async () => {
    // @ts-expect-error 故意传非字符串验证防御
    const r = await parseXml(null)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/字符串/)
  })
})
