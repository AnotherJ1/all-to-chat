import { describe, it, expect, beforeEach } from 'vitest'
import { htmlToMarkdown, __resetTurndownCache } from '../html-to-md'

describe('htmlToMarkdown', () => {
  beforeEach(() => {
    __resetTurndownCache()
  })

  it('基础: 段落 + 粗体 + 斜体 + 链接', async () => {
    const html = '<p>Hello <strong>world</strong> and <em>everyone</em>, see <a href="https://example.com">example</a>.</p>'
    const md = await htmlToMarkdown(html)
    expect(md).toContain('Hello')
    expect(md).toContain('**world**')
    expect(md).toContain('*everyone*')
    expect(md).toContain('[example](https://example.com)')
  })

  it('表格: 三列两行渲染为 GFM 表格', async () => {
    const html = `
      <table>
        <thead><tr><th>name</th><th>age</th><th>city</th></tr></thead>
        <tbody>
          <tr><td>Ada</td><td>36</td><td>London</td></tr>
          <tr><td>Bob</td><td>42</td><td>Paris</td></tr>
        </tbody>
      </table>
    `.trim()
    const md = await htmlToMarkdown(html)
    expect(md).toContain('| name | age | city |')
    expect(md).toContain('| Ada | 36 | London |')
    expect(md).toContain('| Bob | 42 | Paris |')
    // GFM 分隔行至少包含 ---
    expect(md).toMatch(/-{3,}/)
  })

  it('代码块: <pre><code> 输出围栏代码块', async () => {
    const html = '<pre><code class="language-ts">const x: number = 1\nconsole.log(x)</code></pre>'
    const md = await htmlToMarkdown(html)
    // 应包含围栏 ```
    expect(md).toMatch(/```/)
    expect(md).toContain('const x: number = 1')
    expect(md).toContain('console.log(x)')
  })

  it('嵌套列表: 二级缩进保留', async () => {
    const html = `
      <ul>
        <li>外层 1
          <ul>
            <li>内层 1.1</li>
            <li>内层 1.2</li>
          </ul>
        </li>
        <li>外层 2</li>
      </ul>
    `.trim()
    const md = await htmlToMarkdown(html)
    expect(md).toContain('-   外层 1')
    expect(md).toContain('内层 1.1')
    expect(md).toContain('内层 1.2')
    expect(md).toContain('外层 2')
    // 内层项前有缩进(空格或制表)
    expect(md).toMatch(/\n\s+(?:[-*]|\d+\.)\s+内层 1\.1/)
  })

  it('空字符串短路', async () => {
    expect(await htmlToMarkdown('')).toBe('')
    expect(await htmlToMarkdown('   ')).toBe('')
  })

  it('标题: h1-h6 转 ATX 风格', async () => {
    const html = '<h1>一级</h1><h2>二级</h2><h3>三级</h3>'
    const md = await htmlToMarkdown(html)
    expect(md).toContain('# 一级')
    expect(md).toContain('## 二级')
    expect(md).toContain('### 三级')
  })
})
