import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface SessionManagerProps {
  onClose?: () => void
}

export default function SessionManager({ onClose }: SessionManagerProps) {
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
      // Markdown 格式
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
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">会话管理</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ×
          </button>
        )}
      </div>

      {/* 搜索框 */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索对话历史..."
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 新建按钮 */}
      <button
        onClick={createSession}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors mb-4"
      >
        新建对话
      </button>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredSessions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className={`p-3 rounded-lg border transition-colors ${
                currentSessionId === session.id
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}
            >
              <div
                className="flex justify-between items-start cursor-pointer"
                onClick={() => {
                  setCurrentSession(session.id)
                  onClose?.()
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{session.title}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {format(session.updatedAt, 'MM/dd HH:mm', { locale: zhCN })} ·{' '}
                    {session.messages.length} 条消息
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExport(session.id, 'json')
                    }}
                    className="p-1 text-gray-400 hover:text-blue-400"
                    title="导出 JSON"
                  >
                    ↓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExport(session.id, 'markdown')
                    }}
                    className="p-1 text-gray-400 hover:text-blue-400"
                    title="导出 Markdown"
                  >
                    M
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-400"
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* 消息预览 */}
              {session.messages.length > 0 && (
                <div className="mt-2 text-xs text-gray-500 truncate">
                  {session.messages[session.messages.length - 1]?.content.slice(0, 50)}...
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
