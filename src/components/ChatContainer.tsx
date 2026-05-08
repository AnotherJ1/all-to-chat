import { useRef, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import ChatMessage from './ChatMessage'
import MessageInput from './MessageInput'
import SystemPromptInput from './SystemPromptInput'

export default function ChatContainer() {
  const { getCurrentSession } = useSessionStore()
  const currentSession = getCurrentSession()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages])

  if (!currentSession) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-white/40">
          选择或创建一个对话开始聊天
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-aurora">
        {currentSession.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/40">
            开始发送消息...
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {currentSession.messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <SystemPromptInput />
      <MessageInput />
    </div>
  )
}
