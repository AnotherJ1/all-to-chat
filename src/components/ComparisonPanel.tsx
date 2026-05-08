import { useState, useEffect, useRef } from 'react'
import { useMultiModelStore, type MultiModelConfig } from '../stores/multiModelStore'
import { useConfigStore } from '../stores/configStore'

type ModelStatus = 'idle' | 'thinking' | 'completed' | 'error'

interface ModelResponse {
  modelId: string
  content: string
  status: ModelStatus
  duration?: number
  error?: string
}

export default function ComparisonPanel() {
  const { models, addModel, updateModel, removeModel, toggleModel, getEnabledModels } = useMultiModelStore()
  const { protocol, getCurrentConfig } = useConfigStore()
  const { baseUrl, apiKey, model } = getCurrentConfig()

  const [responses, setResponses] = useState<Map<string, ModelResponse>>(new Map())
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  useEffect(() => {
    if (models.length === 0) {
      addModel({
        name: '模型 1',
        protocol,
        baseUrl,
        apiKey,
        model,
        enabled: true,
      })
    }
  }, [])

  const sendToModel = async (
    config: MultiModelConfig,
    message: string,
    signal: AbortSignal
  ): Promise<string> => {
    const { protocol, baseUrl, apiKey, model } = config

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (protocol === 'openai' || protocol === 'gemini') {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    let endpoint = `${baseUrl}/chat/completions`
    let body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: message }],
      stream: true,
    }

    if (protocol === 'anthropic') {
      endpoint = `${baseUrl}/messages`
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
      body = {
        model,
        messages: [{ role: 'user', content: message }],
        max_tokens: 4096,
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `HTTP ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (protocol === 'anthropic') {
              if (parsed.type === 'content_block_delta') {
                fullContent += parsed.delta?.text || ''
              }
            } else {
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
              }
            }

            setResponses((prev) => {
              const newMap = new Map(prev)
              const current = newMap.get(config.id)
              if (current) {
                newMap.set(config.id, { ...current, content: fullContent })
              }
              return newMap
            })
          } catch {
            // ignore parse errors
          }
        }
      }
    }

    return fullContent
  }

  const retryModel = async (modelId: string, userMessage: string) => {
    const modelItem = models.find((m) => m.id === modelId)
    if (!modelItem) return

    const controller = new AbortController()
    abortControllersRef.current.set(modelId, controller)

    setResponses((prev) => {
      const newMap = new Map(prev)
      newMap.set(modelId, { modelId, content: '', status: 'thinking' })
      return newMap
    })

    const startTime = Date.now()

    try {
      const response = await sendToModel(modelItem, userMessage, controller.signal)
      const duration = Date.now() - startTime

      setResponses((prev) => {
        const newMap = new Map(prev)
        newMap.set(modelId, { modelId, content: response, status: 'completed', duration })
        return newMap
      })
    } catch (error) {
      const duration = Date.now() - startTime
      setResponses((prev) => {
        const newMap = new Map(prev)
        newMap.set(modelId, {
          modelId,
          content: '',
          status: 'error',
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        return newMap
      })
    } finally {
      abortControllersRef.current.delete(modelId)
    }
  }

  const cancelModel = (modelId: string) => {
    const controller = abortControllersRef.current.get(modelId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(modelId)
    }
  }

  const enabledModels = getEnabledModels()

  return (
    <div className="flex flex-col h-full">
      {/* 模型列表头部 */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold">多模型对比 ({enabledModels.length})</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              addModel({
                name: `模型 ${models.length + 1}`,
                protocol: 'openai',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: '',
                model: 'gpt-4',
                enabled: true,
              })
            }}
            className="btn-aurora btn-aurora-primary px-3 py-1.5 text-sm"
          >
            添加模型
          </button>
        </div>
      </div>

      {/* 模型配置列表 */}
      <div className="p-4 border-b border-white/10 space-y-2 max-h-48 overflow-y-auto scrollbar-aurora">
        {models.map((modelItem) => (
          <div
            key={modelItem.id}
            className={`flex items-center gap-3 p-2 rounded-xl ${
              modelItem.enabled ? 'glass-card' : 'glass'
            }`}
          >
            <input
              type="checkbox"
              checked={modelItem.enabled}
              onChange={() => toggleModel(modelItem.id)}
              className="w-4 h-4 rounded cursor-pointer accent-cyan-400"
            />
            <input
              type="text"
              value={modelItem.name}
              onChange={(e) => updateModel(modelItem.id, { name: e.target.value })}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm"
              placeholder="模型名称"
            />
            <input
              type="text"
              value={modelItem.model}
              onChange={(e) => updateModel(modelItem.id, { model: e.target.value })}
              className="input-aurora w-32 text-sm py-1.5"
              placeholder="模型名"
            />
            <button
              onClick={() => removeModel(modelItem.id)}
              className="text-white/40 hover:text-red-400 transition-colors cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 对比结果区域 */}
      <div className="flex-1 overflow-hidden">
        {enabledModels.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/40">
            请添加并启用至少一个模型
          </div>
        ) : (
          <div className="h-full flex divide-x divide-white/10">
            {enabledModels.map((modelItem) => {
              const response = responses.get(modelItem.id)
              const status = response?.status || 'idle'

              return (
                <div key={modelItem.id} className="flex-1 flex flex-col min-w-0">
                  {/* 模型标题栏 */}
                  <div className="p-3 bg-black/20 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{modelItem.name}</span>
                      {status === 'thinking' && (
                        <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded animate-pulse">
                          思考中
                        </span>
                      )}
                      {status === 'completed' && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                          完成
                        </span>
                      )}
                      {status === 'error' && (
                        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                          错误
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {response?.duration && (
                        <span className="text-xs text-white/40">
                          {response.duration}ms
                        </span>
                      )}
                      {status === 'thinking' && (
                        <button
                          onClick={() => cancelModel(modelItem.id)}
                          className="text-xs px-2 py-1 glass text-sm cursor-pointer"
                        >
                          取消
                        </button>
                      )}
                      {(status === 'error' || status === 'completed') && (
                        <button
                          onClick={() => retryModel(modelItem.id, '请重试')}
                          className="text-xs px-2 py-1 glass text-sm cursor-pointer"
                        >
                          重试
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 内容区域 */}
                  <div className="flex-1 p-4 overflow-y-auto scrollbar-aurora">
                    {status === 'thinking' && (
                      <div className="flex items-center gap-2 text-white/50">
                        <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span>生成中...</span>
                      </div>
                    )}
                    {status === 'error' && (
                      <div className="text-red-400 text-sm">{response?.error}</div>
                    )}
                    {status === 'completed' && (
                      <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap">
                        {response?.content}
                      </div>
                    )}
                    {status === 'idle' && (
                      <div className="text-white/40 text-sm">等待输入...</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
