import { useSessionStore } from '../stores/sessionStore'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function Sidebar() {
  const { sessions, currentSessionId, setCurrentSession, createSession, deleteSession } = useSessionStore()

  return (
    <div className="w-64 glass border-r border-white/10 flex flex-col">
      {/* New Chat Button */}
      <div className="p-4 border-b border-white/10">
        <button
          onClick={createSession}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400/20 to-purple-500/20 border border-cyan-400/30 text-white font-medium text-sm hover:from-cyan-400/30 hover:to-purple-500/30 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建对话
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto scrollbar-aurora">
        <div className="p-2">
          <p className="px-3 py-2 text-xs text-white/30 font-medium uppercase tracking-wider">历史记录</p>
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentSession(session.id)}
              className={`group px-3 py-3 rounded-xl mb-1 cursor-pointer transition-all ${
                currentSessionId === session.id
                  ? 'bg-gradient-to-r from-cyan-400/15 to-transparent border-l-2 border-cyan-400'
                  : 'hover:bg-white/5 border-l-2 border-transparent'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white/90 truncate">{session.title || '新对话'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-white/40">
                      {format(session.updatedAt, 'MM/dd', { locale: zhCN })}
                    </span>
                    <span className="text-xs text-white/30">·</span>
                    <span className="text-xs text-white/40">{session.messages.length} 条</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-red-400/60 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/30 text-center">
          AI Chat Hub v1.0
        </div>
      </div>
    </div>
  )
}
