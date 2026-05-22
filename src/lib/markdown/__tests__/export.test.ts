import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateStandaloneHtml, downloadAsHtml, printAsPdf, sanitizeUserHtml } from '../export'

// mock file-saver,避免 jsdom 触发实际下载
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}))

import { saveAs } from 'file-saver'

describe('generateStandaloneHtml', () => {
  it('包含 DOCTYPE / html / head / body 必要骨架', () => {
    const html = generateStandaloneHtml('# 标题\n\n正文')
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
    expect(html).toContain('</html>')
  })

  it('包含 GitHub-flavored CSS 的关键选择器', () => {
    const html = generateStandaloneHtml('hello')
    // 关键 CSS 标记位
    expect(html).toContain('font-family')
    expect(html).toContain('.markdown-body')
    expect(html).toMatch(/h1\s*{[^}]*border-bottom/)
    expect(html).toMatch(/pre\s*{[^}]*background/)
    expect(html).toMatch(/table\s+th[^{]*{[^}]*background/)
    expect(html).toMatch(/blockquote\s*{[^}]*border-left/)
  })

  it('入参为已渲染 HTML 时直接嵌入,不再二次解析', () => {
    const out = generateStandaloneHtml('<h1>Pre-rendered</h1><p>body</p>', 'demo')
    expect(out).toContain('<h1>Pre-rendered</h1>')
    expect(out).toContain('<p>body</p>')
    // 不应该把 < 转义掉
    expect(out).not.toContain('&lt;h1&gt;Pre-rendered')
  })

  it('入参为纯 markdown 时进行最小化转换', () => {
    const out = generateStandaloneHtml('# 标题\n\n正文段落\n\n- 项 1\n- 项 2')
    expect(out).toContain('<h1>标题</h1>')
    expect(out).toContain('<p>正文段落</p>')
    expect(out).toContain('<ul>')
    expect(out).toContain('<li>项 1</li>')
    expect(out).toContain('<li>项 2</li>')
  })

  it('围栏代码块转换', () => {
    const out = generateStandaloneHtml('```ts\nconst a = 1\n```')
    expect(out).toContain('<pre>')
    expect(out).toContain('language-ts')
    expect(out).toContain('const a = 1')
  })

  it('title 参数被转义并写入 <title>', () => {
    const out = generateStandaloneHtml('hi', '<script>alert(1)</script>')
    expect(out).toContain('<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>')
    // 不应直接出现裸 script
    expect(out).not.toMatch(/<title><script>/)
  })

  it('article 容器具有 markdown-body 类', () => {
    const out = generateStandaloneHtml('hi')
    expect(out).toContain('<article class="markdown-body">')
  })
})

describe('downloadAsHtml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('调用 saveAs 触发下载,blob 类型为 text/html', () => {
    downloadAsHtml('# H', 'my-doc.html')
    expect(saveAs).toHaveBeenCalledTimes(1)
    const args = (saveAs as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    const blob = args[0] as Blob
    const filename = args[1] as string
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toContain('text/html')
    expect(filename).toBe('my-doc.html')
  })

  it('未传 filename 时使用默认 markdown-export.html', () => {
    downloadAsHtml('hi')
    const args = (saveAs as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    expect(args[1]).toBe('markdown-export.html')
  })
})

describe('printAsPdf', () => {
  beforeEach(() => {
    // 清理可能残留的打印样式标签
    const existed = document.getElementById('omc-md-print-style')
    if (existed && existed.parentNode) existed.parentNode.removeChild(existed)
    // 清理 print-target
    const t = document.getElementById('md-print-target')
    if (t && t.parentNode) t.parentNode.removeChild(t)
  })

  it('存在 #md-print-target 时插入打印样式并调用 window.print', () => {
    const target = document.createElement('div')
    target.id = 'md-print-target'
    target.innerHTML = '<h1>preview</h1>'
    document.body.appendChild(target)

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    printAsPdf('# preview')
    expect(printSpy).toHaveBeenCalled()
    // 临时样式应被注入
    const style = document.getElementById('omc-md-print-style')
    expect(style).not.toBeNull()
    expect(style?.textContent).toContain('@media print')
    printSpy.mockRestore()
  })

  it('window.print 不存在时安静返回(jsdom 兜底场景)', () => {
    const original = window.print
    // @ts-expect-error 故意删除
    window.print = undefined
    expect(() => printAsPdf('# x')).not.toThrow()
    window.print = original
  })
})

// =====================================================================
// XSS 加固测试 — 验证 sanitizeUserHtml 与 generateStandaloneHtml 协同工作
// =====================================================================
describe('sanitizeUserHtml — XSS 加固', () => {
  it('移除 <script>...</script>(含属性、跨行)', () => {
    const dirty = `<p>before</p><script>alert(1)</script><p>after</p>`
    const clean = sanitizeUserHtml(dirty)
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('alert(1)')
    expect(clean).toContain('<p>before</p>')
    expect(clean).toContain('<p>after</p>')
  })

  it('移除带属性的 script、跨行 script、大写 SCRIPT', () => {
    const cases = [
      `<SCRIPT type="text/javascript">x()</SCRIPT>`,
      `<script\nsrc="evil.js">\n</script>`,
      `<script defer>while(1){}</script>`,
    ]
    for (const c of cases) {
      const out = sanitizeUserHtml(c)
      expect(out.toLowerCase()).not.toContain('<script')
    }
  })

  it('移除事件属性 onerror / onclick / onload(三种引号形态)', () => {
    const dirty = `<img src=x onerror="alert(1)"><a onclick='boom()'>x</a><body onload=hack()>`
    const clean = sanitizeUserHtml(dirty)
    expect(clean).not.toMatch(/onerror\s*=/i)
    expect(clean).not.toMatch(/onclick\s*=/i)
    expect(clean).not.toMatch(/onload\s*=/i)
    expect(clean).not.toContain('alert(1)')
  })

  it('中和 javascript: 协议(href / src / 无引号)', () => {
    const dirty = `<a href="javascript:alert(1)">x</a><iframe src='javascript:bad()'></iframe><a href=javascript:doit()>y</a>`
    const clean = sanitizeUserHtml(dirty)
    // javascript: 协议必须被替换/移除,不能再以可执行形式出现在属性值里
    expect(clean).not.toMatch(/href\s*=\s*["']?javascript:/i)
    expect(clean).not.toMatch(/src\s*=\s*["']?javascript:/i)
    // iframe 整体也应被剔除
    expect(clean.toLowerCase()).not.toContain('<iframe')
  })

  it('移除用户内容里的 <style>(避免 expression / @import 远程加载)', () => {
    const dirty = `<style>body{background:url('evil')}</style><p>ok</p>`
    const clean = sanitizeUserHtml(dirty)
    expect(clean).not.toContain('<style')
    expect(clean).toContain('<p>ok</p>')
  })

  it('vbscript: / data:text/html 协议被中和', () => {
    const dirty = `<a href="vbscript:msgbox(1)">x</a><a href="data:text/html,<script>1</script>">y</a>`
    const clean = sanitizeUserHtml(dirty)
    expect(clean).not.toMatch(/href\s*=\s*["']?vbscript:/i)
    expect(clean).not.toMatch(/data:text\/html/i)
  })
})

describe('generateStandaloneHtml — XSS 集成', () => {
  it('入参含 <script> 时,产物不再含可执行脚本', () => {
    const out = generateStandaloneHtml('<p>hi</p><script>alert(1)</script>')
    // 输出仍含 GFM_INLINE_CSS 的 <style>(页面自身),
    // 但 body 区不应含用户脚本
    const bodyStart = out.indexOf('<article')
    const body = out.slice(bodyStart)
    expect(body).not.toContain('<script')
    expect(body).not.toContain('alert(1)')
  })

  it('入参含 <img onerror=...> 时,onerror 属性被剥离', () => {
    const out = generateStandaloneHtml('<img src=x onerror=alert(1)>')
    expect(out).not.toMatch(/onerror\s*=/i)
    expect(out).not.toContain('alert(1)')
  })

  it('入参含 <a href="javascript:..."> 时,javascript 协议被中和', () => {
    const out = generateStandaloneHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toMatch(/href\s*=\s*["']javascript:/i)
    // 链接结构和文字应保留
    expect(out).toContain('click</a>')
  })

  it('页面自身的 GFM 样式不被 sanitize 误杀', () => {
    const out = generateStandaloneHtml('<p>hi</p>')
    // 页面顶部 <style>${GFM_INLINE_CSS}</style> 必须保留
    expect(out).toContain('<style>')
    expect(out).toContain('.markdown-body')
    expect(out).toMatch(/h1\s*{[^}]*border-bottom/)
  })
})
