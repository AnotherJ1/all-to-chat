import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * /diff 工具的偏好设置 store
 * - mode: 'auto' | 'text' | 'json'
 *   auto: 两侧均合法 JSON → JSON 模式，否则文本模式
 *   text: 强制文本模式（保留原行级 diff 体验）
 *   json: 强制 JSON 模式（解析失败时给出错误提示）
 * - sortArrayKeys: JSON 模式下是否启用数组 reorder 容差
 *
 * 持久化到 localStorage（key: diff-preferences）
 */
export type DiffMode = 'auto' | 'text' | 'json'

interface DiffStore {
  mode: DiffMode
  setMode: (m: DiffMode) => void
  sortArrayKeys: boolean
  setSortArrayKeys: (b: boolean) => void
}

export const useDiffStore = create<DiffStore>()(
  persist(
    (set) => ({
      mode: 'auto',
      setMode: (m) => set({ mode: m }),
      sortArrayKeys: false,
      setSortArrayKeys: (b) => set({ sortArrayKeys: b }),
    }),
    {
      name: 'diff-preferences',
    },
  ),
)
