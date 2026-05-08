import { useImageHistoryStore, type ImageRecord } from '../stores/imageHistoryStore'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function ImageHistory() {
  const { records, deleteRecord, clearHistory } = useImageHistoryStore()

  const handleDownload = (record: ImageRecord) => {
    if (record.imageUrl.startsWith('data:')) {
      const link = document.createElement('a')
      link.href = record.imageUrl
      link.download = `generated-image-${record.id}.png`
      link.click()
    } else {
      window.open(record.imageUrl, '_blank')
    }
  }

  return (
    <div className="glass-card rounded-xl p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">生成历史</h2>
        {records.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-sm text-red-400/70 hover:text-red-400 transition-colors cursor-pointer"
          >
            清空
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/40">
          暂无生成记录
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 scrollbar-aurora">
          {records.map((record) => (
            <div
              key={record.id}
              className="glass-card rounded-lg p-3"
            >
              <div className="flex gap-3">
                {/* 缩略图 */}
                <div
                  className="w-20 h-20 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg"
                  onClick={() => handleDownload(record)}
                >
                  <img
                    src={record.imageUrl}
                    alt={record.prompt}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 line-clamp-2">{record.prompt}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400/70 rounded">
                        {record.provider.toUpperCase()}
                      </span>
                      <span className="text-xs text-white/40">
                        {format(record.createdAt, 'MM/dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteRecord(record.id)}
                      className="text-white/30 hover:text-red-400 transition-colors text-sm cursor-pointer"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
