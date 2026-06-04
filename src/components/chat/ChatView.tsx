import { useRef, useEffect, useCallback, useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useConfigStore } from '../../stores/configStore'
import { useChatViewStore, type ChatTab } from '../../stores/chatViewStore'
import { callApi } from '../../api'
import { toast } from '../../stores/toastStore'
import ComparisonPanel from './ComparisonPanel'
import ImageGenerator from '../image/ImageGenerator'
import SessionManager from './SessionManager'
import MessageInput from './MessageInput'
import ChatMessage from './ChatMessage'
import SystemPromptInput from './SystemPromptInput'
import { IconChat, IconCompare, IconImage, IconFolder } from '../common/Icons'

const TABS: { key: ChatTab; label: string; Icon: React.ComponentType<{ className?: string }>; disabled?: boolean }[] = [
  { key: 'chat', label: '对话', Icon: IconChat },
  { key: 'compare', label: '多模型对比', Icon: IconCompare },
  { key: 'image', label: '图片生成', Icon: IconImage, disabled: true },
  { key: 'sessions', label: '会话管理', Icon: IconFolder },
]

export default function ChatView() {
  const { activeTab, setActiveTab } = useChatViewStore()
  const { getCurrentSession, updateMessage, deleteMessage } = useSessionStore()
  const currentSession = getCurrentSession()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 已挂载过的 Tab 集合：首次访问后才挂载，挂载后保留状态不卸载
  const [mountedTabs, setMountedTabs] = useState<Set<ChatTab>>(new Set([activeTab]))
  useEffect(() => {
    setMountedTabs((prev) => prev.has(activeTab) ? prev : new Set(prev).add(activeTab))
  }, [activeTab])

  // 自动滚动到底部
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [currentSession?.messages, activeTab])

  // 重新生成最后一条 assistant 消息
  const handleRegenerate = useCallback(async (messageId: string) => {
    // 始终从 store 读取最新会话，避免闭包捕获旧的 currentSession（流式期间用户可能已发新消息）
    const session = useSessionStore.getState().getCurrentSession()
    if (!session) return
    const sessionId = session.id
    const msgIndex = session.messages.findIndex((m) => m.id === messageId)
    if (msgIndex < 0) return

    // 找到这条 assistant 消息之前的最后一条 user 消息
    const prevMessages = session.messages.slice(0, msgIndex)
    const { protocol, getCurrentConfig: getConfig } = useConfigStore.getState()
    const { baseUrl, apiKey, model, systemPrompt } = getConfig()

    // 清空当前 assistant 消息内容
    updateMessage(sessionId, messageId, '')

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
          const cur = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
          const msg = cur?.messages.find((m) => m.id === messageId)
          if (msg) {
            updateMessage(sessionId, messageId, msg.content + chunk)
          }
        },
        onError: (error) => {
          toast.error(`重新生成失败: ${error.message}`)
        },
      })
    } catch (error) {
      // AbortError 不打扰用户；其他错误已在 onError 中提示
      void error
    }
  }, [updateMessage])

  const handleDelete = useCallback((messageId: string) => {
    if (!currentSession) return
    if (window.confirm('确定删除此消息？')) {
      deleteMessage(currentSession.id, messageId)
    }
  }, [currentSession, deleteMessage])

  return (
    <div className="flex flex-col h-full">
      {/* Tab 导航 — 移动端可横向滚动 */}
      <div
        className="flex items-center gap-1 px-3 sm:px-6 py-2 theme-topbar overflow-x-auto whitespace-nowrap"
        style={{ scrollbarWidth: 'none' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              if (tab.disabled) {
                toast.info('该功能暂未开放，敬请期待')
                return
              }
              setActiveTab(tab.key)
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold cursor-pointer flex-shrink-0"
            style={{
              fontFamily: 'var(--font-body)',
              color: activeTab === tab.key ? 'var(--accent-1)' : 'var(--text-muted)',
              transition: 'var(--transition)',
              background: 'transparent',
              border: 'none',
              borderBottomWidth: '2px',
              borderBottomStyle: 'solid',
              borderBottomColor: activeTab === tab.key ? 'var(--accent-1)' : 'transparent',
              opacity: tab.disabled ? 0.5 : 1,
            }}
          >
            <tab.Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 内容区域 — 用 display 切换保留各 Tab 内部状态（不卸载） */}
      <div className="flex-1 overflow-hidden min-h-0 relative">
        <div className="absolute inset-0" style={{ display: activeTab === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
          <SystemPromptInput />
          <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-4">
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
              <div className="flex flex-col items-center justify-center h-full px-4">
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
                <p className="text-lg mb-2 font-bold text-center" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>开始与 AI 对话</p>
                <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>发送消息开启智能对话体验</p>
              </div>
            )}
          </div>
          <div className="px-3 py-3 sm:px-6 sm:py-4">
            <div className="max-w-4xl mx-auto">
              <MessageInput />
            </div>
          </div>
        </div>

        <div className="absolute inset-0" style={{ display: activeTab === 'compare' ? 'block' : 'none' }}>
          {mountedTabs.has('compare') && <ComparisonPanel />}
        </div>

        <div className="absolute inset-0" style={{ display: activeTab === 'image' ? 'block' : 'none' }}>
          {mountedTabs.has('image') && <ImageGenerator />}
        </div>

        <div className="absolute inset-0" style={{ display: activeTab === 'sessions' ? 'block' : 'none' }}>
          {mountedTabs.has('sessions') && <SessionManager />}
        </div>
      </div>
    </div>
  )
}
