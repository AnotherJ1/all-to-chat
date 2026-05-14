import { useEffect, useState } from 'react'
import Sidebar from '../components/chat/Sidebar'
import ChatView from '../components/chat/ChatView'
import SettingsModal from '../components/common/SettingsModal'
import BackToHome from '../components/common/BackToHome'
import { useSessionStore } from '../stores/sessionStore'
import { IconSettings } from '../components/common/Icons'

/**
 * AI 聊天工具页面壳
 * 全屏布局：Sidebar + ChatView，自动创建首个会话。
 */
export default function ChatPage() {
  const { sessions, createSession } = useSessionStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (sessions.length === 0) {
      createSession()
    }
  }, [sessions.length, createSession])

  return (
    <div className="h-screen w-screen flex">
      {/* 返回首页按钮 */}
      <BackToHome />

      {/* 设置按钮 */}
      <button
        onClick={() => setShowSettings(true)}
        className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center theme-btn"
        style={{ padding: '0', width: '40px', height: '40px' }}
        title="API 设置"
      >
        <IconSettings className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
      </button>

      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className="flex-1 min-w-0">
        <ChatView />
      </main>

      {/* 设置弹窗 */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
