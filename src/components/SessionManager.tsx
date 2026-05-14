import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { IconPlus, IconSearch, IconExport, IconDownload, IconTrash } from './Icons'
import { toast } from '../stores/toastStore'

export default function SessionManager() {
  const {
    sessions,
    currentSessionId,
    setCurrentSession,
    createSession,
    deleteSession,
  } = useSessionStore()

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

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">会话管理</h2>
        <button
          onClick={createSession}
          className="btn-aurora btn-aurora-primary text-sm py-2 px-4 flex items-center gap-1.5"
        >
          <IconPlus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-4">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索对话历史..."
          className="input-aurora pl-10"
        />
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-aurora">
        {filteredSessions.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-8">
            {searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                currentSessionId === session.id
                  ? 'bg-cyan-500/10 border-cyan-400/30'
                  : 'border-[var(--border-color)] hover:border-[var(--border-hover)]'
              }`}
              style={{ transform: 'none' }}
              onClick={() => setCurrentSession(session.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--text-primary)] truncate">{session.title || '新对话'}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {format(session.updatedAt, 'MM/dd HH:mm', { locale: zhCN })} · {session.messages.length} 条消息
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExport(session.id, 'json') }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-cyan-400 hover:bg-[var(--glass-bg-hover)] transition-all cursor-pointer"
                    title="导出 JSON"
                  >
                    <IconDownload className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExport(session.id, 'markdown') }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-cyan-400 hover:bg-[var(--glass-bg-hover)] transition-all cursor-pointer"
                    title="导出 Markdown"
                  >
                    <IconExport className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--glass-bg-hover)] transition-all cursor-pointer"
                    title="删除"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {session.messages.length > 0 && (
                <div className="mt-2 text-xs text-[var(--text-muted)] truncate opacity-60">
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
