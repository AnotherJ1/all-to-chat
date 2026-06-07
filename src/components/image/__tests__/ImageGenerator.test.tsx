import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImageGenerator from '../ImageGenerator'
import { useConfigStore } from '../../../stores/configStore'
import { useImageHistoryStore } from '../../../stores/imageHistoryStore'
import { generateImage } from '../../../api/imagegen'

vi.mock('../../../api/imagegen', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/imagegen')>()
  return {
    ...actual,
    generateImage: vi.fn(),
    editImage: vi.fn(),
  }
})

describe('ImageGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConfigStore.setState({
      protocol: 'openai',
      configs: {
        openai: { baseUrl: 'http://example.test', apiKey: 'sk-test', model: 'gpt-4o', systemPrompt: '' },
        anthropic: { baseUrl: 'https://api.anthropic.com', apiKey: '', model: 'claude', systemPrompt: '' },
        gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: '', model: 'gemini', systemPrompt: '' },
      },
      savedConfigs: [],
      activeConfigId: null,
    })
    useImageHistoryStore.setState({ records: [] })
  })

  it('updates preview and leaves loading state after a successful generation in React StrictMode', async () => {
    vi.mocked(generateImage).mockResolvedValue({
      success: true,
      imageUrl: 'https://example.test/generated.png',
    })

    render(
      <React.StrictMode>
        <MemoryRouter>
          <ImageGenerator />
        </MemoryRouter>
      </React.StrictMode>
    )

    fireEvent.change(screen.getByPlaceholderText('描述你想要生成的图片...'), {
      target: { value: '生成一张测试图' },
    })
    fireEvent.click(screen.getByRole('button', { name: '生成图片' }))

    await waitFor(() => expect(screen.getByAltText('Generated')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '生成图片' })).not.toBeDisabled()
  })

  it('shows the generated image in the preview panel after successful generation', async () => {
    vi.mocked(generateImage).mockResolvedValue({
      success: true,
      imageUrl: 'https://example.test/generated-preview.png',
    })

    render(
      <React.StrictMode>
        <MemoryRouter>
          <ImageGenerator />
        </MemoryRouter>
      </React.StrictMode>
    )

    fireEvent.change(screen.getByPlaceholderText('描述你想要生成的图片...'), {
      target: { value: '生成一张预览测试图' },
    })
    fireEvent.click(screen.getByRole('button', { name: '生成图片' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: '当前预览' })).toBeInTheDocument())
    expect(screen.getByAltText('Generated')).toHaveAttribute('src', 'https://example.test/generated-preview.png')
  })

  it('submits custom width and height as the image size', async () => {
    vi.mocked(generateImage).mockResolvedValue({
      success: true,
      imageUrl: 'https://example.test/custom-size.png',
    })

    render(
      <React.StrictMode>
        <MemoryRouter>
          <ImageGenerator />
        </MemoryRouter>
      </React.StrictMode>
    )

    fireEvent.click(screen.getByRole('button', { name: '自定义' }))
    fireEvent.change(screen.getByLabelText('自定义宽度'), { target: { value: '1280' } })
    fireEvent.change(screen.getByLabelText('自定义高度'), { target: { value: '720' } })
    fireEvent.change(screen.getByPlaceholderText('描述你想要生成的图片...'), {
      target: { value: '生成一张横版活动主视觉' },
    })
    fireEvent.click(screen.getByRole('button', { name: '生成图片' }))

    await waitFor(() => expect(generateImage).toHaveBeenCalled())
    expect(vi.mocked(generateImage).mock.calls[0][4]).toBe('1280x720')
  })

  it('appends a prompt preset template to the current prompt', () => {
    render(
      <React.StrictMode>
        <MemoryRouter>
          <ImageGenerator />
        </MemoryRouter>
      </React.StrictMode>
    )

    const promptInput = screen.getByPlaceholderText('描述你想要生成的图片...') as HTMLTextAreaElement
    fireEvent.change(promptInput, { target: { value: '一只橘猫' } })
    fireEvent.click(screen.getByRole('button', { name: '海报' }))

    expect(promptInput.value).toContain('一只橘猫')
    expect(promptInput.value).toContain('电影级主视觉海报')
    expect(promptInput.value).toContain('标题区预留清晰留白')
    expect(promptInput.value).toContain('印刷级细节')
  })

  it('switches the mobile tab to preview after successful generation', async () => {
    vi.mocked(generateImage).mockResolvedValue({
      success: true,
      imageUrl: 'https://example.test/mobile-preview.png',
    })

    render(
      <React.StrictMode>
        <MemoryRouter>
          <ImageGenerator />
        </MemoryRouter>
      </React.StrictMode>
    )

    fireEvent.change(screen.getByPlaceholderText('描述你想要生成的图片...'), {
      target: { value: '生成一张移动端预览测试图' },
    })
    fireEvent.click(screen.getByRole('button', { name: '生成图片' }))

    await waitFor(() => expect(screen.getByAltText('Generated')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /^预览/ })).toHaveStyle({ color: 'var(--accent-1)' })
  })
})
