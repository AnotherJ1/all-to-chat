/**
 * 工具卡片导航正确性属性测试
 *
 * Property 3: 工具卡片导航正确性
 * For any tool entry in the toolRegistry, clicking its corresponding ToolCard
 * on the HomePage SHALL navigate to the route path specified in that tool's metadata.
 *
 * **Validates: Requirements 2.3**
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import HomePage from '../pages/HomePage'
import { toolRegistry } from '../registry/tools'

/**
 * 辅助组件：显示当前路由路径，用于验证导航结果
 */
function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname}</div>
}

/**
 * 创建与 App.tsx 相同的路由配置，附加 LocationDisplay 用于断言
 */
function TestApp() {
  return (
    <Suspense fallback={<div>加载中…</div>}>
      <LocationDisplay />
      <Routes>
        <Route path="/" element={<HomePage />} />
        {toolRegistry.map((tool) => (
          <Route
            key={tool.id}
            path={tool.route}
            element={<div data-testid={`page-${tool.id}`}>{tool.name} Page</div>}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

describe('Property 3: 工具卡片导航正确性', () => {
  it.each(toolRegistry.filter((t) => !t.disabled).map((tool) => [tool.name, tool.route, tool.id]))(
    '点击工具卡片 "%s" 应导航到路由 "%s"',
    (name, expectedRoute, id) => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TestApp />
        </MemoryRouter>,
      )

      // 初始状态应在首页
      expect(screen.getByTestId('location-display')).toHaveTextContent('/')

      // 找到对应工具卡片并点击（通过工具名称文本定位）
      const toolCard = screen.getByText(name as string).closest('button')
      expect(toolCard).not.toBeNull()
      fireEvent.click(toolCard!)

      // 验证导航后路径已变更为工具的 route
      expect(screen.getByTestId('location-display')).toHaveTextContent(expectedRoute as string)

      // 验证首页内容不再显示（工具页面已渲染）
      expect(screen.queryByText('Tool Hub')).not.toBeInTheDocument()

      // 验证工具页面内容已渲染
      expect(screen.getByTestId(`page-${id}`)).toBeInTheDocument()
    },
  )

  it('所有注册工具都有对应的可点击卡片', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TestApp />
      </MemoryRouter>,
    )

    // 验证每个注册工具都在首页有对应的卡片
    for (const tool of toolRegistry) {
      const toolNameElement = screen.getByText(tool.name)
      expect(toolNameElement).toBeInTheDocument()

      // 验证卡片是可点击的 button 元素
      const button = toolNameElement.closest('button')
      expect(button).not.toBeNull()
    }
  })
})
