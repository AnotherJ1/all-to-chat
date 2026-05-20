import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import { toast } from '../stores/toastStore'
import type {
  CanvasPreset,
  CanvasSize,
  CollageItem,
  InteractionMode,
  ResizeCorner,
} from '../types/collage'
import {
  canvasSizeFromPreset,
  clampCanvasDimension,
  clampItemToCanvas,
  composeCollage,
  copyBlobToClipboard,
  downloadBlob,
  MAX_CANVAS_DIMENSION,
  MAX_ITEMS_PER_CANVAS,
  MIN_CANVAS_DIMENSION,
  PRESET_LABEL_MAP,
  placeNewItem,
  resizeBoxByCorner,
} from '../lib/collage'

/**
 * 自由拼图工具
 * - 多图自由画布：拖动、4 角等比缩放
 * - 画布支持预设比例 + 自定义像素
 * - 一键导出 PNG / JPG / 剪贴板
 *
 * 性能要点：
 * - 画布按 displayScale 缩放显示，交互坐标全部基于画布坐标系
 * - 鼠标事件用 pointer events 统一桌面 + 触屏
 * - ObjectURL 在卸载/清空时统一 revoke
 */

const PRESETS: CanvasPreset[] = ['1:1', '16:9', '9:16', '4:3', 'A4', 'custom']
const HANDLE_CORNERS: ResizeCorner[] = ['nw', 'ne', 'sw', 'se']
/** 画布显示区最大宽/高（px），实际 displayScale 由此推导 */
const MAX_DISPLAY_W = 720
const MAX_DISPLAY_H = 540

export default function CollagePage() {
  const [canvas, setCanvas] = useState<CanvasSize>(() => canvasSizeFromPreset('1:1'))
  const [items, setItems] = useState<CollageItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [interaction, setInteraction] = useState<InteractionMode>({ type: 'idle' })
  const [exporting, setExporting] = useState(false)
  const [jpgQuality, setJpgQuality] = useState(0.92)
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  /** 已生成的 ObjectURL 列表，用于卸载时统一释放 */
  const objectUrlsRef = useRef<string[]>([])

  // 卸载时释放所有 ObjectURL
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      objectUrlsRef.current = []
    }
  }, [])

  // 计算画布显示缩放比：在保持比例前提下塞进 MAX_DISPLAY_W x MAX_DISPLAY_H
  const displayScale = useMemo(() => {
    const sx = MAX_DISPLAY_W / canvas.width
    const sy = MAX_DISPLAY_H / canvas.height
    return Math.min(1, sx, sy)
  }, [canvas.width, canvas.height])

  const displayW = canvas.width * displayScale
  const displayH = canvas.height * displayScale

  // ============ 添加图片 ============

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) {
      toast.error('请选择图片文件')
      return
    }
    if (items.length + list.length > MAX_ITEMS_PER_CANVAS) {
      toast.error(`画布最多容纳 ${MAX_ITEMS_PER_CANVAS} 张图片`)
      return
    }
    const added: CollageItem[] = []
    for (const file of list) {
      try {
        const url = URL.createObjectURL(file)
        objectUrlsRef.current.push(url)
        const dims = await loadImageDims(url)
        const placed = placeNewItem(canvas, dims.w, dims.h)
        added.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          src: url,
          naturalWidth: dims.w,
          naturalHeight: dims.h,
          x: placed.x,
          y: placed.y,
          width: placed.width,
          height: placed.height,
          fileName: file.name,
        })
      } catch (err) {
        console.warn('[collage] 加载失败', err)
      }
    }
    if (added.length > 0) {
      setItems((prev) => [...prev, ...added])
      setSelectedId(added[added.length - 1].id)
      toast.success(`已添加 ${added.length} 张图片`)
    }
  }, [canvas, items.length])

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  // 全局粘贴：从剪贴板粘贴图片
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const it = e.clipboardData?.items
      if (!it) return
      const files: File[] = []
      for (let i = 0; i < it.length; i++) {
        if (it[i].kind === 'file' && it[i].type.startsWith('image/')) {
          const f = it[i].getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length > 0) {
        addFiles(files)
        e.preventDefault()
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addFiles])

  // ============ 画布交互（拖动/缩放） ============

  /** 把屏幕坐标转为画布坐标系（画布原始尺寸） */
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left) / displayScale,
      y: (clientY - rect.top) / displayScale,
    }
  }, [displayScale])

  const onItemPointerDown = (e: React.PointerEvent, item: CollageItem) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const pt = screenToCanvas(e.clientX, e.clientY)
    setSelectedId(item.id)
    setInteraction({
      type: 'drag',
      itemId: item.id,
      offsetX: pt.x - item.x,
      offsetY: pt.y - item.y,
    })
  }

  const onHandlePointerDown = (e: React.PointerEvent, item: CollageItem, corner: ResizeCorner) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setSelectedId(item.id)
    setInteraction({
      type: 'resize',
      itemId: item.id,
      corner,
      startW: item.width,
      startH: item.height,
      startX: item.x,
      startY: item.y,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
    })
  }

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (interaction.type === 'idle') return
    const pt = screenToCanvas(e.clientX, e.clientY)
    if (interaction.type === 'drag') {
      const id = interaction.itemId
      const ox = interaction.offsetX
      const oy = interaction.offsetY
      setItems((prev) => prev.map((it) => {
        if (it.id !== id) return it
        return clampItemToCanvas({ ...it, x: pt.x - ox, y: pt.y - oy }, canvas)
      }))
    } else if (interaction.type === 'resize') {
      const dx = (e.clientX - interaction.pointerStartX) / displayScale
      const dy = (e.clientY - interaction.pointerStartY) / displayScale
      const { itemId, corner, startW, startH, startX, startY } = interaction
      const box = resizeBoxByCorner(corner, { x: startX, y: startY, width: startW, height: startH }, dx, dy)
      setItems((prev) => prev.map((it) => {
        if (it.id !== itemId) return it
        return clampItemToCanvas({ ...it, ...box }, canvas)
      }))
    }
  }

  const onCanvasPointerUp = () => {
    if (interaction.type !== 'idle') setInteraction({ type: 'idle' })
  }

  // ============ 项目操作 ============

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const moveItemZ = (id: string, dir: 'up' | 'down' | 'top' | 'bottom') => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id)
      if (idx < 0) return prev
      const arr = prev.slice()
      const [picked] = arr.splice(idx, 1)
      let target = idx
      if (dir === 'up') target = Math.min(arr.length, idx + 1)
      else if (dir === 'down') target = Math.max(0, idx - 1)
      else if (dir === 'top') target = arr.length
      else if (dir === 'bottom') target = 0
      arr.splice(target, 0, picked)
      return arr
    })
  }

  const clearAll = () => {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    objectUrlsRef.current = []
    setItems([])
    setSelectedId(null)
  }

  // Delete / Backspace 删除选中项；在 input/textarea 内不触发，避免误删
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!selectedId) return
      const el = e.target as HTMLElement | null
      if (el) {
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return
      }
      e.preventDefault()
      removeItem(selectedId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // removeItem 是稳定的 setState 闭包，依赖 selectedId 即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ============ 画布尺寸切换 ============

  const switchPreset = (preset: CanvasPreset) => {
    if (preset === 'custom') {
      setCanvas((c) => ({ ...c, preset: 'custom' }))
      return
    }
    const next = canvasSizeFromPreset(preset)
    setCanvas(next)
    // 把所有 item 夹回新画布
    setItems((prev) => prev.map((it) => clampItemToCanvas(it, next)))
  }

  const setCustomSize = (w: number, h: number) => {
    const cw = clampCanvasDimension(w)
    const ch = clampCanvasDimension(h)
    const next: CanvasSize = { preset: 'custom', width: cw, height: ch }
    setCanvas(next)
    setItems((prev) => prev.map((it) => clampItemToCanvas(it, next)))
  }

  // ============ 导出 ============

  const doExport = async (kind: 'png' | 'jpg' | 'clipboard') => {
    if (items.length === 0) {
      toast.error('画布为空，请先添加图片')
      return
    }
    setExporting(true)
    try {
      const fmt: 'png' | 'jpg' = kind === 'jpg' ? 'jpg' : 'png'
      const blob = await composeCollage(items, canvas, fmt, jpgQuality)
      if (kind === 'clipboard') {
        await copyBlobToClipboard(blob)
        toast.success('已复制到剪贴板')
      } else {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        downloadBlob(blob, `collage-${ts}.${fmt}`)
        toast.success(`已导出 ${fmt.toUpperCase()}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <BackToHome />
      <header className="text-center pt-16 pb-6 px-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          自由拼图
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          多图自由画布 · 拖动缩放 · 导出 PNG / JPG / 剪贴板
        </p>
      </header>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 工具条 */}
        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>画布</label>
          <select
            className="theme-input"
            value={canvas.preset}
            onChange={(e) => switchPreset(e.target.value as CanvasPreset)}
            style={{ padding: '4px 10px', fontSize: '13px', height: 'auto', width: 'auto' }}
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>{PRESET_LABEL_MAP[p]}</option>
            ))}
          </select>
          {canvas.preset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <input
                type="number"
                className="theme-input"
                value={canvas.width}
                min={MIN_CANVAS_DIMENSION}
                max={MAX_CANVAS_DIMENSION}
                onChange={(e) => setCustomSize(Number(e.target.value), canvas.height)}
                style={{ width: '88px', padding: '4px 8px', fontSize: '13px', height: 'auto' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>×</span>
              <input
                type="number"
                className="theme-input"
                value={canvas.height}
                min={MIN_CANVAS_DIMENSION}
                max={MAX_CANVAS_DIMENSION}
                onChange={(e) => setCustomSize(canvas.width, Number(e.target.value))}
                style={{ width: '88px', padding: '4px 8px', fontSize: '13px', height: 'auto' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>px</span>
            </div>
          )}
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {canvas.width} × {canvas.height} · 显示 {Math.round(displayScale * 100)}%
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="theme-btn theme-btn-primary"
              style={{ padding: '6px 14px', fontSize: '13px' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={items.length >= MAX_ITEMS_PER_CANVAS}
            >
              + 添加图片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilePick}
              style={{ display: 'none' }}
            />
            <button
              className="theme-btn"
              style={{ padding: '6px 14px', fontSize: '13px' }}
              onClick={clearAll}
              disabled={items.length === 0}
            >
              清空
            </button>
          </div>
        </section>

        {/* 画布区 */}
        <section
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          style={{
            position: 'relative',
            padding: '24px',
            background: isDragOver
              ? 'color-mix(in srgb, var(--accent-1) 10%, var(--bg-secondary))'
              : 'var(--bg-secondary)',
            border: `2px ${isDragOver ? 'dashed' : 'solid'} ${isDragOver ? 'var(--accent-1)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            justifyContent: 'center',
            transition: 'var(--transition)',
          }}
        >
          <div
            ref={canvasRef}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerUp}
            onPointerDown={() => setSelectedId(null)}
            style={{
              position: 'relative',
              width: `${displayW}px`,
              height: `${displayH}px`,
              background: '#ffffff',
              backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              overflow: 'hidden',
              touchAction: 'none',
              userSelect: 'none',
              cursor: items.length === 0 ? 'pointer' : 'default',
            }}
            onDoubleClick={() => { if (items.length === 0) fileInputRef.current?.click() }}
          >
            {items.length === 0 && (
              <div
                style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#999', fontSize: '14px', pointerEvents: 'none',
                }}
              >
                拖拽图片到此处 / 双击添加 / Ctrl+V 粘贴
              </div>
            )}
            {items.map((item) => {
              const isSel = item.id === selectedId
              return (
                <div
                  key={item.id}
                  onPointerDown={(e) => onItemPointerDown(e, item)}
                  style={{
                    position: 'absolute',
                    left: `${item.x * displayScale}px`,
                    top: `${item.y * displayScale}px`,
                    width: `${item.width * displayScale}px`,
                    height: `${item.height * displayScale}px`,
                    cursor: 'move',
                    outline: isSel ? '2px solid var(--accent-1, #6366f1)' : 'none',
                    outlineOffset: '0',
                  }}
                >
                  <img
                    src={item.src}
                    alt={item.fileName || ''}
                    draggable={false}
                    style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
                  />
                  {isSel && HANDLE_CORNERS.map((c) => (
                    <span
                      key={c}
                      onPointerDown={(e) => onHandlePointerDown(e, item, c)}
                      style={{
                        position: 'absolute',
                        width: '12px', height: '12px',
                        background: 'var(--accent-1, #6366f1)',
                        border: '2px solid #fff',
                        borderRadius: '50%',
                        ...(c === 'nw' && { left: '-7px', top: '-7px', cursor: 'nwse-resize' }),
                        ...(c === 'ne' && { right: '-7px', top: '-7px', cursor: 'nesw-resize' }),
                        ...(c === 'sw' && { left: '-7px', bottom: '-7px', cursor: 'nesw-resize' }),
                        ...(c === 'se' && { right: '-7px', bottom: '-7px', cursor: 'nwse-resize' }),
                      }}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </section>

        {/* 选中项工具栏 */}
        {selectedId && (() => {
          const sel = items.find((it) => it.id === selectedId)
          if (!sel) return null
          return (
            <section
              style={{
                display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
                padding: '10px 14px',
                background: 'var(--bg-surface)',
                border: 'var(--border-width) solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>已选中：</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {sel.fileName || sel.id} · {Math.round(sel.width)} × {Math.round(sel.height)}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button className="theme-btn" style={smallBtn} onClick={() => moveItemZ(sel.id, 'bottom')} title="置底">⤓⤓</button>
                <button className="theme-btn" style={smallBtn} onClick={() => moveItemZ(sel.id, 'down')} title="下移一层">⤓</button>
                <button className="theme-btn" style={smallBtn} onClick={() => moveItemZ(sel.id, 'up')} title="上移一层">⤒</button>
                <button className="theme-btn" style={smallBtn} onClick={() => moveItemZ(sel.id, 'top')} title="置顶">⤒⤒</button>
                <button className="theme-btn" style={smallBtn} onClick={() => removeItem(sel.id)}>移除</button>
              </div>
              <span style={{ width: '100%', fontSize: '11px', color: 'var(--text-muted)' }}>
                提示：按 <kbd style={kbd}>Delete</kbd> 或 <kbd style={kbd}>Backspace</kbd> 也可移除选中图
              </span>
            </section>
          )
        })()}

        {/* 导出区 */}
        <section
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600 }}>导出</span>
          <button
            className="theme-btn theme-btn-primary"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => doExport('png')}
            disabled={exporting || items.length === 0}
          >
            PNG（透明背景）
          </button>
          <button
            className="theme-btn"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => doExport('jpg')}
            disabled={exporting || items.length === 0}
          >
            JPG（白底）
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            JPG 质量
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={jpgQuality}
              onChange={(e) => setJpgQuality(Number(e.target.value))}
              style={{ width: '120px' }}
            />
            <span style={{ minWidth: '32px', textAlign: 'right' }}>{Math.round(jpgQuality * 100)}</span>
          </label>
          <button
            className="theme-btn"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => doExport('clipboard')}
            disabled={exporting || items.length === 0}
          >
            复制到剪贴板（PNG）
          </button>
          {exporting && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>正在合成…</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
            {items.length} / {MAX_ITEMS_PER_CANVAS} 张
          </span>
        </section>
      </main>
    </div>
  )
}

// ============ 辅助 ============

const smallBtn: React.CSSProperties = { padding: '4px 10px', fontSize: '12px', height: 'auto' }

const kbd: React.CSSProperties = {
  display: 'inline-block',
  padding: '0 5px',
  margin: '0 2px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '3px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  color: 'var(--text-secondary)',
}

/** 异步读出 Image 的固有尺寸（用 ObjectURL，不污染主流程） */
function loadImageDims(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}
