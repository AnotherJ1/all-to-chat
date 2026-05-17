import { create } from 'zustand'

export type ChatTab = 'chat' | 'compare' | 'image' | 'sessions'

interface ChatViewState {
  activeTab: ChatTab
  setActiveTab: (tab: ChatTab) => void
}

/**
 * ChatView 当前激活的 Tab 状态
 * 提取到 store 是为了让 SessionManager 等子组件能通过 setActiveTab 切回「对话」Tab。
 * 不需要持久化（刷新后默认从 chat 开始）。
 */
export const useChatViewStore = create<ChatViewState>((set) => ({
  activeTab: 'chat',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
