/**
 * 二维码生成 Hook
 *
 * 集中管理：
 * - 文本/尺寸/颜色/容错等级/Logo 状态
 * - canvas 渲染（处理竞态、空文本、Logo 容错等级回退）
 * - SVG 字符串生成（worker-4 SVG 导出会复用）
 * - 下载 PNG / SVG、复制 Base64、复制图片到剪贴板（带降级）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from '../../../stores/toastStore'
import type { QrErrorLevel } from '../types'
import { readFileAsDataURL } from '../utils/qrUtils'

export interface UseQrGeneratorReturn {
  // 状态
  text: string
  size: number
  fgColor: string
  bgColor: string
  errorLevel: QrErrorLevel
  logoDataUrl: string
  svgString: string

  // setter
  setText: (v: string) => void
  setSize: (v: number) => void
  setFgColor: (v: string) => void
  setBgColor: (v: string) => void
  setErrorLevel: (v: QrErrorLevel) => void

  // refs
  canvasRef: React.RefObject<HTMLCanvasElement>

  // 操作
  setLogoFile: (file: File | null) => Promise<void>
  clearLogo: () => void
  downloadPng: () => void
  downloadSvg: () => void
  copyImageToClipboard: () => Promise<void>
  copyBase64: () => Promise<void>
}

const DEFAULT_TEXT = typeof window !== 'undefined' ? window.location.href : 'https://github.com'

/**
 * 二维码生成核心 Hook
 */
export function useQrGenerator(): UseQrGeneratorReturn {
  const [text, setText] = useState<string>(DEFAULT_TEXT)
  const [size, setSize] = useState<number>(256)
  const [fgColor, setFgColor] = useState<string>('#000000')
  const [bgColor, setBgColor] = useState<string>('#ffffff')
  const [errorLevel, setErrorLevel] = useState<QrErrorLevel>('M')
  const [logoDataUrl, setLogoDataUrl] = useState<string>('')
  const [svgString, setSvgString] = useState<string>('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** 记录用户在上传 Logo 之前选择的容错等级，移除 Logo 后恢复（修复 Bug #6） */
  const errorLevelBeforeLogoRef = useRef<QrErrorLevel | null>(null)

  // 渲染二维码（修复 Bug #4 竞态、Bug #5 空文本不绘制）
  useEffect(() => {
    let active = true

    const draw = async () => {
      const canvas = canvasRef.current
      if (!canvas) return

      // jsdom / 老浏览器下没有 2D 上下文，跳过避免抛错
      const ctxTest = canvas.getContext ? canvas.getContext('2d') : null
      if (!ctxTest) return

      // Bug #5：空文本不再用空格占位绘制；同时清空画布与 svgString
      if (!text || !text.trim()) {
        try {
          canvas.width = size
          canvas.height = size
          ctxTest.clearRect(0, 0, canvas.width, canvas.height)
        } catch {
          // 忽略
        }
        if (active) setSvgString('')
        return
      }

      try {
        await QRCode.toCanvas(canvas, text, {
          width: size,
          margin: 2,
          color: { dark: fgColor, light: bgColor },
          errorCorrectionLevel: errorLevel,
        })

        if (!active) return

        // 渲染 Logo（已转 dataURL，不需要 createObjectURL）
        if (logoDataUrl) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            const img = new Image()
            img.src = logoDataUrl
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve()
              img.onerror = () => reject(new Error('Logo 加载失败'))
            })
            if (!active) return

            const logoSize = size * 0.15
            const x = (size - logoSize) / 2
            const y = (size - logoSize) / 2
            const padding = 3
            ctx.fillStyle = bgColor
            ctx.fillRect(x - padding, y - padding, logoSize + padding * 2, logoSize + padding * 2)
            ctx.drawImage(img, x, y, logoSize, logoSize)
          }
        }

        // 同步生成 SVG 字符串供 SVG 导出使用
        try {
          const svg = await QRCode.toString(text, {
            type: 'svg',
            width: size,
            margin: 2,
            color: { dark: fgColor, light: bgColor },
            errorCorrectionLevel: errorLevel,
          })
          if (active) setSvgString(svg)
        } catch {
          if (active) setSvgString('')
        }
      } catch (err) {
        // 渲染失败仅记录，不阻塞 UI
        console.error('[useQrGenerator] 渲染失败:', err)
      }
    }

    draw()

    return () => {
      active = false
    }
  }, [text, size, fgColor, bgColor, errorLevel, logoDataUrl])

  /** 设置 Logo 文件（内部转 dataURL；传 null 表示清除） */
  const setLogoFile = useCallback(async (file: File | null): Promise<void> => {
    if (!file) {
      setLogoDataUrl('')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('请选择有效的图片文件')
      return
    }
    try {
      const dataUrl = await readFileAsDataURL(file)
      // 记录用户上传 Logo 之前的容错等级（修复 Bug #6）
      setErrorLevel((prev) => {
        errorLevelBeforeLogoRef.current = prev
        return 'H'
      })
      setLogoDataUrl(dataUrl)
      toast.success('已嵌入 Logo，已自动调整为最高 H 级容错率以保证识别率')
    } catch {
      toast.error('Logo 读取失败')
    }
  }, [])

  /** 清除 Logo，并把容错等级恢复为上传前的值 */
  const clearLogo = useCallback(() => {
    setLogoDataUrl('')
    if (errorLevelBeforeLogoRef.current) {
      setErrorLevel(errorLevelBeforeLogoRef.current)
      errorLevelBeforeLogoRef.current = null
    }
  }, [])

  /** 下载 PNG */
  const downloadPng = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `qrcode_${Date.now()}.png`
      link.href = dataUrl
      link.click()
      toast.success('已开始下载 PNG')
    } catch {
      toast.error('下载失败')
    }
  }, [])

  /** 下载 SVG（无 Logo，矢量） */
  const downloadSvg = useCallback(() => {
    if (!svgString) {
      toast.error('当前没有可导出的 SVG')
      return
    }
    try {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `qrcode_${Date.now()}.svg`
      link.href = url
      link.click()
      // 释放 ObjectURL
      setTimeout(() => URL.revokeObjectURL(url), 0)
      toast.success('已开始下载 SVG')
    } catch {
      toast.error('SVG 导出失败')
    }
  }, [svgString])

  /** 复制 Base64 到剪贴板 */
  const copyBase64 = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const dataUrl = canvas.toDataURL('image/png')
      await navigator.clipboard.writeText(dataUrl)
      toast.success('已复制 Base64 地址')
    } catch {
      toast.error('复制失败')
    }
  }, [])

  /** 复制二维码图片到剪贴板，ClipboardItem 不可用时降级为复制 Base64（Bug #11） */
  const copyImageToClipboard = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 降级判断：旧浏览器或 Firefox 不支持 ClipboardItem
    const hasClipboardItem = typeof window !== 'undefined' && typeof window.ClipboardItem !== 'undefined'
    const hasClipboardWrite = typeof navigator !== 'undefined' && !!navigator.clipboard && typeof navigator.clipboard.write === 'function'

    if (!hasClipboardItem || !hasClipboardWrite) {
      // 降级：复制 Base64 文本，并提醒用户
      try {
        const dataUrl = canvas.toDataURL('image/png')
        await navigator.clipboard.writeText(dataUrl)
        toast.warning('当前浏览器不支持复制图片，已退而复制 Base64 文本')
      } catch {
        toast.error('当前浏览器不支持复制图片，且降级复制 Base64 也失败')
      }
      return
    }

    await new Promise<void>((resolve) => {
      try {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            toast.error('生成图片数据失败')
            resolve()
            return
          }
          try {
            await navigator.clipboard.write([
              new window.ClipboardItem({ [blob.type]: blob }),
            ])
            toast.success('二维码图片已成功复制到剪贴板')
          } catch (err) {
            console.error('[useQrGenerator] 复制图片失败:', err)
            // 二次降级：尝试 Base64
            try {
              const dataUrl = canvas.toDataURL('image/png')
              await navigator.clipboard.writeText(dataUrl)
              toast.warning('复制图片失败，已退而复制 Base64 文本')
            } catch {
              toast.error('复制图片失败')
            }
          } finally {
            resolve()
          }
        }, 'image/png')
      } catch {
        toast.error('复制图片出错')
        resolve()
      }
    })
  }, [])

  return {
    text,
    size,
    fgColor,
    bgColor,
    errorLevel,
    logoDataUrl,
    svgString,
    setText,
    setSize,
    setFgColor,
    setBgColor,
    setErrorLevel,
    canvasRef,
    setLogoFile,
    clearLogo,
    downloadPng,
    downloadSvg,
    copyImageToClipboard,
    copyBase64,
  }
}
