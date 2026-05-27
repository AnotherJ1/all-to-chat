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
import { render, screen, fireEvent } from '@testing-library/react'
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

    // ToolCard 使用 <button> 元素；排除 SearchBar 的 ⌘K 触发按钮后，
    // 工具按钮数量应精确等于注册工具数量。
    // 分类 tab 使用 role="tab"，不会被 getAllByRole('button') 匹配。
    const toolButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label') !== '打开命令面板')
    expect(toolButtons).toHaveLength(toolRegistry.length)
  })
})

import { categoryRegistry } from '../registry/categories'

describe('首页分类与搜索', () => {
  it('应渲染所有分类标题', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    for (const cat of categoryRegistry) {
      expect(screen.getByText(cat.name)).toBeInTheDocument()
    }
  })

  it('输入搜索词后只显示命中的工具', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const input = screen.getByLabelText('搜索工具') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JSON' } })

    // 命中的工具仍可见
    expect(screen.getByText('JSON 格式化')).toBeInTheDocument()
    // 未命中的工具不应再可见（例如 cron）
    expect(screen.queryByText('Cron 可视化')).toBeNull()
  })

  it('零匹配时显示空状态文案', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const input = screen.getByLabelText('搜索工具') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zzzzzzzz' } })

    expect(screen.getByText('没有找到相关工具')).toBeInTheDocument()
  })
})
