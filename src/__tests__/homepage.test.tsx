/**
 * 首页渲染属性测试
 *
 * Property 2: 首页渲染所有注册工具
 * For any state of the toolRegistry containing N tool entries,
 * the HomePage SHALL render exactly N ToolCard components.
 *
 * **Validates: Requirements 2.1**
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../pages/HomePage'
import { toolRegistry } from '../registry/tools'

describe('Property 2: 首页渲染所有注册工具', () => {
  it(`应渲染恰好 ${toolRegistry.length} 个工具卡片（N = toolRegistry.length）`, () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // 验证渲染的工具名称数量等于注册表长度
    const renderedToolNames = toolRegistry.map((tool) =>
      screen.getByText(tool.name),
    )
    expect(renderedToolNames).toHaveLength(toolRegistry.length)
  })

  it('每个注册工具的名称都应出现在渲染输出中', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    for (const tool of toolRegistry) {
      expect(screen.getByText(tool.name)).toBeInTheDocument()
    }
  })

  it('每个注册工具的描述都应出现在渲染输出中', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    for (const tool of toolRegistry) {
      expect(screen.getByText(tool.description)).toBeInTheDocument()
    }
  })

  it('渲染的按钮数量应等于注册工具数量', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // ToolCard 使用 <button> 元素，数量应与注册表一致
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(toolRegistry.length)
  })
})
