import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uuid } from '../lib/uuid'

// localStorage 常见配额约 5MB，超大 base64 data URL 直接持久化会触发 QuotaExceededError 或卡住主线程。
// 保守限制单条图片 URL 约 1MB 字符，远程 URL 不受影响。
export const MAX_PERSISTED_IMAGE_URL_LENGTH = 1_000_000

function canPersistImageUrl(imageUrl: string): boolean {
  return !imageUrl.startsWith('data:') || imageUrl.length <= MAX_PERSISTED_IMAGE_URL_LENGTH
}

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

      addRecord: (record) => {
        // 超大 base64 图只用于当前预览/下载，不写入 localStorage 历史，避免配额溢出或主线程卡顿
        if (!canPersistImageUrl(record.imageUrl)) return
        set((state) => ({
          records: [
            {
              ...record,
              id: uuid(),
              createdAt: Date.now(),
            },
            ...state.records,
          ],
        }))
      },

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
