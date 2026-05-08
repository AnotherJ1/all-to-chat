import { useState, useEffect, useRef } from 'react'
import { useConfigStore } from '../stores/configStore'
import { fetchModelList } from '../api/openai'
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
  const settingsRef = useRef<HTMLDivElement>(null)

  const currentConfig = getCurrentConfig()
  const protocolSavedConfigs = getConfigsByProtocol(protocol)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        const settingsBtn = (e.target as Element).closest('[data-settings-btn]')
        if (!settingsBtn) {
          setShowSettings(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings])

  const loadModels = async () => {
    const { baseUrl, apiKey } = currentConfig
    if (!apiKey || !baseUrl) return
    setLoadingModels(true)
    try {
      const list = await fetchModelList(baseUrl, apiKey)
      if (list.length > 0) {
        setModels(list)
        const { model } = currentConfig
        const setModel = useConfigStore.getState().setModel
        if (!list.includes(model)) {
          setModel(list[0])
        }
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
      <header className="glass border-b border-white/10 px-6 py-4 flex items-center justify-between relative z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 border border-cyan-400/30 flex items-center justify-center">
            <span className="text-cyan-400 text-lg font-bold">AI</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">AI Chat Hub</h1>
            <p className="text-xs text-white/40">多协议 · 多模型 · 智能对话</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer"
            title="切换主题"
          >
            <span className="text-white/60">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>

          <button
            data-settings-btn
            onClick={() => setShowSettings(!showSettings)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              showSettings
                ? 'bg-gradient-to-br from-cyan-400/30 to-purple-500/30 border border-cyan-400/40'
                : 'glass hover:bg-white/10'
            }`}
            title="设置"
          >
            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {showSettings && (
        <div
          ref={settingsRef}
          className="fixed top-20 right-6 w-[420px] rounded-2xl overflow-hidden z-[100]"
          style={{
            background: 'rgba(15, 15, 30, 0.95)',
            backdropFilter: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">API 配置</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="text-white/60">×</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white/5">
              <button
                onClick={() => setActiveTab('config')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'config'
                    ? 'bg-gradient-to-br from-cyan-400/25 to-purple-500/25 text-cyan-400'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                当前配置
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'saved'
                    ? 'bg-gradient-to-br from-cyan-400/25 to-purple-500/25 text-cyan-400'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                保存的配置 ({savedConfigs.length})
              </button>
            </div>

            {activeTab === 'config' ? (
              <div className="space-y-4">
                {/* Protocol Selector */}
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">协议</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PROTOCOLS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setProtocol(p.value)}
                        className={`py-3 px-4 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                          protocol === p.value
                            ? 'bg-gradient-to-br from-cyan-400/25 to-purple-500/25 border border-cyan-400/40 text-cyan-400'
                            : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20'
                        }`}
                        style={{ backdropFilter: 'none' }}
                      >
                        <span className="block text-base mb-1">{p.icon}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Base URL</label>
                  <input
                    type="text"
                    value={currentConfig.baseUrl}
                    onChange={(e) => useConfigStore.getState().setBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition-all"
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">API Key</label>
                  <input
                    type="password"
                    value={currentConfig.apiKey}
                    onChange={(e) => useConfigStore.getState().setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition-all"
                  />
                </div>

                {/* Model */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white/60">模型</label>
                    <button
                      onClick={loadModels}
                      disabled={loadingModels || !currentConfig.apiKey}
                      className="text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {loadingModels ? '加载中...' : '刷新列表'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={currentConfig.model}
                    onChange={(e) => useConfigStore.getState().setModel(e.target.value)}
                    placeholder="输入或选择模型"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition-all"
                    list="model-suggestions"
                  />
                  {models.length > 0 && (
                    <datalist id="model-suggestions">
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </datalist>
                  )}
                </div>

                {/* Save Button */}
                <div className="pt-2">
                  {showSaveInput ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                        placeholder="输入配置名称"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-400/50 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveConfig()}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveConfig}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border border-cyan-400/40 text-cyan-400 text-sm font-medium hover:from-cyan-500/40 hover:to-purple-500/40 transition-all cursor-pointer"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => { setShowSaveInput(false); setConfigName('') }}
                        className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all cursor-pointer"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveInput(true)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-white/20 text-white/50 text-sm hover:border-cyan-400/40 hover:text-cyan-400/70 transition-all cursor-pointer"
                    >
                      + 保存当前配置
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {protocolSavedConfigs.length === 0 ? (
                  <div className="text-center py-8 text-white/40 text-sm">
                    暂无保存的 {PROTOCOLS.find(p => p.value === protocol)?.label} 配置
                  </div>
                ) : (
                  protocolSavedConfigs.map((sc) => (
                    <div
                      key={sc.id}
                      className={`p-4 rounded-xl border transition-all ${
                        activeConfigId === sc.id
                          ? 'bg-cyan-400/10 border-cyan-400/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-white font-medium text-sm">{sc.name}</div>
                          <div className="text-white/40 text-xs mt-0.5">
                            {PROTOCOLS.find(p => p.value === sc.protocol)?.label} ·{' '}
                            {new Date(sc.createdAt).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { loadConfig(sc.id); setActiveTab('config'); }}
                            className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white/70 hover:bg-cyan-400/20 hover:text-cyan-400 transition-all cursor-pointer"
                          >
                            加载
                          </button>
                          <button
                            onClick={() => deleteConfig(sc.id)}
                            className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      <div className="text-white/50 text-xs truncate">{sc.config.baseUrl}</div>
                      <div className="text-white/30 text-xs truncate mt-0.5">模型: {sc.config.model}</div>
                    </div>
                  ))
                )}

                {savedConfigs.length > 0 && protocolSavedConfigs.length === 0 && (
                  <div className="text-center py-4 text-white/30 text-xs">
                    其他协议的已保存配置在切换协议后可见
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
