import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import { diffText, type DiffLine } from '../lib/text-diff'
import { tryParseJson } from '../lib/diff/json-diff'
import JsonDiffView from '../components/diff/JsonDiffView'
import { useDiffStore, type DiffMode } from '../stores/diffStore'
import { toast } from '../stores/toastStore'

/**
 * 文本对比工具
 * - 行级 LCS diff
 * - 双栏对照视图（split）/ 单栏统一视图（unified）
 * - 支持忽略大小写、忽略前后空白
 */

type ViewMode = 'split' | 'unified'

const DIFF_COLORS = {
  add: { bg: 'rgba(34,197,94,0.12)', accent: '#22c55e' },
  remove: { bg: 'rgba(239,68,68,0.12)', accent: '#ef4444' },
}

export default function DiffPage() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [ignoreWs, setIgnoreWs] = useState(false)
  const [view, setView] = useState<ViewMode>('split')

  // 来自持久化 store：JSON 模式偏好
  const mode = useDiffStore((s) => s.mode)
  const setMode = useDiffStore((s) => s.setMode)
  const sortArrayKeys = useDiffStore((s) => s.sortArrayKeys)
  const setSortArrayKeys = useDiffStore((s) => s.setSortArrayKeys)

  // 大文本时延迟计算，避免输入卡顿
  const deferredLeft = useDeferredValue(left)
  const deferredRight = useDeferredValue(right)

  // 智能识别：两侧均合法 JSON → 走结构化对比
  const leftJson = useMemo(() => tryParseJson(deferredLeft), [deferredLeft])
  const rightJson = useMemo(() => tryParseJson(deferredRight), [deferredRight])

  /** 实际渲染模式：auto 时根据 JSON 解析结果决策 */
  const effectiveMode: 'text' | 'json' = useMemo(() => {
    if (mode === 'text') return 'text'
    if (mode === 'json') return 'json'
    // auto
    return leftJson.ok && rightJson.ok ? 'json' : 'text'
  }, [mode, leftJson.ok, rightJson.ok])

  const result = useMemo(
    () => diffText(deferredLeft, deferredRight, { ignoreCase, ignoreWhitespace: ignoreWs }),
    [deferredLeft, deferredRight, ignoreCase, ignoreWs],
  )

  // 差异块导航：把连续的非 equal 行合并成一个「差异块」
  const diffBlocks = useMemo(() => {
    const blocks: number[] = []
    let inBlock = false
    result.lines.forEach((line, idx) => {
      if (line.op !== 'equal') {
        if (!inBlock) {
          blocks.push(idx)
          inBlock = true
        }
      } else {
        inBlock = false
      }
    })
    return blocks
  }, [result.lines])

  const [currentBlock, setCurrentBlock] = useState(-1)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // 输入或选项变化时重置导航位置
  useEffect(() => {
    setCurrentBlock(-1)
  }, [diffBlocks])

  /** 滚动到指定差异块；direction: 'next' / 'prev' */
  const goToBlock = (direction: 'next' | 'prev') => {
    if (diffBlocks.length === 0) {
      toast.info('没有差异')
      return
    }
    let next: number
    if (direction === 'next') {
      next = currentBlock < 0 ? 0 : (currentBlock + 1) % diffBlocks.length
    } else {
      next = currentBlock <= 0 ? diffBlocks.length - 1 : currentBlock - 1
    }
    setCurrentBlock(next)

    // 延迟一帧等 DOM 渲染高亮样式
    requestAnimationFrame(() => {
      const lineIdx = diffBlocks[next]
      const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-diff-line="${lineIdx}"]`)
      if (el && scrollerRef.current) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    })
  }

  const handleSwap = () => {
    setLeft(right)
    setRight(left)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>文本对比</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          行级 diff，支持忽略大小写 / 空白
        </p>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 工具条 */}
        <section
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {/* 模式切换：auto / text / json */}
          <div style={{ display: 'flex', gap: '6px' }} data-testid="mode-toggle">
            {(['auto', 'text', 'json'] as DiffMode[]).map((m) => (
              <button
                key={m}
                className={`theme-btn ${mode === m ? 'theme-btn-primary' : ''}`}
                style={{ padding: '6px 14px', fontSize: '13px' }}
                onClick={() => setMode(m)}
                data-testid={`mode-${m}`}
                title={
                  m === 'auto'
                    ? '自动：两侧合法 JSON 时走结构化'
                    : m === 'text'
                      ? '强制文本对比'
                      : '强制 JSON 结构化对比'
                }
              >
                {m === 'auto' ? '自动' : m === 'text' ? '文本' : 'JSON'}
              </button>
            ))}
          </div>

          {/* 视图切换（仅文本模式生效） */}
          {effectiveMode === 'text' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['split', 'unified'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  className={`theme-btn ${view === m ? 'theme-btn-primary' : ''}`}
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  onClick={() => setView(m)}
                >
                  {m === 'split' ? '双栏对照' : '统一视图'}
                </button>
              ))}
            </div>
          )}

          {/* 选项：文本模式与 JSON 模式分别显示 */}
          {effectiveMode === 'text' ? (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} />
                忽略大小写
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={ignoreWs} onChange={(e) => setIgnoreWs(e.target.checked)} />
                忽略前后空白
              </label>
            </>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sortArrayKeys}
                onChange={(e) => setSortArrayKeys(e.target.checked)}
                data-testid="sort-array-keys"
              />
              数组顺序无关
            </label>
          )}

          {/* 统计：仅文本模式显示行级 add/remove */}
          {effectiveMode === 'text' && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', fontSize: '13px', alignItems: 'center' }}>
              <span style={{ color: DIFF_COLORS.add.accent, fontWeight: 600 }}>+ {result.stat.added}</span>
              <span style={{ color: DIFF_COLORS.remove.accent, fontWeight: 600 }}>- {result.stat.removed}</span>
              <span style={{ color: 'var(--text-muted)' }}>= {result.stat.unchanged}</span>
            </div>
          )}
          {effectiveMode === 'json' && (
            <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
              JSON 结构化对比
            </div>
          )}

          <button className="theme-btn" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={handleSwap}>
            互换
          </button>
          <button
            className="theme-btn"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => { setLeft(''); setRight('') }}
          >
            清空
          </button>
        </section>

        {/* 输入区 */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>原始文本（左）</label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{left.split('\n').length} 行 · {left.length} 字符</span>
            </div>
            <textarea
              className="theme-input"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              placeholder="粘贴原始文本..."
              style={{ minHeight: '180px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', resize: 'vertical' }}
              spellCheck={false}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>对比文本（右）</label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{right.split('\n').length} 行 · {right.length} 字符</span>
            </div>
            <textarea
              className="theme-input"
              value={right}
              onChange={(e) => setRight(e.target.value)}
              placeholder="粘贴待对比文本..."
              style={{ minHeight: '180px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', resize: 'vertical' }}
              spellCheck={false}
            />
          </div>
        </section>

        {/* 对比结果 */}
        <section
          style={{
            background: 'var(--bg-surface)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 16px',
              borderBottom: 'var(--border-width) solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 600 }}>对比结果</span>

            {/* 差异块导航 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="theme-btn"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => goToBlock('prev')}
                disabled={diffBlocks.length === 0}
                title="跳转到上一处差异（Shift+Enter）"
              >
                ↑ 上一处
              </button>
              <button
                className="theme-btn"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => goToBlock('next')}
                disabled={diffBlocks.length === 0}
                title="跳转到下一处差异（Enter）"
              >
                ↓ 下一处
              </button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '70px' }}>
                {diffBlocks.length === 0
                  ? '无差异'
                  : `${currentBlock < 0 ? '–' : currentBlock + 1} / ${diffBlocks.length}`}
              </span>
            </div>

            {result.lines.length > 0 && (
              <button
                className="theme-btn"
                style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '12px' }}
                onClick={() => copy(formatPatch(result.lines))}
              >
                复制 patch 格式
              </button>
            )}
          </div>

          {result.lines.length === 0 || (!left && !right) ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              在两个文本框中输入内容以查看差异
            </div>
          ) : effectiveMode === 'json' ? (
            <JsonDiffViewSlot
              leftRaw={deferredLeft}
              rightRaw={deferredRight}
              leftJsonOk={leftJson.ok}
              rightJsonOk={rightJson.ok}
              leftValue={leftJson.ok ? leftJson.value : undefined}
              rightValue={rightJson.ok ? rightJson.value : undefined}
              leftErr={!leftJson.ok ? leftJson.error : ''}
              rightErr={!rightJson.ok ? rightJson.error : ''}
              sortArrayKeys={sortArrayKeys}
            />
          ) : view === 'split' ? (
            <SplitView
              lines={result.lines}
              scrollerRef={scrollerRef}
              activeLineIdx={currentBlock >= 0 ? diffBlocks[currentBlock] : -1}
            />
          ) : (
            <UnifiedView
              lines={result.lines}
              scrollerRef={scrollerRef}
              activeLineIdx={currentBlock >= 0 ? diffBlocks[currentBlock] : -1}
            />
          )}
        </section>
      </main>
    </div>
  )
}

/** 双栏视图：成对显示左右两侧的行 */
function SplitView({
  lines,
  scrollerRef,
  activeLineIdx,
}: {
  lines: DiffLine[]
  scrollerRef: React.MutableRefObject<HTMLDivElement | null>
  activeLineIdx: number
}) {
  // 把 diff 行重新排列为左右两栏的对齐结构，并记录每行对应的原始 lines 索引
  type Pair = { left?: DiffLine; right?: DiffLine; lineIdx: number }
  const pairs: Pair[] = []
  let i = 0
  while (i < lines.length) {
    const cur = lines[i]
    if (cur.op === 'equal') {
      pairs.push({ left: cur, right: cur, lineIdx: i })
      i++
    } else {
      // 收集连续的 remove + add 块，按顺序两两配对
      const blockStart = i
      const removes: Array<{ line: DiffLine; idx: number }> = []
      const adds: Array<{ line: DiffLine; idx: number }> = []
      while (i < lines.length && (lines[i].op === 'remove' || lines[i].op === 'add')) {
        if (lines[i].op === 'remove') removes.push({ line: lines[i], idx: i })
        else adds.push({ line: lines[i], idx: i })
        i++
      }
      const max = Math.max(removes.length, adds.length)
      for (let k = 0; k < max; k++) {
        // 整个差异块共用块起点 idx，便于导航高亮
        pairs.push({ left: removes[k]?.line, right: adds[k]?.line, lineIdx: blockStart })
      }
    }
  }

  return (
    <div ref={scrollerRef} style={{ overflow: 'auto', maxHeight: '700px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '50px' }} />
          <col style={{ width: 'calc(50% - 50px)' }} />
          <col style={{ width: '50px' }} />
          <col style={{ width: 'calc(50% - 50px)' }} />
        </colgroup>
        <tbody>
          {pairs.map((p, idx) => {
            const isActive = activeLineIdx >= 0 && p.lineIdx === activeLineIdx
            return (
              <tr
                key={idx}
                data-diff-line={p.lineIdx}
                style={isActive ? { outline: '2px solid var(--accent-1, #6366f1)', outlineOffset: '-2px' } : undefined}
              >
                <LineNo no={p.left?.leftNo} op={p.left?.op} />
                <LineCell line={p.left} side="left" />
                <LineNo no={p.right?.rightNo} op={p.right?.op} />
                <LineCell line={p.right} side="right" />
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** 统一视图：按 patch 风格上下排列 */
function UnifiedView({
  lines,
  scrollerRef,
  activeLineIdx,
}: {
  lines: DiffLine[]
  scrollerRef: React.MutableRefObject<HTMLDivElement | null>
  activeLineIdx: number
}) {
  // 计算每一行所属的差异块起点 idx（用于高亮整块）
  const blockStartByLine = useMemo(() => {
    const arr = new Array<number>(lines.length).fill(-1)
    let blockStart = -1
    lines.forEach((line, idx) => {
      if (line.op !== 'equal') {
        if (blockStart < 0) blockStart = idx
        arr[idx] = blockStart
      } else {
        blockStart = -1
      }
    })
    return arr
  }, [lines])

  return (
    <div ref={scrollerRef} style={{ overflow: 'auto', maxHeight: '700px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '60px' }} />
          <col style={{ width: '60px' }} />
          <col style={{ width: '24px' }} />
          <col />
        </colgroup>
        <tbody>
          {lines.map((line, idx) => {
            const bg = line.op === 'add' ? DIFF_COLORS.add.bg : line.op === 'remove' ? DIFF_COLORS.remove.bg : 'transparent'
            const sign = line.op === 'add' ? '+' : line.op === 'remove' ? '-' : ' '
            const signColor = line.op === 'add' ? DIFF_COLORS.add.accent : line.op === 'remove' ? DIFF_COLORS.remove.accent : 'var(--text-muted)'
            const blockIdx = blockStartByLine[idx]
            const isActive = activeLineIdx >= 0 && blockIdx === activeLineIdx
            return (
              <tr
                key={idx}
                data-diff-line={blockIdx >= 0 ? blockIdx : ''}
                style={{
                  background: bg,
                  ...(isActive ? { outline: '2px solid var(--accent-1, #6366f1)', outlineOffset: '-2px' } : null),
                }}
              >
                <td style={lineNoStyle}>{line.leftNo ?? ''}</td>
                <td style={lineNoStyle}>{line.rightNo ?? ''}</td>
                <td style={{ padding: '0 6px', color: signColor, fontWeight: 700, textAlign: 'center', userSelect: 'none' }}>{sign}</td>
                <td style={contentCellStyle}>{line.content || '\u00A0'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const lineNoStyle: React.CSSProperties = {
  padding: '2px 8px',
  textAlign: 'right',
  color: 'var(--text-muted)',
  fontSize: '12px',
  userSelect: 'none',
  borderRight: '1px solid var(--border-color)',
  whiteSpace: 'nowrap',
}

const contentCellStyle: React.CSSProperties = {
  padding: '2px 12px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  color: 'var(--text-primary)',
}

function LineNo({ no, op }: { no?: number; op?: DiffLine['op'] }) {
  const bg = op === 'add' ? DIFF_COLORS.add.bg : op === 'remove' ? DIFF_COLORS.remove.bg : 'transparent'
  return <td style={{ ...lineNoStyle, background: bg }}>{no ?? ''}</td>
}

function LineCell({ line, side }: { line?: DiffLine; side: 'left' | 'right' }) {
  if (!line) {
    return <td style={{ ...contentCellStyle, background: 'var(--bg-secondary)' }}>&nbsp;</td>
  }
  const isAdd = line.op === 'add'
  const isRemove = line.op === 'remove'
  // 双栏视图：左侧只显示 equal/remove，右侧只显示 equal/add
  const shouldShow = side === 'left' ? !isAdd : !isRemove
  if (!shouldShow) {
    return <td style={{ ...contentCellStyle, background: 'var(--bg-secondary)' }}>&nbsp;</td>
  }
  const bg = isAdd ? DIFF_COLORS.add.bg : isRemove ? DIFF_COLORS.remove.bg : 'transparent'
  return <td style={{ ...contentCellStyle, background: bg }}>{line.content || '\u00A0'}</td>
}

/** 转成 unified patch 格式（不带 hunk header） */
function formatPatch(lines: DiffLine[]): string {
  return lines
    .map((l) => {
      if (l.op === 'add') return '+' + l.content
      if (l.op === 'remove') return '-' + l.content
      return ' ' + l.content
    })
    .join('\n')
}

/**
 * JSON 模式槽位：处理「强制 JSON 但解析失败」的友好提示
 * - auto 模式由上层智能判定，不会进入这里
 * - 强制 JSON 时若任一侧解析失败，提示用户切换文本模式
 */
function JsonDiffViewSlot(props: {
  leftRaw: string
  rightRaw: string
  leftJsonOk: boolean
  rightJsonOk: boolean
  leftValue: unknown
  rightValue: unknown
  leftErr: string
  rightErr: string
  sortArrayKeys: boolean
}) {
  const { leftJsonOk, rightJsonOk, leftValue, rightValue, leftErr, rightErr, sortArrayKeys } = props
  if (!leftJsonOk || !rightJsonOk) {
    return (
      <div style={{ padding: '24px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        <div style={{ color: '#ef4444', marginBottom: '8px', fontWeight: 600 }}>JSON 解析失败</div>
        {!leftJsonOk && <div>左侧：{leftErr || '非合法 JSON'}</div>}
        {!rightJsonOk && <div>右侧：{rightErr || '非合法 JSON'}</div>}
        <div style={{ marginTop: '12px', color: 'var(--text-muted)' }}>
          请切换到「文本」或「自动」模式继续对比。
        </div>
      </div>
    )
  }
  return <JsonDiffView left={leftValue} right={rightValue} sortArrayKeys={sortArrayKeys} />
}
