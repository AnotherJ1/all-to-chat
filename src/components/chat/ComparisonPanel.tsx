import { useState, useRef, useEffect } from 'react'
import { useConfigStore } from '../../stores/configStore'
import { callApi } from '../../api'
import { fetchModelList } from '../../api/openai'
import { toast } from '../../stores/toastStore'
import { IconPlus, IconClose, IconSend, IconStop, IconRefresh } from '../common/Icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useMultiModelStore, type MultiModelConfig } from '../../stores/multiModelStore'

type ModelStatus = 'idle' | 'thinking' | 'completed' | 'error'

interface ModelResponse {
  content: string
  status: ModelStatus
  duration?: number
  error?: string
}

export default function ComparisonPanel() {
  const { models, addModel, updateModel, removeModel, toggleModel, getEnabledModels } = useMultiModelStore()
  const { protocol, getCurrentConfig, savedConfigs } = useConfigStore()
  const globalConfig = getCurrentConfig()

  const [input, setInput] = useState('')
  const [lastInput, setLastInput] = useState('')
  const [responses, setResponses] = useState<Map<string, ModelResponse>>(new Map())
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const [isSending, setIsSending] = useState(false)
  const [modelLists, setModelLists] = useState<Map<string, string[]>>(new Map())
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (models.length === 0) {
      addModel({
        name: globalConfig.model,
        protocol,
        baseUrl: globalConfig.baseUrl,
        apiKey: globalConfig.apiKey,
        model: globalConfig.model,
        enabled: true,
      })
    }
  }, [])

  const handleFetchModels = async (modelId: string) => {
    const item = models.find((m) => m.id === modelId)
    if (!item || !item.apiKey || !item.baseUrl) {
      toast.warning('请先选择配置')
      return
    }
    setLoadingModels((prev) => new Set(prev).add(modelId))
    try {
      const list = await fetchModelList(item.baseUrl, item.apiKey)
      if (list.length > 0) {
        setModelLists((prev) => new Map(prev).set(modelId, list))
      } else {
        toast.warning('未获取到模型列表')
      }
    } catch {
      toast.error('获取模型列表失败')
    } finally {
      setLoadingModels((prev) => { const s = new Set(prev); s.delete(modelId); return s })
    }
  }

  const handleConfigChange = (modelId: string, configId: string) => {
    if (configId === '_global') {
      updateModel(modelId, { protocol, baseUrl: globalConfig.baseUrl, apiKey: globalConfig.apiKey })
    } else {
      const saved = savedConfigs.find((c) => c.id === configId)
      if (saved) {
        updateModel(modelId, { protocol: saved.protocol, baseUrl: saved.config.baseUrl, apiKey: saved.config.apiKey })
      }
    }
    setModelLists((prev) => { const m = new Map(prev); m.delete(modelId); return m })
  }

  const sendToModel = async (config: MultiModelConfig, message: string) => {
    const controller = new AbortController()
    abortControllersRef.current.set(config.id, controller)
    setResponses((prev) => {
      const newMap = new Map(prev)
      newMap.set(config.id, { content: '', status: 'thinking' })
      return newMap
    })
    const startTime = Date.now()
    try {
      await callApi({
        protocol: config.protocol,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        messages: [{ id: 'user', role: 'user', content: message, timestamp: Date.now() }],
        streaming: true,
        signal: controller.signal,
        onChunk: (chunk) => {
          setResponses((prev) => {
            const newMap = new Map(prev)
            const current = newMap.get(config.id)
            newMap.set(config.id, { content: (current?.content || '') + chunk, status: 'thinking' })
            return newMap
          })
        },
        onComplete: () => {
          const duration = Date.now() - startTime
          setResponses((prev) => {
            const newMap = new Map(prev)
            const current = newMap.get(config.id)
            newMap.set(config.id, { content: current?.content || '', status: 'completed', duration })
            return newMap
          })
        },
        onError: (error) => {
          const duration = Date.now() - startTime
          setResponses((prev) => {
            const newMap = new Map(prev)
            newMap.set(config.id, { content: '', status: 'error', duration, error: error.message })
            return newMap
          })
        },
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      const duration = Date.now() - startTime
      setResponses((prev) => {
        const newMap = new Map(prev)
        newMap.set(config.id, { content: '', status: 'error', duration, error: (error as Error).message })
        return newMap
      })
    } finally {
      abortControllersRef.current.delete(config.id)
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const enabledModels = getEnabledModels()
    if (enabledModels.length === 0) {
      toast.warning('请至少启用一个模型')
      return
    }
    setIsSending(true)
    const message = input.trim()
    setLastInput(message)
    setInput('')
    await Promise.allSettled(enabledModels.map((m) => sendToModel(m, message)))
    setIsSending(false)
  }

  const cancelModel = (modelId: string) => {
    const controller = abortControllersRef.current.get(modelId)
    if (controller) { controller.abort(); abortControllersRef.current.delete(modelId) }
  }

  const retryModel = (modelId: string) => {
    const modelItem = models.find((m) => m.id === modelId)
    if (!modelItem || !lastInput) { toast.info('请先输入消息再重试'); return }
    sendToModel(modelItem, lastInput)
  }

  const enabledModels = getEnabledModels()

  return (
    <div className="flex flex-col h-full">
      {/* 模型配置区域 */}
      <div style={{ borderBottom: 'var(--border-width) solid var(--border-color)' }}>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            模型列表 ({enabledModels.length}/{models.length} 启用)
          </span>
          <button
            onClick={() => addModel({
              name: globalConfig.model, protocol,
              baseUrl: globalConfig.baseUrl, apiKey: globalConfig.apiKey,
              model: globalConfig.model, enabled: true,
            })}
            className="theme-btn"
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>添加模型</span>
          </button>
        </div>
        <div className="flex" style={{ borderTop: 'var(--border-width) solid var(--border-color)' }}>
          {models.map((modelItem, idx) => {
            const availableModels = modelLists.get(modelItem.id) || []
            const isLoading = loadingModels.has(modelItem.id)
            return (
              <div
                key={modelItem.id}
                className="flex-1 min-w-0 p-3 space-y-2"
                style={{ borderLeft: idx > 0 ? 'var(--border-width) solid var(--border-color)' : 'none' }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={modelItem.enabled}
                    onChange={() => toggleModel(modelItem.id)}
                    className="w-4 h-4 cursor-pointer flex-shrink-0"
                    style={{ accentColor: 'var(--accent-1)' }}
                  />
                  <select
                    onChange={(e) => handleConfigChange(modelItem.id, e.target.value)}
                    className="theme-select text-xs flex-1 min-w-0"
                    style={{ padding: '6px 32px 6px 10px' }}
                    defaultValue="_global"
                  >
                    <option value="_global">全局配置</option>
                    {savedConfigs.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeModel(modelItem.id)}
                    className="flex-shrink-0 cursor-pointer"
                    style={{ color: 'var(--text-muted)', transition: 'var(--transition)' }}
                    title="移除"
                  >
                    <IconClose className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {availableModels.length > 0 ? (
                    <select
                      value={modelItem.model}
                      onChange={(e) => updateModel(modelItem.id, { model: e.target.value, name: e.target.value })}
                      className="theme-select flex-1 text-xs min-w-0"
                      style={{ padding: '6px 32px 6px 10px' }}
                    >
                      {!availableModels.includes(modelItem.model) && (
                        <option value={modelItem.model}>{modelItem.model}</option>
                      )}
                      {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={modelItem.model}
                      onChange={(e) => updateModel(modelItem.id, { model: e.target.value, name: e.target.value })}
                      className="theme-input flex-1 text-xs min-w-0"
                      style={{ padding: '6px 10px' }}
                      placeholder="模型名"
                    />
                  )}
                  <button
                    onClick={() => handleFetchModels(modelItem.id)}
                    disabled={isLoading}
                    className="theme-btn flex-shrink-0"
                    style={{ padding: '4px 8px', fontSize: '11px', opacity: isLoading ? 0.5 : 1 }}
                    title="获取模型列表"
                  >
                    {isLoading ? '...' : '获取模型'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 对比结果区域 */}
      <div className="flex-1 overflow-hidden">
        {enabledModels.length === 0 ? (
          <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
            请添加并启用至少一个模型
          </div>
        ) : (
          <div className="h-full flex">
            {enabledModels.map((modelItem, idx) => {
              const response = responses.get(modelItem.id)
              const status = response?.status || 'idle'
              return (
                <div
                  key={modelItem.id}
                  className="flex-1 flex flex-col min-w-0"
                  style={{ borderLeft: idx > 0 ? 'var(--border-width) solid var(--border-color)' : 'none' }}
                >
                  {/* 模型标题栏 */}
                  <div
                    className="px-4 py-2 flex items-center justify-between"
                    style={{
                      borderBottom: 'var(--border-width) solid var(--border-color)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                        {modelItem.model}
                      </span>
                      {status === 'thinking' && (
                        <span
                          className="text-xs px-2 py-0.5 flex-shrink-0"
                          style={{
                            background: 'color-mix(in srgb, var(--accent-1) 15%, transparent)',
                            color: 'var(--accent-1)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--accent-1)',
                          }}
                        >思考中</span>
                      )}
                      {status === 'completed' && (
                        <span
                          className="text-xs px-2 py-0.5 flex-shrink-0"
                          style={{
                            background: 'color-mix(in srgb, var(--accent-3) 15%, transparent)',
                            color: 'var(--accent-3)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--accent-3)',
                          }}
                        >完成</span>
                      )}
                      {status === 'error' && (
                        <span
                          className="text-xs px-2 py-0.5 flex-shrink-0"
                          style={{
                            background: 'rgba(248, 113, 113, 0.15)',
                            color: '#f87171',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid #f87171',
                          }}
                        >错误</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {response?.duration && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{(response.duration / 1000).toFixed(1)}s</span>
                      )}
                      {status === 'thinking' && (
                        <button onClick={() => cancelModel(modelItem.id)} className="cursor-pointer" title="取消">
                          <IconStop className="w-4 h-4" style={{ color: '#f87171' }} />
                        </button>
                      )}
                      {(status === 'error' || status === 'completed') && (
                        <button onClick={() => retryModel(modelItem.id)} className="cursor-pointer" title="重试">
                          <IconRefresh className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* 内容 */}
                  <div className="flex-1 p-4 overflow-y-auto">
                    {status === 'idle' && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>等待输入...</div>}
                    {status === 'thinking' && !response?.content && (
                      <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                        <div
                          className="w-4 h-4 rounded-full animate-spin"
                          style={{ border: '2px solid var(--accent-1)', borderTopColor: 'transparent' }}
                        />
                        <span className="text-sm">生成中...</span>
                      </div>
                    )}
                    {response?.content && (
                      <div className="prose-chat text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {response.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {status === 'error' && (
                      <div className="text-sm" style={{ color: '#f87171' }}>{response?.error}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="p-4" style={{ borderTop: 'var(--border-width) solid var(--border-color)' }}>
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="输入消息,同时发送给所有启用的模型..."
            disabled={isSending}
            className="flex-1 theme-input resize-none min-h-[48px] max-h-[120px]"
            rows={1}
          />
          {isSending ? (
            <button
              onClick={() => abortControllersRef.current.forEach((c) => c.abort())}
              className="theme-btn"
              style={{ padding: 0, width: '44px', height: '44px', background: 'rgba(248, 113, 113, 0.15)', borderColor: '#f87171' }}
              title="全部停止"
            >
              <IconStop className="w-5 h-5" style={{ color: '#f87171' }} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="theme-btn theme-btn-primary"
              style={{ padding: 0, width: '44px', height: '44px', opacity: input.trim() ? 1 : 0.4 }}
              title="发送"
            >
              <IconSend className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
