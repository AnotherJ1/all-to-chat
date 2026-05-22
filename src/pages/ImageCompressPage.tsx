import { useCallback, useEffect, useRef, useState } from 'react'
import BackToHome from '../components/common/BackToHome'
import SinglePane from '../components/image-compress/SinglePane'
import BatchPane from '../components/image-compress/BatchPane'

/**
 * 图片压缩工具
 *
 * 顶部双 tab：
 * - 单图实时：拖拽 / 粘贴单张，左右双栏对比，滑杆调整实时重压缩
 * - 多图批量：列表 + 全局参数 + 进度条 + 下载 ZIP
 *
 * 实现要点：
 * - 仅支持原生 PNG / JPEG / WebP（与 toBlob 原生支持对齐），零新依赖、零 wasm
 * - ≥1MB 走 Web Worker（OffscreenCanvas + createImageBitmap），<1MB 主线程 Canvas
 * - Worker 单实例懒加载并由两个 tab 共享，组件卸载时 terminate
 * - EXIF / ICC 元数据通过重绘自动丢弃
 */

type Tab = 'single' | 'batch'

const tabBtnBase: React.CSSProperties = {
  padding: '8px 18px',
  fontSize: '14px',
  fontFamily: 'var(--font-body)',
  border: 'none',
  borderRadius: 'calc(var(--radius-sm) - 4px)',
  transition: 'var(--transition)',
}

export default function ImageCompressPage() {
  const [tab, setTab] = useState<Tab>('single')

  // Worker 在两个 tab 间共享：首次需要时再创建，组件卸载时 terminate
  const workerRef = useRef<Worker | null>(null)
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/image-compress.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }
    return workerRef.current
  }, [])

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <BackToHome />

      <header className="text-center pt-16 pb-6 px-4">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}
        >
          图片压缩
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          PNG / JPEG / WebP 互转压缩 · 单图实时调参 · 多图批量打包 · 全程本地浏览器，不上传服务器
        </p>
      </header>

      {/* Tab 切换 */}
      <div className="flex justify-center mb-6 px-4">
        <div
          role="tablist"
          aria-label="压缩模式"
          className="inline-flex"
          style={{
            background: 'var(--bg-secondary)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px',
            gap: '4px',
          }}
        >
          {(
            [
              { key: 'single', label: '单图实时' },
              { key: 'batch', label: '多图批量' },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className="cursor-pointer"
              style={{
                ...tabBtnBase,
                fontWeight: tab === t.key ? 600 : 500,
                background: tab === t.key ? 'var(--bg-surface)' : 'transparent',
                color: tab === t.key ? 'var(--accent-1)' : 'var(--text-secondary)',
                boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 32px' }}>
        {/* 两个 tab 始终 mount，仅切换 display 以保留各自状态（已上传文件、已压缩结果） */}
        <section style={{ display: tab === 'single' ? 'block' : 'none' }}>
          <SinglePane getWorker={getWorker} />
        </section>
        <section style={{ display: tab === 'batch' ? 'block' : 'none' }}>
          <BatchPane getWorker={getWorker} />
        </section>
      </main>

      {/* 移动端：双栏对比改纵向堆叠 */}
      <style>{`
        @media (max-width: 768px) {
          .image-compress-preview-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}
