// 消息列表容器
import { useRef, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import ChatMessage from './ChatMessage'
import MessageInput from './MessageInput'
import SystemPromptInput from './SystemPromptInput'

export default function ChatContainer() {
  const { getCurrentSession } = useSessionStore()
  const currentSession = getCurrentSession()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages])

  if (!currentSession) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-gray-500">
          选择或创建一个对话开始聊天
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        {currentSession.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            开始发送消息...
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {currentSession.messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* System Prompt 配置 */}
      <SystemPromptInput />

      {/* 消息输入 */}
      <MessageInput />
    </div>
  )
}