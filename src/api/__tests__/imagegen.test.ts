import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateImage } from '../imagegen'

describe('imagegen API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses output_format to build the data URL MIME type for b64_json responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        created: 1780844893,
        data: [{ b64_json: 'AAAA', revised_prompt: 'test' }],
        output_format: 'jpeg',
      }),
    }))

    const result = await generateImage('http://example.test', 'sk-test', 'gpt-image-2', 'test')

    expect(result).toEqual({ success: true, imageUrl: 'data:image/jpeg;base64,AAAA' })
  })
})
