import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uuid } from '../lib/uuid'

// 10KB 截断阈值
const MAX_SIZE_BYTES = 10 * 1024
// 最多保存50条记录
const MAX_RECORDS = 50

// JSON 历史记录项
export interface JsonRecord {
  id: string
  input: string
  output: string
  timestamp: number
}

interface JsonHistoryState {
  records: JsonRecord[]
  addRecord: (input: string, output: string) => void
  removeRecord: (id: string) => void
  clearAll: () => void
}

/**
 * 截断超过 10KB 的字符串，避免 localStorage 溢出
 */
function truncateIfNeeded(str: string): string {
  if (new Blob([str]).size > MAX_SIZE_BYTES) {
    // 按字符截断到大约 10KB（UTF-8 中文最多3字节，保守截断）
    let truncated = str.slice(0, MAX_SIZE_BYTES)
    // 确保不超过限制
    while (new Blob([truncated]).size > MAX_SIZE_BYTES) {
      truncated = truncated.slice(0, -100)
    }
    return truncated + '\n... [已截断]'
  }
  return str
}

export const useJsonHistoryStore = create<JsonHistoryState>()(
  persist(
    (set) => ({
      records: [],

      addRecord: (input, output) =>
        set((state) => {
          const newRecord: JsonRecord = {
            id: uuid(),
            input: truncateIfNeeded(input),
            output: truncateIfNeeded(output),
            timestamp: Date.now(),
          }
          const updated = [newRecord, ...state.records]
          // 超过50条时删除最旧的记录
          if (updated.length > MAX_RECORDS) {
            return { records: updated.slice(0, MAX_RECORDS) }
          }
          return { records: updated }
        }),

      removeRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        })),

      clearAll: () => set({ records: [] }),
    }),
    {
      name: 'json-history',
    }
  )
)
