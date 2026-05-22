import { describe, it, expect } from 'vitest'
import { calcResizedDims } from '../dimensions'

describe('calcResizedDims — 等比缩放计算', () => {
  it('横图：1600x900 -> maxDim 800，按宽缩放', () => {
    const r = calcResizedDims(1600, 900, 800)
    expect(r.width).toBe(800)
    // 900 * (800/1600) = 450
    expect(r.height).toBe(450)
    expect(r.scale).toBeCloseTo(0.5, 5)
    expect(r.resized).toBe(true)
  })

  it('纵图：900x1600 -> maxDim 800，按高缩放', () => {
    const r = calcResizedDims(900, 1600, 800)
    expect(r.height).toBe(800)
    // 900 * (800/1600) = 450
    expect(r.width).toBe(450)
    expect(r.resized).toBe(true)
  })

  it('小于 maxDim：320x240 -> maxDim 1024，原样不放大', () => {
    const r = calcResizedDims(320, 240, 1024)
    expect(r.width).toBe(320)
    expect(r.height).toBe(240)
    expect(r.scale).toBe(1)
    expect(r.resized).toBe(false)
  })

  it('正方形：1024x1024 -> maxDim 512，两边都缩到 512', () => {
    const r = calcResizedDims(1024, 1024, 512)
    expect(r.width).toBe(512)
    expect(r.height).toBe(512)
    expect(r.scale).toBeCloseTo(0.5, 5)
    expect(r.resized).toBe(true)
  })

  it('超大：8000x6000 -> maxDim 1024，按宽缩到 1024', () => {
    const r = calcResizedDims(8000, 6000, 1024)
    expect(r.width).toBe(1024)
    // 6000 * (1024/8000) = 768
    expect(r.height).toBe(768)
    expect(r.resized).toBe(true)
  })

  it('恰好等于 maxDim：800x600 -> maxDim 800，不缩放', () => {
    const r = calcResizedDims(800, 600, 800)
    expect(r.width).toBe(800)
    expect(r.height).toBe(600)
    expect(r.resized).toBe(false)
  })

  it('非法入参：抛错而非静默', () => {
    expect(() => calcResizedDims(0, 600, 800)).toThrow()
    expect(() => calcResizedDims(800, -1, 800)).toThrow()
    expect(() => calcResizedDims(800, 600, 0)).toThrow()
    expect(() => calcResizedDims(NaN, 600, 800)).toThrow()
  })
})
