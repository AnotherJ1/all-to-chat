import type { ToolMeta } from '../../types'
import { useThemeStore } from '../../stores/themeStore'

interface ToolCardProps {
  tool: ToolMeta
  onClick: () => void
  index?: number
}

export default function ToolCard({ tool, onClick, index = 0 }: ToolCardProps) {
  const Icon = tool.icon
  const style = useThemeStore((s) => s.style)

  // 每种主题的强调色
  const accentColors: Record<string, string[]> = {
    claymorphism: ['#a78bfa', '#f472b6', '#34d399', '#fbbf24'],
    motion: ['#6366f1', '#ec4899', '#06b6d4', '#f59e0b'],
    brutalism: ['#ff0000', '#0000ff', '#ffff00', '#00ff00'],
    neubrutalism: ['#fbbf24', '#f87171', '#34d399', '#60a5fa'],
    cyberpunk: ['#00ffff', '#ff00ff', '#00ff00', '#ffff00'],
    vaporwave: ['#01cdfe', '#ff71ce', '#05ffa1', '#b967ff'],
  }

  const colors = accentColors[style] || accentColors.neubrutalism
  const accent = colors[index % colors.length]

  return (
    <button
      onClick={onClick}
      className={`theme-card text-left p-8 w-full group ${style === 'motion' ? 'motion-glow' : ''}`}
      style={{ animationDelay: style === 'motion' ? `${index * 0.5}s` : undefined }}
    >
      {/* 图标容器 */}
      <div
        className="w-14 h-14 flex items-center justify-center mb-5"
        style={{
          borderRadius: style === 'brutalism' ? '0' : style === 'claymorphism' ? '16px' : '12px',
          background: style === 'motion'
            ? `linear-gradient(135deg, ${accent}22, ${accent}44)`
            : style === 'claymorphism'
            ? `linear-gradient(135deg, ${accent}33, ${accent}11)`
            : accent + '22',
          border: style === 'brutalism' || style === 'neubrutalism'
            ? `var(--border-width) solid var(--border-color)`
            : `2px solid ${accent}44`,
          boxShadow: style === 'claymorphism'
            ? `4px 4px 12px ${accent}22, -2px -2px 8px rgba(255,255,255,0.8)`
            : style === 'neubrutalism'
            ? `3px 3px 0 var(--border-color)`
            : 'none',
        }}
      >
        <Icon
          className="w-7 h-7"
          style={{ color: style === 'brutalism' ? '#000000' : accent }}
        />
      </div>

      {/* 工具名称 */}
      <h3
        className="font-bold mb-2"
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.25rem',
          color: 'var(--text-primary)',
        }}
      >
        {tool.name}
      </h3>

      {/* 工具描述 */}
      <p
        className="leading-relaxed"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
        }}
      >
        {tool.description}
      </p>

      {/* 底部箭头指示 */}
      <div
        className="mt-5 flex items-center gap-2 text-sm font-semibold"
        style={{ color: accent }}
      >
        <span>进入工具</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transition: 'var(--transition)' }}>
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  )
}
