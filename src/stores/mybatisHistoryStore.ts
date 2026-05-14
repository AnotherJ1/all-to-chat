import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uuid } from '../lib/uuid'

// rawLog 最大存储长度（5KB）
const MAX_RAW_LOG_LENGTH = 5 * 1024

// 最多保存的记录数
const MAX_RECORDS = 50

// MyBatis 历史记录项
export interface MybatisRecord {
  id: string
  rawLog: string
  parsedSqls: string[]
  timestamp: number
}

interface MybatisHistoryState {
  records: MybatisRecord[]
  addRecord: (record: Omit<MybatisRecord, 'id' | 'timestamp'>) => void
  removeRecord: (id: string) => void
  clearAll: () => void
}

// 截断超长 rawLog，避免 localStorage 溢出
function truncateRawLog(rawLog: string): string {
  if (rawLog.length > MAX_RAW_LOG_LENGTH) {
    return rawLog.slice(0, MAX_RAW_LOG_LENGTH) + '\n... [已截断]'
  }
  return rawLog
}

export const useMybatisHistoryStore = create<MybatisHistoryState>()(
  persist(
    (set) => ({
      records: [],

      addRecord: (record) =>
        set((state) => {
          const newRecord: MybatisRecord = {
            ...record,
            id: uuid(),
            rawLog: truncateRawLog(record.rawLog),
            timestamp: Date.now(),
          }
          const updated = [newRecord, ...state.records]
          // 超过50条时删除最旧的记录
          return { records: updated.slice(0, MAX_RECORDS) }
        }),

      removeRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        })),

      clearAll: () => set({ records: [] }),
    }),
    {
      name: 'mybatis-history',
    }
  )
)
