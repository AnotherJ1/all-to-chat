import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useConfigStore } from '../../stores/configStore'
import { callApi } from '../../api'
import { toast } from '../../stores/toastStore'
import { uuid } from '../../lib/uuid'
import { IconSend, IconStop } from '../common/Icons'
import type { Message } from '../../types'

export default function MessageInput() {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { protocol, getCurrentConfig } = useConfigStore()
  const { getCurrentSession, addMessage, updateMessage, updateSessionTitle, deleteMessage } = useSessionStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [input])

  const handleStop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }

  const handleSend = async () => {
    const currentSession = getCurrentSession()
    if (!input.trim() || !currentSession || isStreaming) return

    const { baseUrl, apiKey, model, systemPrompt } = getCurrentConfig()
    if (!apiKey) {
      toast.error('请先在设置中配置 API Key')
      return
    }

    const userMessage: Message = {
      id: uuid(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    const sessionId = currentSession.id
    addMessage(sessionId, userMessage)

    const userInput = input
    setInput('')

    // 创建 assistant 占位消息
    const assistantId = uuid()
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addMessage(sessionId, assistantMessage)

    setIsStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await callApi({
        protocol,
        baseUrl,
        apiKey,
        model,
        messages: [...currentSession.messages, userMessage],
        systemPrompt: systemPrompt || undefined,
        streaming: true,
        signal: controller.signal,
        onChunk: (chunk) => {
          // 直接更新 assistant 消息内容(边流边写)
          const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
          const msg = session?.messages.find((m) => m.id === assistantId)
          const newContent = (msg?.content || '') + chunk
          updateMessage(sessionId, assistantId, newContent)
        },
        onComplete: () => {
          // 自动生成标题：从最新 store 状态判断是否首轮（此前为「新对话」且只有刚发的这一问一答）
          const latest = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
          if (latest && latest.title === '新对话') {
            const title = userInput.trim().slice(0, 20) + (userInput.trim().length > 20 ? '...' : '')
            updateSessionTitle(sessionId, title || '新对话')
          }
        },
        onError: (error) => {
          toast.error(`请求失败: ${error.message}`)
        },
      })
    } catch (error) {
      // 仅处理 AbortError，普通错误已在 onError 中提示，避免重复 toast
      if ((error as Error).name === 'AbortError') {
        toast.info('已停止生成')
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      // 若 assistant 占位消息因中止/出错始终为空，删除它，避免界面残留「打字动画」
      const finalSession = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
      const placeholder = finalSession?.messages.find((m) => m.id === assistantId)
      if (placeholder && placeholder.content === '') {
        deleteMessage(sessionId, assistantId)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="relative">
      <div
        className="p-2"
        style={{
          background: 'var(--bg-surface)',
          border: 'var(--border-width) solid var(--border-color)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            disabled={isStreaming}
            className="flex-1 bg-transparent border-none outline-none resize-none px-4 py-3 min-h-[48px] max-h-[150px]"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
            }}
            rows={1}
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="theme-btn"
              style={{ padding: 0, width: '44px', height: '44px', background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              title="停止生成"
            >
              <IconStop className="w-5 h-5" style={{ color: '#ef4444' }} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="theme-btn theme-btn-primary"
              style={{ padding: 0, width: '44px', height: '44px', opacity: input.trim() ? 1 : 0.4 }}
              title="发送"
            >
              <IconSend className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
