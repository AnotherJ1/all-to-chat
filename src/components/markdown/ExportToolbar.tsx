import { useCallback, useState } from 'react'
import { IconCopy, IconDownload } from '../common/Icons'
import { toast } from '../../stores/toastStore'
import { downloadAsHtml, generateStandaloneHtml, printAsPdf } from '../../lib/markdown/export'

interface ExportToolbarProps {
  /** 当前 Markdown 源文本 */
  markdown: string
  /** 文档标题(用作下载文件名 + <title>) */
  title?: string
}

/**
 * Markdown 导出工具栏
 *
 * 三个动作:
 * - 复制 HTML — 把 standaloneHtml 写到剪贴板
 * - 下载 HTML — 通过 file-saver 触发浏览器下载
 * - 打印 PDF — 临时插入打印样式,调用 window.print() 让用户"另存为 PDF"
 */
export default function ExportToolbar({ markdown, title = 'markdown' }: ExportToolbarProps) {
  const [copying, setCopying] = useState(false)

  const handleCopyHtml = useCallback(async () => {
    if (!markdown.trim()) {
      toast.warning('Markdown 内容为空,无法复制')
      return
    }
    try {
      setCopying(true)
      const html = generateStandaloneHtml(markdown, title)
      await navigator.clipboard.writeText(html)
      toast.success('已复制独立 HTML 到剪贴板')
    } catch (err) {
      toast.error(`复制失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCopying(false)
    }
  }, [markdown, title])

  const handleDownload = useCallback(() => {
    if (!markdown.trim()) {
      toast.warning('Markdown 内容为空,无法下载')
      return
    }
    try {
      const safeName = (title || 'markdown').replace(/[\\/:*?"<>|]/g, '_')
      downloadAsHtml(markdown, `${safeName}.html`)
      toast.success(`已开始下载 ${safeName}.html`)
    } catch (err) {
      toast.error(`下载失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [markdown, title])

  const handlePrint = useCallback(() => {
    if (!markdown.trim()) {
      toast.warning('Markdown 内容为空,无法打印')
      return
    }
    try {
      printAsPdf(markdown)
      toast.info('已打开打印对话框,请选择"另存为 PDF"')
    } catch (err) {
      toast.error(`打印失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [markdown])

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: '13px',
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    border: 'var(--border-width) solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'var(--transition)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={handleCopyHtml}
        disabled={copying}
        className="theme-btn"
        style={btnStyle}
        title="复制嵌内联样式的独立 HTML"
      >
        <IconCopy />
        <span>{copying ? '复制中…' : '复制 HTML'}</span>
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="theme-btn"
        style={btnStyle}
        title="下载为独立 .html 文件"
      >
        <IconDownload />
        <span>下载 HTML</span>
      </button>
      <button
        type="button"
        onClick={handlePrint}
        className="theme-btn"
        style={btnStyle}
        title="打开浏览器打印对话框 → 另存为 PDF"
      >
        {/* 复用 IconDownload 风格图标位 */}
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"
          />
        </svg>
        <span>打印 PDF</span>
      </button>
    </div>
  )
}
