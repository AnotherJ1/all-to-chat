import { describe, it, expect } from 'vitest'
import { FORMATS, getFormatMeta, validateValue, DEFAULT_OPTIONS } from '../generate'

describe('barcode/generate · FORMATS', () => {
  it('至少包含 CODE128 / EAN13 / UPC', () => {
    const ids = FORMATS.map((f) => f.format)
    expect(ids).toContain('CODE128')
    expect(ids).toContain('EAN13')
    expect(ids).toContain('UPC')
  })

  it('每个码制都有非空 label / placeholder / hint', () => {
    for (const f of FORMATS) {
      expect(f.label.trim().length).toBeGreaterThan(0)
      expect(f.placeholder.trim().length).toBeGreaterThan(0)
      expect(f.hint.trim().length).toBeGreaterThan(0)
    }
  })

  it('getFormatMeta 命中已知码制，未知回退第一项', () => {
    expect(getFormatMeta('EAN13').format).toBe('EAN13')
    // @ts-expect-error 故意传入非法值测试回退
    expect(getFormatMeta('NOPE').format).toBe(FORMATS[0].format)
  })

  it('DEFAULT_OPTIONS 字段合理', () => {
    expect(DEFAULT_OPTIONS.format).toBe('CODE128')
    expect(DEFAULT_OPTIONS.width).toBeGreaterThan(0)
    expect(DEFAULT_OPTIONS.height).toBeGreaterThan(0)
  })
})

describe('barcode/generate · validateValue', () => {
  it('空值拒绝', () => {
    expect(validateValue('CODE128', '   ').ok).toBe(false)
  })

  it('CODE128 接受任意 ASCII', () => {
    expect(validateValue('CODE128', 'Hello-123!').ok).toBe(true)
  })

  it('EAN13 需 12 或 13 位数字', () => {
    expect(validateValue('EAN13', '400638133393').ok).toBe(true) // 12
    expect(validateValue('EAN13', '4006381333931').ok).toBe(true) // 13
    expect(validateValue('EAN13', '123').ok).toBe(false)
    expect(validateValue('EAN13', 'abcabcabcabc').ok).toBe(false)
  })

  it('EAN8 需 7 或 8 位数字', () => {
    expect(validateValue('EAN8', '9638507').ok).toBe(true)
    expect(validateValue('EAN8', '96385074').ok).toBe(true)
    expect(validateValue('EAN8', '963').ok).toBe(false)
  })

  it('UPC 需 11 或 12 位数字', () => {
    expect(validateValue('UPC', '03600029145').ok).toBe(true)
    expect(validateValue('UPC', '036000291452').ok).toBe(true)
    expect(validateValue('UPC', '36000').ok).toBe(false)
  })

  it('pharmacode 限定 3–131070', () => {
    expect(validateValue('pharmacode', '1234').ok).toBe(true)
    expect(validateValue('pharmacode', '2').ok).toBe(false)
    expect(validateValue('pharmacode', '200000').ok).toBe(false)
  })

  it('CODE39 拒绝小写字母', () => {
    expect(validateValue('CODE39', 'ABC-123').ok).toBe(true)
    expect(validateValue('CODE39', 'abc').ok).toBe(false)
  })

  it('MSI 仅数字', () => {
    expect(validateValue('MSI', '1234567').ok).toBe(true)
    expect(validateValue('MSI', '12a').ok).toBe(false)
  })
})
