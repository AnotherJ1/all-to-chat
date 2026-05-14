import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Protocol } from '../types'
import { uuid } from '../lib/uuid'

// 单个协议的完整配置
export interface ProtocolConfig {
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
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
  configs: Record<Protocol, ProtocolConfig>
  savedConfigs: SavedConfig[]
  activeConfigId: string | null

  setProtocol: (protocol: Protocol) => void
  setBaseUrl: (baseUrl: string) => void
  setApiKey: (apiKey: string) => void
  setModel: (model: string) => void
  setSystemPrompt: (prompt: string) => void
  setTheme: (theme: 'light' | 'dark') => void
  getCurrentConfig: () => ProtocolConfig

  saveConfig: (name: string) => void
  deleteConfig: (id: string) => void
  loadConfig: (id: string) => void
  getConfigsByProtocol: (protocol: Protocol) => SavedConfig[]
}

const DEFAULT_CONFIGS: Record<Protocol, ProtocolConfig> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    apiKey: '',
    model: 'gpt-4o',
    systemPrompt: '',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    model: 'claude-3-5-sonnet-latest',
    systemPrompt: '',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: '',
    model: 'gemini-2.0-flash',
    systemPrompt: '',
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

      setSystemPrompt: (systemPrompt) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [state.protocol]: { ...state.configs[state.protocol], systemPrompt },
          },
        })),

      setTheme: (theme) => set({ theme }),

      getCurrentConfig: () => {
        const { protocol, configs } = get()
        return configs[protocol]
      },

      saveConfig: (name) => {
        const { protocol, configs } = get()
        const newConfig: SavedConfig = {
          id: uuid(),
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

      deleteConfig: (id) =>
        set((state) => ({
          savedConfigs: state.savedConfigs.filter((c) => c.id !== id),
          activeConfigId: state.activeConfigId === id ? null : state.activeConfigId,
        })),

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

      getConfigsByProtocol: (protocol) => {
        return get().savedConfigs.filter((c) => c.protocol === protocol)
      },
    }),
    {
      name: 'config-storage',
      // 迁移: 旧版本没有 systemPrompt 字段
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>
        if (state && typeof state === 'object' && 'configs' in state) {
          const configs = state.configs as Record<string, Record<string, unknown>>
          for (const key of Object.keys(configs)) {
            if (!('systemPrompt' in configs[key])) {
              configs[key].systemPrompt = ''
            }
          }
        }
        return state as unknown as ConfigState
      },
      version: 1,
    }
  )
)
