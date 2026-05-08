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

  // 初始添加一个默认模型（如果列表为空）
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

  // 发送消息到单个模型
  const sendToModel = async (
    config: MultiModelConfig,
    message: string,
    signal: AbortSignal
  ): Promise<string> => {
    const { protocol, baseUrl, apiKey, model } = config

    // 构建请求
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

    // 根据协议调整请求格式
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

    // 处理流式响应
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
              // Anthropic 流式格式
              if (parsed.type === 'content_block_delta') {
                fullContent += parsed.delta?.text || ''
              }
            } else {
              // OpenAI/Gemini 流式格式
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
              }
            }

            // 更新实时内容
            setResponses((prev) => {
              const newMap = new Map(prev)
              const current = newMap.get(config.id)
              if (current) {
                newMap.set(config.id, { ...current, content: fullContent })
              }
              return newMap
            })
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    return fullContent
  }

  // 重试单个模型
  const retryModel = async (modelId: string, userMessage: string) => {
    const model = models.find((m) => m.id === modelId)
    if (!model) return

    const controller = new AbortController()
    abortControllersRef.current.set(modelId, controller)

    setResponses((prev) => {
      const newMap = new Map(prev)
      newMap.set(modelId, { modelId, content: '', status: 'thinking' })
      return newMap
    })

    const startTime = Date.now()

    try {
      const response = await sendToModel(model, userMessage, controller.signal)
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

  // 取消单个模型
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
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
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
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
          >
            添加模型
          </button>
        </div>
      </div>

      {/* 模型配置列表 */}
      <div className="p-4 border-b border-gray-700 space-y-2 max-h-48 overflow-y-auto">
        {models.map((model) => (
          <div
            key={model.id}
            className={`flex items-center gap-3 p-2 rounded-lg ${
              model.enabled ? 'bg-gray-700' : 'bg-gray-800'
            }`}
          >
            <input
              type="checkbox"
              checked={model.enabled}
              onChange={() => toggleModel(model.id)}
              className="w-4 h-4 rounded"
            />
            <input
              type="text"
              value={model.name}
              onChange={(e) => updateModel(model.id, { name: e.target.value })}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm"
              placeholder="模型名称"
            />
            <input
              type="text"
              value={model.model}
              onChange={(e) => updateModel(model.id, { model: e.target.value })}
              className="w-32 bg-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="模型名"
            />
            <button
              onClick={() => removeModel(model.id)}
              className="text-gray-400 hover:text-red-400"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 对比结果区域 */}
      <div className="flex-1 overflow-hidden">
        {enabledModels.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            请添加并启用至少一个模型
          </div>
        ) : (
          <div className="h-full flex divide-x divide-gray-700">
            {enabledModels.map((model) => {
              const response = responses.get(model.id)
              const status = response?.status || 'idle'

              return (
                <div key={model.id} className="flex-1 flex flex-col min-w-0">
                  {/* 模型标题栏 */}
                  <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.name}</span>
                      {status === 'thinking' && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded animate-pulse">
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
                        <span className="text-xs text-gray-500">
                          {response.duration}ms
                        </span>
                      )}
                      {status === 'thinking' && (
                        <button
                          onClick={() => cancelModel(model.id)}
                          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                        >
                          取消
                        </button>
                      )}
                      {(status === 'error' || status === 'completed') && (
                        <button
                          onClick={() => retryModel(model.id, '请重试')}
                          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                        >
                          重试
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 内容区域 */}
                  <div className="flex-1 p-4 overflow-y-auto">
                    {status === 'thinking' && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
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
                      <div className="text-gray-500 text-sm">等待输入...</div>
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
