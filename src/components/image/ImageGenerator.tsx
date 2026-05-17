import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '../../stores/configStore'
import { useImageHistoryStore } from '../../stores/imageHistoryStore'
import { generateImage, getDefaultModel } from '../../api/imagegen'
import { fetchModelList } from '../../api/openai'
import { toast } from '../../stores/toastStore'
import { IconDownload, IconTrash, IconArrowLeft, IconImage, IconHistory } from '../common/Icons'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

type MobileTab = 'generate' | 'history'

export default function ImageGenerator() {
  const navigate = useNavigate()
  const { getCurrentConfig, savedConfigs } = useConfigStore()
  const globalConfig = getCurrentConfig()
  const { records, addRecord, deleteRecord, clearHistory } = useImageHistoryStore()

  // 移动端 tab
  const [mobileTab, setMobileTab] = useState<MobileTab>('generate')

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

  // 用于卸载时中止正在进行的图片生成
  const generateAbortRef = useRef<AbortController | null>(null)
  const generateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)
  useEffect(() => {
    return () => {
      unmountedRef.current = true
      generateAbortRef.current?.abort()
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current)
    }
  }, [])

  const handleProviderChange = (newProvider: 'dalle' | 'imagen' | 'flux') => {
    setProvider(newProvider)
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

    const controller = new AbortController()
    generateAbortRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 60000)
    generateTimeoutRef.current = timeout

    try {
      const result = await generateImage(activeBaseUrl, activeApiKey, model, prompt, provider, controller.signal)
      if (unmountedRef.current) return
      if (result.success && result.imageUrl) {
        setCurrentImage(result.imageUrl)
        addRecord({ prompt, imageUrl: result.imageUrl, provider, model })
        toast.success('图片生成成功')
      } else {
        toast.error(result.error || '生成失败')
      }
    } catch (err) {
      if (unmountedRef.current) return
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('图片生成超时（60秒），请重试')
      } else {
        toast.error(err instanceof Error ? err.message : '生成失败')
      }
    } finally {
      clearTimeout(timeout)
      generateTimeoutRef.current = null
      generateAbortRef.current = null
      if (!unmountedRef.current) setIsGenerating(false)
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

  // ───────── 渲染：左侧生成面板 ─────────
  const generatorPanel = (
    <div className="w-full md:w-96 p-4 md:p-6 flex flex-col overflow-y-auto theme-sidebar md:flex-shrink-0 h-full">
      <h2 className="text-lg font-bold mb-4 hidden md:block" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>图片生成</h2>

      {/* API 配置选择 */}
      <div className="mb-4 p-3" style={{ border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>API 配置</label>
          <button
            onClick={() => {
              setUseGlobalConfig(true)
              setCustomBaseUrl(globalConfig.baseUrl)
              setCustomApiKey(globalConfig.apiKey)
            }}
            className="theme-btn flex-shrink-0"
            style={{ padding: '2px 8px', fontSize: '11px', background: useGlobalConfig ? 'color-mix(in srgb, var(--accent-1) 15%, transparent)' : 'transparent', color: useGlobalConfig ? 'var(--accent-1)' : 'var(--text-muted)' }}
          >
            使用全局配置
          </button>
        </div>
        {useGlobalConfig ? (
          <div className="text-xs break-all" style={{ color: 'var(--text-muted)' }}>
            当前使用全局配置: {globalConfig.baseUrl}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="Base URL"
              className="theme-input text-sm"
              style={{ padding: '8px 12px' }}
            />
            <input
              type="password"
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              placeholder="API Key"
              className="theme-input text-sm"
              style={{ padding: '8px 12px' }}
            />
          </div>
        )}
        {savedConfigs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {savedConfigs.map((sc) => (
              <button
                key={sc.id}
                onClick={() => handleLoadSavedConfig(sc.id)}
                className="theme-btn"
                style={{ padding: '2px 8px', fontSize: '11px' }}
              >
                {sc.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 提供商选择 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>提供商</label>
        <div className="flex flex-wrap gap-2">
          {(['dalle', 'imagen', 'flux'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handleProviderChange(p)}
              className={provider === p ? 'theme-btn theme-btn-primary' : 'theme-btn'}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              {p === 'dalle' ? 'OpenAI' : p === 'imagen' ? 'Imagen' : 'Flux'}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {provider === 'dalle' && '适用于 OpenAI 兼容 API（含 CLIProxyAPI 等代理服务）。请点击「获取模型」选择可用的图片模型。'}
          {provider === 'imagen' && '适用于 Google AI 原生 API。需要 Google API Key。'}
          {provider === 'flux' && '适用于 OpenAI 兼容端点（Replicate/代理）。请点击「获取模型」选择可用的 Flux 模型。'}
        </p>
      </div>

      {/* 模型输入 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>模型</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative min-w-0">
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onFocus={() => imageModels.length > 0 && setShowImageModelList(true)}
              placeholder={`如 ${getDefaultModel(provider)}`}
              className="theme-input"
            />
            {showImageModelList && imageModels.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 z-50 max-h-40 overflow-y-auto"
                style={{ background: 'var(--bg-surface)', border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)' }}
              >
                {imageModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => { setModel(m); setShowImageModelList(false) }}
                    className="w-full text-left px-4 py-2 text-sm cursor-pointer"
                    style={{ color: model === m ? 'var(--accent-1)' : 'var(--text-primary)', background: model === m ? 'color-mix(in srgb, var(--accent-1) 10%, transparent)' : 'transparent', transition: 'var(--transition)' }}
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
            className="theme-btn flex-shrink-0"
            style={{ whiteSpace: 'nowrap', fontSize: '12px', opacity: (loadingImageModels || !activeApiKey) ? 0.5 : 1 }}
          >
            {loadingImageModels ? '加载中...' : '获取模型'}
          </button>
        </div>
      </div>

      {/* Prompt 输入 */}
      <div className="mb-4" onClick={() => setShowImageModelList(false)}>
        <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>描述</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想要生成的图片..."
          className="theme-input h-32 resize-none"
        />
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="theme-btn theme-btn-primary w-full"
        style={{ opacity: (isGenerating || !prompt.trim()) ? 0.5 : 1 }}
      >
        {isGenerating ? '生成中...' : '生成图片'}
      </button>

      {/* 当前图片预览 */}
      {currentImage && (
        <div className="mt-4 relative">
          <img
            src={currentImage}
            alt="Generated"
            className="w-full"
            style={{ borderRadius: 'var(--radius-sm)', border: 'var(--border-width) solid var(--border-color)' }}
          />
          <button
            onClick={() => handleDownload(currentImage)}
            className="absolute bottom-2 right-2 theme-btn"
            style={{ padding: '4px 10px', fontSize: '12px', background: 'rgba(0,0,0,0.7)', color: '#fff' }}
          >
            <IconDownload className="w-3.5 h-3.5" />
            下载
          </button>
        </div>
      )}
    </div>
  )

  // ───────── 渲染：右侧历史记录 ─────────
  const historyPanel = (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto h-full min-h-0">
      <div className="flex justify-between items-center mb-4 gap-3">
        <h3 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>生成历史</h3>
        {records.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-sm cursor-pointer flex-shrink-0"
            style={{ color: '#f87171', transition: 'var(--transition)' }}
          >
            清空
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
          暂无生成记录
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {records.map((record) => (
            <div
              key={record.id}
              className="theme-card overflow-hidden group"
              style={{ padding: 0 }}
            >
              <div
                className="aspect-square cursor-pointer overflow-hidden"
                onClick={() => handleDownload(record.imageUrl)}
              >
                <img
                  src={record.imageUrl}
                  alt={record.prompt}
                  className="w-full h-full object-cover"
                  style={{ transition: 'transform 0.3s' }}
                />
              </div>
              <div className="p-3">
                <p className="text-sm line-clamp-2" style={{ color: 'var(--text-primary)' }}>{record.prompt}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-xs px-1.5 py-0.5 flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--accent-1) 15%, transparent)', color: 'var(--accent-1)', borderRadius: 'var(--radius-sm)' }}
                    >
                      {record.provider.toUpperCase()}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {format(record.createdAt, 'MM/dd HH:mm', { locale: zhCN })}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="cursor-pointer flex-shrink-0 w-7 h-7 flex items-center justify-center"
                    style={{ color: 'var(--text-muted)', transition: 'var(--transition)', borderRadius: 'var(--radius-sm)' }}
                    title="删除"
                    aria-label="删除记录"
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
  )

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* 移动端顶部工具栏 + Tab */}
      <div
        className="md:hidden flex flex-col flex-shrink-0"
        style={{ background: 'var(--bg-surface)', borderBottom: 'var(--border-width) solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={() => navigate('/')}
            className="theme-btn"
            style={{ padding: 0, width: '40px', height: '40px' }}
            aria-label="返回首页"
          >
            <IconArrowLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
          </button>
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            图片生成
          </span>
          <div style={{ width: '40px' }} aria-hidden="true" />
        </div>
        <div className="flex border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => setMobileTab('generate')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold cursor-pointer"
            style={{
              color: mobileTab === 'generate' ? 'var(--accent-1)' : 'var(--text-muted)',
              borderBottom: mobileTab === 'generate' ? '2px solid var(--accent-1)' : '2px solid transparent',
              background: 'transparent',
              border: 'none',
              borderBottomWidth: '2px',
              borderBottomStyle: 'solid',
              borderBottomColor: mobileTab === 'generate' ? 'var(--accent-1)' : 'transparent',
            }}
          >
            <IconImage className="w-4 h-4" />
            <span>生成</span>
          </button>
          <button
            onClick={() => setMobileTab('history')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold cursor-pointer"
            style={{
              color: mobileTab === 'history' ? 'var(--accent-1)' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottomWidth: '2px',
              borderBottomStyle: 'solid',
              borderBottomColor: mobileTab === 'history' ? 'var(--accent-1)' : 'transparent',
            }}
          >
            <IconHistory className="w-4 h-4" />
            <span>历史 {records.length > 0 && `(${records.length})`}</span>
          </button>
        </div>
      </div>

      {/* 移动端：根据 tab 切换显示；桌面端：并排显示 */}
      <div className={`${mobileTab === 'generate' ? 'flex' : 'hidden'} md:flex flex-col flex-1 md:flex-initial min-h-0`}>
        {generatorPanel}
      </div>
      <div className={`${mobileTab === 'history' ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-h-0`}>
        {historyPanel}
      </div>
    </div>
  )
}
