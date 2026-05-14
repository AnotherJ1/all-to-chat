import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 可用主题风格
 */
export type ThemeStyle = 'claymorphism' | 'motion' | 'brutalism' | 'neubrutalism' | 'cyberpunk' | 'vaporwave'

interface ThemeState {
  style: ThemeStyle
  switcherOpen: boolean
  setStyle: (style: ThemeStyle) => void
  toggleSwitcher: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      style: 'neubrutalism',
      switcherOpen: false,
      setStyle: (style) => set({ style, switcherOpen: false }),
      toggleSwitcher: () => set((s) => ({ switcherOpen: !s.switcherOpen })),
    }),
    { name: 'theme-style-storage', partialize: (state) => ({ style: state.style }) }
  )
)

/** 主题元数据 */
export const themeOptions: { id: ThemeStyle; name: string; icon: string }[] = [
  { id: 'claymorphism', name: '黏土', icon: '●' },
  { id: 'motion', name: '流光', icon: '◎' },
  { id: 'brutalism', name: '粗野', icon: '■' },
  { id: 'neubrutalism', name: '新粗', icon: '◆' },
  { id: 'cyberpunk', name: '赛博', icon: '⬡' },
  { id: 'vaporwave', name: '蒸汽', icon: '△' },
]
