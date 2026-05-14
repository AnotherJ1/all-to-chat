import { useState, useRef, useEffect, useCallback } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useConfigStore } from '../../stores/configStore'
import { callApi } from '../../api'
import { toast } from '../../stores/toastStore'
import ComparisonPanel from './ComparisonPanel'
import ImageGenerator from '../image/ImageGenerator'
import SessionManager from './SessionManager'
import MessageInput from './MessageInput'
import ChatMessage from './ChatMessage'
import SystemPromptInput from './SystemPromptInput'
import { IconChat, IconCompare, IconImage, IconFolder } from '../common/Icons'

type Tab = 'chat' | 'compare' | 'image' | 'sessions'

const TABS: { key: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'chat', label: '对话', Icon: IconChat },
  { key: 'compare', label: '多模型对比', Icon: IconCompare },
  { key: 'image', label: '图片生成', Icon: IconImage },
  { key: 'sessions', label: '会话管理', Icon: IconFolder },
]

export default function ChatView() {
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const { getCurrentSession, updateMessage, deleteMessage } = useSessionStore()
  const currentSession = getCurrentSession()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages])

  // 重新生成最后一条 assistant 消息
  const handleRegenerate = useCallback(async (messageId: string) => {
    if (!currentSession) return
    const msgIndex = currentSession.messages.findIndex((m) => m.id === messageId)
    if (msgIndex < 0) return

    // 找到这条 assistant 消息之前的最后一条 user 消息
    const prevMessages = currentSession.messages.slice(0, msgIndex)
    const { protocol, getCurrentConfig: getConfig } = useConfigStore.getState()
    const { baseUrl, apiKey, model, systemPrompt } = getConfig()

    // 清空当前 assistant 消息内容
    updateMessage(currentSession.id, messageId, '')

    try {
      await callApi({
        protocol,
        baseUrl,
        apiKey,
        model,
        messages: prevMessages,
        systemPrompt: systemPrompt || undefined,
        streaming: true,
        onChunk: (chunk) => {
          const session = useSessionStore.getState().sessions.find((s) => s.id === currentSession.id)
          const msg = session?.messages.find((m) => m.id === messageId)
          if (msg) {
            updateMessage(currentSession.id, messageId, msg.content + chunk)
          }
        },
        onError: (error) => {
          toast.error(`重新生成失败: ${error.message}`)
        },
      })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error(`重新生成失败: ${(error as Error).message}`)
      }
    }
  }, [currentSession, updateMessage])

  const handleDelete = useCallback((messageId: string) => {
    if (!currentSession) return
    if (window.confirm('确定删除此消息？')) {
      deleteMessage(currentSession.id, messageId)
    }
  }, [currentSession, deleteMessage])

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <div className="flex flex-col h-full">
            <SystemPromptInput />
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {currentSession && currentSession.messages.length > 0 ? (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {currentSession.messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      message={msg}
                      onRegenerate={msg.role === 'assistant' ? () => handleRegenerate(msg.id) : undefined}
                      onDelete={() => handleDelete(msg.id)}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <div
                    className="w-20 h-20 flex items-center justify-center mb-4"
                    style={{
                      borderRadius: 'var(--radius)',
                      border: 'var(--border-width) solid var(--border-color)',
                      background: 'color-mix(in srgb, var(--accent-1) 10%, transparent)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <IconChat className="w-10 h-10" style={{ color: 'var(--accent-1)', opacity: 0.7 }} />
                  </div>
                  <p className="text-lg mb-2 font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>开始与 AI 对话</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>发送消息开启智能对话体验</p>
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
      case 'sessions':
        return <SessionManager />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab 导航 */}
      <div
        className="flex items-center gap-1 px-6 py-2 theme-topbar"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold cursor-pointer"
            style={{
              fontFamily: 'var(--font-body)',
              color: activeTab === tab.key ? 'var(--accent-1)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-1)' : '2px solid transparent',
              transition: 'var(--transition)',
              background: 'transparent',
              border: 'none',
              borderBottomWidth: '2px',
              borderBottomStyle: 'solid',
              borderBottomColor: activeTab === tab.key ? 'var(--accent-1)' : 'transparent',
            }}
          >
            <tab.Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  )
}


