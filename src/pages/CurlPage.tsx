import { useMemo, useState, useCallback } from 'react'
import BackToHome from '../components/common/BackToHome'
import { toast } from '../stores/toastStore'
import CurlTable from '../components/curl/CurlTable'
import CurlBuilder from '../components/curl/CurlBuilder'
import { parseCurl, type CurlCommand } from '../lib/curl/parser'
import { generateCode, TARGET_LABELS, type CurlTarget } from '../lib/curl/generators'

const SAMPLE_CURL = `curl -X POST 'https://api.example.com/v1/login' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Client: web' \\
  -d '{"user":"alice","password":"s3cret"}'`

const TARGET_KEYS: CurlTarget[] = [
  'fetch',
  'axios',
  'node-http',
  'python-requests',
  'go-net-http',
  'php-curl',
  'java-okhttp',
]

/**
 * cURL 工具主页
 * 左：cURL 输入；右：解析结构 + 多语言代码输出 + 反向构建器
 */
export default function CurlPage() {
  const [input, setInput] = useState<string>(SAMPLE_CURL)
  const [target, setTarget] = useState<CurlTarget>('fetch')

  /** 解析输入；解析失败仅暴露 error，不抛出 */
  const parsed = useMemo<{ cmd?: CurlCommand; error?: string }>(() => {
    if (!input.trim()) return { error: '请输入 cURL 命令' }
    try {
      const cmd = parseCurl(input)
      return { cmd }
    } catch (e) {
      // 显式异常处理：失败时回传错误信息给 UI
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [input])

  /** 生成目标语言代码；解析失败时直接为空 */
  const generated = useMemo(() => {
    if (!parsed.cmd) return ''
    try {
      return generateCode(parsed.cmd, target)
    } catch (e) {
      return `// 生成失败：${e instanceof Error ? e.message : String(e)}`
    }
  }, [parsed, target])

  /** 复制生成结果到剪贴板 */
  const handleCopyCode = useCallback(async () => {
    if (!generated) return
    try {
      await navigator.clipboard.writeText(generated)
      toast.success('已复制到剪切板')
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }, [generated])

  /** 应用 builder 输出到左侧 */
  const handleApplyBuilder = useCallback((s: string) => {
    setInput(s)
    toast.info('已应用到左侧输入')
  }, [])

  return (
    <div
      className="min-h-screen w-full pb-12"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          cURL 工具
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          解析任意 cURL 命令，自动转换为 fetch / axios / Python / Go / PHP / Java 代码，并支持反向构建
        </p>
      </header>

      <main
        className="curl-main"
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 16px',
          display: 'grid',
          gap: '20px',
        }}
      >
        {/* 左：cURL 输入 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              cURL 命令输入
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="theme-btn"
                onClick={() => setInput(SAMPLE_CURL)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                示例
              </button>
              <button
                className="theme-btn"
                onClick={() => setInput('')}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                清空
              </button>
            </div>
          </div>
          <textarea
            className="theme-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴你的 curl 命令..."
            spellCheck={false}
            style={{
              minHeight: '260px',
              resize: 'vertical',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              lineHeight: 1.6,
            }}
          />

          {parsed.error && (
            <div
              role="alert"
              style={{
                padding: '10px 12px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-sm)',
                color: '#ef4444',
                fontSize: '13px',
              }}
            >
              <strong>解析失败：</strong>
              {parsed.error}
            </div>
          )}

          {parsed.cmd && (
            <div>
              <div
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}
              >
                解析结构
              </div>
              <CurlTable cmd={parsed.cmd} />
            </div>
          )}
        </section>

        {/* 右：语言选择 + 代码输出 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              目标语言
            </label>
            <select
              className="theme-select"
              value={target}
              onChange={(e) => setTarget(e.target.value as CurlTarget)}
              style={{ flex: 1 }}
            >
              {TARGET_KEYS.map((k) => (
                <option key={k} value={k}>
                  {TARGET_LABELS[k]}
                </option>
              ))}
            </select>
            <button
              className="theme-btn theme-btn-primary"
              onClick={handleCopyCode}
              disabled={!generated}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              复制代码
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: '14px',
              background: 'var(--bg-secondary)',
              border: 'var(--border-width) solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12.5px',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              minHeight: '260px',
              maxHeight: '500px',
              overflow: 'auto',
            }}
          >
            {generated || (
              <span style={{ color: 'var(--text-muted)' }}>
                输入合法的 curl 命令后将在此显示等价代码...
              </span>
            )}
          </pre>

          <div style={{ marginTop: '8px' }}>
            <div
              className="text-sm font-medium"
              style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}
            >
              反向构建（表单 → cURL）
            </div>
            <CurlBuilder onApply={handleApplyBuilder} />
          </div>
        </section>
      </main>

      {/* 响应式：移动端纵向堆叠 */}
      <style>{`
        .curl-main {
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 768px) {
          .curl-main {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
