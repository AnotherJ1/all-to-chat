import { describe, it, expect } from 'vitest'
import { flatten, unflatten } from '../flatten'

describe('flatten', () => {
  it('单层对象保持原样', () => {
    expect(flatten({ a: 1, b: 'x' })).toEqual({ a: 1, b: 'x' })
  })

  it('深嵌套对象按 . 展平', () => {
    expect(flatten({ user: { profile: { name: 'Tom', age: 18 } } })).toEqual({
      'user.profile.name': 'Tom',
      'user.profile.age': 18,
    })
  })

  it('数组元素以索引展平', () => {
    expect(flatten({ list: [10, 20, 30] })).toEqual({
      'list.0': 10,
      'list.1': 20,
      'list.2': 30,
    })
  })

  it('对象 + 数组混合嵌套', () => {
    const input = {
      id: 1,
      tags: ['a', 'b'],
      meta: { author: { name: 'Foo' } },
    }
    expect(flatten(input)).toEqual({
      id: 1,
      'tags.0': 'a',
      'tags.1': 'b',
      'meta.author.name': 'Foo',
    })
  })

  it('保留 null / 空对象 / 空数组作为叶子', () => {
    expect(flatten({ a: null, b: {}, c: [] })).toEqual({
      a: null,
      b: {},
      c: [],
    })
  })

  it('循环引用安全降级为 [Circular]', () => {
    const a: Record<string, unknown> = { name: 'A' }
    a.self = a
    const out = flatten(a)
    expect(out['name']).toBe('A')
    expect(out['self']).toBe('[Circular]')
  })
})

describe('unflatten', () => {
  it('单层路径还原对象', () => {
    expect(unflatten({ a: 1, b: 'x' })).toEqual({ a: 1, b: 'x' })
  })

  it('点路径还原嵌套对象', () => {
    expect(unflatten({ 'user.profile.name': 'Tom' })).toEqual({
      user: { profile: { name: 'Tom' } },
    })
  })

  it('连续数字键还原为数组', () => {
    expect(unflatten({ 'list.0': 10, 'list.1': 20, 'list.2': 30 })).toEqual({
      list: [10, 20, 30],
    })
  })

  it('flatten + unflatten 应可还原原始结构', () => {
    const original = {
      id: 1,
      tags: ['a', 'b'],
      meta: { author: { name: 'Foo' }, score: [99, 100] },
    }
    const round = unflatten(flatten(original))
    expect(round).toEqual(original)
  })

  it('非连续数字键保持对象形态（避免乱序歧义）', () => {
    expect(unflatten({ 'm.0': 'x', 'm.2': 'y' })).toEqual({
      m: { '0': 'x', '2': 'y' },
    })
  })
})
