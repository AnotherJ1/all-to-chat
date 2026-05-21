/**
 * useQrHistory 单元测试
 *
 * 覆盖：
 * 1. 添加 → 出现在最前
 * 2. 同 text+options 去重 → 仅刷新顺序，不增量
 * 3. 超过上限丢弃最旧
 * 4. removeItem / clearAll
 * 5. localStorage 持久化（重新挂载读到）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useQrHistory,
  HISTORY_STORAGE_KEY,
  HISTORY_MAX_ITEMS,
} from '../hooks/useQrHistory'
import type { QrGenOptions } from '../types'

/** 通用 options 工厂 */
function makeOpts(overrides: Partial<QrGenOptions> = {}): QrGenOptions {
  return {
    text: 'placeholder',
    size: 256,
    fgColor: '#000000',
    bgColor: '#ffffff',
    errorLevel: 'M',
    ...overrides,
  }
}

describe('useQrHistory', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('addItem 后历史中应有该条且位于第一', () => {
    const { result } = renderHook(() => useQrHistory())
    act(() => {
      result.current.addItem('hello', makeOpts({ text: 'hello' }))
    })
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].text).toBe('hello')
  })

  it('相同 text+options 重复添加应去重并刷新到顶端', () => {
    const { result } = renderHook(() => useQrHistory())
    act(() => {
      result.current.addItem('a', makeOpts({ text: 'a' }))
      result.current.addItem('b', makeOpts({ text: 'b' }))
      result.current.addItem('a', makeOpts({ text: 'a' }))
    })
    expect(result.current.history).toHaveLength(2)
    // 'a' 应在最前
    expect(result.current.history[0].text).toBe('a')
    expect(result.current.history[1].text).toBe('b')
  })

  it('超过 HISTORY_MAX_ITEMS 应淘汰最旧', () => {
    const { result } = renderHook(() => useQrHistory())
    act(() => {
      for (let i = 0; i < HISTORY_MAX_ITEMS + 5; i++) {
        result.current.addItem(`text-${i}`, makeOpts({ text: `text-${i}` }))
      }
    })
    expect(result.current.history.length).toBe(HISTORY_MAX_ITEMS)
    // 最新的 text-(N-1) 在最前
    expect(result.current.history[0].text).toBe(
      `text-${HISTORY_MAX_ITEMS + 5 - 1}`,
    )
    // 最旧若干条已被淘汰
    expect(result.current.history.find((it) => it.text === 'text-0')).toBeUndefined()
  })

  it('removeItem 应按 id 删除', () => {
    const { result } = renderHook(() => useQrHistory())
    act(() => {
      result.current.addItem('x', makeOpts({ text: 'x' }))
      result.current.addItem('y', makeOpts({ text: 'y' }))
    })
    const targetId = result.current.history[0].id
    act(() => {
      result.current.removeItem(targetId)
    })
    expect(result.current.history.find((it) => it.id === targetId)).toBeUndefined()
  })

  it('clearAll 应清空全部', () => {
    const { result } = renderHook(() => useQrHistory())
    act(() => {
      result.current.addItem('x', makeOpts({ text: 'x' }))
      result.current.addItem('y', makeOpts({ text: 'y' }))
      result.current.clearAll()
    })
    expect(result.current.history).toHaveLength(0)
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBe('[]')
  })

  it('addItem 应持久化到 localStorage 并能再次读取', () => {
    const first = renderHook(() => useQrHistory())
    act(() => {
      first.result.current.addItem('persist', makeOpts({ text: 'persist' }))
    })
    expect(window.localStorage.getItem(HISTORY_STORAGE_KEY)).toBeTruthy()

    const second = renderHook(() => useQrHistory())
    expect(second.result.current.history.some((it) => it.text === 'persist')).toBe(true)
  })

  it('空字符串 text 应被拒绝', () => {
    const { result } = renderHook(() => useQrHistory())
    act(() => {
      result.current.addItem('', makeOpts({ text: '' }))
      result.current.addItem('   ', makeOpts({ text: '   ' }))
    })
    expect(result.current.history).toHaveLength(0)
  })

  it('restore 应能按 id 取回原条目', () => {
    const { result } = renderHook(() => useQrHistory())
    act(() => {
      result.current.addItem('hi', makeOpts({ text: 'hi', size: 320 }))
    })
    const id = result.current.history[0].id
    const got = result.current.restore(id)
    expect(got?.text).toBe('hi')
    expect(got?.options.size).toBe(320)
    expect(result.current.restore('not-exist')).toBeNull()
  })
})
