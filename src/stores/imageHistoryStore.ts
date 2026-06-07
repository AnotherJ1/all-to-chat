import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uuid } from '../lib/uuid'

// 图片历史记录项
export interface ImageRecord {
  id: string
  prompt: string
  imageUrl: string
  model: string
  size?: string
  /** 生成来源；旧记录无此字段，按 generate 处理 */
  mode?: 'generate' | 'edit'
  createdAt: number
}

interface ImageHistoryState {
  records: ImageRecord[]
  addRecord: (record: Omit<ImageRecord, 'id' | 'createdAt'>) => void
  deleteRecord: (id: string) => void
  clearHistory: () => void
}

export const useImageHistoryStore = create<ImageHistoryState>()(
  persist(
    (set) => ({
      records: [],

      addRecord: (record) =>
        set((state) => ({
          records: [
            {
              ...record,
              id: uuid(),
              createdAt: Date.now(),
            },
            ...state.records,
          ],
        })),

      deleteRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        })),

      clearHistory: () => set({ records: [] }),
    }),
    {
      name: 'image-history-storage',
    }
  )
)
