import { useState, useEffect } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useChatViewStore } from '../../stores/chatViewStore'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { IconPlus, IconSearch, IconExport, IconDownload, IconTrash, IconChat } from '../common/Icons'
import { toast } from '../../stores/toastStore'

export default function SessionManager() {
  const {
    sessions,
    currentSessionId,
    setCurrentSession,
    createSession,
    deleteSession,
  } = useSessionStore()
  const setActiveTab = useChatViewStore((s) => s.setActiveTab)

  const [searchQuery, setSearchQuery] = useState('')
  const [filteredSessions, setFilteredSessions] = useState(sessions)

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      setFilteredSessions(
        sessions.filter(
          (s) =>
            s.title.toLowerCase().includes(query) ||
            s.messages.some((m) => m.content.toLowerCase().includes(query))
        )
      )
    } else {
      setFilteredSessions(sessions)
    }
  }, [searchQuery, sessions])

  const handleExport = (sessionId: string, exportFormat: 'json' | 'markdown') => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return
    let content: string
    let filename: string
    let mimeType: string
    if (exportFormat === 'json') {
      content = JSON.stringify(session, null, 2)
      filename = `${session.title || '对话'}.json`
      mimeType = 'application/json'
    } else {
      content = `# ${session.title || '对话'}\n\n`
      content += `创建时间: ${format(session.createdAt, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}\n\n`
      session.messages.forEach((msg) => {
        const role = msg.role === 'user' ? '用户' : '助手'
        content += `## ${role}\n\n${msg.content}\n\n`
      })
      filename = `${session.title || '对话'}.md`
      mimeType = 'text/markdown'
    }
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`已导出: ${filename}`)
  }

  const handleRestore = (sessionId: string) => {
    setCurrentSession(sessionId)
    setActiveTab('chat')
    toast.success('已恢复到对话页')
  }

  return (
    <div className="h-full flex flex-col p-3 sm:p-6">
      <div className="flex justify-between items-center mb-4 gap-3">
        <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>会话管理</h2>
        <button onClick={createSession} className="theme-btn theme-btn-primary flex-shrink-0" style={{ padding: '8px 16px', fontSize: '13px' }}>
          <IconPlus className="w-4 h-4" />
          <span>新建对话</span>
        </button>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-4">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索对话历史..."
          className="theme-input"
          style={{ paddingLeft: '36px' }}
        />
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            {searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className="theme-card"
              style={{
                padding: '16px',
                borderColor: currentSessionId === session.id ? 'var(--accent-1)' : 'var(--border-color)',
                background: currentSessionId === session.id ? 'color-mix(in srgb, var(--accent-1) 8%, var(--bg-surface))' : 'var(--bg-surface)',
                cursor: 'default',
              }}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                    {session.title || '新对话'}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {format(session.updatedAt, 'MM/dd HH:mm', { locale: zhCN })} · {session.messages.length} 条消息
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestore(session.id) }}
                    className="theme-btn theme-btn-primary"
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    title="恢复到对话页继续聊天"
                  >
                    <IconChat className="w-3.5 h-3.5" />
                    <span>恢复</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExport(session.id, 'json') }}
                    className="p-1.5 cursor-pointer"
                    style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', transition: 'var(--transition)' }}
                    title="导出 JSON"
                    aria-label="导出 JSON"
                  >
                    <IconDownload className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExport(session.id, 'markdown') }}
                    className="p-1.5 cursor-pointer"
                    style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', transition: 'var(--transition)' }}
                    title="导出 Markdown"
                    aria-label="导出 Markdown"
                  >
                    <IconExport className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (window.confirm('确定删除此对话？此操作不可恢复。')) { deleteSession(session.id) } }}
                    className="p-1.5 cursor-pointer"
                    style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', transition: 'var(--transition)' }}
                    title="删除"
                    aria-label="删除"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {session.messages.length > 0 && (
                <div
                  className="mt-2 text-xs truncate cursor-pointer"
                  style={{ color: 'var(--text-muted)', opacity: 0.7 }}
                  onClick={() => handleRestore(session.id)}
                  title="点击恢复到对话页"
                >
                  {session.messages[session.messages.length - 1]?.content.slice(0, 80)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
