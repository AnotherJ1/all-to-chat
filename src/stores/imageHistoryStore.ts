import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uuid } from '../lib/uuid'

// 图片历史记录项
export interface ImageRecord {
  id: string
  prompt: string
  imageUrl: string
  provider: 'dalle' | 'imagen' | 'flux'
  model: string
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
