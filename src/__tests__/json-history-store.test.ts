import { describe, it, expect, beforeEach } from 'vitest'
import { useJsonHistoryStore } from '../stores/jsonHistoryStore'

describe('jsonHistoryStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useJsonHistoryStore.setState({ records: [] })
  })

  it('addRecord 应正确添加记录', () => {
    const store = useJsonHistoryStore.getState()
    store.addRecord('{"a":1}', '{\n  "a": 1\n}')

    const { records } = useJsonHistoryStore.getState()
    expect(records).toHaveLength(1)
    expect(records[0].input).toBe('{"a":1}')
    expect(records[0].output).toBe('{\n  "a": 1\n}')
    expect(records[0].id).toBeTruthy()
    expect(records[0].timestamp).toBeGreaterThan(0)
  })

  it('addRecord 新记录应在列表最前面', () => {
    const store = useJsonHistoryStore.getState()
    store.addRecord('first', 'first-out')

    // 等待一毫秒确保时间戳不同
    useJsonHistoryStore.getState().addRecord('second', 'second-out')

    const { records } = useJsonHistoryStore.getState()
    expect(records).toHaveLength(2)
    expect(records[0].input).toBe('second')
    expect(records[1].input).toBe('first')
  })

  it('removeRecord 应正确删除指定记录', () => {
    const store = useJsonHistoryStore.getState()
    store.addRecord('a', 'a-out')
    store.addRecord('b', 'b-out')

    const { records } = useJsonHistoryStore.getState()
    const idToRemove = records[0].id

    useJsonHistoryStore.getState().removeRecord(idToRemove)

    const updated = useJsonHistoryStore.getState().records
    expect(updated).toHaveLength(1)
    expect(updated[0].input).toBe('a')
  })

  it('clearAll 应清空所有记录', () => {
    const store = useJsonHistoryStore.getState()
    store.addRecord('a', 'a-out')
    store.addRecord('b', 'b-out')

    useJsonHistoryStore.getState().clearAll()

    expect(useJsonHistoryStore.getState().records).toHaveLength(0)
  })

  it('超过50条时应自动删除最旧记录', () => {
    // 添加51条记录
    for (let i = 0; i < 51; i++) {
      useJsonHistoryStore.getState().addRecord(`input-${i}`, `output-${i}`)
    }

    const { records } = useJsonHistoryStore.getState()
    expect(records).toHaveLength(50)
    // 最新的记录在最前面
    expect(records[0].input).toBe('input-50')
    // 最旧的记录（input-0）应该被删除
    expect(records.find((r) => r.input === 'input-0')).toBeUndefined()
  })

  it('超过10KB的 input/output 应被截断', () => {
    const store = useJsonHistoryStore.getState()
    // 创建一个超过10KB的字符串
    const largeStr = 'x'.repeat(11 * 1024)

    store.addRecord(largeStr, largeStr)

    const { records } = useJsonHistoryStore.getState()
    expect(records[0].input.length).toBeLessThan(largeStr.length)
    expect(records[0].input).toContain('... [已截断]')
    expect(records[0].output).toContain('... [已截断]')
  })

  it('persist key 应为 "json-history"', () => {
    const persistOptions = (useJsonHistoryStore as unknown as {
      persist: { getOptions: () => { name: string } }
    }).persist.getOptions()
    expect(persistOptions.name).toBe('json-history')
  })
})
