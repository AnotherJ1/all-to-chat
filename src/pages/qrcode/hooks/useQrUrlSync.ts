/**
 * URL 状态同步 Hook
 *
 * - 把 generator 的核心参数（text/size/fgColor/bgColor/errorLevel）
 *   同步到 URL query string，便于直接分享当前配置
 * - 防抖 500ms，避免高频改色频繁 history.replaceState
 * - 不同步 logo（dataURL 太长，会让 URL 撑爆）
 * - 进入页面时 readInitialFromUrl() 一次性读取初始值（在 useState 初始化时使用）
 *
 * 由 lead 在 QrCodePage 内调用：
 *   useQrUrlSync(generator)
 */
import { useEffect, useRef } from 'react'
import {
  paramsToQueryString,
  queryStringToParams,
  isValidHexColor,
} from '../utils/qrUtils'
import type { QrErrorLevel } from '../types'

/** URL 同步的字段，与 useQrGenerator 暴露的同名 setter 一一对应 */
export interface QrUrlState {
  text: string
  size: number
  fgColor: string
  bgColor: string
  errorLevel: QrErrorLevel
}

/** generator 形状（仅取本 hook 关心的部分），与 UseQrGeneratorReturn 兼容 */
export interface QrUrlSyncTarget extends QrUrlState {
  setText: (v: string) => void
  setSize: (v: number) => void
  setFgColor: (v: string) => void
  setBgColor: (v: string) => void
  setErrorLevel: (v: QrErrorLevel) => void
}

/** 防抖延迟：500ms */
const DEBOUNCE_MS = 500
/** URL 中 text 长度上限，避免某些浏览器/服务器对超长 URL 截断 */
const MAX_TEXT_IN_URL = 2000

/**
 * 从当前 URL 读取初始状态（仅返回出现的字段，调用方可与默认值合并）
 * 适合在组件外作为 useQrGenerator 的初始值参考。
 */
export function readInitialFromUrl(): Partial<QrUrlState> {
  if (typeof window === 'undefined') return {}
  try {
    const qs = queryStringToParams(window.location.search)
    const out: Partial<QrUrlState> = {}
    if (typeof qs.text === 'string' && qs.text.length > 0) {
      out.text = qs.text
    }
    if (typeof qs.size === 'string') {
      const n = Number(qs.size)
      if (Number.isFinite(n) && n >= 64 && n <= 1024) out.size = Math.round(n)
    }
    if (typeof qs.fg === 'string' && isValidHexColor(qs.fg)) {
      out.fgColor = qs.fg
    }
    if (typeof qs.bg === 'string' && isValidHexColor(qs.bg)) {
      out.bgColor = qs.bg
    }
    if (qs.ec === 'L' || qs.ec === 'M' || qs.ec === 'Q' || qs.ec === 'H') {
      out.errorLevel = qs.ec
    }
    return out
  } catch {
    return {}
  }
}

/**
 * URL 同步副作用：监听 generator 状态变化，防抖写回 URL（不刷新页面）
 */
export function useQrUrlSync(target: QrUrlSyncTarget): void {
  const { text, size, fgColor, bgColor, errorLevel } = target
  /** 防抖句柄 */
  const timerRef = useRef<number | null>(null)
  /** 标记首次渲染，避免初次进入就 replaceState 干扰用户 URL */
  const initRef = useRef<boolean>(false)

  useEffect(() => {
    // 首次渲染只记录，不写 URL
    if (!initRef.current) {
      initRef.current = true
      return
    }
    if (typeof window === 'undefined') return

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      try {
        // text 过长时不写入 URL，但保留其它参数
        const safeText = text.length > MAX_TEXT_IN_URL ? '' : text
        const qs = paramsToQueryString({
          text: safeText,
          size,
          fg: fgColor,
          bg: bgColor,
          ec: errorLevel,
        })
        const url = qs
          ? `${window.location.pathname}?${qs}${window.location.hash}`
          : `${window.location.pathname}${window.location.hash}`
        window.history.replaceState(null, '', url)
      } catch {
        // 同步失败不阻塞 UI
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [text, size, fgColor, bgColor, errorLevel])
}
