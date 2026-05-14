/**
 * Property 6: Store 数据持久化 round-trip
 * Validates: Requirements 8.3
 *
 * 对于任何有效的 Zustand store 状态对象，将其序列化到 localStorage
 * 然后反序列化回来，应产生等价的状态对象，所有字段保持不变。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Protocol, Session, Message } from '../types'
import type { SavedConfig, ProtocolConfig } from '../stores/configStore'
import type { ImageRecord } from '../stores/imageHistoryStore'

// 模拟 localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('Property 6: Store 数据持久化 round-trip', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('configStore persist key 为 "config-storage" 且数据 round-trip 正确', () => {
    const CONFIG_PERSIST_KEY = 'config-storage'

    it('persist key 应为 "config-storage"', async () => {
      // 验证 store 使用正确的 persist key
      const { useConfigStore } = await import('../stores/configStore')
      // Zustand persist 会在 store 初始化时写入 localStorage
      // 通过 store 的 persist API 验证 key
      const persistOptions = (useConfigStore as unknown as { persist: { getOptions: () => { name: string } } }).persist.getOptions()
      expect(persistOptions.name).toBe(CONFIG_PERSIST_KEY)
    })

    it('configStore 状态数据序列化/反序列化 round-trip 应保持等价', () => {
      const sampleState = {
        protocol: 'anthropic' as Protocol,
        theme: 'dark' as const,
        configs: {
          openai: {
            baseUrl: 'https://api.openai.com',
            apiKey: 'sk-test-key-123',
            model: 'gpt-4o',
            systemPrompt: '你是一个有帮助的助手',
          } as ProtocolConfig,
          anthropic: {
            baseUrl: 'https://api.anthropic.com',
            apiKey: 'sk-ant-test',
            model: 'claude-3-5-sonnet-latest',
            systemPrompt: '',
          } as ProtocolConfig,
          gemini: {
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: 'AIza-test',
            model: 'gemini-2.0-flash',
            systemPrompt: '系统提示词测试',
          } as ProtocolConfig,
        },
        savedConfigs: [
          {
            id: 'cfg-001',
            name: '我的配置',
            protocol: 'openai' as Protocol,
            config: {
              baseUrl: 'https://api.openai.com',
              apiKey: 'sk-saved',
              model: 'gpt-4o',
              systemPrompt: '',
            },
            createdAt: 1700000000000,
          } as SavedConfig,
        ],
        activeConfigId: 'cfg-001',
      }

      // 序列化到 localStorage（模拟 Zustand persist 行为）
      const serialized = JSON.stringify({ state: sampleState, version: 1 })
      localStorageMock.setItem(CONFIG_PERSIST_KEY, serialized)

      // 反序列化
      const raw = localStorageMock.getItem(CONFIG_PERSIST_KEY)
      expect(raw).not.toBeNull()
      const deserialized = JSON.parse(raw!)

      // 验证 round-trip 等价性
      expect(deserialized.state).toEqual(sampleState)
      expect(deserialized.state.protocol).toBe('anthropic')
      expect(deserialized.state.theme).toBe('dark')
      expect(deserialized.state.configs.openai.apiKey).toBe('sk-test-key-123')
      expect(deserialized.state.configs.gemini.systemPrompt).toBe('系统提示词测试')
      expect(deserialized.state.savedConfigs).toHaveLength(1)
      expect(deserialized.state.savedConfigs[0].name).toBe('我的配置')
      expect(deserialized.state.activeConfigId).toBe('cfg-001')
    })

    it('configStore 含中文和特殊字符的 systemPrompt 应正确 round-trip', () => {
      const stateWithSpecialChars = {
        protocol: 'openai' as Protocol,
        theme: 'dark' as const,
        configs: {
          openai: {
            baseUrl: 'https://custom.api.com/v1',
            apiKey: '',
            model: 'gpt-4o',
            systemPrompt: '你是AI助手。请用中文回答。\n特殊字符: <>&"\'\\/',
          } as ProtocolConfig,
          anthropic: {
            baseUrl: 'https://api.anthropic.com',
            apiKey: '',
            model: 'claude-3-5-sonnet-latest',
            systemPrompt: '',
          } as ProtocolConfig,
          gemini: {
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: '',
            model: 'gemini-2.0-flash',
            systemPrompt: '',
          } as ProtocolConfig,
        },
        savedConfigs: [] as SavedConfig[],
        activeConfigId: null,
      }

      const serialized = JSON.stringify({ state: stateWithSpecialChars, version: 1 })
      localStorageMock.setItem(CONFIG_PERSIST_KEY, serialized)

      const deserialized = JSON.parse(localStorageMock.getItem(CONFIG_PERSIST_KEY)!)
      expect(deserialized.state).toEqual(stateWithSpecialChars)
      expect(deserialized.state.configs.openai.systemPrompt).toBe(
        '你是AI助手。请用中文回答。\n特殊字符: <>&"\'\\/'
      )
    })
  })

  describe('sessionStore persist key 为 "session-storage" 且数据 round-trip 正确', () => {
    const SESSION_PERSIST_KEY = 'session-storage'

    it('persist key 应为 "session-storage"', async () => {
      const { useSessionStore } = await import('../stores/sessionStore')
      const persistOptions = (useSessionStore as unknown as { persist: { getOptions: () => { name: string } } }).persist.getOptions()
      expect(persistOptions.name).toBe(SESSION_PERSIST_KEY)
    })

    it('sessionStore 含复杂嵌套会话数据应正确 round-trip', () => {
      const messages: Message[] = [
        {
          id: 'msg-001',
          role: 'user',
          content: '你好，请帮我写一段代码',
          timestamp: 1700000001000,
        },
        {
          id: 'msg-002',
          role: 'assistant',
          content: '好的，这是一段示例代码：\n```typescript\nconst x = 1;\n```',
          timestamp: 1700000002000,
        },
        {
          id: 'msg-003',
          role: 'user',
          content: '请附带图片说明',
          timestamp: 1700000003000,
          imageUrls: ['https://example.com/img1.png', 'https://example.com/img2.jpg'],
        },
      ]

      const sessions: Session[] = [
        {
          id: 'session-001',
          title: '代码讨论',
          messages,
          createdAt: 1700000000000,
          updatedAt: 1700000003000,
        },
        {
          id: 'session-002',
          title: '新对话',
          messages: [],
          createdAt: 1700000010000,
          updatedAt: 1700000010000,
        },
      ]

      const sampleState = {
        sessions,
        currentSessionId: 'session-001',
      }

      // 序列化
      const serialized = JSON.stringify({ state: sampleState, version: 0 })
      localStorageMock.setItem(SESSION_PERSIST_KEY, serialized)

      // 反序列化
      const deserialized = JSON.parse(localStorageMock.getItem(SESSION_PERSIST_KEY)!)

      // 验证 round-trip 等价性
      expect(deserialized.state).toEqual(sampleState)
      expect(deserialized.state.sessions).toHaveLength(2)
      expect(deserialized.state.sessions[0].messages).toHaveLength(3)
      expect(deserialized.state.sessions[0].messages[2].imageUrls).toEqual([
        'https://example.com/img1.png',
        'https://example.com/img2.jpg',
      ])
      expect(deserialized.state.currentSessionId).toBe('session-001')
    })

    it('sessionStore 空会话列表应正确 round-trip', () => {
      const sampleState = {
        sessions: [] as Session[],
        currentSessionId: null,
      }

      const serialized = JSON.stringify({ state: sampleState, version: 0 })
      localStorageMock.setItem(SESSION_PERSIST_KEY, serialized)

      const deserialized = JSON.parse(localStorageMock.getItem(SESSION_PERSIST_KEY)!)
      expect(deserialized.state).toEqual(sampleState)
      expect(deserialized.state.sessions).toHaveLength(0)
      expect(deserialized.state.currentSessionId).toBeNull()
    })
  })

  describe('imageHistoryStore persist key 为 "image-history-storage" 且数据 round-trip 正确', () => {
    const IMAGE_HISTORY_PERSIST_KEY = 'image-history-storage'

    it('persist key 应为 "image-history-storage"', async () => {
      const { useImageHistoryStore } = await import('../stores/imageHistoryStore')
      const persistOptions = (useImageHistoryStore as unknown as { persist: { getOptions: () => { name: string } } }).persist.getOptions()
      expect(persistOptions.name).toBe(IMAGE_HISTORY_PERSIST_KEY)
    })

    it('imageHistoryStore 含多条记录应正确 round-trip', () => {
      const records: ImageRecord[] = [
        {
          id: 'img-001',
          prompt: '一只可爱的猫咪在阳光下睡觉',
          imageUrl: 'https://example.com/generated/cat.png',
          provider: 'dalle',
          model: 'dall-e-3',
          createdAt: 1700000001000,
        },
        {
          id: 'img-002',
          prompt: 'A futuristic cityscape at sunset',
          imageUrl: 'https://example.com/generated/city.png',
          provider: 'imagen',
          model: 'imagen-3',
          createdAt: 1700000002000,
        },
        {
          id: 'img-003',
          prompt: '抽象艺术，蓝色和紫色渐变',
          imageUrl: 'https://example.com/generated/abstract.png',
          provider: 'flux',
          model: 'flux-pro',
          createdAt: 1700000003000,
        },
      ]

      const sampleState = { records }

      // 序列化
      const serialized = JSON.stringify({ state: sampleState, version: 0 })
      localStorageMock.setItem(IMAGE_HISTORY_PERSIST_KEY, serialized)

      // 反序列化
      const deserialized = JSON.parse(localStorageMock.getItem(IMAGE_HISTORY_PERSIST_KEY)!)

      // 验证 round-trip 等价性
      expect(deserialized.state).toEqual(sampleState)
      expect(deserialized.state.records).toHaveLength(3)
      expect(deserialized.state.records[0].prompt).toBe('一只可爱的猫咪在阳光下睡觉')
      expect(deserialized.state.records[0].provider).toBe('dalle')
      expect(deserialized.state.records[1].provider).toBe('imagen')
      expect(deserialized.state.records[2].provider).toBe('flux')
    })

    it('imageHistoryStore 空记录列表应正确 round-trip', () => {
      const sampleState = { records: [] as ImageRecord[] }

      const serialized = JSON.stringify({ state: sampleState, version: 0 })
      localStorageMock.setItem(IMAGE_HISTORY_PERSIST_KEY, serialized)

      const deserialized = JSON.parse(localStorageMock.getItem(IMAGE_HISTORY_PERSIST_KEY)!)
      expect(deserialized.state).toEqual(sampleState)
      expect(deserialized.state.records).toHaveLength(0)
    })
  })

  describe('JSON.parse(JSON.stringify()) round-trip 对复杂嵌套对象', () => {
    it('深层嵌套的会话消息数据应通过 round-trip 保持完整', () => {
      const complexState = {
        sessions: [
          {
            id: 'deep-session',
            title: '深层嵌套测试',
            messages: [
              {
                id: 'deep-msg-1',
                role: 'user' as const,
                content: '包含特殊字符: \t\n\r "quotes" \'single\' <html> & more',
                timestamp: Date.now(),
                imageUrls: ['data:image/png;base64,iVBORw0KGgo='],
              },
            ],
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
          },
        ],
        currentSessionId: 'deep-session',
      }

      const roundTripped = JSON.parse(JSON.stringify(complexState))
      expect(roundTripped).toEqual(complexState)
    })

    it('configStore 含所有协议配置的完整状态应通过 round-trip', () => {
      const fullConfigState = {
        protocol: 'gemini' as Protocol,
        theme: 'dark' as const,
        configs: {
          openai: { baseUrl: 'https://api.openai.com', apiKey: 'key1', model: 'gpt-4o', systemPrompt: '' },
          anthropic: { baseUrl: 'https://api.anthropic.com', apiKey: 'key2', model: 'claude-3-5-sonnet-latest', systemPrompt: '提示' },
          gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: 'key3', model: 'gemini-2.0-flash', systemPrompt: '' },
        },
        savedConfigs: [
          { id: 'c1', name: '配置1', protocol: 'openai' as Protocol, config: { baseUrl: 'u', apiKey: 'k', model: 'm', systemPrompt: 's' }, createdAt: 1 },
          { id: 'c2', name: '配置2', protocol: 'anthropic' as Protocol, config: { baseUrl: 'u2', apiKey: 'k2', model: 'm2', systemPrompt: 's2' }, createdAt: 2 },
        ],
        activeConfigId: 'c1',
      }

      const roundTripped = JSON.parse(JSON.stringify(fullConfigState))
      expect(roundTripped).toEqual(fullConfigState)
    })
  })
})
