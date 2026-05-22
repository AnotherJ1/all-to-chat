import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BackToHome from '../components/common/BackToHome'
import FormatSelect from '../components/data-convert/FormatSelect'
import { toast } from '../stores/toastStore'
import type { DataFormat } from '../lib/data-convert/types'
import { FORMAT_LABELS } from '../lib/data-convert/types'
import { parseByFormat } from '../lib/data-convert/parsers'
import { serializeByFormat } from '../lib/data-convert/serializers'

/**
 * 数据格式互转页面
 *
 * 顶部：输入格式 / 输出格式两个下拉 + ↔ 交换 + （仅当输出=json）"在 JSON 中打开"
 * 主体：左输入 / 右输出 双栏
 * 错误：上方红色 panel 展示
 *
 * location.state 协议（与 /json 互通）：
 *   { from?: 'json', content?: string }
 *   - 若提供 content，预填到输入区
 *   - 若提供 from，预填输入格式
 */

interface NavState {
  from?: DataFormat
  content?: string
}

export default function DataConvertPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initState = (location.state || {}) as NavState

  const [fromFmt, setFromFmt] = useState<DataFormat>(initState.from ?? 'json')
  const [toFmt, setToFmt] = useState<DataFormat>('yaml')
  const [input, setInput] = useState<string>(initState.content ?? '')
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState<boolean>(false)

  // 顶部跳转按钮（仅当输出格式 = json 才显示）
  const canOpenInJson = toFmt === 'json' && !!output && !error

  /** 执行一次转换：input → IR → output */
  const runConvert = useCallback(async (text: string, from: DataFormat, to: DataFormat) => {
    if (!text.trim()) {
      setOutput('')
      setError('')
      setWarnings([])
      return
    }
    setBusy(true)
    try {
      const parsed = await parseByFormat(from, text)
      if (!parsed.ok) {
        setError(`解析 ${FORMAT_LABELS[from]} 失败：${parsed.error}`)
        setOutput('')
        setWarnings([])
        return
      }
      const ser = await serializeByFormat(to, parsed.ir)
      if (!ser.ok) {
        setError(`序列化为 ${FORMAT_LABELS[to]} 失败：${ser.error}`)
        setOutput('')
        setWarnings([])
        return
      }
      setOutput(ser.output ?? '')
      setError('')
      setWarnings(ser.warnings ?? [])
    } finally {
      setBusy(false)
    }
  }, [])

  // 输入 / 格式变更 → 自动转换（debounce 200ms）
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runConvert(input, fromFmt, toFmt)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [input, fromFmt, toFmt, runConvert])

  // 进入页面时若已有预填输入则跑一次
  useEffect(() => {
    if (initState.content) {
      void runConvert(initState.content, initState.from ?? 'json', toFmt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 交换输入/输出格式 + 内容（基于当前显示态） */
  const handleSwap = () => {
    const newFrom = toFmt
    const newTo = fromFmt
    const newInput = output
    setFromFmt(newFrom)
    setToFmt(newTo)
    setInput(newInput)
  }

  /** 复制输出 */
  const handleCopy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  /** 跳转到 /json 工具，预填当前 output */
  const handleOpenInJson = () => {
    navigate('/json', { state: { content: output } })
  }

  /** 清空 */
  const handleClear = () => {
    setInput('')
    setOutput('')
    setError('')
    setWarnings([])
  }

  // 占位文案（输入区根据格式不同提示不同样例）
  const placeholder = useMemo(() => {
    switch (fromFmt) {
      case 'json': return '{\n  "name": "demo",\n  "version": "1.0.0"\n}'
      case 'yaml': return 'name: demo\nversion: 1.0.0'
      case 'toml': return 'name = "demo"\nversion = "1.0.0"'
      case 'xml': return '<root>\n  <name>demo</name>\n  <version>1.0.0</version>\n</root>'
      case 'env': return 'NAME=demo\nVERSION=1.0.0'
      case 'properties': return 'name=demo\nversion=1.0.0'
    }
  }, [fromFmt])

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-4 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
          数据格式互转
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
          JSON · YAML · TOML · XML · .env · .properties &nbsp;任意互转
        </p>
      </header>

      {/* 顶部工具栏：格式选择 + 操作按钮 */}
      <section style={{ maxWidth: '1400px', margin: '0 auto 12px', padding: '0 16px' }}>
        <div className="dc-toolbar" style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          background: 'var(--bg-surface)',
          border: 'var(--border-width) solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>输入</span>
          <FormatSelect value={fromFmt} onChange={setFromFmt} ariaLabel="输入格式" />

          <button
            type="button"
            className="theme-btn"
            onClick={handleSwap}
            title="交换输入/输出"
            aria-label="交换输入与输出"
          >
            ↔ 交换
          </button>

          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>输出</span>
          <FormatSelect value={toFmt} onChange={setToFmt} ariaLabel="输出格式" />

          <div style={{ flex: 1 }} />

          <button type="button" className="theme-btn" onClick={handleCopy} disabled={!output}>
            复制
          </button>
          <button type="button" className="theme-btn" onClick={handleClear}>
            清空
          </button>
          {canOpenInJson && (
            <button type="button" className="theme-btn theme-btn-primary" onClick={handleOpenInJson}>
              在 JSON 中打开 →
            </button>
          )}
        </div>

        {/* 错误 panel */}
        {error && (
          <div
            role="alert"
            style={{
              marginTop: '10px',
              padding: '10px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-sm)',
              color: '#ef4444',
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            <strong>错误：</strong>{error}
          </div>
        )}

        {/* 警告 panel（有损警告，黄色） */}
        {warnings.length > 0 && (
          <div
            role="status"
            style={{
              marginTop: '10px',
              padding: '10px 12px',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              borderRadius: 'var(--radius-sm)',
              color: '#eab308',
              fontSize: '13px',
            }}
          >
            <strong>注意：</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* 主体双栏 */}
      <main className="dc-main" style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 16px 24px',
        display: 'grid',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
            输入（{FORMAT_LABELS[fromFmt]}）
          </label>
          <textarea
            className="theme-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            style={{
              minHeight: '420px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
            输出（{FORMAT_LABELS[toFmt]}）{busy && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> · 转换中...</span>}
          </label>
          <pre
            style={{
              minHeight: '420px',
              margin: 0,
              padding: '12px',
              background: 'var(--bg-secondary)',
              border: 'var(--border-width) solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              lineHeight: '1.6',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              overflow: 'auto',
            }}
          >
            {output || <span style={{ color: 'var(--text-muted)' }}>转换结果将显示在这里...</span>}
          </pre>
        </div>
      </main>

      {/* 响应式：≤768 单栏纵向 */}
      <style>{`
        .dc-main {
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 768px) {
          .dc-main {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
