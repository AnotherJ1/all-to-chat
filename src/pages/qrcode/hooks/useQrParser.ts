/**
 * 二维码解析 Hook
 *
 * 集中管理：
 * - parseResult / parseError / previewUrl 状态
 * - decodeFile：先降采样防 OOM，再 jsQR 解析；try/catch getImageData
 * - onFileChange / onDrop / onPaste 事件
 * - 修复：
 *   - Bug #1：onFileChange 末尾清空 input value
 *   - Bug #2：超大图先降采样
 *   - Bug #7：previewUrl 替换前先 revokeObjectURL；卸载时 revoke
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { toast } from '../../../stores/toastStore'
import { downscaleImage, safeRevoke } from '../utils/qrUtils'
import type { QrLocation } from '../types'

export interface UseQrParserReturn {
  parseResult: string
  parseError: string
  previewUrl: string
  /** jsQR 解析的 4 个角点位置（P2 元数据可视化用） */
  parseLocation: QrLocation | null

  fileInputRef: React.RefObject<HTMLInputElement>

  /** 选择文件 input 的 onChange */
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** 拖拽 onDrop */
  onDrop: (e: React.DragEvent) => void
  /** 容器 onPaste */
  onPaste: (e: React.ClipboardEvent) => void
  /** 直接由 worker-2 摄像头扫码或 worker-5 批量解析等模块调用 */
  decodeFile: (file: File) => Promise<void>
  /** 主动清除预览（释放内存） */
  clearPreview: () => void
}

export function useQrParser(): UseQrParserReturn {
  const [parseResult, setParseResult] = useState<string>('')
  const [parseError, setParseError] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [parseLocation, setParseLocation] = useState<QrLocation | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  /** 持有当前 previewUrl 的引用，用于切换 / 卸载时 revoke（修复 Bug #7） */
  const previewUrlRef = useRef<string>('')

  // 卸载时释放最后一次的 previewUrl
  useEffect(() => {
    return () => {
      safeRevoke(previewUrlRef.current)
      previewUrlRef.current = ''
    }
  }, [])

  /** 设置预览，并把上一次的 ObjectURL 安全释放 */
  const updatePreview = useCallback((file: File | null) => {
    safeRevoke(previewUrlRef.current)
    if (!file) {
      previewUrlRef.current = ''
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPreviewUrl(url)
  }, [])

  /**
   * 解析图片文件 —— 公共入口
   * worker-2 摄像头帧、worker-5 批量解析等都可调用
   */
  const decodeFile = useCallback(async (file: File): Promise<void> => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片格式文件')
      setParseError('请选择图片格式文件')
      return
    }

    updatePreview(file)

    try {
      // Bug #2：先降采样到最大边 1600px
      const canvas = await downscaleImage(file, 1600)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setParseResult('')
        setParseError('当前环境不支持 Canvas 2D 上下文')
        setParseLocation(null)
        toast.error('当前环境不支持 Canvas 2D 上下文')
        return
      }

      let imageData: ImageData
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      } catch (err) {
        console.error('[useQrParser] getImageData 失败:', err)
        setParseResult('')
        setParseError('图片读取失败（可能因尺寸过大或格式不支持）')
        setParseLocation(null)
        toast.error('图片读取失败')
        return
      }

      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        setParseResult(code.data)
        setParseError('')
        setParseLocation(code.location ?? null)
        toast.success('解析成功')
      } else {
        setParseResult('')
        setParseError('未能在图片中识别出二维码')
        setParseLocation(null)
        toast.error('未识别到二维码')
      }
    } catch (err) {
      console.error('[useQrParser] 解析异常:', err)
      setParseResult('')
      setParseError(err instanceof Error ? err.message : '图片加载失败，请重试')
      setParseLocation(null)
      toast.error('图片加载失败')
    }
  }, [updatePreview])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void decodeFile(file)
    }
    // Bug #1：重置 input.value，使同名文件再次选择仍能触发 change
    e.target.value = ''
  }, [decodeFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void decodeFile(file)
    }
  }, [decodeFile])

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile()
        if (file) {
          void decodeFile(file)
          break
        }
      }
    }
  }, [decodeFile])

  const clearPreview = useCallback(() => {
    safeRevoke(previewUrlRef.current)
    previewUrlRef.current = ''
    setPreviewUrl('')
    setParseResult('')
    setParseError('')
    setParseLocation(null)
  }, [])

  return {
    parseResult,
    parseError,
    previewUrl,
    parseLocation,
    fileInputRef,
    onFileChange,
    onDrop,
    onPaste,
    decodeFile,
    clearPreview,
  }
}
