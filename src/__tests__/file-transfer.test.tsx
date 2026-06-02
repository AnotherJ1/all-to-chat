// src/__tests__/file-transfer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FileTransferPage from '../pages/FileTransferPage'
import { toolRegistry } from '../registry/tools'

describe('文件传输工具', () => {
  it('已在注册表中且路由为 /file-transfer', () => {
    const tool = toolRegistry.find((t) => t.id === 'file-transfer')
    expect(tool).toBeDefined()
    expect(tool?.route).toBe('/file-transfer')
    expect(tool?.category).toBe('dev')
  })

  it('默认显示内网渠道与角色选择', () => {
    render(<MemoryRouter><FileTransferPage /></MemoryRouter>)
    expect(screen.getByText('跨设备文件传输')).toBeInTheDocument()
    expect(screen.getByText('发送文件')).toBeInTheDocument()
    expect(screen.getByText('接收文件')).toBeInTheDocument()
  })

  it('切到外网 Tab 显示「即将推出」占位', () => {
    render(<MemoryRouter><FileTransferPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /外网/ }))
    // "即将推出" 在 tab 按钮和 ComingSoonCard 标题中均出现，用 getAllByText
    expect(screen.getAllByText(/即将推出/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/TURN/)).toBeInTheDocument()
  })
})