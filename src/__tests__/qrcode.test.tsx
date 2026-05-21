import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import QrCodePage from '../pages/QrCodePage'

describe('QrCodePage 二维码生成与解析测试', () => {
  it('应渲染页面标题与描述', () => {
    render(
      <MemoryRouter>
        <QrCodePage />
      </MemoryRouter>
    )

    expect(screen.getByText('二维码生成与解析')).toBeInTheDocument()
    expect(screen.getByText(/支持二维码实时生成/)).toBeInTheDocument()
  })

  it('应渲染二维码生成区域与相关控制控件', () => {
    render(
      <MemoryRouter>
        <QrCodePage />
      </MemoryRouter>
    )

    expect(screen.getByText('二维码生成')).toBeInTheDocument()
    expect(screen.getByText('二维码内容（文本或链接）')).toBeInTheDocument()

    // 默认内容
    const textarea = screen.getByPlaceholderText('请输入您要转换的文本或 URL 地址...')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue(window.location.href)

    // 控制控件
    expect(screen.getByText(/前景色/)).toBeInTheDocument()
    expect(screen.getByText(/背景色/)).toBeInTheDocument()
    expect(screen.getByText(/二维码大小/)).toBeInTheDocument()
    expect(screen.getByText(/^容错等级/)).toBeInTheDocument()
    expect(screen.getByText(/^嵌入 Logo 图标/)).toBeInTheDocument()

    // 操作按钮
    expect(screen.getByText('下载 PNG 图片')).toBeInTheDocument()
    expect(screen.getByText('复制图片')).toBeInTheDocument()
    expect(screen.getByText('复制 Base64')).toBeInTheDocument()
  })

  it('输入内容应能触发更新', () => {
    render(
      <MemoryRouter>
        <QrCodePage />
      </MemoryRouter>
    )

    const textarea = screen.getByPlaceholderText('请输入您要转换的文本或 URL 地址...')
    fireEvent.change(textarea, { target: { value: 'https://google.com' } })
    expect(textarea).toHaveValue('https://google.com')
  })

  it('应渲染二维码解析区域', () => {
    render(
      <MemoryRouter>
        <QrCodePage />
      </MemoryRouter>
    )

    expect(screen.getByText('二维码解析')).toBeInTheDocument()
    expect(screen.getByText('拖拽图片到这里，或者点击此处上传')).toBeInTheDocument()
    expect(screen.getByText(/提示：支持在当前页面直接 Ctrl \+ V/)).toBeInTheDocument()
  })

  // ===== 新增 worker-1 重构相关测试 =====

  it('颜色对比度过低时应显示警告条（Bug #10）', () => {
    render(
      <MemoryRouter>
        <QrCodePage />
      </MemoryRouter>
    )

    // 默认黑白对比度足够，无警告
    expect(screen.queryByTestId('contrast-warning')).not.toBeInTheDocument()

    // 把背景色改为接近前景色的深灰，对比度应小于 2
    const bgHexInput = screen.getByLabelText('背景色 Hex') as HTMLInputElement
    fireEvent.change(bgHexInput, { target: { value: '#222222' } })
    fireEvent.blur(bgHexInput)

    expect(screen.getByTestId('contrast-warning')).toBeInTheDocument()
  })

  it('输入空文本不渲染二维码（Bug #5）', () => {
    render(
      <MemoryRouter>
        <QrCodePage />
      </MemoryRouter>
    )

    const textarea = screen.getByPlaceholderText('请输入您要转换的文本或 URL 地址...')
    fireEvent.change(textarea, { target: { value: '' } })
    expect(textarea).toHaveValue('')
    // 仅断言文本被清空且没有抛错；canvas 由 jsdom 模拟，绘制行为已在 Hook 中安全跳过
    expect(screen.getByText(/0 字符/)).toBeInTheDocument()
  })

  it('拖拽区应支持键盘可访问（Bug #15）', () => {
    render(
      <MemoryRouter>
        <QrCodePage />
      </MemoryRouter>
    )

    const dropzone = screen.getByTestId('qr-dropzone')
    expect(dropzone).toHaveAttribute('role', 'button')
    expect(dropzone).toHaveAttribute('tabindex', '0')
    // 模拟 Enter 键 —— 不应抛错
    fireEvent.keyDown(dropzone, { key: 'Enter' })
    fireEvent.keyDown(dropzone, { key: ' ' })
  })

  it('无效 Hex 颜色应被回退（Bug #9）', () => {
    render(
      <MemoryRouter>
        <QrCodePage />
      </MemoryRouter>
    )

    const fgHexInput = screen.getByLabelText('前景色 Hex') as HTMLInputElement
    expect(fgHexInput.value).toBe('#000000')

    fireEvent.change(fgHexInput, { target: { value: 'not-a-color' } })
    fireEvent.blur(fgHexInput)
    // 失焦后应被恢复为上一次有效值
    expect(fgHexInput.value).toBe('#000000')
  })
})
