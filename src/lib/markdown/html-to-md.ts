/**
 * HTML → Markdown 转换器
 *
 * 设计要点:
 * - 通过 await import('turndown') 懒加载,避免主包体积膨胀(~15KB gzip)
 * - 单例缓存 TurndownService 实例,重复调用零成本
 * - 启用 GitHub Flavored 选项: 围栏代码块 + ATX 标题 + 连字符无序列表
 * - 失败时抛出 Error,由调用方捕获并 toast 提示
 */

// 关键算法说明: 仅在首次调用时动态 import turndown,后续调用复用同一服务实例。
// 这样在用户从未使用 HTML→MD 功能时,turndown 不会被加入主 bundle。

// turndown 的类型由 @types/turndown 提供
type TurndownInstance = {
  turndown(html: string): string
  addRule(name: string, rule: unknown): TurndownInstance
}

let cachedService: TurndownInstance | null = null

/**
 * GFM 表格转换规则
 * 关键算法: 遍历 thead/tbody 的 tr/th/td,生成 GFM 管道表格;header 行后跟分隔行
 * 自定义实现避免引入 turndown-plugin-gfm 额外依赖
 */
function registerGfmTable(service: TurndownInstance): void {
  service.addRule('gfm-table', {
    filter: 'table',
    replacement: (_content: string, node: unknown) => {
      const table = node as HTMLTableElement
      const rows = Array.from(table.querySelectorAll('tr'))
      if (rows.length === 0) return ''

      // 提取每行单元格文本(去除多余空白)
      const matrix: string[][] = rows.map((row) =>
        Array.from(row.querySelectorAll('th,td')).map((cell) =>
          (cell.textContent ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim(),
        ),
      )
      const colCount = Math.max(...matrix.map((r) => r.length))
      // 补齐短行
      const padded = matrix.map((r) => {
        while (r.length < colCount) r.push('')
        return r
      })
      const header = padded[0]
      const body = padded.slice(1)
      const separator = new Array(colCount).fill('---')

      const fmt = (cells: string[]) => `| ${cells.join(' | ')} |`
      const lines = [fmt(header), fmt(separator), ...body.map(fmt)]
      return `\n\n${lines.join('\n')}\n\n`
    },
  })
}

/** 懒加载并初始化 turndown 服务 */
async function getService(): Promise<TurndownInstance> {
  if (cachedService) return cachedService
  // 动态 import: Vite 会自动拆出独立 chunk
  const mod = await import('turndown')
  // turndown 默认导出可能是 default 也可能直接是构造函数,做兼容
  const TurndownCtor = (mod as { default?: unknown }).default ?? mod
  // 用 Function 类型而非 any,避免 unused eslint-disable 警告
  const Ctor = TurndownCtor as new (opts: Record<string, unknown>) => TurndownInstance
  const service: TurndownInstance = new Ctor({
    headingStyle: 'atx', // # ## ### 风格,而非下划线风格
    bulletListMarker: '-', // 与 GFM 习惯一致
    codeBlockStyle: 'fenced', // 围栏代码块 ``` 而非缩进
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  })
  // 注册 GFM 表格规则
  registerGfmTable(service)
  cachedService = service
  return service
}

/**
 * 将 HTML 字符串转换为 Markdown
 *
 * @param html 任意 HTML 字符串(可包含 <table>、<pre><code>、嵌套 <ul> 等)
 * @returns 对应的 Markdown 文本(GFM 风格)
 * @throws Error 当 turndown 加载失败或转换抛错时
 */
export async function htmlToMarkdown(html: string): Promise<string> {
  // 关键算法: 空串短路,避免无谓的模块加载
  if (!html || !html.trim()) return ''
  const service = await getService()
  return service.turndown(html)
}

/** 仅供测试使用: 重置缓存,确保每个用例独立 */
export function __resetTurndownCache(): void {
  cachedService = null
}
