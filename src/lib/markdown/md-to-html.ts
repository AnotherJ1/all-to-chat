/**
 * Markdown → HTML 转换
 *
 * 实现策略：
 * - 复用 react-markdown + remark-gfm 渲染管线（保持与 MarkdownPreview 一致的输出）
 * - 走 react-dom/server 的 renderToStaticMarkup 拿静态 HTML 字符串
 * - 经过 sanitizeUserHtml 兜底 XSS（与 PDF/独立 HTML 导出共用同一道防线）
 *
 * 体积取舍：
 * - react-dom/server 在 Vite 中会被自动 tree-shake，仅在调用此函数的页面被路由懒加载时引入
 * - 不引入新依赖（react / react-markdown / remark-gfm 均已在 package.json 中）
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { sanitizeUserHtml } from './export'

/**
 * 把 Markdown 字符串转成 HTML 字符串（GFM 语法）
 *
 * @param markdown 原始 Markdown 文本
 * @returns 已 sanitize 过的 HTML 片段（不含 <html>/<head>/<body>，仅内容标签）
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || markdown.trim() === '') return ''
  // 用 createElement 避免 JSX；renderToStaticMarkup 不带 React 内部数据属性
  const element = createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown)
  const rawHtml = renderToStaticMarkup(element)
  // 复用与 print/独立 HTML 导出相同的 sanitize 兜底
  return sanitizeUserHtml(rawHtml)
}
