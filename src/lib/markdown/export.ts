/**
 * Markdown 导出工具集
 *
 * 三个核心能力:
 * 1. generateStandaloneHtml — 生成嵌内联 GitHub-flavored CSS 的独立 HTML
 * 2. downloadAsHtml — 用 file-saver 触发浏览器下载
 * 3. printAsPdf — 通过 window.print() 实现"另存为 PDF",零依赖
 *
 * 渲染策略:
 * - generateStandaloneHtml 使用 marked-style 字符串解析?不,本平台已用 react-markdown,
 *   所以本函数接受调用方传入"已渲染好的 HTML 片段"也支持原始 markdown:
 *   * 若发现入参看起来已经是 HTML(包含 < 且非纯 markdown),直接当 body
 *   * 否则进行最小化的 markdown→HTML 转换(标题、段落、围栏代码、表格、列表)
 * - 当前实现为简化:导出动作发生在页面已渲染了 HTML 之后,因此页面会先把已渲染的
 *   预览区 innerHTML 取出再传入,避免重复实现 markdown 解析。
 */

import { saveAs } from 'file-saver'

/**
 * 简化版 markdown→HTML(仅用于"用户没渲染就直接调用 generateStandaloneHtml(md)" 的兜底)
 * 用法约定: 页面层一般传入预览区的 innerHTML(已被 react-markdown 渲染),
 * 因此本函数仅在入参看上去是 markdown 时启用。
 *
 * 关键算法: 启发式判断 — 入参不含 < 即视为纯 markdown,需要简化转 HTML
 */
function looksLikeHtml(text: string): boolean {
  return /<[a-zA-Z][^>]*>/.test(text)
}

/** 极简 markdown→HTML(仅做最常见的 5 类块级:标题、段落、列表、围栏代码、表格行) */
function naiveMarkdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let inCode = false
  let codeLang = ''
  let codeBuf: string[] = []
  let listBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null

  // 关键算法: 单趟扫描,遇到围栏代码块整体收集,列表合并连续项,其余按段落
  const flushList = () => {
    if (listType && listBuf.length) {
      out.push(`<${listType}>${listBuf.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</${listType}>`)
    }
    listBuf = []
    listType = null
  }

  for (const raw of lines) {
    const line = raw
    if (inCode) {
      if (line.trim().startsWith('```')) {
        out.push(`<pre><code${codeLang ? ` class="language-${codeLang}"` : ''}>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
        inCode = false
        codeBuf = []
        codeLang = ''
      } else {
        codeBuf.push(line)
      }
      continue
    }
    const fence = line.trim().match(/^```(\w*)/)
    if (fence) {
      flushList()
      inCode = true
      codeLang = fence[1] || ''
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushList()
      const level = heading[1].length
      out.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`)
      continue
    }
    const ul = line.match(/^[-*]\s+(.+)$/)
    if (ul) {
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listBuf.push(ul[1])
      continue
    }
    const ol = line.match(/^\d+\.\s+(.+)$/)
    if (ol) {
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listBuf.push(ol[1])
      continue
    }
    if (!line.trim()) {
      flushList()
      continue
    }
    flushList()
    out.push(`<p>${escapeHtml(line)}</p>`)
  }
  flushList()
  if (inCode) {
    // 文件结束但未闭合代码块,仍尽量输出
    out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }
  return out.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 用户 HTML 内容 sanitize(XSS 加固)
 *
 * 安全目标:
 * 1. 移除 <script>...</script>(含属性、跨行、未闭合等变体)
 * 2. 移除 <style>...</style>(防止 expression()、@import 远程加载等老式攻击面)
 * 3. 移除所有 on* 事件属性(onclick / onerror / onload / onmouseover ...)
 * 4. 中和 javascript: / vbscript: / data:text/html 协议(href / src / xlink:href / formaction 等)
 * 5. 移除 <iframe> <object> <embed> <link> <meta> 等可承载脚本/远程资源的标签
 *
 * 注意作用域: 本函数仅作用于"用户内容"(generateStandaloneHtml 的 body 变量),
 * 页面自身注入的 <style>${GFM_INLINE_CSS}</style> 由模板字面量在 sanitize 之后拼接,
 * 不受影响。
 *
 * 关键算法: 多趟正则替换 — 先剥离危险标签整体(含内容),再清理标签内的危险属性。
 * 正则均使用 g 标志且不依赖回溯型嵌套,避免 ReDoS。
 */
export function sanitizeUserHtml(html: string): string {
  if (!html) return ''
  let out = html

  // 1) 整段移除 <script>...</script>(含属性 / 跨行 / 大小写)
  //    使用 [\s\S] 而非 . 跨行匹配;非贪婪 *? 防止误吞
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
  // 兜底: 处理未闭合的 <script ...>(从开始到字符串末尾)
  out = out.replace(/<script\b[^>]*>[\s\S]*$/gi, '')

  // 2) 整段移除 <style>...</style>(用户内容里的;页面自身样式不会进入此函数)
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
  out = out.replace(/<style\b[^>]*>[\s\S]*$/gi, '')

  // 3) 移除其他危险标签(自闭合 / 含内容两种形态都覆盖)
  //    iframe / object / embed 可加载远程内容;link / meta 可注入跳转、CSP 旁路、刷新攻击
  const dangerousTags = ['iframe', 'object', 'embed', 'link', 'meta', 'base', 'frame', 'frameset']
  for (const tag of dangerousTags) {
    // 含内容形态
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '')
    // 自闭合 / 单标签形态
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }

  // 4) 移除所有 on* 事件属性
  //    覆盖三种引号形态: onclick="..."  onclick='...'  onclick=xxx
  //    边界处理: 前置必须是空白(避免误伤 class="onerror" 之类的属性值)
  //    注意: \s 含换行, 故 <img src=x\nonerror=...> 这类换行分隔也能命中;
  //    反复执行直到不再变化, 防止移除后相邻属性重新拼出新的 on* 形态
  const stripOnAttrs = (s: string): string => {
    let prev: string
    do {
      prev = s
      s = s.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
      s = s.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
      // 无引号形态: 值取到下一个空白/换行/`>` 为止 (\s 含换行)
      s = s.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')
    } while (s !== prev)
    return s
  }
  out = stripOnAttrs(out)

  // 5) 中和危险协议
  //    href="javascript:..."  src='vbscript:...'  href=javascript:...
  //    策略: 把协议替换成 about:blank,保留 DOM 结构方便排错
  const dangerousProto = /(?:javascript|vbscript|livescript)\s*:/gi
  // 引号包裹形态
  out = out.replace(/(\s(?:href|src|xlink:href|formaction|action|background|poster|cite|data|ping)\s*=\s*")([^"]*)"/gi, (_m, prefix: string, val: string) => {
    return `${prefix}${val.replace(dangerousProto, 'about:blank:')}"`
  })
  out = out.replace(/(\s(?:href|src|xlink:href|formaction|action|background|poster|cite|data|ping)\s*=\s*')([^']*)'/gi, (_m, prefix: string, val: string) => {
    return `${prefix}${val.replace(dangerousProto, 'about:blank:')}'`
  })
  // 无引号形态
  out = out.replace(/(\s(?:href|src|xlink:href|formaction|action|background|poster|cite|data|ping)\s*=\s*)([^\s>]+)/gi, (_m, prefix: string, val: string) => {
    return `${prefix}${val.replace(dangerousProto, 'about:blank:')}`
  })
  // data:text/html 也要中和(可执行 HTML+JS)
  out = out.replace(/data\s*:\s*text\s*\/\s*html/gi, 'data:text/plain')

  return out
}

/**
 * GitHub-flavored 内联样式 (~5KB)
 * 设计意图:导出后的 HTML 在任何浏览器中独立打开都拥有可读的版式
 */
const GFM_INLINE_CSS = `
:root {
  color-scheme: light;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #24292f;
  background: #ffffff;
  max-width: 920px;
  margin: 40px auto;
  padding: 0 24px;
}
.markdown-body { color: inherit; }
h1, h2, h3, h4, h5, h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}
h1 { font-size: 2em; padding-bottom: .3em; border-bottom: 1px solid #d0d7de; }
h2 { font-size: 1.5em; padding-bottom: .3em; border-bottom: 1px solid #d0d7de; }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }
h5 { font-size: .875em; }
h6 { font-size: .85em; color: #57606a; }
p, ul, ol, blockquote, pre, table { margin: 0 0 16px 0; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
code {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 85%;
  background: rgba(175,184,193,.2);
  padding: .2em .4em;
  border-radius: 6px;
}
pre {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
}
pre code {
  background: transparent;
  padding: 0;
  font-size: 100%;
  white-space: pre;
}
blockquote {
  padding: 0 1em;
  color: #57606a;
  border-left: .25em solid #d0d7de;
}
ul, ol { padding-left: 2em; }
li + li { margin-top: 4px; }
table {
  border-collapse: collapse;
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
}
table th, table td {
  padding: 6px 13px;
  border: 1px solid #d0d7de;
}
table th {
  background: #f6f8fa;
  font-weight: 600;
}
table tr { background: #ffffff; border-top: 1px solid #d0d7de; }
table tr:nth-child(2n) { background: #f6f8fa; }
img { max-width: 100%; box-sizing: border-box; }
hr {
  border: 0;
  border-top: 2px solid #d0d7de;
  margin: 24px 0;
}
`.trim()

/**
 * 生成可独立打开的 HTML 文档字符串
 * @param markdownOrHtml 入参既可以是已渲染的 HTML 片段,也可以是原始 markdown
 * @param title 文档标题(<title> + 顶部 h1 占位),默认 "Markdown Export"
 */
export function generateStandaloneHtml(markdownOrHtml: string, title = 'Markdown Export'): string {
  // 关键算法: 启发式判断入参形态,自动选择是否需要 markdown 转 HTML
  const rawBody = looksLikeHtml(markdownOrHtml)
    ? markdownOrHtml
    : naiveMarkdownToHtml(markdownOrHtml)
  // XSS 加固: 对用户内容统一 sanitize,移除 <script>/<style>/事件属性/危险协议
  // 页面自身的 GFM_INLINE_CSS 由下方模板拼接进 <style>,不会经过此函数
  const body = sanitizeUserHtml(rawBody)

  const safeTitle = escapeHtml(title)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
${GFM_INLINE_CSS}
</style>
</head>
<body>
<article class="markdown-body">
${body}
</article>
</body>
</html>`
}

/**
 * 触发浏览器下载 standalone HTML
 * @param markdownOrHtml 同 generateStandaloneHtml
 * @param filename 默认 markdown-export.html
 */
export function downloadAsHtml(markdownOrHtml: string, filename = 'markdown-export.html'): void {
  const html = generateStandaloneHtml(markdownOrHtml, filename.replace(/\.html?$/i, ''))
  // 关键算法: 用 Blob + file-saver 触发下载,跨浏览器兼容性最好
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  saveAs(blob, filename)
}

/** 打印样式标签 ID,便于插入与移除 */
const PRINT_STYLE_ID = 'omc-md-print-style'

/**
 * 打印为 PDF
 *
 * 实现思路:
 * - 临时插入一段 @media print 样式,隐藏除目标预览区(#md-print-target)外的所有元素
 * - 触发 window.print()
 * - 打印对话框关闭后(afterprint 事件)移除样式,还原页面
 *
 * 入参 markdown 仅用于打印失败兜底场景:
 * - 若页面没有 #md-print-target 元素,则在新窗口写入 standaloneHtml 后调用 print
 *
 * 关键算法: 优先就地打印,避免弹窗被浏览器拦截;失败回退到新窗口打印
 */
export function printAsPdf(markdown: string): void {
  // 仅在浏览器环境执行;jsdom 中无 window.print 时直接 noop
  if (typeof window === 'undefined' || typeof window.print !== 'function') return

  const target = typeof document !== 'undefined' ? document.getElementById('md-print-target') : null
  if (target) {
    // 路径 A: 就地打印 — 临时样式
    const style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    style.textContent = `
@media print {
  body * { visibility: hidden !important; }
  #md-print-target, #md-print-target * { visibility: visible !important; }
  #md-print-target {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    padding: 16px !important;
    background: white !important;
    color: #24292f !important;
  }
}
`.trim()
    document.head.appendChild(style)

    const cleanup = () => {
      const existed = document.getElementById(PRINT_STYLE_ID)
      if (existed && existed.parentNode) existed.parentNode.removeChild(existed)
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)

    try {
      window.print()
    } finally {
      // 部分浏览器(Safari)不会触发 afterprint,做一次延迟兜底清理
      setTimeout(cleanup, 1000)
    }
    return
  }

  // 路径 B: 新窗口兜底
  const html = generateStandaloneHtml(markdown, 'Print Preview')
  const win = window.open('', '_blank')
  if (!win) {
    // 弹窗被拦截:抛错让上层用 toast 提示
    throw new Error('打印窗口被浏览器拦截,请允许弹出窗口后重试')
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  // 等图片/字体加载好再 print,简单做 200ms 延迟
  setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
      // 静默忽略,用户仍可手动 Ctrl+P
    }
  }, 200)
}
