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
    <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">生成历史</h2>
        {records.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-sm text-red-400 hover:text-red-300"
          >
            清空
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          暂无生成记录
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3">
          {records.map((record) => (
            <div
              key={record.id}
              className="bg-gray-700 rounded-lg p-3 border border-gray-600"
            >
              <div className="flex gap-3">
                {/* 缩略图 */}
                <div
                  className="w-20 h-20 flex-shrink-0 cursor-pointer overflow-hidden rounded"
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
                  <p className="text-sm text-gray-300 line-clamp-2">{record.prompt}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 bg-gray-600 rounded">
                        {record.provider.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(record.createdAt, 'MM/dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteRecord(record.id)}
                      className="text-gray-500 hover:text-red-400 text-sm"
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
