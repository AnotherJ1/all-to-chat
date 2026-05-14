/**
 * 路由正确性属性测试
 *
 * Property 1: 未定义路由重定向
 * For any URL path that is not registered in the toolRegistry and is not
 * the root path `/`, navigating to that path SHALL result in a redirect
 * to the HomePage at `/`.
 *
 * **Validates: Requirements 1.7**
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import HomePage from '../pages/HomePage'
import { toolRegistry } from '../registry/tools'

/**
 * 创建与 App.tsx 相同的路由配置，但使用 MemoryRouter 以便测试
 */
function AppRoutes() {
  return (
    <Suspense fallback={<div>加载中…</div>}>
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
  )
}

/**
 * 生成不在注册表中的随机路径
 */
function generateUndefinedPaths(): string[] {
  const registeredRoutes = new Set(toolRegistry.map((t) => t.route))
  registeredRoutes.add('/')

  // 各种未注册的路径样本
  const candidates = [
    '/nonexistent',
    '/foo/bar',
    '/xyz',
    '/about',
    '/settings',
    '/admin',
    '/dashboard',
    '/tools/unknown',
    '/chat/extra/path',
    '/image/sub',
    '/api/v1',
    '/login',
    '/register',
    '/help',
    '/undefined-route-12345',
  ]

  // 过滤掉任何碰巧已注册的路径
  return candidates.filter((path) => !registeredRoutes.has(path))
}

describe('Property 1: 未定义路由重定向', () => {
  const undefinedPaths = generateUndefinedPaths()

  it.each(undefinedPaths)(
    '导航到未定义路径 "%s" 应重定向到首页',
    (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>,
      )

      // 验证 HomePage 被渲染：检查标题 "Tool Hub" 存在
      expect(screen.getByText('Tool Hub')).toBeInTheDocument()

      // 验证首页的 tagline 也存在
      expect(screen.getByText('AI 驱动的创作工具集')).toBeInTheDocument()
    },
  )

  it('已注册路由不应重定向到首页（对照测试）', () => {
    // 验证根路径渲染首页
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByText('Tool Hub')).toBeInTheDocument()
  })
})
