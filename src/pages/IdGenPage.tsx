import { useMemo, useState } from 'react'
import { saveAs } from 'file-saver'
import BackToHome from '../components/common/BackToHome'
import { toast } from '../stores/toastStore'
import IdControls, { DEFAULT_CONTROLS, type IdControlsState, type IdKindKey } from '../components/id/IdControls'
import IdParser from '../components/id/IdParser'
import {
  genNanoid,
  genRandom,
  genSnowflake,
  genUlid,
  genUuidV1,
  genUuidV4,
  genUuidV7,
} from '../lib/id/generators'

/**
 * ID 生成器页面
 * - 上方：类型 tab
 * - 中部：参数表单 + 数量 + 生成
 * - 下方：输出区，支持复制 / 导出 .txt / .csv
 * - 末尾：反解析组件
 */

const KINDS: Array<{ key: IdKindKey; label: string }> = [
  { key: 'uuid-v4', label: 'UUID v4' },
  { key: 'uuid-v1', label: 'UUID v1' },
  { key: 'uuid-v7', label: 'UUID v7' },
  { key: 'nanoid', label: 'NanoID' },
  { key: 'snowflake', label: 'Snowflake' },
  { key: 'ulid', label: 'ULID' },
  { key: 'random', label: '随机串' },
]

export default function IdGenPage() {
  const [kind, setKind] = useState<IdKindKey>('uuid-v4')
  const [controls, setControls] = useState<IdControlsState>(DEFAULT_CONTROLS)
  const [count, setCount] = useState(10)
  const [results, setResults] = useState<string[]>([])

  const kindLabel = useMemo(() => KINDS.find((k) => k.key === kind)?.label ?? kind, [kind])

  /** 单次生成一个 ID */
  const genOne = (): string => {
    switch (kind) {
      case 'uuid-v1':
        return genUuidV1()
      case 'uuid-v4':
        return genUuidV4()
      case 'uuid-v7':
        return genUuidV7()
      case 'nanoid':
        return genNanoid(controls.nanoidLength, controls.nanoidAlphabet || undefined)
      case 'snowflake':
        return genSnowflake({
          workerId: controls.workerId,
          datacenterId: controls.datacenterId,
          epoch: controls.epoch,
        })
      case 'ulid':
        return genUlid()
      case 'random':
        return genRandom(controls.randomLength, controls.randomCharset)
    }
  }

  const handleGenerate = () => {
    const n = Math.max(1, Math.min(10000, Math.floor(count)))
    try {
      const out: string[] = new Array(n)
      for (let i = 0; i < n; i++) out[i] = genOne()
      setResults(out)
      toast.success(`已生成 ${n} 个 ${kindLabel}`)
    } catch (e) {
      toast.error('生成失败：' + (e as Error).message)
    }
  }

  const handleCopyAll = async () => {
    if (!results.length) return
    try {
      await navigator.clipboard.writeText(results.join('\n'))
      toast.success(`已复制 ${results.length} 项`)
    } catch {
      toast.error('复制失败')
    }
  }

  const handleCopyOne = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s)
      toast.success('已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleExportTxt = () => {
    if (!results.length) return
    const blob = new Blob([results.join('\n')], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `${kind}-${results.length}.txt`)
  }

  const handleExportCsv = () => {
    if (!results.length) return
    // CSV 转义：含 , 或 " 的字段加引号
    const escape = (s: string) =>
      /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    const csv = ['index,id', ...results.map((r, i) => `${i + 1},${escape(r)}`)].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, `${kind}-${results.length}.csv`)
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          ID 生成器
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          UUID / NanoID / Snowflake / ULID / 随机串 — 批量生成与反解析
        </p>
      </header>

      <main
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 16px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* 类型 tab */}
        <section className="theme-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {KINDS.map((k) => {
              const active = k.key === kind
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => setKind(k.key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'var(--border-width) solid var(--border-color)',
                    background: active ? 'var(--accent-color, rgba(99,102,241,0.15))' : 'var(--bg-secondary)',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 400,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {k.label}
                </button>
              )
            })}
          </div>
        </section>

        {/* 参数 */}
        <section className="theme-card" style={{ padding: '20px 24px' }}>
          <h2 className="font-semibold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
            {kindLabel} 参数
          </h2>
          <IdControls kind={kind} state={controls} onChange={setControls} />

          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>数量 (1-10000)</span>
              <input
                type="number"
                className="theme-input"
                value={count}
                min={1}
                max={10000}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n)) setCount(Math.max(1, Math.min(10000, Math.floor(n))))
                }}
                style={{ width: '140px', fontFamily: "'JetBrains Mono', monospace" }}
              />
            </label>
            <button className="theme-btn" type="button" onClick={handleGenerate} style={{ minWidth: '120px' }}>
              生成
            </button>
          </div>
        </section>

        {/* 输出区 */}
        {results.length > 0 && (
          <section className="theme-card" style={{ padding: '20px 24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '12px',
              }}
            >
              <h2 className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
                输出（{results.length}）
              </h2>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="theme-btn" type="button" onClick={handleCopyAll}>
                  全部复制
                </button>
                <button className="theme-btn" type="button" onClick={handleExportTxt}>
                  导出 .txt
                </button>
                <button className="theme-btn" type="button" onClick={handleExportCsv}>
                  导出 .csv
                </button>
              </div>
            </div>

            <div
              style={{
                maxHeight: '420px',
                overflowY: 'auto',
                border: 'var(--border-width) solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)',
              }}
            >
              {results.slice(0, 1000).map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', minWidth: '40px', fontFamily: "'JetBrains Mono', monospace" }}>
                    #{i + 1}
                  </span>
                  <code style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all' }}>{r}</code>
                  <button
                    type="button"
                    onClick={() => handleCopyOne(r)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'var(--border-width) solid var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    复制
                  </button>
                </div>
              ))}
              {results.length > 1000 && (
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  仅展示前 1000 条，导出可获得全部 {results.length} 条
                </div>
              )}
            </div>
          </section>
        )}

        {/* 反解析 */}
        <IdParser />
      </main>
    </div>
  )
}
