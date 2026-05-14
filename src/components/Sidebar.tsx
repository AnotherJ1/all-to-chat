import { useSessionStore } from '../stores/sessionStore'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { IconPlus, IconClose, IconSidebar } from './Icons'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { sessions, currentSessionId, setCurrentSession, createSession, deleteSession } = useSessionStore()

  if (collapsed) {
    return (
      <div className="w-14 glass border-r border-[var(--border-color)] flex flex-col items-center py-4 gap-3">
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer"
          title="展开侧栏"
        >
          <IconSidebar className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <button
          onClick={createSession}
          className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-400/20 to-purple-500/20 border border-cyan-400/30 flex items-center justify-center hover:from-cyan-400/30 hover:to-purple-500/30 transition-all cursor-pointer"
          title="新建对话"
        >
          <IconPlus className="w-4 h-4 text-cyan-400" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-64 glass border-r border-[var(--border-color)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-2">
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer"
          title="收起侧栏"
        >
          <IconSidebar className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        <button
          onClick={createSession}
          className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400/20 to-purple-500/20 border border-cyan-400/30 text-[var(--text-primary)] font-medium text-sm hover:from-cyan-400/30 hover:to-purple-500/30 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <IconPlus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto scrollbar-aurora">
        <div className="p-2">
          <p className="px-3 py-2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">历史记录</p>
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentSession(session.id)}
              className={`group px-3 py-3 rounded-xl mb-1 cursor-pointer transition-colors ${
                currentSessionId === session.id
                  ? 'bg-gradient-to-r from-cyan-400/15 to-transparent border-l-2 border-cyan-400'
                  : 'hover:bg-[var(--glass-bg-hover)] border-l-2 border-transparent'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-[var(--text-primary)] truncate">
                    {session.title || '新对话'}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[var(--text-muted)]">
                      {format(session.updatedAt, 'MM/dd', { locale: zhCN })}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">·</span>
                    <span className="text-xs text-[var(--text-muted)]">{session.messages.length} 条</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all cursor-pointer"
                  title="删除对话"
                >
                  <IconClose className="w-3.5 h-3.5 text-red-400/60" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border-color)]">
        <div className="text-xs text-[var(--text-muted)] text-center">
          AI Chat Hub v1.0
        </div>
      </div>
    </div>
  )
}
