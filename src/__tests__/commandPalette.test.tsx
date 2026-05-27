import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CommandPalette from '../components/common/CommandPalette'
import { useCommandPaletteStore } from '../stores/commandPaletteStore'

function setup() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/json" element={<div>JSON_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CommandPalette', () => {
  beforeEach(() => {
    act(() => {
      useCommandPaletteStore.getState().setOpen(false)
    })
  })

  it('open=false 时不渲染', () => {
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('open=true 时渲染输入框', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    expect(screen.getByLabelText('命令面板搜索框')).toBeInTheDocument()
  })

  it('输入关键字过滤结果', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    const input = screen.getByLabelText('命令面板搜索框') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JSON 格式化' } })
    expect(screen.getByText('JSON 格式化')).toBeInTheDocument()
    expect(screen.queryByText('Cron 可视化')).toBeNull()
  })

  it('Enter 选中并跳转，面板关闭', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    const input = screen.getByLabelText('命令面板搜索框') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JSON 格式化' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('JSON_PAGE')).toBeInTheDocument()
    expect(useCommandPaletteStore.getState().open).toBe(false)
  })

  it('Escape 关闭面板', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    const input = screen.getByLabelText('命令面板搜索框') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(useCommandPaletteStore.getState().open).toBe(false)
  })

  it('零结果显示空状态', () => {
    setup()
    act(() => useCommandPaletteStore.getState().setOpen(true))
    const input = screen.getByLabelText('命令面板搜索框') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zzzzzzzzz' } })
    expect(screen.getByText('没有找到相关工具')).toBeInTheDocument()
  })
})
