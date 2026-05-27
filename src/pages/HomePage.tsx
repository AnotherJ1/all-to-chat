import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toolRegistry } from '../registry/tools'
import { getOrderedCategories } from '../registry/categories'
import ToolCard from '../components/common/ToolCard'
import Logo from '../components/common/Logo'
import SearchBar from '../components/common/SearchBar'
import { useThemeStore } from '../stores/themeStore'
import { useCommandPaletteStore } from '../stores/commandPaletteStore'
import { searchTools } from '../lib/searchTools'
import { toast } from '../stores/toastStore'
import type { ToolMeta } from '../types'

export default function HomePage() {
  const navigate = useNavigate()
  const style = useThemeStore((s) => s.style)
  const openPalette = useCommandPaletteStore((s) => s.setOpen)

  const [query, setQuery] = useState('')

  const filtered = useMemo(() => searchTools(query, toolRegistry), [query])

  const groups = useMemo(() => {
    const cats = getOrderedCategories()
    return cats
      .map((cat) => ({ cat, tools: filtered.filter((t) => t.category === cat.id) }))
      .filter((g) => g.tools.length > 0)
  }, [filtered])

  const handleToolClick = (tool: ToolMeta) => {
    if (tool.disabled) {
      toast.info('该功能暂未开放，敬请期待')
      return
    }
    navigate(tool.route)
  }

  // 为每张卡片计算稳定的全局 index，保证强调色随分类位置不抖
  let runningIndex = 0

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-16 relative overflow-hidden">
      {style === 'motion' && <div className="fixed inset-0 motion-gradient-bg pointer-events-none" />}
      {style === 'claymorphism' && (
        <>
          <div className="clay-blob" style={{ width: '400px', height: '400px', background: '#a78bfa', top: '-100px', left: '-100px' }} />
          <div className="clay-blob" style={{ width: '300px', height: '300px', background: '#f472b6', bottom: '-80px', right: '-80px' }} />
        </>
      )}
      {style === 'cyberpunk' && <div className="fixed inset-0 cyber-scanlines pointer-events-none" />}

      <header className="text-center mb-12 relative z-10">
        <div className="flex items-center justify-center mb-4">
          <Logo size={56} />
        </div>
        <h1
          className={`font-bold tracking-tight ${style === 'motion' ? 'motion-float' : ''}`}
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)',
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            lineHeight: 1.1,
          }}
        >
          Tool Hub
        </h1>
        <p className="mt-3" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontFamily: 'var(--font-body)' }}>
          AI 驱动的创作工具集
        </p>
      </header>

      <div className="w-full max-w-5xl relative z-10 mb-12">
        <SearchBar value={query} onChange={setQuery} onOpenPalette={() => openPalette(true)} />
      </div>

      <div className="w-full max-w-5xl relative z-10 flex flex-col gap-12">
        {groups.length === 0 ? (
          <div
            className="text-center py-12"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            没有找到相关工具
          </div>
        ) : (
          groups.map(({ cat, tools }) => (
            <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
              <h2
                id={`cat-${cat.id}`}
                className="mb-5 pb-2 font-semibold"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.1rem',
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border-color, rgba(127,127,127,0.18))',
                }}
              >
                {cat.name}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '0.5rem', fontWeight: 400 }}>
                  {tools.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {tools.map((tool) => {
                  const idx = runningIndex++
                  return (
                    <ToolCard key={tool.id} tool={tool} onClick={() => handleToolClick(tool)} index={idx} />
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
