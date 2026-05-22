import { describe, it, expect } from 'vitest'
import {
  diffJson,
  summarizeDiff,
  tryParseJson,
  JsonDiffDepthError,
  type DiffEntry,
} from '../json-diff'

/** 取 path 列表（不关心顺序的细节时方便断言） */
function paths(entries: DiffEntry[]): string[] {
  return entries.map((e) => `${e.type}:${e.path}`)
}

describe('json-diff', () => {
  it('基础类型相等', () => {
    const r = diffJson(1, 1)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ path: '', type: 'equal', leftValue: 1, rightValue: 1 })
  })

  it('基础类型变更', () => {
    const r = diffJson(1, 2)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ type: 'change', leftValue: 1, rightValue: 2 })
  })

  it('对象新增字段', () => {
    const r = diffJson({ a: 1 }, { a: 1, b: 2 })
    const ps = paths(r)
    expect(ps).toContain('equal:a')
    expect(ps).toContain('add:b')
    const addEntry = r.find((e) => e.path === 'b')!
    expect(addEntry.type).toBe('add')
    expect(addEntry.rightValue).toBe(2)
    expect(addEntry.leftValue).toBeUndefined()
  })

  it('对象删除字段', () => {
    const r = diffJson({ a: 1, b: 2 }, { a: 1 })
    const ps = paths(r)
    expect(ps).toContain('remove:b')
    const removeEntry = r.find((e) => e.path === 'b')!
    expect(removeEntry.type).toBe('remove')
    expect(removeEntry.leftValue).toBe(2)
    expect(removeEntry.rightValue).toBeUndefined()
  })

  it('对象字段值变更', () => {
    const r = diffJson({ a: 1 }, { a: 2 })
    const changeEntry = r.find((e) => e.path === 'a')!
    expect(changeEntry.type).toBe('change')
    expect(changeEntry.leftValue).toBe(1)
    expect(changeEntry.rightValue).toBe(2)
  })

  it('嵌套对象差异路径正确', () => {
    const r = diffJson({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } })
    const change = r.find((e) => e.type === 'change')!
    expect(change.path).toBe('a.b.c')
    expect(change.leftValue).toBe(1)
    expect(change.rightValue).toBe(2)
  })

  it('数组按下标对比 + reorder 检测为变更', () => {
    const r = diffJson([1, 2, 3], [3, 2, 1])
    // 下标 0/2 不同
    const changes = r.filter((e) => e.type === 'change').map((e) => e.path)
    expect(changes).toContain('[0]')
    expect(changes).toContain('[2]')
    expect(r.find((e) => e.path === '[1]')?.type).toBe('equal')
  })

  it('sortKeys 容忍数组重排序', () => {
    const r = diffJson([3, 1, 2], [1, 2, 3], { sortKeys: true })
    // 排序后等价
    const hasChange = r.some((e) => e.type === 'change')
    expect(hasChange).toBe(false)
  })

  it('数组长度不一致：缺失项标 add/remove', () => {
    const r = diffJson([1, 2], [1, 2, 3])
    const addEntry = r.find((e) => e.path === '[2]' && e.type === 'add')!
    expect(addEntry.rightValue).toBe(3)
  })

  it('null 与 undefined 严格区分', () => {
    const r1 = diffJson({ a: null }, { a: undefined })
    // null 是 primitive，undefined 也是 primitive，但值不等 → change
    const cell = r1.find((e) => e.path === 'a')!
    expect(cell.type).toBe('change')
    expect(cell.leftValue).toBeNull()
    expect(cell.rightValue).toBeUndefined()

    const r2 = diffJson({ a: null }, { a: null })
    expect(r2.find((e) => e.path === 'a')?.type).toBe('equal')
  })

  it('类型变更（数字 → 字符串）标 change', () => {
    const r = diffJson({ a: 1 }, { a: '1' })
    const cell = r.find((e) => e.path === 'a')!
    expect(cell.type).toBe('change')
    expect(cell.leftValue).toBe(1)
    expect(cell.rightValue).toBe('1')
  })

  it('类型变更（对象 → 数组）整体标 change', () => {
    const r = diffJson({ a: { x: 1 } }, { a: [1, 2] })
    const cell = r.find((e) => e.path === 'a')!
    expect(cell.type).toBe('change')
  })

  it('深度爆炸抛 JsonDiffDepthError', () => {
    // 构造 200 层嵌套对象
    let left: Record<string, unknown> = { v: 1 }
    let right: Record<string, unknown> = { v: 1 }
    for (let i = 0; i < 200; i++) {
      left = { n: left }
      right = { n: right }
    }
    expect(() => diffJson(left, right, { maxDepth: 100 })).toThrow(JsonDiffDepthError)
  })

  it('summarizeDiff 统计正确', () => {
    const r = diffJson({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, d: 4 })
    const stat = summarizeDiff(r)
    expect(stat.equal).toBeGreaterThanOrEqual(1) // a
    expect(stat.change).toBeGreaterThanOrEqual(1) // b
    expect(stat.remove).toBeGreaterThanOrEqual(1) // c
    expect(stat.add).toBeGreaterThanOrEqual(1) // d
  })

  it('tryParseJson 正常 / 异常', () => {
    expect(tryParseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
    const bad = tryParseJson('{not json')
    expect(bad.ok).toBe(false)
    const empty = tryParseJson('   ')
    expect(empty.ok).toBe(false)
  })

  it('完全相等的复杂对象', () => {
    const a = { x: [1, 2, { k: 'v' }], y: null, z: { a: [true, false] } }
    const b = { x: [1, 2, { k: 'v' }], y: null, z: { a: [true, false] } }
    const r = diffJson(a, b)
    // 不应有任何 change/add/remove
    expect(r.some((e) => e.type !== 'equal')).toBe(false)
  })

  it('sortKeys=true 时超深嵌套数组（>100 层）必须抛 JsonDiffDepthError，不得静默通过', () => {
    // 关键：构造 200 层嵌套数组（每层都是单元素数组），
    // 修复前：stableSortValue 内 sort 回调中 stableStringify(_, 0, ...) 每次比较都从 0 起步，
    //         超深嵌套不会触发 maxDepth 防御
    // 修复后：stableStringify 接收当前真实深度，超过 maxDepth 必抛异常
    let deepLeft: unknown = 1
    let deepRight: unknown = 1
    for (let i = 0; i < 200; i++) {
      // 每层用双元素数组，强制 sort 回调里至少调用一次 stableStringify 比较
      deepLeft = [deepLeft, 0]
      deepRight = [deepRight, 0]
    }
    expect(() =>
      diffJson(deepLeft, deepRight, { sortKeys: true, maxDepth: 100 }),
    ).toThrow(JsonDiffDepthError)
  })

  it('sortKeys=true 时正常 10 层嵌套数组仍能稳定排序对比（修复回归）', () => {
    // 构造 10 层嵌套数组，左右两侧每层数组顺序故意不同，sortKeys 应抹平 reorder
    function build(reverse: boolean): unknown {
      let v: unknown = [3, 1, 2]
      for (let i = 0; i < 10; i++) {
        v = reverse ? [2, v, 1] : [1, v, 2]
      }
      return v
    }
    const left = build(false)
    const right = build(true)
    // 不应抛错
    const r = diffJson(left, right, { sortKeys: true, maxDepth: 100 })
    // 排序后两侧等价：所有条目都是 equal
    expect(r.every((e) => e.type === 'equal')).toBe(true)
  })
})
