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
import type { ToolCategory, ToolMeta } from '../types'

type TabId = ToolCategory | 'all'

export default function HomePage() {
  const navigate = useNavigate()
  const style = useThemeStore((s) => s.style)
  const openPalette = useCommandPaletteStore((s) => s.setOpen)

  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('all')

  const filtered = useMemo(() => searchTools(query, toolRegistry), [query])

  const orderedCategories = useMemo(() => getOrderedCategories(), [])

  // 计算每个分类在当前搜索结果下的工具数（用于 tab 上的计数徽标）
  const countByCategory = useMemo(() => {
    const map: Record<string, number> = { all: filtered.length }
    for (const cat of orderedCategories) {
      map[cat.id] = filtered.filter((t) => t.category === cat.id).length
    }
    return map
  }, [filtered, orderedCategories])

  const visibleTools = useMemo(() => {
    if (activeTab === 'all') return filtered
    return filtered.filter((t) => t.category === activeTab)
  }, [filtered, activeTab])

  const handleToolClick = (tool: ToolMeta) => {
    if (tool.disabled) {
      toast.info('该功能暂未开放，敬请期待')
      return
    }
    navigate(tool.route)
  }

  const tabs: { id: TabId; name: string }[] = [
    { id: 'all', name: '全部' },
    ...orderedCategories.map((c) => ({ id: c.id as TabId, name: c.name })),
  ]

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

      <div className="w-full max-w-5xl relative z-10 mb-8">
        <SearchBar value={query} onChange={setQuery} onOpenPalette={() => openPalette(true)} />
      </div>

      <div
        className="w-full max-w-5xl relative z-10 mb-10 flex flex-wrap items-center justify-center gap-2"
        role="tablist"
        aria-label="工具分类"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id
          const count = countByCategory[tab.id] ?? 0
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className="theme-tab"
            >
              <span>{tab.name}</span>
              <span className="theme-tab-count">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="w-full max-w-5xl relative z-10">
        {visibleTools.length === 0 ? (
          <div
            className="text-center py-12"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            没有找到相关工具
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {visibleTools.map((tool, idx) => (
              <ToolCard key={tool.id} tool={tool} onClick={() => handleToolClick(tool)} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
