import { useMemo } from 'react'
import type { Message } from '../types'

interface ChatMessageProps {
  message: Message
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  const renderedContent = useMemo(() => {
    if (!message.content) return { __html: '' }

    let html = message.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // 代码块
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
      return `<pre class="bg-black/40 rounded-xl p-4 my-3 overflow-x-auto border border-white/10"><code class="text-sm text-cyan-400 font-mono">${code.trim()}</code></pre>`
    })

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code class="bg-cyan-400/10 text-cyan-400 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')

    // 粗体
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')

    // 斜体
    html = html.replace(/\*([^*]+)\*/g, '<em class="text-white/80">$1</em>')

    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">$1</a>')

    // 换行
    html = html.replace(/\n/g, '<br />')

    return { __html: html }
  }, [message.content])

  if (isSystem) {
    return (
      <div className="flex gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
        <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">⚙️</span>
        </div>
        <div className="flex-1 text-sm text-yellow-200/80">
          <div dangerouslySetInnerHTML={renderedContent} />
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-4 ${isUser ? '' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-semibold ${
          isUser
            ? 'bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-400/30 text-blue-400'
            : 'bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 border border-emerald-400/30 text-emerald-400'
        }`}
      >
        {isUser ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 min-w-0 ${isUser ? '' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-sm font-medium ${isUser ? 'text-blue-400' : 'text-emerald-400'}`}>
            {isUser ? '你' : 'AI 助手'}
          </span>
          <span className="text-xs text-white/30">{new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        <div
          className={`p-4 rounded-2xl leading-relaxed ${
            isUser
              ? 'message-glow-user'
              : 'message-glow-assistant'
          }`}
        >
          <div
            className="text-white/90 leading-relaxed"
            dangerouslySetInnerHTML={renderedContent}
          />
        </div>
      </div>
    </div>
  )
}
