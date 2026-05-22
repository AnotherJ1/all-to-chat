/**
 * 数据格式互转 — JSON / YAML / TOML / XML 往返一致测试
 *
 * 通过把同一 IR 序列化为某格式后再解析回来，断言关键字段相等。
 * 注意：XML 由于属性 / 文本节点歧义，仅做"对象基线 + root 包裹"的轻量校验。
 */

import { describe, it, expect } from 'vitest'
import {
  parseJson,
  parseYaml,
  parseToml,
  parseXml,
} from '../parsers'
import {
  serializeJson,
  serializeYaml,
  serializeToml,
  serializeXml,
} from '../serializers'

describe('roundtrip: JSON ↔ YAML ↔ TOML ↔ XML', () => {
  // 基础对象（不含 null，避免 toml 限制）
  const fixture = {
    name: 'demo',
    version: '1.0.0',
    enabled: true,
    count: 42,
    tags: ['a', 'b', 'c'],
    nested: { host: 'localhost', port: 8080 },
  }

  it('1. JSON 往返一致', () => {
    const s = serializeJson(fixture)
    expect(s.ok).toBe(true)
    const p = parseJson(s.output!)
    expect(p.ok).toBe(true)
    expect(p.ir).toEqual(fixture)
  })

  it('2. YAML 往返一致', async () => {
    const s = await serializeYaml(fixture)
    expect(s.ok).toBe(true)
    const p = await parseYaml(s.output!)
    expect(p.ok).toBe(true)
    expect(p.ir).toEqual(fixture)
  })

  it('3. TOML 往返一致', async () => {
    const s = await serializeToml(fixture)
    expect(s.ok).toBe(true)
    const p = await parseToml(s.output!)
    expect(p.ok).toBe(true)
    // @iarna/toml 解析后的对象应包含完整字段
    expect(p.ir).toMatchObject({
      name: 'demo',
      version: '1.0.0',
      enabled: true,
      count: 42,
      tags: ['a', 'b', 'c'],
      nested: { host: 'localhost', port: 8080 },
    })
  })

  it('4. XML 顶层标量包 root 自动还原', async () => {
    const s = await serializeXml('hello')
    expect(s.ok).toBe(true)
    const p = await parseXml(s.output!)
    expect(p.ok).toBe(true)
    expect(p.ir).toMatchObject({ root: 'hello' })
  })

  it('5. XML 对象基线往返（属性 / 文本节点）', async () => {
    const objWithAttr = {
      book: {
        '@_id': '1',
        title: 'Hello',
        author: 'Alice',
      },
    }
    const s = await serializeXml(objWithAttr)
    expect(s.ok).toBe(true)
    const p = await parseXml(s.output!)
    expect(p.ok).toBe(true)
    expect(p.ir).toMatchObject({
      book: {
        '@_id': 1,
        title: 'Hello',
        author: 'Alice',
      },
    })
  })

  it('6. 跨格式：JSON → YAML → JSON 一致', async () => {
    const j1 = serializeJson(fixture).output!
    const ir1 = parseJson(j1).ir
    const y = await serializeYaml(ir1)
    expect(y.ok).toBe(true)
    const ir2 = (await parseYaml(y.output!)).ir
    const j2 = serializeJson(ir2).output!
    expect(JSON.parse(j2)).toEqual(fixture)
  })

  it('7. 跨格式：JSON → TOML → JSON 还原（过滤数组容差）', async () => {
    const ir = parseJson(serializeJson(fixture).output!).ir
    const tomlOut = await serializeToml(ir)
    expect(tomlOut.ok).toBe(true)
    const ir2 = (await parseToml(tomlOut.output!)).ir
    expect(ir2).toMatchObject({
      name: 'demo',
      version: '1.0.0',
      enabled: true,
      count: 42,
      tags: ['a', 'b', 'c'],
      nested: { host: 'localhost', port: 8080 },
    })
  })
})
