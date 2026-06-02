import { describe, it, expect } from 'vitest'
import {
  CHUNK_SIZE,
  totalChunks,
  buildMetaFrame,
  buildTextFrame,
  buildDoneFrame,
  parseControlFrame,
} from '../transfer'

describe('totalChunks', () => {
  it('按 CHUNK_SIZE 向上取整', () => {
    expect(totalChunks(0)).toBe(0)
    expect(totalChunks(1)).toBe(1)
    expect(totalChunks(CHUNK_SIZE)).toBe(1)
    expect(totalChunks(CHUNK_SIZE + 1)).toBe(2)
  })
})

describe('control frame 构造与解析往返', () => {
  it('meta 帧', () => {
    const s = buildMetaFrame({ id: 'a', name: 'x.png', size: 100, mime: 'image/png', chunks: 7 })
    const f = parseControlFrame(s)
    expect(f).toEqual({ type: 'meta', id: 'a', name: 'x.png', size: 100, mime: 'image/png', chunks: 7 })
  })

  it('text 帧', () => {
    const s = buildTextFrame('b', '你好 world')
    expect(parseControlFrame(s)).toEqual({ type: 'text', id: 'b', content: '你好 world' })
  })

  it('done 帧', () => {
    expect(parseControlFrame(buildDoneFrame('c'))).toEqual({ type: 'done', id: 'c' })
  })

  it('非法 JSON 返回 null', () => {
    expect(parseControlFrame('{not json')).toBeNull()
  })

  it('未知 type 返回 null', () => {
    expect(parseControlFrame(JSON.stringify({ type: 'xxx' }))).toBeNull()
  })
})