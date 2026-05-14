import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Protocol } from '../types'
import { uuid } from '../lib/uuid'

// 多模型配置
export interface MultiModelConfig {
  id: string
  name: string
  protocol: Protocol
  baseUrl: string
  apiKey: string
  model: string
  enabled: boolean
}

// 多模型状态
interface MultiModelState {
  models: MultiModelConfig[]
  addModel: (config: Omit<MultiModelConfig, 'id'>) => void
  updateModel: (id: string, config: Partial<MultiModelConfig>) => void
  removeModel: (id: string) => void
  toggleModel: (id: string) => void
  getEnabledModels: () => MultiModelConfig[]
}

export const useMultiModelStore = create<MultiModelState>()(
  persist(
    (set, get) => ({
      models: [],

      addModel: (config) =>
        set((state) => ({
          models: [
            ...state.models,
            { ...config, id: uuid() },
          ],
        })),

      updateModel: (id, config) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id ? { ...m, ...config } : m
          ),
        })),

      removeModel: (id) =>
        set((state) => ({
          models: state.models.filter((m) => m.id !== id),
        })),

      toggleModel: (id) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id ? { ...m, enabled: !m.enabled } : m
          ),
        })),

      getEnabledModels: () => get().models.filter((m) => m.enabled),
    }),
    {
      name: 'multi-model-storage',
    }
  )
)
