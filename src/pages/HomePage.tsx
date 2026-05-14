import { useNavigate } from 'react-router-dom'
import { toolRegistry } from '../registry/tools'
import ToolCard from '../components/common/ToolCard'
import Logo from '../components/common/Logo'
import { useThemeStore } from '../stores/themeStore'

/**
 * 首页 — 工具卡片网格
 */
export default function HomePage() {
  const navigate = useNavigate()
  const style = useThemeStore((s) => s.style)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden"
    >
      {/* Motion 主题：动态渐变背景 */}
      {style === 'motion' && (
        <div className="fixed inset-0 motion-gradient-bg pointer-events-none" />
      )}

      {/* Claymorphism 主题：装饰性色块 */}
      {style === 'claymorphism' && (
        <>
          <div className="clay-blob" style={{ width: '400px', height: '400px', background: '#a78bfa', top: '-100px', left: '-100px' }} />
          <div className="clay-blob" style={{ width: '300px', height: '300px', background: '#f472b6', bottom: '-80px', right: '-80px' }} />
        </>
      )}

      {/* Cyberpunk 主题：扫描线 */}
      {style === 'cyberpunk' && <div className="fixed inset-0 cyber-scanlines pointer-events-none" />}

      {/* 标题区域 */}
      <header className="text-center mb-16 relative z-10">
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

      {/* 工具卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl w-full relative z-10">
        {toolRegistry.map((tool, index) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onClick={() => navigate(tool.route)}
            index={index}
          />
        ))}
      </div>
    </div>
  )
}
