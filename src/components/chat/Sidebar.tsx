import { useSessionStore } from '../../stores/sessionStore'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { IconPlus, IconClose, IconSidebar } from '../common/Icons'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { sessions, currentSessionId, setCurrentSession, createSession, deleteSession } = useSessionStore()

  if (collapsed) {
    return (
      <div
        className="w-14 theme-sidebar flex flex-col items-center py-4 gap-3"
      >
        <button
          onClick={onToggle}
          className="theme-btn"
          style={{ padding: 0, width: '36px', height: '36px' }}
          title="展开侧栏"
        >
          <IconSidebar className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          onClick={createSession}
          className="theme-btn theme-btn-primary"
          style={{ padding: 0, width: '36px', height: '36px' }}
          title="新建对话"
        >
          <IconPlus className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-64 theme-sidebar flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-2" style={{ borderBottom: 'var(--border-width) solid var(--border-color)' }}>
        <button
          onClick={onToggle}
          className="theme-btn"
          style={{ padding: 0, width: '32px', height: '32px' }}
          title="收起侧栏"
        >
          <IconSidebar className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          onClick={createSession}
          className="flex-1 theme-btn theme-btn-primary"
          style={{ padding: '8px 16px' }}
        >
          <IconPlus className="w-4 h-4" />
          <span>新建对话</span>
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <p
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
          >
            历史记录
          </p>
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentSession(session.id)}
              className="group mb-1 cursor-pointer"
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: currentSessionId === session.id
                  ? `var(--border-width) solid var(--accent-1)`
                  : `var(--border-width) solid transparent`,
                background: currentSessionId === session.id
                  ? 'color-mix(in srgb, var(--accent-1) 10%, transparent)'
                  : 'transparent',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => {
                if (currentSessionId !== session.id) {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-1) 5%, transparent)'
                }
              }}
              onMouseLeave={(e) => {
                if (currentSessionId !== session.id) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm truncate"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
                  >
                    {session.title || '新对话'}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {format(session.updatedAt, 'MM/dd', { locale: zhCN })}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {session.messages.length} 条
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm('确定删除此对话？此操作不可恢复。')) {
                      deleteSession(session.id)
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center cursor-pointer"
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    transition: 'var(--transition)',
                    background: 'rgba(239, 68, 68, 0.1)',
                  }}
                  title="删除对话"
                >
                  <IconClose className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4" style={{ borderTop: 'var(--border-width) solid var(--border-color)' }}>
        <div className="text-xs text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
          Tool Hub · AI Chat
        </div>
      </div>
    </div>
  )
}
