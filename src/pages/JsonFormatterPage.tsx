import { useState, useRef, useCallback, useEffect } from 'react'
import BackToHome from '../components/common/BackToHome'
import { useJsonHistoryStore } from '../stores/jsonHistoryStore'

/** 100KB 阈值：超过此大小使用 Web Worker */
const LARGE_JSON_THRESHOLD = 100 * 1024

// ============ JSON 树形渲染组件（支持折叠/展开） ============

/** 渲染 JSON 值，递归处理对象和数组 */
function JsonValue({ value, indent, fontSize }: { value: unknown; indent: number; fontSize: number }) {
  if (value === null) return <span style={{ color: '#e06c75' }}>null</span>
  if (typeof value === 'boolean') return <span style={{ color: '#e06c75' }}>{String(value)}</span>
  if (typeof value === 'number') return <span style={{ color: '#d19a66' }}>{String(value)}</span>
  if (typeof value === 'string') return <span style={{ color: '#98c379' }}>"{value}"</span>
  if (Array.isArray(value)) return <JsonArray arr={value} indent={indent} fontSize={fontSize} />
  if (typeof value === 'object') return <JsonObject obj={value as Record<string, unknown>} indent={indent} fontSize={fontSize} />
  return <span>{String(value)}</span>
}

/** 渲染 JSON 对象节点（可折叠） */
function JsonObject({ obj, indent, fontSize }: { obj: Record<string, unknown>; indent: number; fontSize: number }) {
  const [collapsed, setCollapsed] = useState(false)
  const keys = Object.keys(obj)

  if (keys.length === 0) return <span>{'{}'}</span>

  const indentStr = '  '.repeat(indent + 1)
  const closingIndent = '  '.repeat(indent)

  return (
    <span>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: `${fontSize - 2}px`,
          padding: '0 2px',
          lineHeight: 1,
          verticalAlign: 'middle',
        }}
        title={collapsed ? '展开' : '折叠'}
      >
        {collapsed ? '▶' : '▼'}
      </button>
      {'{'}
      {collapsed ? (
        <span style={{ color: 'var(--text-muted)' }}>{` ... ${keys.length} items `}</span>
      ) : (
        <>
          {'\n'}
          {keys.map((key, i) => (
            <span key={key}>
              {indentStr}<span style={{ color: '#61afef' }}>"{key}"</span>: <JsonValue value={obj[key]} indent={indent + 1} fontSize={fontSize} />
              {i < keys.length - 1 ? ',' : ''}{'\n'}
            </span>
          ))}
          {closingIndent}
        </>
      )}
      {'}'}
    </span>
  )
}

/** 渲染 JSON 数组节点（可折叠） */
function JsonArray({ arr, indent, fontSize }: { arr: unknown[]; indent: number; fontSize: number }) {
  const [collapsed, setCollapsed] = useState(false)

  if (arr.length === 0) return <span>{'[]'}</span>

  const indentStr = '  '.repeat(indent + 1)
  const closingIndent = '  '.repeat(indent)

  return (
    <span>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: `${fontSize - 2}px`,
          padding: '0 2px',
          lineHeight: 1,
          verticalAlign: 'middle',
        }}
        title={collapsed ? '展开' : '折叠'}
      >
        {collapsed ? '▶' : '▼'}
      </button>
      {'['}
      {collapsed ? (
        <span style={{ color: 'var(--text-muted)' }}>{` ... ${arr.length} items `}</span>
      ) : (
        <>
          {'\n'}
          {arr.map((item, i) => (
            <span key={i}>
              {indentStr}<JsonValue value={item} indent={indent + 1} fontSize={fontSize} />
              {i < arr.length - 1 ? ',' : ''}{'\n'}
            </span>
          ))}
          {closingIndent}
        </>
      )}
      {']'}
    </span>
  )
}

// ============ 主页面组件 ============

export default function JsonFormatterPage() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [parsedJson, setParsedJson] = useState<unknown>(undefined)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [fontSize, setFontSize] = useState(13)
  const [editorHeight, setEditorHeight] = useState(400)

  const workerRef = useRef<Worker | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLPreElement>(null)

  const { records, addRecord, removeRecord } = useJsonHistoryStore()

  // 监听左侧 textarea 高度变化，同步到右侧（通过 mouseup 事件）
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // 用户拖拽 textarea 后，mouseup 时同步高度
    const syncHeight = () => {
      const h = textarea.offsetHeight
      if (h > 0 && h !== editorHeight) {
        setEditorHeight(h)
      }
    }

    // 监听 mouseup（拖拽结束）和 pointerup
    textarea.addEventListener('mouseup', syncHeight)
    textarea.addEventListener('pointerup', syncHeight)
    return () => {
      textarea.removeEventListener('mouseup', syncHeight)
      textarea.removeEventListener('pointerup', syncHeight)
    }
  }, [editorHeight])

  // 初始化 Worker（懒加载）
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/json-formatter.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }
    return workerRef.current
  }, [])

  // 组件卸载时终止 Worker
  useEffect(() => {
    return () => { workerRef.current?.terminate() }
  }, [])

  /** 主线程处理小 JSON */
  const processInMainThread = useCallback((type: 'format' | 'minify', data: string) => {
    try {
      const parsed = JSON.parse(data)
      const result = type === 'format'
        ? JSON.stringify(parsed, null, 2)
        : JSON.stringify(parsed)
      setOutput(result)
      setParsedJson(type === 'format' ? parsed : undefined)
      setError('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setOutput('')
      setParsedJson(undefined)
    }
  }, [])

  /** Worker 处理大 JSON */
  const processInWorker = useCallback((type: 'format' | 'minify', data: string) => {
    setProcessing(true)
    const worker = getWorker()
    worker.onmessage = (event) => {
      const response = event.data
      if (response.success) {
        setOutput(response.result)
        // 大JSON不使用树形渲染（性能考虑），用纯文本
        setParsedJson(undefined)
        setError('')
      } else {
        setError(response.error)
        setOutput('')
        setParsedJson(undefined)
      }
      setProcessing(false)
    }
    worker.onerror = () => {
      setError('Worker 处理出错')
      setProcessing(false)
    }
    worker.postMessage({ type, data })
  }, [getWorker])

  /** 根据数据大小选择处理方式 */
  const processJson = useCallback((type: 'format' | 'minify') => {
    if (!input.trim()) { setError('请输入 JSON 数据'); return }
    const size = new Blob([input]).size
    if (size >= LARGE_JSON_THRESHOLD) {
      processInWorker(type, input)
    } else {
      processInMainThread(type, input)
    }
  }, [input, processInMainThread, processInWorker])

  const handleFormat = () => processJson('format')
  const handleMinify = () => processJson('minify')

  const handleCopy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch { setError('复制失败，请手动复制') }
  }

  const handleSave = () => {
    if (!input.trim() || !output) return
    addRecord(input, output)
  }

  const handleClear = () => {
    setInput(''); setOutput(''); setError(''); setParsedJson(undefined)
  }

  const handleLoadRecord = (record: { input: string; output: string }) => {
    setInput(record.input); setOutput(record.output); setError('')
    // 尝试解析以启用树形视图
    try { setParsedJson(JSON.parse(record.input)) } catch { setParsedJson(undefined) }
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
          JSON 格式化工具
        </h1>
      </header>

      {error && (
        <div className="mx-4 mb-4 p-3 text-sm" style={{ maxWidth: '1400px', margin: '0 auto 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#ef4444' }}>
          <strong>错误：</strong>{error}
        </div>
      )}

      {/* 主体三栏布局 */}
      <main className="json-formatter-main" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 16px 24px', display: 'grid', gap: '16px' }}>
        {/* 左侧：输入区 */}
        <div className="json-input-area" style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>输入 JSON</label>
          <textarea
            ref={textareaRef}
            className="theme-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴 JSON 数据..."
            style={{ height: `${editorHeight}px`, minHeight: '200px', maxHeight: '800px', resize: 'vertical', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', lineHeight: '1.6' }}
            spellCheck={false}
          />
        </div>

        {/* 中间：操作按钮列 */}
        <div className="json-actions-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <button className="theme-btn theme-btn-primary" onClick={handleFormat} disabled={processing} title="格式化 JSON">
            {processing ? '处理中...' : '格式化'}
          </button>
          <button className="theme-btn" onClick={handleMinify} disabled={processing} title="压缩 JSON">压缩</button>
          <button className="theme-btn" onClick={handleCopy} disabled={!output} title="复制结果">{copySuccess ? '已复制 ✓' : '复制'}</button>
          <button className="theme-btn" onClick={handleSave} disabled={!output} title="保存到历史记录">保存</button>
          <button className="theme-btn" onClick={handleClear} title="清空输入和输出">清空</button>
        </div>

        {/* 右侧：预览区 */}
        <div className="json-preview-area" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>结果预览</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button className="theme-btn" style={{ padding: '2px 8px', fontSize: '12px', lineHeight: 1 }} onClick={() => setFontSize((s) => Math.max(10, s - 1))} title="缩小字体">A-</button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'center' }}>{fontSize}px</span>
              <button className="theme-btn" style={{ padding: '2px 8px', fontSize: '12px', lineHeight: 1 }} onClick={() => setFontSize((s) => Math.min(24, s + 1))} title="放大字体">A+</button>
            </div>
          </div>
          <pre
            ref={previewRef}
            style={{
              height: `${editorHeight}px`,
              minHeight: '200px',
              maxHeight: '800px',
              margin: 0,
              padding: '16px',
              overflow: 'auto',
              background: 'var(--bg-secondary)',
              border: 'var(--border-width) solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: `${fontSize}px`,
              lineHeight: '1.6',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {parsedJson !== undefined ? (
              <JsonValue value={parsedJson} indent={0} fontSize={fontSize} />
            ) : output ? (
              <code>{output}</code>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>格式化结果将显示在这里...</span>
            )}
          </pre>
        </div>
      </main>

      {/* 底部可折叠历史记录面板 */}
      <section style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 16px 24px' }}>
        <button
          className="theme-btn"
          onClick={() => setHistoryOpen(!historyOpen)}
          style={{ width: '100%', justifyContent: 'flex-start', gap: '8px' }}
        >
          <span style={{ transform: historyOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
          历史记录 ({records.length}条)
        </button>

        {historyOpen && (
          <div style={{ marginTop: '12px', maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {records.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>暂无历史记录</p>
            ) : (
              records.map((record) => (
                <div key={record.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--bg-surface)', border: 'var(--border-width) solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(record.timestamp).toLocaleString()}</span>
                  <span className="text-sm" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{record.input.slice(0, 80)}</span>
                  <button className="theme-btn" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => handleLoadRecord(record)}>加载</button>
                  <button className="theme-btn" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => removeRecord(record.id)}>删除</button>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* 响应式样式 */}
      <style>{`
        .json-formatter-main {
          grid-template-columns: 1fr auto 1fr;
        }
        .json-actions-area {
          flex-direction: column;
        }
        @media (max-width: 768px) {
          .json-formatter-main {
            grid-template-columns: 1fr;
          }
          .json-actions-area {
            flex-direction: row;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  )
}
