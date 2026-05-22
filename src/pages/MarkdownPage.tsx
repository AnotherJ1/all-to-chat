import { useCallback, useEffect, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import MarkdownEditor from '../components/markdown/MarkdownEditor'
import MarkdownPreview from '../components/markdown/MarkdownPreview'
import ExportToolbar from '../components/markdown/ExportToolbar'
import { htmlToMarkdown } from '../lib/markdown/html-to-md'
import { markdownToHtml } from '../lib/markdown/md-to-html'
import { toast } from '../stores/toastStore'

/** 工具方向 tab */
type Direction = 'edit' | 'md-to-html' | 'html-to-md'

/** 移动端单栏切换 tab */
type MobilePane = 'editor' | 'preview'

const SAMPLE_MD = `# Markdown 工具示例

支持 GitHub Flavored Markdown:

## 列表

- 项 A
- 项 B
  - 嵌套 1
  - 嵌套 2

## 代码

\`\`\`ts
function greet(name: string) {
  console.log(\`Hello, \${name}!\`)
}
\`\`\`

## 表格

| 名称 | 年龄 | 城市 |
| ---- | ---- | ---- |
| Ada  | 36   | London |
| Bob  | 42   | Paris  |

> 引用块也支持

[OMC GitHub](https://github.com)
`

const SAMPLE_HTML = `<h1>HTML → Markdown</h1>
<p>把任意 HTML 粘贴到左侧,右侧实时显示转换后的 Markdown。</p>
<ul>
  <li>支持 <strong>粗体</strong> / <em>斜体</em> / <a href="https://example.com">链接</a></li>
  <li>支持表格、代码块、嵌套列表</li>
</ul>`

/**
 * Markdown 工具页 — 双向 MD ↔ HTML 转换 + 导出
 *
 * 布局:
 * - 顶部方向 tab (edit | html-to-md)
 * - 桌面端: 双栏(左编辑右预览)
 * - 移动端: 下拉切换单栏(editor / preview)
 * - 顶部 toolbar: 复制 HTML / 下载 HTML / 打印 PDF
 *
 * 关键算法:
 * - edit 模式: 左侧 textarea 编辑 markdown,右侧 react-markdown 实时渲染
 * - html-to-md 模式: 左侧 textarea 粘贴 HTML,右侧通过 turndown(懒加载) 渲染对应的 markdown 文本
 *   通过受控 useEffect 异步触发转换,避免高频按键时频繁重算
 */
export default function MarkdownPage() {
  const [direction, setDirection] = useState<Direction>('edit')

  // edit 模式状态
  const [markdownText, setMarkdownText] = useState<string>(SAMPLE_MD)

  // md→html 模式状态（与 edit 模式共用 markdownText 输入，避免内容丢失）
  const [convertedHtml, setConvertedHtml] = useState<string>('')

  // html→md 模式状态
  const [htmlInput, setHtmlInput] = useState<string>(SAMPLE_HTML)
  const [convertedMd, setConvertedMd] = useState<string>('')
  const [converting, setConverting] = useState<boolean>(false)

  // 移动端单栏切换
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor')

  // 关键算法: html→md 异步转换 — 内容变化触发懒加载 turndown
  useEffect(() => {
    if (direction !== 'html-to-md') return
    let cancelled = false
    setConverting(true)
    htmlToMarkdown(htmlInput)
      .then((md) => {
        if (!cancelled) setConvertedMd(md)
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(`转换失败: ${err instanceof Error ? err.message : String(err)}`)
        }
      })
      .finally(() => {
        if (!cancelled) setConverting(false)
      })
    return () => {
      cancelled = true
    }
  }, [direction, htmlInput])

  // 关键算法: md→html 同步转换（renderToStaticMarkup 是同步 API），输入变化即重算
  useEffect(() => {
    if (direction !== 'md-to-html') return
    try {
      setConvertedHtml(markdownToHtml(markdownText))
    } catch (err) {
      toast.error(`转换失败: ${err instanceof Error ? err.message : String(err)}`)
      setConvertedHtml('')
    }
  }, [direction, markdownText])

  // 复制 HTML（md→html 专用）
  const handleCopyHtml = useCallback(async () => {
    if (!convertedHtml) {
      toast.warning('无内容可复制')
      return
    }
    try {
      await navigator.clipboard.writeText(convertedHtml)
      toast.success('已复制 HTML')
    } catch (err) {
      toast.error(`复制失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [convertedHtml])

  // 复制转换结果(html→md 专用)
  const handleCopyMd = useCallback(async () => {
    if (!convertedMd) {
      toast.warning('无内容可复制')
      return
    }
    try {
      await navigator.clipboard.writeText(convertedMd)
      toast.success('已复制 Markdown')
    } catch (err) {
      toast.error(`复制失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [convertedMd])

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontFamily: 'var(--font-heading)',
    fontSize: '13px',
    fontWeight: 700,
    border: 'var(--border-width) solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--accent-1)' : 'var(--bg-surface)',
    color: active ? 'var(--bg-primary)' : 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'var(--transition)',
    letterSpacing: '0.05em',
  })

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <BackToHome />

      {/* 顶部标题 + 方向 tab + 工具栏 */}
      <header
        className="px-4 sm:px-6 pt-4 pb-3 flex-shrink-0"
        style={{
          borderBottom: 'var(--border-width) solid var(--border-color)',
          background: 'var(--bg-surface)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-[1600px] mx-auto pl-12 sm:pl-14">
          <div>
            <h1
              className="text-xl sm:text-2xl font-bold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
            >
              Markdown 工具
            </h1>
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--text-muted)' }}
            >
              双向 MD ↔ HTML · 实时预览 · 一键导出 HTML / PDF
            </p>
          </div>

          {/* 导出工具栏(仅 edit 模式显示) */}
          {direction === 'edit' && (
            <ExportToolbar markdown={markdownText} title="markdown" />
          )}
          {direction === 'md-to-html' && (
            <button
              type="button"
              onClick={handleCopyHtml}
              className="theme-btn"
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                border: 'var(--border-width) solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              title="把转换后的 HTML 源码复制到剪贴板"
            >
              复制 HTML
            </button>
          )}
          {direction === 'html-to-md' && (
            <button
              type="button"
              onClick={handleCopyMd}
              className="theme-btn"
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                border: 'var(--border-width) solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              title="把转换后的 Markdown 复制到剪贴板"
            >
              复制 Markdown
            </button>
          )}
        </div>

        {/* 方向 tab */}
        <div className="mt-3 max-w-[1600px] mx-auto pl-12 sm:pl-14 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setDirection('edit')}
            style={tabBtnStyle(direction === 'edit')}
          >
            编辑预览
          </button>
          <button
            type="button"
            onClick={() => setDirection('md-to-html')}
            style={tabBtnStyle(direction === 'md-to-html')}
          >
            MD → HTML
          </button>
          <button
            type="button"
            onClick={() => setDirection('html-to-md')}
            style={tabBtnStyle(direction === 'html-to-md')}
          >
            HTML → MD
          </button>

          {/* 移动端单栏切换:仅 ≤768px 显示 */}
          <div className="md:hidden ml-auto">
            <select
              value={mobilePane}
              onChange={(e) => setMobilePane(e.target.value as MobilePane)}
              className="theme-select"
              style={{
                padding: '6px 10px',
                fontSize: '13px',
                border: 'var(--border-width) solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <option value="editor">编辑器</option>
              <option value="preview">预览</option>
            </select>
          </div>

          {converting && direction === 'html-to-md' && (
            <span
              className="text-xs"
              style={{ color: 'var(--text-muted)', marginLeft: '8px' }}
            >
              转换中…
            </span>
          )}
        </div>
      </header>

      {/* 主体: 双栏 / 单栏 */}
      <main className="flex-1 min-h-0 px-4 sm:px-6 py-4 max-w-[1600px] w-full mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100vh-180px)] min-h-[400px]">
          {/* 左栏: 编辑器 */}
          <div
            className={mobilePane === 'editor' ? 'block' : 'hidden md:block'}
            style={{ minHeight: 0 }}
          >
            {direction === 'html-to-md' ? (
              <MarkdownEditor
                value={htmlInput}
                onChange={setHtmlInput}
                label="HTML 输入"
                placeholder="粘贴 HTML 源码…"
              />
            ) : (
              <MarkdownEditor
                value={markdownText}
                onChange={setMarkdownText}
                label="MARKDOWN"
                placeholder="在此输入 Markdown…"
              />
            )}
          </div>

          {/* 右栏: 预览 / 转换结果 */}
          <div
            className={mobilePane === 'preview' ? 'block' : 'hidden md:block'}
            style={{ minHeight: 0 }}
          >
            {direction === 'edit' && (
              <MarkdownPreview
                source={markdownText}
                label="预览"
                printTargetId="md-print-target"
              />
            )}
            {direction === 'md-to-html' && (
              <MarkdownEditor
                value={convertedHtml}
                onChange={() => {}}
                readOnly
                label="HTML 输出"
                placeholder="转换结果将显示在这里…"
              />
            )}
            {direction === 'html-to-md' && (
              <MarkdownEditor
                value={convertedMd}
                onChange={() => {}}
                readOnly
                label="MARKDOWN 输出"
                placeholder="转换结果将显示在这里…"
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
