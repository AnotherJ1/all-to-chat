import { describe, expect, it } from 'vitest'
import { normalizeApiBase } from '../api-url'

describe('normalizeApiBase', () => {
  it('keeps a clean base unchanged', () => {
    expect(normalizeApiBase('https://cpa.chinaai.cyou')).toBe('https://cpa.chinaai.cyou')
  })

  it('strips a trailing slash', () => {
    expect(normalizeApiBase('https://api.openai.com/')).toBe('https://api.openai.com')
  })

  it('strips a trailing /v1 so callers can append /v1/... without doubling', () => {
    expect(normalizeApiBase('https://cpa.chinaai.cyou/v1')).toBe('https://cpa.chinaai.cyou')
  })

  it('strips a trailing /v1/ (with slash)', () => {
    expect(normalizeApiBase('https://cpa.chinaai.cyou/v1/')).toBe('https://cpa.chinaai.cyou')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeApiBase('  https://cpa.chinaai.cyou/v1  ')).toBe('https://cpa.chinaai.cyou')
  })

  it('does NOT strip Gemini /v1beta', () => {
    expect(normalizeApiBase('https://generativelanguage.googleapis.com/v1beta')).toBe(
      'https://generativelanguage.googleapis.com/v1beta'
    )
  })

  it('only strips a trailing /v1, not /v1 in the middle of a path', () => {
    expect(normalizeApiBase('https://host/v1/proxy')).toBe('https://host/v1/proxy')
  })
})
