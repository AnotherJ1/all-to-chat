import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../types'
import { IconUser, IconBot, IconCopy, IconRefresh, IconTrash } from './Icons'
import { toast } from '../stores/toastStore'

interface ChatMessageProps {
  message: Message
  onRegenerate?: () => void
  onDelete?: () => void
}

export default function ChatMessage({ message, onRegenerate, onDelete }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }, [message.content])

  if (isSystem) {
    return (
      <div className="flex gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
        <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </div>
        <div className="flex-1 text-sm text-yellow-200/80 leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="group flex gap-4">
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${
          isUser
            ? 'bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-400/30 text-blue-400'
            : 'bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 border border-emerald-400/30 text-emerald-400'
        }`}
      >
        {isUser ? <IconUser className="w-5 h-5" /> : <IconBot className="w-5 h-5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-sm font-medium ${isUser ? 'text-blue-400' : 'text-emerald-400'}`}>
            {isUser ? '你' : 'AI 助手'}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <div className={`p-4 rounded-2xl leading-relaxed ${isUser ? 'message-glow-user' : 'message-glow-assistant'}`}>
          {message.content ? (
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children }) => (
                    <pre className="bg-black/40 rounded-xl p-4 my-3 overflow-x-auto border border-[var(--border-color)]">
                      {children}
                    </pre>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isBlock = className?.includes('language-')
                    if (isBlock) {
                      return (
                        <code className="text-sm text-cyan-400 font-mono" {...props}>
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code className="bg-cyan-400/10 text-cyan-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    )
                  },
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="min-w-full border-collapse border border-[var(--border-color)] text-sm">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-[var(--border-color)] px-3 py-2 bg-white/5 text-left font-medium">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-[var(--border-color)] px-3 py-2">
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--text-muted)] hover:text-cyan-400 hover:bg-white/5 transition-all cursor-pointer"
            title="复制"
          >
            <IconCopy />
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
          {!isUser && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--text-muted)] hover:text-cyan-400 hover:bg-white/5 transition-all cursor-pointer"
              title="重新生成"
            >
              <IconRefresh />
              <span>重新生成</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-white/5 transition-all cursor-pointer"
              title="删除"
            >
              <IconTrash />
              <span>删除</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
