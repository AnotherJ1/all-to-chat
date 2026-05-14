import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import HomePage from './pages/HomePage'
import { toolRegistry } from './registry/tools'
import ErrorBoundary from './components/common/ErrorBoundary'
import ToastContainer from './components/common/Toast'
import ThemeSwitcher from './components/common/ThemeSwitcher'
import { useThemeStore } from './stores/themeStore'

/** 加载中占位屏幕 */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-body)' }}>加载中…</div>
    </div>
  )
}

/** 主题同步：将 themeStore 的 style 同步到 html[data-theme] */
function ThemeSync() {
  const style = useThemeStore((s) => s.style)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', style)
  }, [style])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeSync />
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            {toolRegistry.map((tool) => (
              <Route
                key={tool.id}
                path={tool.route}
                element={<tool.component />}
              />
            ))}
            {/* 未定义路由重定向到首页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <ThemeSwitcher />
      <ToastContainer />
    </ErrorBoundary>
  )
}
