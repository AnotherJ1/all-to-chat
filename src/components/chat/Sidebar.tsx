import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../stores/sessionStore'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { IconPlus, IconClose, IconSidebar, IconArrowLeft } from '../common/Icons'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  /** 点击会话项后的额外回调（移动端用于关闭抽屉） */
  onItemClick?: () => void
}

export default function Sidebar({ collapsed, onToggle, onItemClick }: SidebarProps) {
  const navigate = useNavigate()
  const { sessions, currentSessionId, setCurrentSession, createSession, deleteSession } = useSessionStore()

  // 桌面端折叠态：仅图标列；移动端不展示折叠态（移动端使用整宽抽屉）
  if (collapsed) {
    return (
      <div className="hidden md:flex w-14 theme-sidebar flex-col items-center py-4 gap-3 h-full">
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
    <div className="w-72 md:w-64 h-full theme-sidebar flex flex-col">
      {/* Header */}
      <div
        className="p-3 md:p-4 flex items-center gap-2"
        style={{ borderBottom: 'var(--border-width) solid var(--border-color)' }}
      >
        {/* 移动端：返回首页按钮替代「折叠侧栏」 */}
        <button
          onClick={() => navigate('/')}
          className="theme-btn md:hidden"
          style={{ padding: 0, width: '32px', height: '32px' }}
          aria-label="返回首页"
          title="返回首页"
        >
          <IconArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        {/* 桌面端：折叠侧栏按钮 */}
        <button
          onClick={onToggle}
          className="theme-btn hidden md:flex"
          style={{ padding: 0, width: '32px', height: '32px' }}
          title="收起侧栏"
        >
          <IconSidebar className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          onClick={() => {
            createSession()
            onItemClick?.()
          }}
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
              onClick={() => {
                setCurrentSession(session.id)
                onItemClick?.()
              }}
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
                  className="md:opacity-0 md:group-hover:opacity-100 w-7 h-7 md:w-6 md:h-6 flex items-center justify-center cursor-pointer flex-shrink-0"
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    transition: 'var(--transition)',
                    background: 'rgba(239, 68, 68, 0.1)',
                  }}
                  title="删除对话"
                  aria-label="删除对话"
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
        <div
          className="text-xs text-center"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
        >
          Tool Hub · AI Chat
        </div>
      </div>
    </div>
  )
}
