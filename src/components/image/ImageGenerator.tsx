import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '../../stores/configStore'
import { MAX_PERSISTED_IMAGE_URL_LENGTH, useImageHistoryStore } from '../../stores/imageHistoryStore'
import {
  generateImage,
  editImage,
  DEFAULT_IMAGE_MODEL,
  IMAGE_SIZES,
  IMAGE_QUALITIES,
  IMAGE_FORMATS,
  type ImageSize,
  type ImageQuality,
  type ImageFormat,
} from '../../api/imagegen'
import { fetchModelList } from '../../api/openai'
import { toast } from '../../stores/toastStore'
import { IconDownload, IconTrash, IconArrowLeft, IconImage, IconHistory, IconSettings } from '../common/Icons'
import SettingsModal from '../common/SettingsModal'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

type MobileTab = 'generate' | 'history'
type GenMode = 'generate' | 'edit'
type SelectedImageSize = ImageSize | 'custom'

const PROMPT_PRESETS = [
  { label: '人像', prompt: '人像摄影，真实自然的面部细节，柔和光线，浅景深，高级摄影质感' },
  { label: '海报', prompt: '海报设计，醒目的主标题，清晰的信息层级，高级排版，商业摄影质感' },
  { label: '宣传图', prompt: '宣传图设计，突出核心卖点，视觉冲击力强，品牌感统一，适合社交媒体传播' },
  { label: '广告', prompt: '广告创意图，产品主体突出，强烈记忆点，精致布光，高转化率商业视觉' },
  { label: '活动', prompt: '活动主视觉，热烈氛围，明确主题，适合线上线下活动宣传，画面层次丰富' },
  { label: '证件', prompt: '证件照风格，正面半身，纯色背景，光线均匀，五官清晰，自然真实' },
] as const

/** 把本地文件读成 data URL（base64），供编辑端点的 image_url 使用 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}分${secs.toString().padStart(2, '0')}秒` : `${secs}秒`
}

export default function ImageGenerator() {
  const navigate = useNavigate()
  const { getCurrentConfig, savedConfigs } = useConfigStore()
  const globalConfig = getCurrentConfig()
  const { records, addRecord, deleteRecord, clearHistory } = useImageHistoryStore()

  // 移动端 tab
  const [mobileTab, setMobileTab] = useState<MobileTab>('generate')
  // 全局 API 配置弹窗
  const [showSettings, setShowSettings] = useState(false)

  // 图片生成使用的配置(默认跟随全局)
  const [customBaseUrl, setCustomBaseUrl] = useState(globalConfig.baseUrl)
  const [customApiKey, setCustomApiKey] = useState(globalConfig.apiKey)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(DEFAULT_IMAGE_MODEL)
  const [size, setSize] = useState<SelectedImageSize>('auto')
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')
  const [quality, setQuality] = useState<ImageQuality>('auto')
  const [outputFormat, setOutputFormat] = useState<ImageFormat>('png')
  const [mode, setMode] = useState<GenMode>('generate')
  const [inputImages, setInputImages] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
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
  const generateElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unmountedRef = useRef(false)
  useEffect(() => {
    // React StrictMode 开发环境会先执行一次 cleanup 再重新挂载，必须在挂载时重置为 false。
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      generateAbortRef.current?.abort()
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current)
      if (generateElapsedRef.current) clearInterval(generateElapsedRef.current)
    }
  }, [])

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
        toast.warning('该地址未返回任何模型')
      }
    } catch (err) {
      toast.error(`获取模型列表失败：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoadingImageModels(false)
    }
  }

  const appendPromptPreset = (presetPrompt: string) => {
    setPrompt((prev) => (prev.trim() ? `${prev.trimEnd()}，${presetPrompt}` : presetPrompt))
  }

  const getEffectiveSize = (): ImageSize | null => {
    if (size !== 'custom') return size

    const width = customWidth.trim()
    const height = customHeight.trim()
    if (!/^\d+$/.test(width) || !/^\d+$/.test(height) || Number(width) <= 0 || Number(height) <= 0) {
      return null
    }
    return `${width}x${height}` as ImageSize
  }

  // 选择本地图片加入编辑输入
  const handlePickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    try {
      const urls = await Promise.all(Array.from(files).map(fileToDataUrl))
      setInputImages((prev) => [...prev, ...urls])
    } catch {
      toast.error('读取图片失败')
    }
  }

  // 从历史记录带入一张图进入编辑模式
  const handleEditFromHistory = (imageUrl: string, basePrompt: string) => {
    setMode('edit')
    setInputImages([imageUrl])
    setPrompt(basePrompt)
    setCurrentImage(null)
    setMobileTab('generate')
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    if (!activeApiKey) {
      toast.error('请先配置 API Key')
      return
    }
    if (mode === 'edit' && inputImages.length === 0) {
      toast.error('编辑模式请至少添加一张输入图片')
      return
    }
    const effectiveSize = getEffectiveSize()
    if (!effectiveSize) {
      toast.error('请输入有效的自定义宽高')
      return
    }

    setIsGenerating(true)
    setElapsedSeconds(0)
    setCurrentImage(null)
    if (generateElapsedRef.current) clearInterval(generateElapsedRef.current)
    generateElapsedRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    const controller = new AbortController()
    generateAbortRef.current = controller
    // 图片生成/编辑均较慢（实测单次生成可达 4~5 分钟），统一给 10 分钟超时
    const timeoutMs = 600000
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    generateTimeoutRef.current = timeout

    const options = { quality, outputFormat, outputCompression: 80 }

    try {
      const result =
        mode === 'edit'
          ? await editImage(activeBaseUrl, activeApiKey, model, prompt, inputImages, effectiveSize, options, controller.signal)
          : await generateImage(activeBaseUrl, activeApiKey, model, prompt, effectiveSize, options, controller.signal)
      if (unmountedRef.current) return
      if (result.success && result.imageUrl) {
        setCurrentImage(result.imageUrl)
        setMobileTab('history')
        const tooLargeForHistory = result.imageUrl.startsWith('data:') && result.imageUrl.length > MAX_PERSISTED_IMAGE_URL_LENGTH
        addRecord({ prompt, imageUrl: result.imageUrl, model: model || DEFAULT_IMAGE_MODEL, size: effectiveSize, mode })
        if (tooLargeForHistory) {
          toast.warning(`${mode === 'edit' ? '图片编辑成功' : '图片生成成功'}，但图片较大未保存到历史，请及时下载`)
        } else {
          toast.success(mode === 'edit' ? '图片编辑成功' : '图片生成成功')
        }
      } else {
        toast.error(result.error || (mode === 'edit' ? '编辑失败' : '生成失败'))
      }
    } catch (err) {
      if (unmountedRef.current) return
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error(`图片${mode === 'edit' ? '编辑' : '生成'}超时（${timeoutMs / 60000}分钟），请重试`)
      } else {
        toast.error(err instanceof Error ? err.message : '请求失败')
      }
    } finally {
      clearTimeout(timeout)
      if (generateElapsedRef.current) clearInterval(generateElapsedRef.current)
      generateTimeoutRef.current = null
      generateElapsedRef.current = null
      generateAbortRef.current = null
      if (!unmountedRef.current) setIsGenerating(false)
    }
  }

  const triggerDownload = (href: string, revoke = false) => {
    const link = document.createElement('a')
    link.href = href
    link.download = `generated-image-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    if (revoke) URL.revokeObjectURL(href)
  }

  const handleDownload = async (imageUrl: string) => {
    if (imageUrl.startsWith('data:')) {
      triggerDownload(imageUrl)
      return
    }
    // 远程图片：优先 fetch 成 blob 真正下载；跨域失败则回退新开标签
    try {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blobUrl = URL.createObjectURL(await res.blob())
      triggerDownload(blobUrl, true)
    } catch {
      window.open(imageUrl, '_blank')
    }
  }

  // ───────── 渲染：左侧生成面板 ─────────
  const generatorPanel = (
    <div className="w-full md:w-96 p-4 md:p-6 flex flex-col overflow-y-auto theme-sidebar md:flex-shrink-0 h-full">
      <h2 className="text-lg font-bold mb-4 hidden md:block" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>图片生成</h2>

      {/* 模式切换：生成 / 编辑 */}
      <div className="mb-4">
        <div className="flex gap-2">
          {([
            { v: 'generate', label: '文生图' },
            { v: 'edit', label: '图生图 / 编辑' },
          ] as const).map((m) => (
            <button
              key={m.v}
              onClick={() => setMode(m.v)}
              className={mode === m.v ? 'theme-btn theme-btn-primary flex-1' : 'theme-btn flex-1'}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 编辑模式：输入图片区域 */}
      {mode === 'edit' && (
        <div className="mb-4 p-3" style={{ border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
          <div className="flex items-center justify-between mb-2 gap-2">
            <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              输入图片 {inputImages.length > 0 && `(${inputImages.length})`}
            </label>
            <label className="theme-btn flex-shrink-0 cursor-pointer" style={{ padding: '2px 8px', fontSize: '11px' }}>
              + 添加图片
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handlePickFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {inputImages.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              上传 1 张图修改，或多张图融合生成。也可在右侧历史点「编辑」带入。
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {inputImages.map((img, idx) => (
                <div key={idx} className="relative aspect-square overflow-hidden" style={{ borderRadius: 'var(--radius-sm)', border: 'var(--border-width) solid var(--border-color)' }}>
                  <img src={img} alt={`输入 ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setInputImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center cursor-pointer"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 'var(--radius-sm)' }}
                    title="移除"
                    aria-label="移除图片"
                  >
                    <IconTrash className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* API 配置选择 */}
      <div className="mb-4 p-3" style={{ border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>API 配置</label>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => {
                setUseGlobalConfig(true)
                setCustomBaseUrl(globalConfig.baseUrl)
                setCustomApiKey(globalConfig.apiKey)
              }}
              className="theme-btn"
              style={{ padding: '2px 8px', fontSize: '11px', background: useGlobalConfig ? 'color-mix(in srgb, var(--accent-1) 15%, transparent)' : 'transparent', color: useGlobalConfig ? 'var(--accent-1)' : 'var(--text-muted)' }}
            >
              使用全局配置
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="theme-btn flex items-center gap-1"
              style={{ padding: '2px 8px', fontSize: '11px' }}
              title="打开全局 API 配置"
            >
              <IconSettings className="w-3 h-3" />
              配置
            </button>
          </div>
        </div>
        {useGlobalConfig ? (
          globalConfig.apiKey ? (
            <div className="text-xs break-all" style={{ color: 'var(--text-muted)' }}>
              当前使用全局配置: {globalConfig.baseUrl}
            </div>
          ) : (
            <div className="text-xs" style={{ color: '#f87171' }}>
              尚未配置全局 API，点右上「配置」按钮设置 Base URL 与 API Key。
            </div>
          )
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

      {/* 尺寸选择 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>尺寸</label>
        <div className="flex flex-wrap gap-2">
          {IMAGE_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={size === s ? 'theme-btn theme-btn-primary' : 'theme-btn'}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              {s === 'auto' ? '自动' : s}
            </button>
          ))}
          <button
            onClick={() => setSize('custom')}
            className={size === 'custom' ? 'theme-btn theme-btn-primary' : 'theme-btn'}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            自定义
          </button>
        </div>
        {size === 'custom' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              宽度
              <input
                aria-label="自定义宽度"
                type="number"
                min="1"
                inputMode="numeric"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                placeholder="如 1280"
                className="theme-input mt-1 text-sm"
                style={{ padding: '8px 10px' }}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              高度
              <input
                aria-label="自定义高度"
                type="number"
                min="1"
                inputMode="numeric"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                placeholder="如 720"
                className="theme-input mt-1 text-sm"
                style={{ padding: '8px 10px' }}
              />
            </label>
          </div>
        )}
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          基于 OpenAI GPT Image 2 协议，适用于 OpenAI 官方及 OneAPI / NewAPI / CLIProxyAPI 等兼容代理。
        </p>
      </div>

      {/* 质量选择 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>质量</label>
        <div className="flex flex-wrap gap-2">
          {IMAGE_QUALITIES.map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={quality === q ? 'theme-btn theme-btn-primary' : 'theme-btn'}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              {q === 'auto' ? '自动' : q === 'low' ? '低' : q === 'medium' ? '中' : '高'}
            </button>
          ))}
        </div>
      </div>

      {/* 输出格式 */}
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>格式</label>
        <div className="flex flex-wrap gap-2">
          {IMAGE_FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setOutputFormat(f)}
              className={outputFormat === f ? 'theme-btn theme-btn-primary' : 'theme-btn'}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        {outputFormat !== 'png' && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {outputFormat.toUpperCase()} 格式将以 80% 压缩输出，体积更小。
          </p>
        )}
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
              placeholder={`如 ${DEFAULT_IMAGE_MODEL}`}
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
        <div className="flex flex-wrap gap-2 mb-2">
          {PROMPT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => appendPromptPreset(preset.prompt)}
              className="theme-btn"
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={mode === 'edit' ? '描述想要的修改，如「给猫加一顶帽子」...' : '描述你想要生成的图片...'}
          className="theme-input h-32 resize-none"
        />
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim() || (mode === 'edit' && inputImages.length === 0)}
        className="theme-btn theme-btn-primary w-full"
        style={{ opacity: (isGenerating || !prompt.trim() || (mode === 'edit' && inputImages.length === 0)) ? 0.5 : 1 }}
      >
        {isGenerating ? (mode === 'edit' ? '编辑中...' : '生成中...') : mode === 'edit' ? '生成编辑图' : '生成图片'}
      </button>

      {isGenerating && (
        <div
          className="mt-3 p-3"
          style={{ border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, var(--accent-1) 8%, transparent)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full animate-spin flex-shrink-0"
              style={{ border: '3px solid color-mix(in srgb, var(--accent-1) 25%, transparent)', borderTopColor: 'var(--accent-1)' }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {mode === 'edit' ? '正在编辑图片' : '正在生成图片'}
                <span className="inline-block animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="inline-block animate-bounce" style={{ animationDelay: '120ms' }}>.</span>
                <span className="inline-block animate-bounce" style={{ animationDelay: '240ms' }}>.</span>
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                  已用时 {formatElapsed(elapsedSeconds)}
                </span>
              </div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                GPT Image 2 可能需要 1-5 分钟，复杂提示可能更久；最长等待 10 分钟，请勿关闭页面。
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  )

  // ───────── 渲染：右侧当前预览 + 可编辑历史 ─────────
  const previewPanel = (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto h-full min-h-0">
      <div className="flex justify-between items-center mb-4 gap-3">
        <h3 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>当前预览</h3>
        {records.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-sm cursor-pointer flex-shrink-0"
            style={{ color: '#f87171', transition: 'var(--transition)' }}
          >
            清空历史
          </button>
        )}
      </div>

      <div className="theme-card mb-5" style={{ minHeight: '320px' }}>
        {currentImage ? (
          <div className="space-y-3">
            <img
              src={currentImage}
              alt="Generated"
              className="w-full max-h-[70vh] object-contain"
              style={{ borderRadius: 'var(--radius-sm)', border: 'var(--border-width) solid var(--border-color)' }}
            />
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => handleDownload(currentImage)}
                className="theme-btn theme-btn-primary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <IconDownload className="w-4 h-4" />
                下载
              </button>
              <button
                onClick={() => handleEditFromHistory(currentImage, prompt)}
                className="theme-btn"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                基于此图编辑
              </button>
            </div>
          </div>
        ) : isGenerating ? (
          <div className="flex flex-col items-center justify-center h-72 text-center gap-3">
            <div
              className="w-8 h-8 rounded-full animate-spin"
              style={{ border: '4px solid color-mix(in srgb, var(--accent-1) 25%, transparent)', borderTopColor: 'var(--accent-1)' }}
              aria-hidden="true"
            />
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {mode === 'edit' ? '正在编辑图片' : '正在生成图片'} · 已用时 {formatElapsed(elapsedSeconds)}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              请求仍在处理中，生成完成后会在这里显示大图。
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-72 text-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <IconImage className="w-10 h-10" />
            <p>生成完成后，图片会显示在这里。</p>
            <p className="text-xs">超大图片不会保存到历史，但会保留当前预览和下载按钮。</p>
          </div>
        )}
      </div>

      {records.length > 0 && (
        <div>
          <h4 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>可编辑历史</h4>
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
                        className="text-xs px-1.5 py-0.5 flex-shrink-0 truncate"
                        style={{ background: 'color-mix(in srgb, var(--accent-1) 15%, transparent)', color: 'var(--accent-1)', borderRadius: 'var(--radius-sm)', maxWidth: '120px' }}
                        title={record.model}
                      >
                        {record.model}
                      </span>
                      <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        {format(record.createdAt, 'MM/dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEditFromHistory(record.imageUrl, record.prompt)}
                        className="cursor-pointer h-7 px-2 flex items-center justify-center text-xs"
                        style={{ color: 'var(--accent-1)', transition: 'var(--transition)', borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, var(--accent-1) 12%, transparent)' }}
                        title="基于此图编辑"
                        aria-label="基于此图编辑"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => deleteRecord(record.id)}
                        className="cursor-pointer w-7 h-7 flex items-center justify-center"
                        style={{ color: 'var(--text-muted)', transition: 'var(--transition)', borderRadius: 'var(--radius-sm)' }}
                        title="删除"
                        aria-label="删除记录"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
          <button
            onClick={() => setShowSettings(true)}
            className="theme-btn"
            style={{ padding: 0, width: '40px', height: '40px' }}
            aria-label="API 设置"
          >
            <IconSettings className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>
        <div className="flex border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => setMobileTab('generate')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold cursor-pointer"
            style={{
              color: mobileTab === 'generate' ? 'var(--accent-1)' : 'var(--text-muted)',
              background: 'transparent',
              borderTopWidth: 0,
              borderRightWidth: 0,
              borderBottomWidth: '2px',
              borderLeftWidth: 0,
              borderTopStyle: 'none',
              borderRightStyle: 'none',
              borderBottomStyle: 'solid',
              borderLeftStyle: 'none',
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
              borderTopWidth: 0,
              borderRightWidth: 0,
              borderBottomWidth: '2px',
              borderLeftWidth: 0,
              borderTopStyle: 'none',
              borderRightStyle: 'none',
              borderBottomStyle: 'solid',
              borderLeftStyle: 'none',
              borderBottomColor: mobileTab === 'history' ? 'var(--accent-1)' : 'transparent',
            }}
          >
            <IconHistory className="w-4 h-4" />
            <span>预览 {records.length > 0 && `(${records.length})`}</span>
          </button>
        </div>
      </div>

      {/* 桌面端：API 设置按钮（右上角，移动端在顶栏内） */}
      <button
        onClick={() => setShowSettings(true)}
        className="hidden md:flex fixed top-4 right-4 z-50 w-10 h-10 items-center justify-center theme-btn"
        style={{ padding: 0, width: '40px', height: '40px' }}
        title="API 设置"
        aria-label="API 设置"
      >
        <IconSettings className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
      </button>

      {/* 移动端：根据 tab 切换显示；桌面端：并排显示 */}
      <div className={`${mobileTab === 'generate' ? 'flex' : 'hidden'} md:flex flex-col flex-1 md:flex-initial min-h-0`}>
        {generatorPanel}
      </div>
      <div className={`${mobileTab === 'history' ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-h-0`}>
        {previewPanel}
      </div>

      {/* 全局 API 配置弹窗 */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
