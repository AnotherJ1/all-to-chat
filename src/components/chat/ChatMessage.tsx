import { useState, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../../types'
import { IconUser, IconBot, IconCopy, IconRefresh, IconTrash } from '../common/Icons'
import { toast } from '../../stores/toastStore'

interface ChatMessageProps {
  message: Message
  onRegenerate?: () => void
  onDelete?: () => void
}

export default function ChatMessage({ message, onRegenerate, onDelete }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const [copied, setCopied] = useState(false)

  const markdownComponents = useMemo(() => ({
    pre: ({ children }: { children: React.ReactNode }) => (
      <pre style={{
        background: 'var(--bg-secondary)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px',
        margin: '12px 0',
        overflowX: 'auto' as const,
      }}>
        {children}
      </pre>
    ),
    code: ({ className, children, ...props }: { className?: string; children: React.ReactNode }) => {
      const isBlock = className?.includes('language-')
      if (isBlock) {
        return (
          <code style={{ fontSize: '13px', color: 'var(--accent-1)', fontFamily: "'JetBrains Mono', monospace" }} {...props}>
            {children}
          </code>
        )
      }
      return (
        <code style={{
          background: 'color-mix(in srgb, var(--accent-1) 10%, transparent)',
          color: 'var(--accent-1)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '13px',
          fontFamily: "'JetBrains Mono', monospace",
        }} {...props}>
          {children}
        </code>
      )
    },
    a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-1)', textDecoration: 'underline' }}>
        {children}
      </a>
    ),
    table: ({ children }: { children: React.ReactNode }) => (
      <div style={{ overflowX: 'auto', margin: '12px 0' }}>
        <table style={{ minWidth: '100%', borderCollapse: 'collapse', border: 'var(--border-width) solid var(--border-color)', fontSize: '14px' }}>
          {children}
        </table>
      </div>
    ),
    th: ({ children }: { children: React.ReactNode }) => (
      <th style={{ border: 'var(--border-width) solid var(--border-color)', padding: '8px 12px', background: 'var(--bg-secondary)', textAlign: 'left' as const, fontWeight: 600 }}>
        {children}
      </th>
    ),
    td: ({ children }: { children: React.ReactNode }) => (
      <td style={{ border: 'var(--border-width) solid var(--border-color)', padding: '8px 12px' }}>
        {children}
      </td>
    ),
  }), [])

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
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center"
        style={{
          borderRadius: 'var(--radius-sm)',
          border: 'var(--border-width) solid var(--border-color)',
          background: isUser
            ? 'color-mix(in srgb, var(--accent-1) 15%, transparent)'
            : 'color-mix(in srgb, var(--accent-3) 15%, transparent)',
          boxShadow: 'var(--shadow-sm)',
          color: isUser ? 'var(--accent-1)' : 'var(--accent-3)',
        }}
      >
        {isUser ? <IconUser className="w-5 h-5" /> : <IconBot className="w-5 h-5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold" style={{ color: isUser ? 'var(--accent-1)' : 'var(--accent-3)', fontFamily: 'var(--font-heading)' }}>
            {isUser ? '你' : 'AI 助手'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <div
          className={isUser ? 'theme-message-user' : 'theme-message-assistant'}
          style={{ padding: '16px' }}
        >
          {message.content ? (
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-1)', animation: 'typing-bounce 1.4s infinite' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-2)', animation: 'typing-bounce 1.4s infinite 0.2s' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-3)', animation: 'typing-bounce 1.4s infinite 0.4s' }} />
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100" style={{ transition: 'opacity 0.2s' }}>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs cursor-pointer"
            style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', transition: 'var(--transition)' }}
            title="复制"
          >
            <IconCopy />
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
          {!isUser && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 px-2 py-1 text-xs cursor-pointer"
              style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', transition: 'var(--transition)' }}
              title="重新生成"
            >
              <IconRefresh />
              <span>重新生成</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 text-xs cursor-pointer"
              style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', transition: 'var(--transition)' }}
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
