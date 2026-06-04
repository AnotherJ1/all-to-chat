import { useState, useCallback, useRef } from 'react'
import BackToHome from '../components/common/BackToHome'
import { parseMybatisLog, type ParseResult } from '../lib/mybatis-parser'
import { useMybatisHistoryStore, type MybatisRecord } from '../stores/mybatisHistoryStore'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'

// 注册 SQL 语言高亮
hljs.registerLanguage('sql', sql)

/**
 * MyBatis 日志转 SQL 工具页面
 * 功能：粘贴日志自动解析、SQL高亮展示、复制、历史记录管理
 */
export default function MybatisLogPage() {
  const [inputLog, setInputLog] = useState('')
  const [results, setResults] = useState<ParseResult[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { records, addRecord, removeRecord } = useMybatisHistoryStore()

  // 解析日志并自动保存
  const handleParse = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setResults([])
        return
      }
      const parsed = parseMybatisLog(text)
      setResults(parsed)
      // 解析成功且有结果时自动保存到 store
      if (parsed.length > 0) {
        addRecord({
          rawLog: text,
          parsedSqls: parsed.map((r) => r.sql),
        })
      }
    },
    [addRecord]
  )

  // 输入变化时自动解析
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setInputLog(value)
      handleParse(value)
    },
    [handleParse]
  )

  // 复制 SQL 到剪贴板
  const handleCopy = useCallback(async (sqlText: string, index: number) => {
    try {
      await navigator.clipboard.writeText(sqlText)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = sqlText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }, [])

  // 查看历史记录：填入输入框并重新解析
  const handleViewRecord = useCallback((record: MybatisRecord) => {
    setInputLog(record.rawLog)
    const parsed = parseMybatisLog(record.rawLog)
    setResults(parsed)
    // 滚动到顶部
    inputRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // HTML 转义（高亮失败时兜底，避免原始输入注入 DOM 造成 XSS）
  const escapeHtml = useCallback((s: string): string => {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }, [])

  // SQL 高亮渲染
  const highlightSql = useCallback((sqlText: string): string => {
    try {
      return hljs.highlight(sqlText, { language: 'sql' }).value
    } catch {
      // 高亮失败时返回转义后的文本，绝不把原始输入直接交给 dangerouslySetInnerHTML
      return escapeHtml(sqlText)
    }
  }, [escapeHtml])

  // 格式化时间戳
  const formatTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* 返回首页按钮 */}
      <BackToHome />

      {/* 页面主体 */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 20px 40px' }}>
        {/* 标题 */}
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.5rem',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '24px',
            color: 'var(--text-primary)',
          }}
        >
          MyBatis 日志转 SQL
        </h1>

        {/* 输入区域 */}
        <section style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
            }}
          >
            粘贴 MyBatis 日志（支持批量）
          </label>
          <textarea
            ref={inputRef}
            value={inputLog}
            onChange={handleInputChange}
            placeholder={'==>  Preparing: SELECT * FROM user WHERE id = ?\n==> Parameters: 1(Integer)'}
            className="theme-input"
            style={{
              minHeight: '160px',
              resize: 'vertical',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: '1.6',
            }}
          />
        </section>

        {/* 解析结果区域 */}
        {results.length > 0 && (
          <section style={{ marginBottom: '24px' }}>
            <h2
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '12px',
              }}
            >
              解析结果（{results.length} 条 SQL）
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {results.map((result, index) => (
                <div
                  key={index}
                  style={{
                    background: 'var(--bg-surface)',
                    border: 'var(--border-width) solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '14px 16px',
                    position: 'relative',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      color: 'var(--text-primary)',
                    }}
                    dangerouslySetInnerHTML={{ __html: highlightSql(result.sql) }}
                  />
                  <button
                    className="theme-btn"
                    onClick={() => handleCopy(result.sql, index)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      padding: '4px 10px',
                      fontSize: '12px',
                    }}
                  >
                    {copiedIndex === index ? '已复制' : '复制'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 历史记录区域 */}
        {records.length > 0 && (
          <section>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-body)',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: showHistory ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                ▶
              </span>
              历史记录（{records.length} 条）
            </button>

            {showHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {records.map((record) => (
                  <div
                    key={record.id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: 'var(--border-width) solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    {/* 时间 */}
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {formatTime(record.timestamp)}
                    </span>

                    {/* SQL 预览 */}
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {record.parsedSqls[0] || '(空)'}
                    </span>

                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        className="theme-btn"
                        onClick={() => handleViewRecord(record)}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        查看
                      </button>
                      <button
                        className="theme-btn"
                        onClick={() => removeRecord(record.id)}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
