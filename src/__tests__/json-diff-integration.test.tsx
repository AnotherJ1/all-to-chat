/**
 * /diff JSON 模式集成测试
 * - auto 模式下两侧合法 JSON 自动切结构化
 * - toggle 切回文本仍能正常工作
 * - JSON 模式 toggle 数组顺序无关选项
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DiffPage from '../pages/DiffPage'
import { useDiffStore } from '../stores/diffStore'

// jsdom 默认 localStorage 即可
function resetStore() {
  // 重置为默认值
  useDiffStore.setState({ mode: 'auto', sortArrayKeys: false })
  localStorage.clear()
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DiffPage />
    </MemoryRouter>,
  )
}

describe('/diff JSON 模式集成', () => {
  beforeEach(() => {
    resetStore()
  })

  it('auto 模式 + 两侧合法 JSON → 自动切结构化视图', () => {
    renderPage()
    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    expect(textareas.length).toBeGreaterThanOrEqual(2)

    fireEvent.change(textareas[0], { target: { value: '{"a":1,"b":2}' } })
    fireEvent.change(textareas[1], { target: { value: '{"a":1,"b":3}' } })

    // JSON 模式下应出现路径节点 'b'
    expect(screen.getByText('JSON 结构化对比')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
  })

  it('auto 模式 + 任一侧非 JSON → 走文本对比', () => {
    renderPage()
    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    fireEvent.change(textareas[0], { target: { value: 'hello' } })
    fireEvent.change(textareas[1], { target: { value: 'world' } })

    // 应显示文本模式的统计（"= xxx" 等）
    // 文本模式下不会出现 'JSON 结构化对比' 标题
    expect(screen.queryByText('JSON 结构化对比')).not.toBeInTheDocument()
  })

  it('toggle 切到文本模式 → 仍可使用文本 diff', () => {
    renderPage()
    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    fireEvent.change(textareas[0], { target: { value: '{"a":1}' } })
    fireEvent.change(textareas[1], { target: { value: '{"a":2}' } })

    // auto 默认会进入 JSON 模式
    expect(screen.getByText('JSON 结构化对比')).toBeInTheDocument()

    // 点击「文本」按钮
    const textBtn = screen.getByTestId('mode-text')
    fireEvent.click(textBtn)
    expect(useDiffStore.getState().mode).toBe('text')

    // 切到文本后应该不再显示 JSON 标题，并能看到文本统计
    expect(screen.queryByText('JSON 结构化对比')).not.toBeInTheDocument()
    // 双栏 / 统一视图按钮应显示
    expect(screen.getByText('双栏对照')).toBeInTheDocument()
  })

  it('强制 JSON 模式 + 非 JSON 输入 → 显示解析失败提示', () => {
    renderPage()
    const jsonBtn = screen.getByTestId('mode-json')
    fireEvent.click(jsonBtn)

    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    fireEvent.change(textareas[0], { target: { value: 'not json' } })
    fireEvent.change(textareas[1], { target: { value: 'still not json' } })

    expect(screen.getByText(/JSON 解析失败/)).toBeInTheDocument()
  })

  it('JSON 模式下 sortArrayKeys 切换：数组重排序由"差异"变"等价"', () => {
    renderPage()
    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    fireEvent.change(textareas[0], { target: { value: '[1,2,3]' } })
    fireEvent.change(textareas[1], { target: { value: '[3,2,1]' } })

    // 默认下标对比：[0] 和 [2] 出现 change
    expect(screen.getByText('JSON 结构化对比')).toBeInTheDocument()
    expect(screen.getAllByText('[0]').length).toBeGreaterThan(0)
    expect(screen.getAllByText('[2]').length).toBeGreaterThan(0)

    // 打开数组顺序无关
    const cb = screen.getByTestId('sort-array-keys') as HTMLInputElement
    fireEvent.click(cb)
    expect(useDiffStore.getState().sortArrayKeys).toBe(true)
    // 排序后等价：现在不应再有 [0] / [2] 的差异节点（折叠相同子树后整个数组只剩根节点）
    expect(screen.queryAllByText('[0]').length).toBe(0)
  })

  it('persist key 为 diff-preferences', () => {
    const opts = (useDiffStore as unknown as { persist: { getOptions: () => { name: string } } }).persist.getOptions()
    expect(opts.name).toBe('diff-preferences')
  })
})
