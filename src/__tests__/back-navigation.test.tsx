/**
 * 工具页面返回导航属性测试
 *
 * Property 5: 工具页面返回导航
 * For any tool page rendered at a registered route, the page SHALL contain
 * a navigation element that, when activated, navigates the user back to
 * the HomePage at `/`.
 *
 * **Validates: Requirements 4.2, 4.3**
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import HomePage from '../pages/HomePage'
import ChatPage from '../pages/ChatPage'
import ImagePage from '../pages/ImagePage'
import { toolRegistry } from '../registry/tools'

/**
 * 直接导入的页面组件映射（绕过懒加载在测试环境中的问题）
 */
const pageComponents: Record<string, React.ComponentType> = {
  '/chat': ChatPage,
  '/image': ImagePage,
}

/**
 * 创建与 App.tsx 相同的路由配置，使用 MemoryRouter 以便测试。
 * 使用直接导入的组件替代懒加载，确保测试环境中组件能正常渲染。
 */
function AppRoutes() {
  return (
    <Suspense fallback={<div>加载中…</div>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {toolRegistry.map((tool) => {
          const PageComponent = pageComponents[tool.route]
          return (
            <Route
              key={tool.id}
              path={tool.route}
              element={PageComponent ? <PageComponent /> : <tool.component />}
            />
          )
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

describe('Property 5: 工具页面返回导航', () => {
  it.each(toolRegistry.map((tool) => [tool.name, tool.route]))(
    '工具页面 "%s" (路由: %s) 应包含返回首页按钮，点击后导航到首页',
    async (_name, route) => {
      render(
        <MemoryRouter initialEntries={[route]}>
          <AppRoutes />
        </MemoryRouter>,
      )

      // 等待组件渲染完成，找到返回首页按钮
      const backButton = await waitFor(() =>
        screen.getByLabelText('返回首页'),
      )
      expect(backButton).toBeInTheDocument()

      // 点击返回首页按钮
      fireEvent.click(backButton)

      // 验证导航到首页：HomePage 渲染 "Tool Hub" 标题
      await waitFor(() => {
        expect(screen.getByText('Tool Hub')).toBeInTheDocument()
      })
    },
  )
})
