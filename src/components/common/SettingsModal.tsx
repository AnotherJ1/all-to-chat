import { useState } from 'react'
import { useConfigStore } from '../../stores/configStore'
import { fetchModelList } from '../../api/openai'
import { IconClose } from './Icons'
import type { Protocol } from '../../types'

const PROTOCOLS: { value: Protocol; label: string; icon: string }[] = [
  { value: 'openai', label: 'OpenAI', icon: '○' },
  { value: 'anthropic', label: 'Anthropic', icon: '◈' },
  { value: 'gemini', label: 'Gemini', icon: '◇' },
]

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

/**
 * API 配置设置弹窗
 * 从旧 Header.tsx 迁移而来，支持协议切换、API Key/Base URL/模型配置、配置保存与加载。
 */
export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const {
    protocol,
    setProtocol,
    getCurrentConfig,
    savedConfigs,
    activeConfigId,
    saveConfig,
    deleteConfig,
    loadConfig,
    getConfigsByProtocol,
  } = useConfigStore()

  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [configName, setConfigName] = useState('')
  const [activeTab, setActiveTab] = useState<'config' | 'saved'>('config')
  const [showModelList, setShowModelList] = useState(false)

  const currentConfig = getCurrentConfig()
  const protocolSavedConfigs = getConfigsByProtocol(protocol)

  if (!open) return null

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50"
        style={{ backdropFilter: 'blur(8px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          border: 'var(--border-width) solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="API 配置"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6" style={{ borderBottom: 'var(--border-width) solid var(--border-color)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>API 配置</h2>
          <button
            onClick={onClose}
            className="theme-btn"
            style={{ padding: 0, width: '32px', height: '32px' }}
            aria-label="关闭"
          >
            <IconClose className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-3 sm:p-4" style={{ borderBottom: 'var(--border-width) solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-2.5 px-3 sm:px-4 text-sm font-semibold cursor-pointer ${activeTab === 'config' ? 'theme-btn theme-btn-primary' : 'theme-btn'}`}
          >
            当前配置
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-2.5 px-3 sm:px-4 text-sm font-semibold cursor-pointer ${activeTab === 'saved' ? 'theme-btn theme-btn-primary' : 'theme-btn'}`}
          >
            <span className="hidden sm:inline">保存的配置 </span>
            <span className="sm:hidden">已保存 </span>
            ({savedConfigs.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6" onClick={() => setShowModelList(false)}>
          {activeTab === 'config' ? (
            <div className="space-y-6">
              {/* Protocol Selector */}
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>协议</label>
                <div className="grid grid-cols-3 gap-3">
                  {PROTOCOLS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setProtocol(p.value)}
                      className={`py-4 px-4 text-sm font-semibold cursor-pointer ${protocol === p.value ? 'theme-btn theme-btn-primary' : 'theme-btn'}`}
                      style={{ flexDirection: 'column' }}
                    >
                      <span className="block text-xl mb-1">{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Base URL</label>
                <input
                  type="text"
                  value={currentConfig.baseUrl}
                  onChange={(e) => useConfigStore.getState().setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com"
                  className="theme-input"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>API Key</label>
                <input
                  type="password"
                  value={currentConfig.apiKey}
                  onChange={(e) => useConfigStore.getState().setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="theme-input"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>模型</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={currentConfig.model}
                      onChange={(e) => useConfigStore.getState().setModel(e.target.value)}
                      onFocus={() => models.length > 0 && setShowModelList(true)}
                      placeholder="输入模型名称"
                      className="theme-input"
                    />
                    {showModelList && models.length > 0 && (
                      <div
                        className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto"
                        style={{
                          background: 'var(--bg-surface)',
                          border: 'var(--border-width) solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          boxShadow: 'var(--shadow-lg)',
                        }}
                      >
                        {models.map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              useConfigStore.getState().setModel(m)
                              setShowModelList(false)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm cursor-pointer"
                            style={{
                              color: currentConfig.model === m ? 'var(--accent-1)' : 'var(--text-primary)',
                              background: currentConfig.model === m ? 'color-mix(in srgb, var(--accent-1) 10%, transparent)' : 'transparent',
                              transition: 'var(--transition)',
                            }}
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
                    className="theme-btn"
                    style={{ whiteSpace: 'nowrap', opacity: (loadingModels || !currentConfig.apiKey) ? 0.5 : 1 }}
                  >
                    {loadingModels ? '加载中...' : '获取模型'}
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                {showSaveInput ? (
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <input
                      type="text"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      placeholder="输入配置名称"
                      className="theme-input flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveConfig()}
                      autoFocus
                    />
                    <div className="flex gap-2 sm:gap-3">
                      <button onClick={handleSaveConfig} className="theme-btn theme-btn-primary flex-1 sm:flex-initial">
                        保存
                      </button>
                      <button
                        onClick={() => { setShowSaveInput(false); setConfigName('') }}
                        className="theme-btn flex-1 sm:flex-initial"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSaveInput(true)}
                    className="w-full py-3 text-sm cursor-pointer theme-btn"
                    style={{ borderStyle: 'dashed' }}
                  >
                    + 保存当前配置
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {protocolSavedConfigs.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  暂无保存的 {PROTOCOLS.find(p => p.value === protocol)?.label} 配置
                </div>
              ) : (
                protocolSavedConfigs.map((sc) => (
                  <div
                    key={sc.id}
                    className="theme-card"
                    style={{
                      padding: '16px',
                      cursor: 'default',
                      borderColor: activeConfigId === sc.id ? 'var(--accent-1)' : 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{sc.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {PROTOCOLS.find(p => p.value === sc.protocol)?.label} ·{' '}
                          {new Date(sc.createdAt).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => { loadConfig(sc.id); setActiveTab('config') }}
                          className="theme-btn"
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                        >
                          加载
                        </button>
                        <button
                          onClick={() => deleteConfig(sc.id)}
                          className="theme-btn"
                          style={{ padding: '4px 12px', fontSize: '12px', color: '#ef4444' }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <div className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{sc.config.baseUrl}</div>
                    <div className="text-sm truncate mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>模型: {sc.config.model}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
