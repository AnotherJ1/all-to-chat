import { useState } from 'react'
import { useConfigStore } from '../stores/configStore'
import { useImageHistoryStore } from '../stores/imageHistoryStore'
import { generateImage, getDefaultModel } from '../api/imagegen'

interface ImageGeneratorProps {
  onClose?: () => void
}

export default function ImageGenerator({ onClose }: ImageGeneratorProps) {
  const { baseUrl, apiKey } = useConfigStore.getState().getCurrentConfig()
  const { addRecord } = useImageHistoryStore()

  const [prompt, setPrompt] = useState('')
  const [provider, setProvider] = useState<'dalle' | 'imagen' | 'flux'>('dalle')
  const [model, setModel] = useState('dall-e-3')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentImage, setCurrentImage] = useState<string | null>(null)

  const handleProviderChange = (newProvider: 'dalle' | 'imagen' | 'flux') => {
    setProvider(newProvider)
    setModel(getDefaultModel(newProvider))
    setCurrentImage(null)
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    if (!apiKey) {
      setError('请先配置 API Key')
      return
    }

    setIsGenerating(true)
    setError(null)
    setCurrentImage(null)

    try {
      const result = await generateImage(baseUrl, apiKey, model, prompt, provider)

      if (result.success && result.imageUrl) {
        setCurrentImage(result.imageUrl)
        addRecord({
          prompt,
          imageUrl: result.imageUrl,
          provider,
          model,
        })
      } else {
        setError(result.error || '生成失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!currentImage) return

    // 如果是 data URL，转换为 blob 下载
    if (currentImage.startsWith('data:')) {
      const link = document.createElement('a')
      link.href = currentImage
      link.download = `generated-image-${Date.now()}.png`
      link.click()
    } else {
      // 外部 URL，尝试新窗口打开下载
      window.open(currentImage, '_blank')
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">图片生成</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ×
          </button>
        )}
      </div>

      {/* 提供商选择 */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">提供商</label>
        <div className="flex gap-2">
          {(['dalle', 'imagen', 'flux'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handleProviderChange(p)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                provider === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {p === 'dalle' ? 'DALL-E' : p === 'imagen' ? 'Imagen' : 'Flux'}
            </button>
          ))}
        </div>
      </div>

      {/* 模型输入 */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">模型</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={`输入模型名称，如 ${getDefaultModel(provider)}`}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Prompt 输入 */}
      <div className="mb-4 flex-1">
        <label className="block text-sm font-medium mb-1">描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想要生成的图片..."
          className="w-full h-32 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-2 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 图片预览 */}
      {currentImage && (
        <div className="mb-4">
          <div className="relative">
            <img
              src={currentImage}
              alt="Generated"
              className="w-full rounded-lg border border-gray-600"
            />
            <button
              onClick={handleDownload}
              className="absolute bottom-2 right-2 px-3 py-1.5 bg-gray-900/80 hover:bg-gray-900 rounded-lg text-sm transition-colors"
            >
              下载
            </button>
          </div>
        </div>
      )}

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
      >
        {isGenerating ? '生成中...' : '生成图片'}
      </button>
    </div>
  )
}
