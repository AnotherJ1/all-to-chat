import { useState } from 'react'
import { useConfigStore } from '../stores/configStore'
import { fetchModelList } from '../api/openai'
import { IconSun, IconMoon, IconSettings, IconClose } from './Icons'
import type { Protocol } from '../types'

const PROTOCOLS: { value: Protocol; label: string; icon: string }[] = [
  { value: 'openai', label: 'OpenAI', icon: '○' },
  { value: 'anthropic', label: 'Anthropic', icon: '◈' },
  { value: 'gemini', label: 'Gemini', icon: '◇' },
]

export default function Header() {
  const {
    protocol,
    theme,
    setProtocol,
    setTheme,
    getCurrentConfig,
    savedConfigs,
    activeConfigId,
    saveConfig,
    deleteConfig,
    loadConfig,
    getConfigsByProtocol,
  } = useConfigStore()

  const [showSettings, setShowSettings] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [configName, setConfigName] = useState('')
  const [activeTab, setActiveTab] = useState<'config' | 'saved'>('config')
  const [showModelList, setShowModelList] = useState(false)

  const currentConfig = getCurrentConfig()
  const protocolSavedConfigs = getConfigsByProtocol(protocol)

  const loadModels = async () => {
    const { baseUrl, apiKey } = currentConfig
    if (!apiKey || !baseUrl) return
    setLoadingModels(true)
    try {
      const list = await fetchModelList(baseUrl, apiKey)
      if (list.length > 0) {
        setModels(list)
        setShowModelList(true)
      }
    } catch {
      console.error('Failed to fetch models')
    } finally {
      setLoadingModels(false)
    }
  }

  const handleSaveConfig = () => {
    if (!configName.trim()) return
    saveConfig(configName.trim())
    setConfigName('')
    setShowSaveInput(false)
    setActiveTab('saved')
  }

  return (
    <>
      <header className="glass border-b border-[var(--border-color)] px-6 py-4 flex items-center justify-between relative z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 border border-cyan-400/30 flex items-center justify-center">
            <span className="text-cyan-400 text-lg font-bold">AI</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">AI Chat Hub</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {PROTOCOLS.find(p => p.value === protocol)?.label} · {currentConfig.model}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:bg-[var(--glass-bg-hover)] transition-all cursor-pointer"
            title="切换主题"
          >
            {theme === 'dark' ? (
              <IconSun className="w-5 h-5 text-[var(--text-secondary)]" />
            ) : (
              <IconMoon className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer glass hover:bg-[var(--glass-bg-hover)]"
            title="设置"
          >
            <IconSettings className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 dark:bg-black/70"
            style={{ backdropFilter: 'blur(8px)' }}
            onClick={() => setShowSettings(false)}
            aria-hidden="true"
          />
          <div
            className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl border border-[var(--border-color)] shadow-2xl"
            style={{ transform: 'none', background: 'var(--bg-primary)' }}
            role="dialog"
            aria-modal="true"
            aria-label="API 配置"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">API 配置</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 rounded-lg hover:bg-[var(--glass-bg-hover)] flex items-center justify-center cursor-pointer transition-colors"
              >
                <IconClose className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-4 border-b border-[var(--border-color)] bg-[var(--glass-bg)]">
              <button
                onClick={() => setActiveTab('config')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'config'
                    ? 'bg-gradient-to-br from-cyan-400/25 to-purple-500/25 text-cyan-400'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                当前配置
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'saved'
                    ? 'bg-gradient-to-br from-cyan-400/25 to-purple-500/25 text-cyan-400'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                保存的配置 ({savedConfigs.length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-aurora" onClick={() => setShowModelList(false)}>
              {activeTab === 'config' ? (
                <div className="space-y-6">
                  {/* Protocol Selector */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">协议</label>
                    <div className="grid grid-cols-3 gap-3">
                      {PROTOCOLS.map((p) => (
                        <button
                          key={p.value}
                          onClick={() => setProtocol(p.value)}
                          className={`py-4 px-4 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                            protocol === p.value
                              ? 'bg-gradient-to-br from-cyan-400/25 to-purple-500/25 border border-cyan-400/40 text-cyan-400'
                              : 'border border-[var(--border-color)] hover:border-[var(--border-hover)]'
                          }`}
                        >
                          <span className="block text-xl mb-1">{p.icon}</span>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Base URL */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Base URL</label>
                    <input
                      type="text"
                      value={currentConfig.baseUrl}
                      onChange={(e) => useConfigStore.getState().setBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com"
                      className="input-aurora"
                    />
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">API Key</label>
                    <input
                      type="password"
                      value={currentConfig.apiKey}
                      onChange={(e) => useConfigStore.getState().setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="input-aurora"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">模型</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={currentConfig.model}
                          onChange={(e) => useConfigStore.getState().setModel(e.target.value)}
                          onFocus={() => models.length > 0 && setShowModelList(true)}
                          placeholder="输入模型名称"
                          className="input-aurora"
                        />
                        {showModelList && models.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded-xl border border-[var(--border-color)] shadow-lg scrollbar-aurora" style={{ background: 'var(--bg-primary)' }}>
                            {models.map((m) => (
                              <button
                                key={m}
                                onClick={() => {
                                  useConfigStore.getState().setModel(m)
                                  setShowModelList(false)
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer hover:bg-[var(--glass-bg-hover)] ${
                                  currentConfig.model === m ? 'text-cyan-400 bg-cyan-400/5' : 'text-[var(--text-primary)]'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={loadModels}
                        disabled={loadingModels || !currentConfig.apiKey}
                        className="btn-aurora text-xs py-2.5 px-3 whitespace-nowrap disabled:opacity-50"
                      >
                        {loadingModels ? '加载中...' : '获取模型'}
                      </button>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-2">
                    {showSaveInput ? (
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={configName}
                          onChange={(e) => setConfigName(e.target.value)}
                          placeholder="输入配置名称"
                          className="input-aurora flex-1"
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveConfig()}
                          autoFocus
                        />
                        <button onClick={handleSaveConfig} className="btn-aurora btn-aurora-primary px-6">
                          保存
                        </button>
                        <button
                          onClick={() => { setShowSaveInput(false); setConfigName('') }}
                          className="btn-aurora px-4"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSaveInput(true)}
                        className="w-full py-3 rounded-xl border border-dashed border-[var(--border-hover)] text-[var(--text-muted)] text-sm hover:border-cyan-400/40 hover:text-cyan-400/70 transition-all cursor-pointer"
                      >
                        + 保存当前配置
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {protocolSavedConfigs.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-muted)]">
                      暂无保存的 {PROTOCOLS.find(p => p.value === protocol)?.label} 配置
                    </div>
                  ) : (
                    protocolSavedConfigs.map((sc) => (
                      <div
                        key={sc.id}
                        className={`p-4 rounded-xl border transition-colors ${
                          activeConfigId === sc.id
                            ? 'bg-cyan-400/10 border-cyan-400/30'
                            : 'border-[var(--border-color)] hover:border-[var(--border-hover)]'
                        }`}
                        style={{ transform: 'none' }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-[var(--text-primary)] font-medium">{sc.name}</div>
                            <div className="text-[var(--text-muted)] text-xs mt-0.5">
                              {PROTOCOLS.find(p => p.value === sc.protocol)?.label} ·{' '}
                              {new Date(sc.createdAt).toLocaleDateString('zh-CN')}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { loadConfig(sc.id); setActiveTab('config') }}
                              className="px-4 py-1.5 rounded-lg text-sm border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-cyan-400 hover:border-cyan-400/30 transition-all cursor-pointer"
                            >
                              加载
                            </button>
                            <button
                              onClick={() => deleteConfig(sc.id)}
                              className="px-4 py-1.5 rounded-lg text-sm border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-400/30 transition-all cursor-pointer"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                        <div className="text-[var(--text-muted)] text-sm truncate">{sc.config.baseUrl}</div>
                        <div className="text-[var(--text-muted)] text-sm truncate mt-0.5 opacity-60">模型: {sc.config.model}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
