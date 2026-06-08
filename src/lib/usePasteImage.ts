import { useEffect } from 'react'

/**
 * usePasteImage —— 全局监听 Ctrl/⌘ + V 粘贴图片
 *
 * 复用项目里已有的粘贴范式（见 SinglePane / Base64ImagePage / CollagePage）：
 * 在 window 上挂 paste 监听，从 clipboardData.items 里挑出 image/* 类型的文件。
 *
 * - onImages 回调收到本次粘贴的所有图片文件（通常 1 张，截图工具可能多张）
 * - 命中图片时调用 e.preventDefault()，避免把图片当文本粘进聚焦的输入框
 * - enabled=false 时不挂监听（如某些 tab 未激活时可关闭）
 *
 * 之所以监听 window 而非具体元素：这些工具页通常没有需要聚焦才能粘贴的语义，
 * 用户截图后直接 Ctrl+V 即可，无需先点中上传区。
 */
export function usePasteImage(
  onImages: (files: File[]) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        onImages(files)
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [onImages, enabled])
}
