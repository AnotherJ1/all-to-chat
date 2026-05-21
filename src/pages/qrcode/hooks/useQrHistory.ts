/**
 * 二维码历史记录 Hook
 *
 * - localStorage 持久化（key: qrcode_history_v1）
 * - 同 text+options 去重，重复时仅刷新 createdAt 并提到顶端
 * - 最多保留 20 条，超过淘汰最旧
 * - SSR 安全（typeof window 检查）
 * - restore(item) 把整条历史恢复到 generator
 *
 * 用法（lead 在 QrCodePage 中挂载）：
 *   const history = useQrHistory()
 *   history.addItem(text, { size, fgColor, bgColor, errorLevel })
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { QrGenOptions, QrHistoryItem } from '../types'

/** localStorage key（版本化便于以后升级 schema） */
export const HISTORY_STORAGE_KEY = 'qrcode_history_v1'
/** 历史记录最大保留条数 */
export const HISTORY_MAX_ITEMS = 20

/** 是否在浏览器环境（SSR 安全） */
function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/** 生成稳定签名用于去重：仅取核心可序列化字段 */
function buildSignature(text: string, options: QrGenOptions): string {
  // 仅核心字段参与签名，避免 logoDataUrl 这类大字段污染（实际也不会进 history）
  const norm = {
    text,
    size: options.size,
    fgColor: options.fgColor,
    bgColor: options.bgColor,
    errorLevel: options.errorLevel,
    dotStyle: options.dotStyle ?? null,
    gradient: options.gradient ?? null,
  }
  return JSON.stringify(norm)
}

/** 从 localStorage 安全读取，损坏数据自动清空 */
function loadFromStorage(): QrHistoryItem[] {
  if (!hasWindow()) return []
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // 简单字段校验，过滤掉异常项
    return parsed.filter(
      (it): it is QrHistoryItem =>
        it &&
        typeof it.id === 'string' &&
        typeof it.text === 'string' &&
        typeof it.createdAt === 'number' &&
        it.options &&
        typeof it.options === 'object',
    )
  } catch {
    // 解析失败，主动清掉
    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY)
    } catch {
      // 忽略
    }
    return []
  }
}

/** 写入 localStorage，配额超限静默吞掉 */
function saveToStorage(items: QrHistoryItem[]): void {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // 配额满或隐私模式：忽略
  }
}

/** 生成唯一 id（不依赖 crypto.randomUUID，兼容老浏览器） */
function genId(): string {
  return `qrh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export interface UseQrHistoryReturn {
  history: QrHistoryItem[]
  /** 新增一条；同 text+options 不重复，仅刷新 createdAt 排到顶端 */
  addItem: (text: string, options: QrGenOptions) => void
  /** 按 id 删除 */
  removeItem: (id: string) => void
  /** 清空全部 */
  clearAll: () => void
  /** 取出指定 id 的一条（不修改顺序），用于 restore 前的查询 */
  restore: (id: string) => QrHistoryItem | null
}

/**
 * 二维码历史记录 Hook
 *
 * 持久化策略：把 saveToStorage 放在 effect 中，对 history 状态变化做依赖驱动写入，
 * 避免在 setState updater 内同步写 localStorage 与外部同步代码竞争（修复批处理下
 * clearAll → addItem 顺序倒置导致 storage 被旧 updater 覆盖的问题）。
 */
export function useQrHistory(): UseQrHistoryReturn {
  const [history, setHistory] = useState<QrHistoryItem[]>(() => loadFromStorage())

  /** 标记是否已挂载，避免初始挂载时把 loadFromStorage 的结果再写回去 */
  const mountedRef = useRef<boolean>(false)

  // 持久化：history 变化即写入 localStorage
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    saveToStorage(history)
  }, [history])

  // 跨标签页同步：监听 storage 事件
  useEffect(() => {
    if (!hasWindow()) return
    const handler = (e: StorageEvent) => {
      if (e.key !== HISTORY_STORAGE_KEY) return
      setHistory(loadFromStorage())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  /** 新增/刷新一条 */
  const addItem = useCallback((text: string, options: QrGenOptions) => {
    if (!text || !text.trim()) return
    setHistory((prev) => {
      const sig = buildSignature(text, options)
      // 去掉同签名的旧记录
      const filtered = prev.filter(
        (it) => buildSignature(it.text, it.options) !== sig,
      )
      const next: QrHistoryItem = {
        id: genId(),
        text,
        // 历史不存 logoDataUrl（可能很大），仅保留核心选项
        options: {
          text,
          size: options.size,
          fgColor: options.fgColor,
          bgColor: options.bgColor,
          errorLevel: options.errorLevel,
          dotStyle: options.dotStyle,
          gradient: options.gradient,
        },
        createdAt: Date.now(),
      }
      return [next, ...filtered].slice(0, HISTORY_MAX_ITEMS)
    })
  }, [])

  /** 删除一条 */
  const removeItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((it) => it.id !== id))
  }, [])

  /** 全部清空 */
  const clearAll = useCallback(() => {
    setHistory([])
  }, [])

  /** 查询单条 */
  const restore = useCallback(
    (id: string): QrHistoryItem | null => {
      return history.find((it) => it.id === id) ?? null
    },
    [history],
  )

  return { history, addItem, removeItem, clearAll, restore }
}
