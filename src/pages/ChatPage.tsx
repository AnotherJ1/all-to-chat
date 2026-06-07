import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/chat/Sidebar'
import ChatView from '../components/chat/ChatView'
import SettingsModal from '../components/common/SettingsModal'
import { useSessionStore } from '../stores/sessionStore'
import { IconSettings, IconMenu } from '../components/common/Icons'

/**
 * AI 聊天工具页面壳
 * 桌面端：Sidebar + ChatView 横向布局
 * 移动端：Sidebar 转为抽屉，顶部增加汉堡菜单
 */
export default function ChatPage() {
  const navigate = useNavigate()
  const createSession = useSessionStore((s) => s.createSession)
  // 桌面侧栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // 移动端抽屉打开状态
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // 初始化标记：避免 React StrictMode 下 useEffect 双跑导致重复创建会话
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    if (useSessionStore.getState().sessions.length === 0) {
      createSession()
    }
  }, [createSession])

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden">
      {/* 移动端顶部工具栏 */}
      <div
        className="md:hidden flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: 'var(--border-width) solid var(--border-color)',
        }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="theme-btn"
          style={{ padding: 0, width: '40px', height: '40px' }}
          aria-label="打开会话列表"
        >
          <IconMenu className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
        </button>
        <button
          onClick={() => navigate('/')}
          className="text-sm font-bold cursor-pointer"
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)',
            background: 'transparent',
            border: 'none',
            padding: '4px 8px',
          }}
          title="返回首页"
          aria-label="返回首页"
        >
          AI 聊天
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="theme-btn"
          style={{ padding: 0, width: '40px', height: '40px' }}
          aria-label="API 设置"
        >
          <IconSettings className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      {/* 桌面端：设置按钮（移动端在顶部工具栏） */}
      <div className="hidden md:block">
        <button
          onClick={() => setShowSettings(true)}
          className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center theme-btn"
          style={{ padding: '0', width: '40px', height: '40px' }}
          title="API 设置"
        >
          <IconSettings className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      {/* 移动端抽屉遮罩 */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar：桌面端常驻；移动端抽屉式 */}
      <div
        className={`
          md:relative md:flex md:flex-shrink-0
          fixed inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onItemClick={() => setDrawerOpen(false)}
        />
      </div>

      <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
        <ChatView />
      </main>

      {/* 设置弹窗 */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
