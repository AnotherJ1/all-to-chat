import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useConfigStore } from '../stores/configStore'
import { callApi } from '../api'
import type { Message } from '../types'

export default function MessageInput() {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingRef = useRef<HTMLDivElement>(null)
  const { protocol, getCurrentConfig } = useConfigStore()
  const { baseUrl, apiKey, model } = getCurrentConfig()
  const { getCurrentSession, addMessage, updateMessage, updateSessionTitle } = useSessionStore()
  const currentSession = getCurrentSession()
  const currentSessionRef = useRef(currentSession)
  const streamingContentRef = useRef('')

  useEffect(() => {
    currentSessionRef.current = currentSession
  }, [currentSession])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [input])

  useEffect(() => {
    if (streamingRef.current) {
      streamingRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [streamingContent])

  const handleSend = async () => {
    if (!input.trim() || !currentSessionRef.current || isStreaming) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    const session = currentSessionRef.current
    addMessage(session.id, userMessage)

    const userInput = input
    setInput('')

    setIsStreaming(true)
    setStreamingContent('')
    streamingContentRef.current = ''

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addMessage(session.id, assistantMessage)
    const assistantMessageId = assistantMessage.id

    try {
      const systemPrompt = localStorage.getItem(`systemPrompt-${protocol}`) || undefined

      await callApi({
        protocol,
        baseUrl,
        apiKey,
        model,
        messages: [...session.messages, userMessage],
        systemPrompt,
        streaming: true,
        onChunk: (chunk) => {
          streamingContentRef.current += chunk
          setStreamingContent((prev) => prev + chunk)
        },
        onComplete: () => {
          updateMessage(session.id, assistantMessageId, streamingContentRef.current)
          if (session.messages.length === 0 && session.title === '新对话') {
            const title = userInput.slice(0, 20) + (userInput.length > 20 ? '...' : '')
            updateSessionTitle(session.id, title || '新对话')
          }
          setStreamingContent('')
          setIsStreaming(false)
        },
        onError: () => {
          setStreamingContent('')
          setIsStreaming(false)
        },
      })
    } catch {
      setStreamingContent('')
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="relative px-6 py-4">
      {/* Streaming Preview */}
      {isStreaming && streamingContent && (
        <div
          ref={streamingRef}
          className="mb-4 p-4 rounded-2xl bg-black/40 border border-cyan-400/20 backdrop-blur-sm max-h-64 overflow-y-auto scrollbar-aurora"
        >
          <div className="text-white/90 leading-relaxed whitespace-pre-wrap">{streamingContent}</div>
          <div className="flex items-center gap-1 mt-2">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="relative glass-card p-2">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
            disabled={isStreaming}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/30 resize-none px-4 py-3 min-h-[48px] max-h-[150px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400/30 to-purple-500/30 border border-cyan-400/30 flex items-center justify-center hover:from-cyan-400/40 hover:to-purple-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isStreaming ? (
              <svg className="w-5 h-5 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
