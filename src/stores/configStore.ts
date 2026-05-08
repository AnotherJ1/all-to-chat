import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Protocol } from '../types'

// 单个协议的完整配置
export interface ProtocolConfig {
  baseUrl: string
  apiKey: string
  model: string
}

// 保存的命名配置
export interface SavedConfig {
  id: string
  name: string
  protocol: Protocol
  config: ProtocolConfig
  createdAt: number
}

interface ConfigState {
  protocol: Protocol
  theme: 'light' | 'dark'
  // 每个协议的当前配置
  configs: Record<Protocol, ProtocolConfig>
  // 保存的命名配置列表
  savedConfigs: SavedConfig[]
  // 当前激活的配置ID（null表示使用当前协议的手动配置）
  activeConfigId: string | null

  // 获取当前协议的完整URL
  getCompleteUrl: (path: string) => string
  setProtocol: (protocol: Protocol) => void
  setBaseUrl: (baseUrl: string) => void
  setApiKey: (apiKey: string) => void
  setModel: (model: string) => void
  setTheme: (theme: 'light' | 'dark') => void
  getCurrentConfig: () => ProtocolConfig

  // 配置管理
  saveConfig: (name: string) => void
  deleteConfig: (id: string) => void
  loadConfig: (id: string) => void
  getConfigsByProtocol: (protocol: Protocol) => SavedConfig[]
}

// 默认配置
const DEFAULT_CONFIGS: Record<Protocol, ProtocolConfig> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    apiKey: '',
    model: 'gpt-4o',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    model: 'claude-3-5-sonnet-latest',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: '',
    model: 'gemini-2.0-flash',
  },
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      protocol: 'openai',
      theme: 'dark',
      configs: { ...DEFAULT_CONFIGS },
      savedConfigs: [],
      activeConfigId: null,

      getCompleteUrl: (path: string) => {
        const { protocol, configs } = get()
        const baseUrl = configs[protocol].baseUrl.replace(/\/$/, '')
        if (path.startsWith('http')) return path
        return `${baseUrl}${path}`
      },

      setProtocol: (protocol) => set({ protocol, activeConfigId: null }),

      setBaseUrl: (baseUrl) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [state.protocol]: { ...state.configs[state.protocol], baseUrl },
          },
        })),

      setApiKey: (apiKey) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [state.protocol]: { ...state.configs[state.protocol], apiKey },
          },
        })),

      setModel: (model) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [state.protocol]: { ...state.configs[state.protocol], model },
          },
        })),

      setTheme: (theme) => set({ theme }),

      getCurrentConfig: () => {
        const { protocol, configs } = get()
        return configs[protocol]
      },

      // 保存当前配置为新命名配置
      saveConfig: (name) => {
        const { protocol, configs } = get()
        const newConfig: SavedConfig = {
          id: crypto.randomUUID(),
          name,
          protocol,
          config: { ...configs[protocol] },
          createdAt: Date.now(),
        }
        set((state) => ({
          savedConfigs: [...state.savedConfigs, newConfig],
          activeConfigId: newConfig.id,
        }))
      },

      // 删除命名配置
      deleteConfig: (id) =>
        set((state) => ({
          savedConfigs: state.savedConfigs.filter((c) => c.id !== id),
          activeConfigId: state.activeConfigId === id ? null : state.activeConfigId,
        })),

      // 加载命名配置到当前协议
      loadConfig: (id) => {
        const config = get().savedConfigs.find((c) => c.id === id)
        if (!config) return
        set((state) => ({
          protocol: config.protocol,
          configs: {
            ...state.configs,
            [config.protocol]: { ...config.config },
          },
          activeConfigId: id,
        }))
      },

      // 获取指定协议的所有保存配置
      getConfigsByProtocol: (protocol) => {
        return get().savedConfigs.filter((c) => c.protocol === protocol)
      },
    }),
    {
      name: 'config-storage',
    }
  )
)
