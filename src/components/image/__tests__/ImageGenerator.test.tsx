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
})
