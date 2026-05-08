import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import ComparisonPanel from './ComparisonPanel'
import ImageGenerator from './ImageGenerator'
import ImageHistory from './ImageHistory'
import SessionManager from './SessionManager'
import MessageInput from './MessageInput'
import ChatMessage from './ChatMessage'
import SystemPromptInput from './SystemPromptInput'

type Tab = 'chat' | 'compare' | 'image' | 'history' | 'sessions'

const TABS = [
  { key: 'chat', label: '对话', icon: '💬' },
  { key: 'compare', label: '多模型对比', icon: '⚡' },
  { key: 'image', label: '图片生成', icon: '🎨' },
  { key: 'history', label: '历史记录', icon: '📷' },
  { key: 'sessions', label: '会话管理', icon: '📁' },
]

export default function ChatView() {
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const { getCurrentSession } = useSessionStore()
  const currentSession = getCurrentSession()

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <div className="flex flex-col h-full">
            <SystemPromptInput />
            <div className="flex-1 overflow-y-auto scrollbar-aurora px-6 py-4">
              {currentSession && currentSession.messages.length > 0 ? (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {currentSession.messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 border border-cyan-400/20 flex items-center justify-center mb-4">
                    <span className="text-3xl">✨</span>
                  </div>
                  <p className="text-white/40 text-lg mb-2">开始与 AI 对话</p>
                  <p className="text-white/30 text-sm">发送消息开启智能对话体验</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4">
              <div className="max-w-4xl mx-auto">
                <MessageInput />
              </div>
            </div>
          </div>
        )
      case 'compare':
        return <ComparisonPanel />
      case 'image':
        return <ImageGenerator />
      case 'history':
        return <ImageHistory />
      case 'sessions':
        return <SessionManager />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab 导航 */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-white/10 glass">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            className={`tab-aurora flex items-center gap-2 ${
              activeTab === tab.key ? 'active' : ''
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  )
}
