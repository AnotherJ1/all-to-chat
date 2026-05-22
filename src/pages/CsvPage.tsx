import { useEffect, useMemo, useRef, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import { toast } from '../stores/toastStore'
import TablePreview from '../components/csv/TablePreview'
import { csvToJson, jsonToCsv, type CsvParseResult } from '../lib/csv/transform'

/** 工作方向 */
type Direction = 'csv-to-json' | 'json-to-csv'

/**
 * CSV ↔ JSON 工具页
 *
 * 设计要点：
 * - 顶部方向 tab：CSV→JSON / JSON→CSV
 * - 左输入区：textarea + 拖拽 / 点击上传 .csv 文件
 * - 右输出区：JSON 模式给原文 + 表格预览；CSV 模式给原文 + 解析回的表格预览
 * - 选项条：表头 / camelCase / 分隔符（auto/, /; /\t）/ 嵌套展平（仅 JSON→CSV）
 * - 一键复制 + 一键下载（.csv / .json）
 * - papaparse 通过 lib 层 await import() 懒加载，主包零增量
 */
export default function CsvPage() {
  const [direction, setDirection] = useState<Direction>('csv-to-json')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [parsed, setParsed] = useState<CsvParseResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 选项
  const [hasHeader, setHasHeader] = useState(true)
  const [camelCase, setCamelCase] = useState(false)
  const [delimiter, setDelimiter] = useState<'auto' | ',' | ';' | '\t'>('auto')
  const [doFlatten, setDoFlatten] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 切换方向时清空 IO，避免误读旧值 */
  function onSwitchDirection(next: Direction) {
    if (next === direction) return
    setDirection(next)
    setInput('')
    setOutput('')
    setParsed(null)
    setErrorMsg(null)
  }

  /** 真正的转换执行：根据方向调对应 lib 函数 */
  useEffect(() => {
    if (!input.trim()) {
      setOutput('')
      setParsed(null)
      setErrorMsg(null)
      return
    }
    let cancelled = false
    setBusy(true)
    ;(async () => {
      try {
        if (direction === 'csv-to-json') {
          const result = await csvToJson(input, {
            header: hasHeader,
            delimiter,
            camelCase,
          })
          if (cancelled) return
          setParsed(result)
          setOutput(JSON.stringify(result.data, null, 2))
          setErrorMsg(result.errors.length > 0 ? result.errors[0].message : null)
        } else {
          // JSON → CSV：先解析输入是否为合法 JSON 数组
          const arr = JSON.parse(input)
          if (!Array.isArray(arr)) {
            throw new Error('JSON → CSV 输入必须是数组（顶层 [...]）')
          }
          const csv = await jsonToCsv(arr, {
            delimiter: delimiter === 'auto' ? ',' : delimiter,
            flatten: doFlatten,
            header: hasHeader,
          })
          if (cancelled) return
          setOutput(csv)
          // 反向解析一次给表格预览
          try {
            const back = await csvToJson(csv, { header: hasHeader, delimiter })
            if (!cancelled) setParsed(back)
          } catch {
            /* 预览失败不影响主流程 */
          }
          setErrorMsg(null)
        }
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(msg)
        setOutput('')
        setParsed(null)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [input, direction, hasHeader, camelCase, delimiter, doFlatten])

  /** 处理拖拽 / 选择文件 */
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    // 仅做最小校验：扩展名 / MIME，过大文件 (>10MB) 给警告
    const isCsv = /\.csv$/i.test(file.name) || file.type.includes('csv')
    const isJson = /\.json$/i.test(file.name) || file.type.includes('json')
    if (direction === 'csv-to-json' && !isCsv && !isJson) {
      toast.error('请上传 .csv 文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.info('文件较大（>10MB），可能影响性能')
    }
    const text = await file.text()
    setInput(text)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  function onCopy() {
    if (!output) return
    navigator.clipboard
      .writeText(output)
      .then(() => toast.success('已复制到剪贴板'))
      .catch(() => toast.error('复制失败，请手动选中'))
  }

  function onDownload() {
    if (!output) return
    const isJson = direction === 'csv-to-json'
    const ext = isJson ? 'json' : 'csv'
    const mime = isJson ? 'application/json' : 'text/csv'
    const blob = new Blob([output], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `output.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`已下载 output.${ext}`)
  }

  /** 顶部 hint：从 parsed 得到的检测结果 */
  const detectedDelimiter = useMemo(() => {
    if (!parsed) return null
    const map: Record<string, string> = { ',': '逗号', ';': '分号', '\t': 'Tab' }
    return map[parsed.meta.delimiter] ?? `自定义(${JSON.stringify(parsed.meta.delimiter)})`
  }, [parsed])

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <BackToHome />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px 48px' }}>
        {/* 标题 + 方向 tab */}
        <div style={{ marginBottom: '20px' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-heading)',
            }}
          >
            CSV ↔ JSON
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            自动检测分隔符与表头，嵌套对象按 . 路径展平。papaparse 懒加载，主包零增量。
          </p>
        </div>

        <div className="csv-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['csv-to-json', 'json-to-csv'] as Direction[]).map((d) => (
            <button
              key={d}
              type="button"
              className="theme-btn"
              onClick={() => onSwitchDirection(d)}
              style={{
                // 与 MarkdownPage 选中态对齐：选中走 accent-1 + bg-primary 反相文字，
                // fallback 文字色用项目标准 var(--bg-primary) 而非硬编码 #fff，
                // 避免某些主题下 accent 是浅色时撞色看不清
                background: direction === d ? 'var(--accent-1)' : 'var(--bg-surface)',
                color: direction === d ? 'var(--bg-primary)' : 'var(--text-primary)',
                padding: '8px 16px',
                fontWeight: 700,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.05em',
              }}
            >
              {d === 'csv-to-json' ? 'CSV → JSON' : 'JSON → CSV'}
            </button>
          ))}
        </div>

        {/* 选项条 */}
        <div
          className="csv-options"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px 20px',
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
            首行表头
          </label>
          {direction === 'csv-to-json' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="checkbox" checked={camelCase} onChange={(e) => setCamelCase(e.target.checked)} />
              表头 camelCase
            </label>
          )}
          {direction === 'json-to-csv' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="checkbox" checked={doFlatten} onChange={(e) => setDoFlatten(e.target.checked)} />
              嵌套对象展平
            </label>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            分隔符：
            <select
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value as 'auto' | ',' | ';' | '\t')}
              className="theme-input"
              style={{ padding: '4px 8px', fontSize: '13px' }}
            >
              <option value="auto">自动</option>
              <option value=",">,（逗号）</option>
              <option value=";">;（分号）</option>
              <option value="\t">Tab</option>
            </select>
          </label>
          {detectedDelimiter && direction === 'csv-to-json' && (
            <span style={{ color: 'var(--text-muted)' }}>检测到：{detectedDelimiter}</span>
          )}
          {busy && <span style={{ color: 'var(--accent-primary)' }}>转换中…</span>}
        </div>

        {/* 主体：左输入 + 右输出 */}
        <div
          className="csv-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '16px',
          }}
        >
          {/* 左：输入 */}
          <div className="theme-card" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>
                {direction === 'csv-to-json' ? '输入 CSV' : '输入 JSON 数组'}
              </strong>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={direction === 'csv-to-json' ? '.csv,text/csv' : '.json,application/json'}
                  style={{ display: 'none' }}
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  type="button"
                  className="theme-btn"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  上传文件
                </button>
                <button
                  type="button"
                  className="theme-btn"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => setInput('')}
                >
                  清空
                </button>
              </div>
            </div>
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              style={{ position: 'relative' }}
            >
              <textarea
                className="theme-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  direction === 'csv-to-json'
                    ? '粘贴 CSV，或拖拽 .csv 文件到这里…\n例：name,age\nAlice,30\nBob,25'
                    : '粘贴 JSON 数组，或拖拽 .json 文件…\n例：[{"name":"Alice","age":30}]'
                }
                spellCheck={false}
                style={{
                  width: '100%',
                  minHeight: '320px',
                  padding: '10px 12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '13px',
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
              />
            </div>
            {errorMsg && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  background: 'color-mix(in srgb, #ef4444 12%, transparent)',
                  border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ef4444',
                  fontSize: '12.5px',
                }}
              >
                {errorMsg}
              </div>
            )}
          </div>

          {/* 右：输出 */}
          <div className="theme-card" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>
                {direction === 'csv-to-json' ? '输出 JSON' : '输出 CSV'}
              </strong>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="theme-btn"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={onCopy}
                  disabled={!output}
                >
                  复制
                </button>
                <button
                  type="button"
                  className="theme-btn"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={onDownload}
                  disabled={!output}
                >
                  下载
                </button>
              </div>
            </div>
            <textarea
              className="theme-input"
              readOnly
              value={output}
              placeholder="转换结果会显示在这里…"
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: '180px',
                padding: '10px 12px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                lineHeight: 1.5,
                resize: 'vertical',
                marginBottom: '12px',
              }}
            />
            <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>
              表格预览
            </strong>
            <TablePreview rows={parsed?.data ?? []} columns={parsed?.meta.fields} />
          </div>
        </div>
      </div>

      {/* 移动端响应式：≤768px 双栏改纵向堆叠 */}
      <style>{`
        @media (max-width: 768px) {
          .csv-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
