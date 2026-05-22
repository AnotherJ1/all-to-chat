import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownPreviewProps {
  source: string
  /** 标签文案 */
  label?: string
  /** 给打印用:挂在容器上的 id;Markdown 工具页固定传 'md-print-target' */
  printTargetId?: string
}

/**
 * Markdown 预览组件
 *
 * 复用现有 react-markdown + remark-gfm 渲染管道(与 ChatMessage 风格保持一致)
 * 通过主题 CSS 变量适配 6 套主题
 *
 * 关键算法: components 在组件实例生命周期内 useMemo 缓存,避免每次重渲染重建
 */
export default function MarkdownPreview({
  source,
  label,
  printTargetId,
}: MarkdownPreviewProps) {
  const components = useMemo(
    () => ({
      pre: ({ children }: { children?: React.ReactNode }) => (
        <pre
          style={{
            background: 'var(--bg-secondary)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            margin: '12px 0',
            overflowX: 'auto' as const,
          }}
        >
          {children}
        </pre>
      ),
      code: ({
        className,
        children,
        ...props
      }: { className?: string; children?: React.ReactNode }) => {
        const isBlock = className?.includes('language-')
        if (isBlock) {
          return (
            <code
              style={{
                fontSize: '13px',
                color: 'var(--accent-1)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
              {...props}
            >
              {children}
            </code>
          )
        }
        return (
          <code
            style={{
              background: 'color-mix(in srgb, var(--accent-1) 10%, transparent)',
              color: 'var(--accent-1)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            {...props}
          >
            {children}
          </code>
        )
      },
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent-1)', textDecoration: 'underline' }}
        >
          {children}
        </a>
      ),
      table: ({ children }: { children?: React.ReactNode }) => (
        <div style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table
            style={{
              minWidth: '100%',
              borderCollapse: 'collapse',
              border: 'var(--border-width) solid var(--border-color)',
              fontSize: '14px',
            }}
          >
            {children}
          </table>
        </div>
      ),
      th: ({ children }: { children?: React.ReactNode }) => (
        <th
          style={{
            border: 'var(--border-width) solid var(--border-color)',
            padding: '8px 12px',
            background: 'var(--bg-secondary)',
            textAlign: 'left' as const,
            fontWeight: 600,
          }}
        >
          {children}
        </th>
      ),
      td: ({ children }: { children?: React.ReactNode }) => (
        <td
          style={{
            border: 'var(--border-width) solid var(--border-color)',
            padding: '8px 12px',
          }}
        >
          {children}
        </td>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote
          style={{
            borderLeft: `4px solid var(--accent-1)`,
            paddingLeft: '12px',
            color: 'var(--text-muted)',
            margin: '12px 0',
            fontStyle: 'italic',
          }}
        >
          {children}
        </blockquote>
      ),
    }),
    [],
  )

  return (
    <div
      className="flex flex-col min-w-0 h-full"
      style={{
        background: 'var(--bg-surface)',
        border: 'var(--border-width) solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      {label && (
        <div
          className="px-3 py-1.5 text-xs font-bold flex-shrink-0"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            borderBottom: 'var(--border-width) solid var(--border-color)',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </div>
      )}
      <div
        id={printTargetId}
        className="prose-chat flex-1 min-h-0 overflow-auto"
        style={{
          color: 'var(--text-primary)',
          padding: '16px',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          lineHeight: 1.7,
        }}
      >
        {source.trim() ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {source}
          </ReactMarkdown>
        ) : (
          <div
            style={{
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              textAlign: 'center',
              paddingTop: '40px',
            }}
          >
            预览区:在左侧编辑 Markdown,这里实时显示渲染结果
          </div>
        )}
      </div>
    </div>
  )
}
