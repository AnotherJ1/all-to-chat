import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { usePasteImage } from '../usePasteImage'

afterEach(cleanup)

/** 测试组件：把 hook 挂上，回调记录到外部 spy */
function Harness({ onImages, enabled }: { onImages: (f: File[]) => void; enabled?: boolean }) {
  usePasteImage(onImages, enabled)
  return null
}

/** 构造一个带 image 文件项的 paste 事件 */
function makePasteEvent(files: File[]): Event {
  const items = files.map((f) => ({
    kind: 'file' as const,
    type: f.type,
    getAsFile: () => f,
  }))
  const e = new Event('paste') as Event & { clipboardData: unknown }
  e.clipboardData = { items }
  return e
}

const imgFile = (name = 'a.png') => new File(['x'], name, { type: 'image/png' })

describe('usePasteImage', () => {
  it('粘贴图片时回调收到文件', () => {
    const spy = vi.fn()
    render(<Harness onImages={spy} />)
    window.dispatchEvent(makePasteEvent([imgFile()]))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toHaveLength(1)
    expect(spy.mock.calls[0][0][0].type).toBe('image/png')
  })

  it('多张图片一次性传入', () => {
    const spy = vi.fn()
    render(<Harness onImages={spy} />)
    window.dispatchEvent(makePasteEvent([imgFile('a.png'), imgFile('b.png')]))
    expect(spy.mock.calls[0][0]).toHaveLength(2)
  })

  it('非图片项被忽略，不触发回调', () => {
    const spy = vi.fn()
    render(<Harness onImages={spy} />)
    const e = new Event('paste') as Event & { clipboardData: unknown }
    e.clipboardData = { items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }] }
    window.dispatchEvent(e)
    expect(spy).not.toHaveBeenCalled()
  })

  it('enabled=false 时不监听', () => {
    const spy = vi.fn()
    render(<Harness onImages={spy} enabled={false} />)
    window.dispatchEvent(makePasteEvent([imgFile()]))
    expect(spy).not.toHaveBeenCalled()
  })

  it('卸载后不再触发', () => {
    const spy = vi.fn()
    const { unmount } = render(<Harness onImages={spy} />)
    unmount()
    window.dispatchEvent(makePasteEvent([imgFile()]))
    expect(spy).not.toHaveBeenCalled()
  })
})
