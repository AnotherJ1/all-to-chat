import { useState, useRef, useEffect } from 'react'
import { useConfigStore } from '../../stores/configStore'
import { useSessionStore } from '../../stores/sessionStore'
import { callApi } from '../../api'
import { fetchModelList } from '../../api/openai'
import { toast } from '../../stores/toastStore'
import { IconPlus, IconClose, IconSend, IconStop, IconRefresh } from '../common/Icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useMultiModelStore, type MultiModelConfig } from '../../stores/multiModelStore'
import { uuid } from '../../lib/uuid'
import type { Message } from '../../types'

type ModelStatus = 'idle' | 'thinking' | 'completed' | 'error'

interface ModelRuntime {
  status: ModelStatus
  duration?: number
  error?: string
  /** 当前流式生成中的 assistant 消息 id，用于持续追加 chunk */
  currentAssistantId?: string
}

export default function ComparisonPanel() {
  const { models, addModel, updateModel, removeModel, toggleModel, getEnabledModels, resetAllSessions } = useMultiModelStore()
  const { protocol, getCurrentConfig, savedConfigs } = useConfigStore()
  const { sessions, createSessionSilent, addMessage, updateMessage, updateSessionTitle, deleteSession } = useSessionStore()
  const globalConfig = getCurrentConfig()

  const [input, setInput] = useState('')
  const [lastInput, setLastInput] = useState('')
  // 每个模型的运行时状态（thinking/error 等），不持久化
  const [runtimes, setRuntimes] = useState<Map<string, ModelRuntime>>(new Map())
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const [isSending, setIsSending] = useState(false)
  const [modelLists, setModelLists] = useState<Map<string, string[]>>(new Map())
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set())
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    if (useMultiModelStore.getState().models.length === 0) {
      addModel({
        name: globalConfig.model,
        protocol,
        baseUrl: globalConfig.baseUrl,
        apiKey: globalConfig.apiKey,
        model: globalConfig.model,
        enabled: true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 工具：拿到某个模型当前的 session（如果 sessionId 已不存在或为空，返回 undefined）
  const getModelSession = (modelItem: MultiModelConfig) => {
    if (!modelItem.sessionId) return undefined
    return sessions.find((s) => s.id === modelItem.sessionId)
  }

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

  const setRuntime = (modelId: string, patch: Partial<ModelRuntime>) => {
    setRuntimes((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(modelId) || { status: 'idle' as ModelStatus }
      newMap.set(modelId, { ...current, ...patch })
      return newMap
    })
  }

  /** 给某个模型发送一条用户消息（自动追加到其 session 历史） */
  const sendToModel = async (config: MultiModelConfig, userMessage: Message) => {
    // 1. 确保 session 存在；不存在就创建一个，标题包含模型名
    let sessionId = config.sessionId
    let isNewSession = false
    if (!sessionId || !sessions.find((s) => s.id === sessionId)) {
      const title = `[对比] ${config.model}`
      const newSession = createSessionSilent(title)
      sessionId = newSession.id
      isNewSession = true
      updateModel(config.id, { sessionId })
    }

    // 2. 把用户消息写入 session
    addMessage(sessionId, userMessage)

    // 3. 创建 assistant 占位消息
    const assistantId = uuid()
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addMessage(sessionId, assistantMessage)

    // 4. 计算请求 messages（取持久化后最新的历史，含 user 消息但不含空 assistant 占位）
    const latestSession = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
    const messagesForApi: Message[] = latestSession
      ? latestSession.messages.filter((m) => m.id !== assistantId)
      : [userMessage]

    const controller = new AbortController()
    abortControllersRef.current.set(config.id, controller)
    setRuntime(config.id, { status: 'thinking', currentAssistantId: assistantId, error: undefined, duration: undefined })
    const startTime = Date.now()
    let firstChunkReceived = false

    try {
      await callApi({
        protocol: config.protocol,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        messages: messagesForApi,
        streaming: true,
        signal: controller.signal,
        onChunk: (chunk) => {
          firstChunkReceived = true
          const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId!)
          const msg = session?.messages.find((m) => m.id === assistantId)
          updateMessage(sessionId!, assistantId, (msg?.content || '') + chunk)
        },
        onComplete: () => {
          const duration = Date.now() - startTime
          setRuntime(config.id, { status: 'completed', duration, currentAssistantId: undefined })
          // 新 session 第一次发送：用户消息作为标题前缀
          if (isNewSession) {
            const t = userMessage.content.slice(0, 20) + (userMessage.content.length > 20 ? '...' : '')
            updateSessionTitle(sessionId!, `[${config.model}] ${t}`)
          }
        },
        onError: (error) => {
          const duration = Date.now() - startTime
          setRuntime(config.id, { status: 'error', duration, error: error.message, currentAssistantId: undefined })
        },
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // 中止：把已生成内容保留
        const duration = Date.now() - startTime
        setRuntime(config.id, { status: firstChunkReceived ? 'completed' : 'error', duration, error: firstChunkReceived ? undefined : '已取消', currentAssistantId: undefined })
        return
      }
      const duration = Date.now() - startTime
      setRuntime(config.id, { status: 'error', duration, error: (error as Error).message, currentAssistantId: undefined })
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
    const messageContent = input.trim()
    setLastInput(messageContent)
    setInput('')

    // 为每个启用的模型构造独立的 user message（不同 id 便于追加到各自 session）
    await Promise.allSettled(enabledModels.map((m) => {
      const userMsg: Message = {
        id: uuid(),
        role: 'user',
        content: messageContent,
        timestamp: Date.now(),
      }
      return sendToModel(m, userMsg)
    }))
    setIsSending(false)
  }

  const cancelModel = (modelId: string) => {
    const controller = abortControllersRef.current.get(modelId)
    if (controller) { controller.abort(); abortControllersRef.current.delete(modelId) }
  }

  /** 重新生成最后一条 assistant 消息：删掉它，重发上一条 user 消息 */
  const retryModel = async (modelId: string) => {
    const modelItem = models.find((m) => m.id === modelId)
    if (!modelItem) return
    const session = getModelSession(modelItem)
    if (!session) {
      // 无历史会话，使用 lastInput 重发
      if (!lastInput) { toast.info('请先输入消息再重试'); return }
      const userMsg: Message = { id: uuid(), role: 'user', content: lastInput, timestamp: Date.now() }
      sendToModel(modelItem, userMsg)
      return
    }
    // 找到最后一条 user 消息及其后的 assistant 消息
    const messages = session.messages
    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx < 0) {
      toast.info('未找到可重试的消息')
      return
    }
    const lastUserMsg = messages[lastUserIdx]
    // 删掉 user 消息之后的所有消息（assistant 占位/错误等）
    const toRemove = messages.slice(lastUserIdx + 1)
    toRemove.forEach((m) => useSessionStore.getState().deleteMessage(session.id, m.id))
    // 同时删掉这条 user 消息（sendToModel 会重新加）
    useSessionStore.getState().deleteMessage(session.id, lastUserMsg.id)
    // 重发
    sendToModel(modelItem, { ...lastUserMsg, id: uuid(), timestamp: Date.now() })
  }

  /** 开始一轮新的对比对话：清除模型与 session 的关联，但不删除 session 数据 */
  const handleNewRound = () => {
    if (isSending) {
      toast.warning('请等待当前对话完成或停止后再开始新对话')
      return
    }
    resetAllSessions()
    setRuntimes(new Map())
    setLastInput('')
    toast.success('已开始新一轮对比对话')
  }

  /** 清空某个模型的当前对话（同时删除其 session） */
  const handleClearModel = (modelId: string) => {
    const modelItem = models.find((m) => m.id === modelId)
    if (!modelItem || !modelItem.sessionId) return
    if (!window.confirm('确定清空此模型的当前对话？此操作不可撤销。')) return
    const sessionIdToDelete = modelItem.sessionId
    // 先解除关联，再删除 session，避免对话页 currentSessionId 被无意切换
    updateModel(modelId, { sessionId: undefined })
    // 仅当被删的不是对话页的当前会话时才删除（避免删掉正在浏览的对话）
    // 这里直接删除即可：sessionStore.deleteSession 在 currentSessionId === id 时会切到下一个；
    // 多模型对比创建的 session 不应被设为对话页 currentSessionId（createSessionSilent 不会切换），
    // 所以正常情况不会冲突。但用户曾点过「恢复」就可能；此时给提示而非自动切换。
    const currentId = useSessionStore.getState().currentSessionId
    if (currentId === sessionIdToDelete) {
      // 该 session 同时是对话页正在查看的会话——为避免突然切换，提示用户
      if (!window.confirm('此对话正显示在「对话」Tab 中，删除会切换到其他会话，是否继续？')) {
        // 用户取消：恢复关联
        updateModel(modelId, { sessionId: sessionIdToDelete })
        return
      }
    }
    deleteSession(sessionIdToDelete)
    setRuntimes((prev) => { const m = new Map(prev); m.delete(modelId); return m })
  }

  // 流式追加时自动滚动每列到底部
  useEffect(() => {
    runtimes.forEach((rt, modelId) => {
      if (rt.status === 'thinking') {
        const el = scrollRefs.current.get(modelId)
        if (el) el.scrollTop = el.scrollHeight
      }
    })
  }, [runtimes, sessions])

  const enabledModels = getEnabledModels()

  return (
    <div className="flex flex-col h-full">
      {/* 模型配置区域 */}
      <div style={{ borderBottom: 'var(--border-width) solid var(--border-color)' }}>
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 gap-2">
          <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            模型 ({enabledModels.length}/{models.length})
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleNewRound}
              className="theme-btn"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              title="开始新一轮对话（保留各模型已有会话历史）"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              <span>新对话</span>
            </button>
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
        </div>
        <div className="flex flex-col md:flex-row" style={{ borderTop: 'var(--border-width) solid var(--border-color)' }}>
          {models.map((modelItem, idx) => {
            const availableModels = modelLists.get(modelItem.id) || []
            const isLoading = loadingModels.has(modelItem.id)
            return (
              <div
                key={modelItem.id}
                className={`flex-1 min-w-0 p-3 space-y-2 ${idx > 0 ? 'compare-divider' : ''}`}
                style={{ opacity: modelItem.enabled ? 1 : 0.55, transition: 'opacity 0.2s' }}
              >
                {/* 第一行：配置选择 + 启用开关 + 删除 */}
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => handleConfigChange(modelItem.id, e.target.value)}
                    className="theme-select text-xs flex-1 min-w-0"
                    style={{ padding: '6px 32px 6px 10px', height: '32px' }}
                    defaultValue="_global"
                    aria-label="选择 API 配置"
                  >
                    <option value="_global">全局配置</option>
                    {savedConfigs.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                  <label
                    className="flex items-center justify-center cursor-pointer flex-shrink-0"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'var(--border-width) solid var(--border-color)',
                      background: modelItem.enabled
                        ? 'color-mix(in srgb, var(--accent-1) 15%, transparent)'
                        : 'transparent',
                      transition: 'var(--transition)',
                    }}
                    title={modelItem.enabled ? '已启用，点击禁用' : '已禁用，点击启用'}
                  >
                    <input
                      type="checkbox"
                      checked={modelItem.enabled}
                      onChange={() => toggleModel(modelItem.id)}
                      className="w-4 h-4 cursor-pointer"
                      style={{ accentColor: 'var(--accent-1)' }}
                      aria-label="启用此模型"
                    />
                  </label>
                  <button
                    onClick={() => removeModel(modelItem.id)}
                    className="flex-shrink-0 cursor-pointer flex items-center justify-center"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'var(--border-width) solid var(--border-color)',
                      color: 'var(--text-muted)',
                      background: 'transparent',
                      transition: 'var(--transition)',
                    }}
                    title="移除此模型"
                    aria-label="移除模型"
                  >
                    <IconClose className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* 第二行：模型选择 + 获取模型 */}
                <div className="flex items-center gap-2">
                  {availableModels.length > 0 ? (
                    <select
                      value={modelItem.model}
                      onChange={(e) => updateModel(modelItem.id, { model: e.target.value, name: e.target.value })}
                      className="theme-select flex-1 text-xs min-w-0"
                      style={{ padding: '6px 32px 6px 10px', height: '32px' }}
                      aria-label="模型"
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
                      style={{ padding: '6px 10px', height: '32px' }}
                      placeholder="模型名"
                      aria-label="模型名"
                    />
                  )}
                  <button
                    onClick={() => handleFetchModels(modelItem.id)}
                    disabled={isLoading}
                    className="theme-btn flex-shrink-0"
                    style={{
                      padding: '0 12px',
                      height: '32px',
                      fontSize: '11px',
                      whiteSpace: 'nowrap',
                      opacity: isLoading ? 0.5 : 1,
                    }}
                    title="从 API 获取可用模型列表"
                  >
                    {isLoading ? '加载中...' : '获取模型'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 对比结果区域 */}
      <div className="flex-1 overflow-hidden min-h-0">
        {enabledModels.length === 0 ? (
          <div className="h-full flex items-center justify-center px-4 text-center" style={{ color: 'var(--text-muted)' }}>
            请添加并启用至少一个模型
          </div>
        ) : (
          <div className="h-full flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
            {enabledModels.map((modelItem, idx) => {
              const runtime = runtimes.get(modelItem.id) || { status: 'idle' as ModelStatus }
              const session = getModelSession(modelItem)
              const messagesToShow = session?.messages || []
              return (
                <div
                  key={modelItem.id}
                  className={`flex-1 flex flex-col min-w-0 min-h-[40vh] md:min-h-0 ${idx > 0 ? 'compare-divider' : ''}`}
                >
                  {/* 模型标题栏 */}
                  <div
                    className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2"
                    style={{
                      borderBottom: 'var(--border-width) solid var(--border-color)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                        {modelItem.model}
                      </span>
                      {messagesToShow.length > 0 && (
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {Math.floor(messagesToShow.length / 2)} 轮
                        </span>
                      )}
                      {runtime.status === 'thinking' && (
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
                      {runtime.status === 'completed' && (
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
                      {runtime.status === 'error' && (
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
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {runtime.duration !== undefined && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{(runtime.duration / 1000).toFixed(1)}s</span>
                      )}
                      {runtime.status === 'thinking' && (
                        <button onClick={() => cancelModel(modelItem.id)} className="cursor-pointer w-7 h-7 flex items-center justify-center" title="取消" aria-label="取消">
                          <IconStop className="w-4 h-4" style={{ color: '#f87171' }} />
                        </button>
                      )}
                      {(runtime.status === 'error' || runtime.status === 'completed') && (
                        <button onClick={() => retryModel(modelItem.id)} className="cursor-pointer w-7 h-7 flex items-center justify-center" title="重新生成最后一条" aria-label="重试">
                          <IconRefresh className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        </button>
                      )}
                      {messagesToShow.length > 0 && runtime.status !== 'thinking' && (
                        <button onClick={() => handleClearModel(modelItem.id)} className="cursor-pointer w-7 h-7 flex items-center justify-center" title="清空此模型对话" aria-label="清空">
                          <IconClose className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* 内容 */}
                  <div
                    className="flex-1 p-3 sm:p-4 overflow-y-auto min-h-0 space-y-3"
                    ref={(el) => {
                      if (el) scrollRefs.current.set(modelItem.id, el)
                      else scrollRefs.current.delete(modelItem.id)
                    }}
                  >
                    {messagesToShow.length === 0 && runtime.status === 'idle' && (
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>等待输入...</div>
                    )}
                    {messagesToShow.map((msg) => (
                      <div
                        key={msg.id}
                        className={msg.role === 'user' ? 'theme-message-user' : 'theme-message-assistant'}
                        style={{ padding: '10px 12px', fontSize: '13px' }}
                      >
                        <div
                          className="text-xs font-bold mb-1"
                          style={{ color: msg.role === 'user' ? 'var(--accent-1)' : 'var(--accent-3)', fontFamily: 'var(--font-heading)' }}
                        >
                          {msg.role === 'user' ? '你' : modelItem.model}
                        </div>
                        {msg.content ? (
                          <div className="prose-chat" style={{ fontSize: '13px' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        ) : runtime.status === 'thinking' && msg.id === runtime.currentAssistantId ? (
                          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                            <div
                              className="w-3 h-3 rounded-full animate-spin"
                              style={{ border: '2px solid var(--accent-1)', borderTopColor: 'transparent' }}
                            />
                            <span className="text-xs">生成中...</span>
                          </div>
                        ) : (
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>(空)</div>
                        )}
                      </div>
                    ))}
                    {runtime.status === 'error' && messagesToShow.length === 0 && (
                      <div className="text-sm" style={{ color: '#f87171' }}>{runtime.error}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="p-3 sm:p-4" style={{ borderTop: 'var(--border-width) solid var(--border-color)' }}>
        <div className="flex items-end gap-2 sm:gap-3 max-w-4xl mx-auto">
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
              className="theme-btn flex-shrink-0"
              style={{ padding: 0, width: '44px', height: '44px', background: 'rgba(248, 113, 113, 0.15)', borderColor: '#f87171' }}
              title="全部停止"
            >
              <IconStop className="w-5 h-5" style={{ color: '#f87171' }} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="theme-btn theme-btn-primary flex-shrink-0"
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
