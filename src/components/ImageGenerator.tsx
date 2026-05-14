import { useState } from 'react'
import { useConfigStore } from '../stores/configStore'
import { useImageHistoryStore } from '../stores/imageHistoryStore'
import { generateImage, getDefaultModel } from '../api/imagegen'
import { fetchModelList } from '../api/openai'
import { toast } from '../stores/toastStore'
import { IconDownload, IconTrash } from './Icons'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function ImageGenerator() {
  const { getCurrentConfig, savedConfigs } = useConfigStore()
  const globalConfig = getCurrentConfig()
  const { records, addRecord, deleteRecord, clearHistory } = useImageHistoryStore()

  // 图片生成使用的配置(默认跟随全局)
  const [customBaseUrl, setCustomBaseUrl] = useState(globalConfig.baseUrl)
  const [customApiKey, setCustomApiKey] = useState(globalConfig.apiKey)
  const [prompt, setPrompt] = useState('')
  const [provider, setProvider] = useState<'dalle' | 'imagen' | 'flux'>('dalle')
  const [model, setModel] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [useGlobalConfig, setUseGlobalConfig] = useState(true)
  const [imageModels, setImageModels] = useState<string[]>([])
  const [showImageModelList, setShowImageModelList] = useState(false)
  const [loadingImageModels, setLoadingImageModels] = useState(false)

  // 实际使用的配置
  const activeBaseUrl = useGlobalConfig ? globalConfig.baseUrl : customBaseUrl
  const activeApiKey = useGlobalConfig ? globalConfig.apiKey : customApiKey

  const handleProviderChange = (newProvider: 'dalle' | 'imagen' | 'flux') => {
    setProvider(newProvider)
    // 不重置模型名,保留用户已选择的模型
    setCurrentImage(null)
  }

  const handleLoadSavedConfig = (configId: string) => {
    const saved = savedConfigs.find((c) => c.id === configId)
    if (saved) {
      setCustomBaseUrl(saved.config.baseUrl)
      setCustomApiKey(saved.config.apiKey)
      setUseGlobalConfig(false)
    }
  }

  const handleFetchModels = async () => {
    if (!activeApiKey || !activeBaseUrl) return
    setLoadingImageModels(true)
    try {
      const list = await fetchModelList(activeBaseUrl, activeApiKey)
      if (list.length > 0) {
        setImageModels(list)
        setShowImageModelList(true)
      } else {
        toast.warning('未获取到模型列表')
      }
    } catch {
      toast.error('获取模型列表失败')
    } finally {
      setLoadingImageModels(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    if (!activeApiKey) {
      toast.error('请先配置 API Key')
      return
    }

    setIsGenerating(true)
    setCurrentImage(null)

    try {
      const result = await generateImage(activeBaseUrl, activeApiKey, model, prompt, provider)
      if (result.success && result.imageUrl) {
        setCurrentImage(result.imageUrl)
        addRecord({ prompt, imageUrl: result.imageUrl, provider, model })
        toast.success('图片生成成功')
      } else {
        toast.error(result.error || '生成失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = (imageUrl: string) => {
    if (imageUrl.startsWith('data:')) {
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `generated-image-${Date.now()}.png`
      link.click()
    } else {
      window.open(imageUrl, '_blank')
    }
  }

  return (
    <div className="flex h-full">
      {/* 左侧: 生成面板 */}
      <div className="w-96 border-r border-[var(--border-color)] p-6 flex flex-col overflow-y-auto scrollbar-aurora">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">图片生成</h2>

        {/* API 配置选择 */}
        <div className="mb-4 p-3 rounded-xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">API 配置</label>
            <button
              onClick={() => {
                setUseGlobalConfig(true)
                setCustomBaseUrl(globalConfig.baseUrl)
                setCustomApiKey(globalConfig.apiKey)
              }}
              className={`text-xs px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                useGlobalConfig ? 'bg-cyan-400/10 text-cyan-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              使用全局配置
            </button>
          </div>
          {useGlobalConfig ? (
            <div className="text-xs text-[var(--text-muted)]">
              当前使用全局配置: {globalConfig.baseUrl}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="Base URL"
                className="input-aurora text-sm py-2"
              />
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="API Key"
                className="input-aurora text-sm py-2"
              />
            </div>
          )}
          {savedConfigs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {savedConfigs.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => handleLoadSavedConfig(sc.id)}
                  className="text-xs px-2 py-1 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-cyan-400/30 hover:text-cyan-400 transition-colors cursor-pointer"
                >
                  {sc.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 提供商选择 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">提供商</label>
          <div className="flex gap-2">
            {(['dalle', 'imagen', 'flux'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  provider === p
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30'
                    : 'border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                }`}
              >
                {p === 'dalle' ? 'DALL-E' : p === 'imagen' ? 'Imagen' : 'Flux'}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
            {provider === 'dalle' && '适用于 OpenAI 兼容 API（含代理服务）。请点击「获取模型」选择你代理中实际可用的图片模型,如 gpt-image-2。'}
            {provider === 'imagen' && '适用于 Google AI 原生 API。需要 Google API Key,代理服务通常不支持此选项。'}
            {provider === 'flux' && '适用于 OpenAI 兼容端点（Replicate/代理）。请点击「获取模型」选择可用的 Flux 模型。'}
          </p>
        </div>

        {/* 模型输入 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">模型</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                onFocus={() => imageModels.length > 0 && setShowImageModelList(true)}
                placeholder={`如 ${getDefaultModel(provider)}`}
                className="input-aurora"
              />
              {showImageModelList && imageModels.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-40 overflow-y-auto rounded-xl border border-[var(--border-color)] shadow-lg scrollbar-aurora" style={{ background: 'var(--bg-primary)' }}>
                  {imageModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => { setModel(m); setShowImageModelList(false) }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer hover:bg-[var(--glass-bg-hover)] ${
                        model === m ? 'text-cyan-400 bg-cyan-400/5' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleFetchModels}
              disabled={loadingImageModels || !activeApiKey}
              className="btn-aurora text-xs py-2.5 px-3 whitespace-nowrap disabled:opacity-50"
            >
              {loadingImageModels ? '加载中...' : '获取模型'}
            </button>
          </div>
        </div>

        {/* Prompt 输入 */}
        <div className="mb-4" onClick={() => setShowImageModelList(false)}>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">描述</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想要生成的图片..."
            className="input-aurora h-32 resize-none"
          />
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="btn-aurora btn-aurora-primary w-full"
        >
          {isGenerating ? '生成中...' : '生成图片'}
        </button>

        {/* 当前图片预览 */}
        {currentImage && (
          <div className="mt-4 relative">
            <img
              src={currentImage}
              alt="Generated"
              className="w-full rounded-xl border border-[var(--border-color)]"
            />
            <button
              onClick={() => handleDownload(currentImage)}
              className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1"
            >
              <IconDownload className="w-3.5 h-3.5" />
              下载
            </button>
          </div>
        )}
      </div>

      {/* 右侧: 历史记录 */}
      <div className="flex-1 p-6 overflow-y-auto scrollbar-aurora">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">生成历史</h3>
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
          <div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
            暂无生成记录
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((record) => (
              <div key={record.id} className="rounded-xl border border-[var(--border-color)] overflow-hidden group" style={{ transform: 'none' }}>
                <div
                  className="aspect-square cursor-pointer overflow-hidden"
                  onClick={() => handleDownload(record.imageUrl)}
                >
                  <img
                    src={record.imageUrl}
                    alt={record.prompt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm text-[var(--text-primary)] line-clamp-2">{record.prompt}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400/70 rounded">
                        {record.provider.toUpperCase()}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {format(record.createdAt, 'MM/dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteRecord(record.id)}
                      className="text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                      title="删除"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
