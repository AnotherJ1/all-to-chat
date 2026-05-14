import { useThemeStore, themeOptions, type ThemeStyle } from '../../stores/themeStore'

/**
 * 主题切换器 — 浮动在页面右下角
 * 默认收起为一个小按钮，点击展开显示所有主题选项
 */
export default function ThemeSwitcher() {
  const { style, switcherOpen, setStyle, toggleSwitcher } = useThemeStore()

  return (
    <div className="fixed bottom-5 right-5 z-[999]">
      {/* 展开面板 */}
      {switcherOpen && (
        <div
          className="absolute bottom-14 right-0 flex flex-col gap-1 p-2 mb-2"
          style={{
            background: 'var(--bg-surface)',
            border: 'var(--border-width) solid var(--border-color)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: '120px',
          }}
        >
          {themeOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setStyle(opt.id as ThemeStyle)}
              className="flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
              style={{
                borderRadius: 'var(--radius-sm)',
                background: style === opt.id ? 'color-mix(in srgb, var(--accent-1) 15%, transparent)' : 'transparent',
                color: style === opt.id ? 'var(--accent-1)' : 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: style === opt.id ? 700 : 500,
                border: 'none',
                transition: 'var(--transition)',
                width: '100%',
              }}
            >
              <span style={{ fontSize: '14px' }}>{opt.icon}</span>
              <span>{opt.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* 触发按钮 */}
      <button
        onClick={toggleSwitcher}
        className="theme-btn"
        style={{
          width: '42px',
          height: '42px',
          padding: 0,
          borderRadius: '50%',
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="切换主题"
        aria-label="切换主题"
      >
        {themeOptions.find((o) => o.id === style)?.icon || '◆'}
      </button>
    </div>
  )
}
